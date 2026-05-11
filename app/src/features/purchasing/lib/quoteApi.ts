/**
 * Quote API-lag.
 *
 * Upsert-baseret — re-parsing af samme mail (eller manuel korrektion)
 * skal kunne overskrive. `(rfq_id, supplier_id)` er unique på `project_quotes`
 * og `(quote_id, rfq_line_id)` er unique på `project_quote_lines`.
 *
 * Total-mode: `total_price` er primær. `unit_price` er GENERATED i DB —
 * sendes aldrig med i INSERT/UPDATE (derfor udeladt i input-typerne).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  QUOTE_TABLE,
  QUOTE_LINES_TABLE,
  RFQ_TABLE,
  type Quote,
  type QuoteLine,
  type UpsertQuoteInput,
  type UpsertQuoteLineInput,
} from '../types';

/**
 * Upsert en quote på (rfq_id, supplier_id). Returnerer den (evt. opdaterede)
 * række.
 */
export async function upsertQuote(input: UpsertQuoteInput): Promise<Quote> {
  const payload = {
    rfq_id: input.rfq_id,
    supplier_id: input.supplier_id,
    status: input.status ?? 'received',
    received_at: input.received_at ?? null,
    valid_until: input.valid_until ?? null,
    currency: input.currency ?? 'DKK',
    lead_time_days: input.lead_time_days ?? null,
    payment_terms: input.payment_terms ?? null,
    delivery_terms: input.delivery_terms ?? null,
    total_price: input.total_price ?? null,
    notes: input.notes ?? null,
    source_email_id: input.source_email_id ?? null,
    source_email_received_at: input.source_email_received_at ?? null,
    raw_source_text: input.raw_source_text ?? null,
    needs_review: input.needs_review ?? false,
    created_by: input.created_by ?? 'human',
    pdf_url: input.pdf_url ?? null,
    pdf_filename: input.pdf_filename ?? null,
  };

  const { data, error } = await supabase
    .from(QUOTE_TABLE)
    .upsert(payload, { onConflict: 'rfq_id,supplier_id' })
    .select()
    .single();

  if (error) throw error;
  return data as Quote;
}

/**
 * Batch upsert quote_lines for én quote på (quote_id, rfq_line_id).
 * Slår alle linjer op og returnerer den resulterende række fra DB
 * (inkl. beregnet `unit_price`).
 */
export async function upsertQuoteLines(
  quoteId: string,
  lines: UpsertQuoteLineInput[],
): Promise<QuoteLine[]> {
  if (lines.length === 0) return [];

  const payload = lines.map((l) => ({
    quote_id: quoteId,
    rfq_line_id: l.rfq_line_id,
    total_price: l.total_price ?? null,
    quoted_qty: l.quoted_qty ?? null,
    unit: l.unit ?? null,
    lead_time_days: l.lead_time_days ?? null,
    min_qty: l.min_qty ?? null,
    alternative_offered: l.alternative_offered ?? false,
    alternative_note: l.alternative_note ?? null,
    declined: l.declined ?? false,
    notes: l.notes ?? null,
    // unit_price udelades bevidst — GENERATED i DB.
  }));

  const { data, error } = await supabase
    .from(QUOTE_LINES_TABLE)
    .upsert(payload, { onConflict: 'quote_id,rfq_line_id' })
    .select();

  if (error) throw error;
  return (data ?? []) as QuoteLine[];
}

/**
 * Review-kø: alle quotes med needs_review=true for projektets RFQs.
 * Join'es via RFQ for at filtrere på project_id.
 */
export async function listReviewQueue(projectId: string): Promise<Quote[]> {
  // Supabase kan filtrere på FK-relation via punktnotation:
  // rfq:RFQ_TABLE!inner(project_id) → alias + inner join.
  const { data, error } = await supabase
    .from(QUOTE_TABLE)
    .select(
      `
      *,
      rfq:${RFQ_TABLE}!inner(project_id)
    `,
    )
    .eq('needs_review', true)
    .eq(`rfq.project_id`, projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fjern det joinede felt før vi returnerer — callers forventer rene Quote'er.
  return (data ?? []).map((row) => {
    const { rfq: _rfq, ...quote } = row as Quote & { rfq: unknown };
    return quote as Quote;
  });
}

/**
 * Godkend en auto-genereret quote. Sæt needs_review=false + reviewer-fingerprint.
 */
export async function approveQuote(
  quoteId: string,
  reviewedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from(QUOTE_TABLE)
    .update({
      needs_review: false,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) throw error;
}

/**
 * Afvis og slet en quote. Cascader til quote_lines i DB.
 */
export async function rejectQuote(quoteId: string): Promise<void> {
  const { error } = await supabase.from(QUOTE_TABLE).delete().eq('id', quoteId);
  if (error) throw error;
}

/**
 * Tildel vindende quote(s). Sætter angivne quotes til `selected`, alle
 * øvrige quotes på samme RFQ til `lost`, og RFQ-status til `awarded`.
 *
 * Split tilladt: flere winningQuoteIds er OK.
 */
export async function assignWinners(
  rfqId: string,
  winningQuoteIds: string[],
): Promise<void> {
  // 1) Hent alle quotes på RFQ'en for at finde taberne.
  const { data: allQuotes, error: listErr } = await supabase
    .from(QUOTE_TABLE)
    .select('id')
    .eq('rfq_id', rfqId);

  if (listErr) throw listErr;

  const losingIds = (allQuotes ?? [])
    .map((q) => (q as { id: string }).id)
    .filter((id) => !winningQuoteIds.includes(id));

  // 2) Markér vindere som selected.
  if (winningQuoteIds.length > 0) {
    const { error: winErr } = await supabase
      .from(QUOTE_TABLE)
      .update({ status: 'selected' })
      .in('id', winningQuoteIds);
    if (winErr) throw winErr;
  }

  // 3) Markér tabere som lost.
  if (losingIds.length > 0) {
    const { error: lostErr } = await supabase
      .from(QUOTE_TABLE)
      .update({ status: 'lost' })
      .in('id', losingIds);
    if (lostErr) throw lostErr;
  }

  // 4) Markér RFQ'en som awarded.
  const { error: rfqErr } = await supabase
    .from(RFQ_TABLE)
    .update({ status: 'awarded' })
    .eq('id', rfqId);
  if (rfqErr) throw rfqErr;
}
