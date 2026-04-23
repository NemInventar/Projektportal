/**
 * RFQ API-lag.
 *
 * Rene Supabase-kald. Ingen React, ingen state. Alle funktioner kaster ved fejl
 * — PurchasingContext er ansvarlig for fejl-håndtering + toasts.
 *
 * DB-skema fra INDKOB_PLAN.md §2. Tabeller er suffix _2026_04_23_10_00.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  RFQ_TABLE,
  RFQ_LINES_TABLE,
  RFQ_SUPPLIERS_TABLE,
  QUOTE_TABLE,
  QUOTE_LINES_TABLE,
  type CreateRfqInput,
  type CreateRfqLineInput,
  type Rfq,
  type RfqLine,
  type RfqStatus,
  type RfqSupplier,
  type RfqWithRelations,
  type UpdateRfqInput,
} from '../types';
import { assertCanTransitionRfq } from './statusTransitions';

/**
 * List alle RFQs for et projekt, nyeste først.
 */
export async function listRfqs(projectId: string): Promise<Rfq[]> {
  const { data, error } = await supabase
    .from(RFQ_TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Rfq[];
}

/**
 * Hent en RFQ med alle relationer (linjer, suppliers, quotes + quote_lines).
 * Bruger Supabase nested select (FK-joins).
 */
export async function getRfqWithRelations(rfqId: string): Promise<RfqWithRelations> {
  // Hent hoved-rfq + linjer + suppliers via ét kald.
  const { data: rfqRow, error: rfqErr } = await supabase
    .from(RFQ_TABLE)
    .select(
      `
      *,
      lines:${RFQ_LINES_TABLE}(*),
      suppliers:${RFQ_SUPPLIERS_TABLE}(*)
    `,
    )
    .eq('id', rfqId)
    .single();

  if (rfqErr) throw rfqErr;
  if (!rfqRow) throw new Error(`RFQ med id ${rfqId} findes ikke`);

  // Hent quotes + quote_lines separat (nested join af 3 niveauer bliver
  // let mudret med aliaser; 2 kald er klarere end ét monster-query).
  const { data: quoteRows, error: quoteErr } = await supabase
    .from(QUOTE_TABLE)
    .select(
      `
      *,
      lines:${QUOTE_LINES_TABLE}(*)
    `,
    )
    .eq('rfq_id', rfqId);

  if (quoteErr) throw quoteErr;

  const typed = rfqRow as Rfq & {
    lines: RfqLine[] | null;
    suppliers: RfqSupplier[] | null;
  };

  const lines = (typed.lines ?? []).slice().sort((a, b) => a.line_no - b.line_no);
  const suppliers = typed.suppliers ?? [];
  const quotes = (quoteRows ?? []).map((q) => ({
    ...(q as unknown as RfqWithRelations['quotes'][number]),
    lines: ((q as { lines?: unknown[] }).lines ?? []) as RfqWithRelations['quotes'][number]['lines'],
  }));

  return {
    ...(rfqRow as Rfq),
    lines,
    suppliers,
    quotes,
  };
}

/**
 * Opret en ny RFQ. Default status = `draft`, default created_by = `human`.
 */
export async function createRfq(input: CreateRfqInput): Promise<Rfq> {
  const { data, error } = await supabase
    .from(RFQ_TABLE)
    .insert({
      project_id: input.project_id,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'draft',
      deadline: input.deadline ?? null,
      first_delivery_date: input.first_delivery_date ?? null,
      last_delivery_date: input.last_delivery_date ?? null,
      payment_terms: input.payment_terms ?? null,
      budget_hint_total: input.budget_hint_total ?? null,
      currency: input.currency ?? 'DKK',
      notes: input.notes ?? null,
      created_by: input.created_by ?? 'human',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Rfq;
}

/**
 * Opdatér felter på en RFQ. Brug `updateRfqStatus` til status-ændringer
 * (den validerer overgangen).
 */
export async function updateRfq(id: string, patch: UpdateRfqInput): Promise<void> {
  const { error } = await supabase.from(RFQ_TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Tilføj en linje til en RFQ. Tildeler automatisk næste `line_no`
 * ved at slå nuværende max op.
 */
export async function addRfqLine(
  rfqId: string,
  line: CreateRfqLineInput,
): Promise<RfqLine> {
  // Find næste line_no
  const { data: existing, error: listErr } = await supabase
    .from(RFQ_LINES_TABLE)
    .select('line_no')
    .eq('rfq_id', rfqId)
    .order('line_no', { ascending: false })
    .limit(1);

  if (listErr) throw listErr;
  const nextLineNo = (existing?.[0]?.line_no ?? 0) + 1;

  const { data, error } = await supabase
    .from(RFQ_LINES_TABLE)
    .insert({
      rfq_id: rfqId,
      line_no: nextLineNo,
      project_material_id: line.project_material_id ?? null,
      name: line.name,
      description: line.description ?? null,
      qty: line.qty,
      unit: line.unit,
      spec: line.spec ?? null,
      budget_hint_total: line.budget_hint_total ?? null,
      notes: line.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RfqLine;
}

/**
 * Fjern en RFQ-linje. Cascader til quote_lines i DB.
 */
export async function removeRfqLine(lineId: string): Promise<void> {
  const { error } = await supabase.from(RFQ_LINES_TABLE).delete().eq('id', lineId);
  if (error) throw error;
}

/**
 * Inviter en leverandør til en RFQ. Opretter en rfq_supplier-række
 * med `invite_status='invited'` og `invited_at=now()`.
 *
 * Contact-felter er snapshots — typisk kopieret fra standard_suppliers
 * af kalder før kaldet.
 */
export async function inviteSupplier(
  rfqId: string,
  supplierId: string,
  contactEmail?: string | null,
  contactPerson?: string | null,
): Promise<RfqSupplier> {
  const { data, error } = await supabase
    .from(RFQ_SUPPLIERS_TABLE)
    .insert({
      rfq_id: rfqId,
      supplier_id: supplierId,
      invite_status: 'invited',
      invited_at: new Date().toISOString(),
      contact_email: contactEmail ?? null,
      contact_person: contactPerson ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RfqSupplier;
}

/**
 * Fjern en leverandør-invitation (bruges fra RFQCreateWizard inden afsendelse).
 * RESTRICT FK forhindrer sletning hvis leverandøren allerede har quotes.
 */
export async function removeSupplierInvite(rfqSupplierId: string): Promise<void> {
  const { error } = await supabase
    .from(RFQ_SUPPLIERS_TABLE)
    .delete()
    .eq('id', rfqSupplierId);
  if (error) throw error;
}

/**
 * Felter der må opdateres på en rfq_supplier-række.
 * Bruges bl.a. af SendRFQDialog til at markere leverandører som inviteret.
 */
export type UpdateSupplierInviteInput = Partial<{
  invite_status: RfqSupplier['invite_status'];
  invited_at: string | null;
  reminded_at: string | null;
  contact_email: string | null;
  contact_person: string | null;
  notes: string | null;
}>;

/**
 * Opdatér en rfq_supplier-invitation (status, timestamps, kontakt-snapshots).
 */
export async function updateSupplierInvite(
  rfqSupplierId: string,
  patch: UpdateSupplierInviteInput,
): Promise<void> {
  const { error } = await supabase
    .from(RFQ_SUPPLIERS_TABLE)
    .update(patch)
    .eq('id', rfqSupplierId);
  if (error) throw error;
}

/**
 * Opdatér RFQ-status med validering af overgangen.
 * Slår nuværende status op og kaster hvis overgangen er ugyldig.
 */
export async function updateRfqStatus(id: string, status: RfqStatus): Promise<void> {
  const { data: current, error: readErr } = await supabase
    .from(RFQ_TABLE)
    .select('status')
    .eq('id', id)
    .single();

  if (readErr) throw readErr;
  if (!current) throw new Error(`RFQ med id ${id} findes ikke`);

  assertCanTransitionRfq((current as { status: RfqStatus }).status, status);

  const { error } = await supabase
    .from(RFQ_TABLE)
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
