/**
 * Purchasing (RFQ + Quotes) — type definitions.
 *
 * 1:1 match med DB-skemaet i INDKOB_PLAN.md (migration suffix _2026_04_23_10_00).
 *
 * Konventioner:
 * - Alle timestamps/dates er `string` (ISO) som de kommer fra Supabase.
 * - Numeriske felter der kan være NULL er `number | null` for at matche DB.
 * - `unit_price` er GENERATED i DB — må aldrig sættes via INSERT/UPDATE.
 * - Total-mode: `total_price` er primær på linje-niveau. `unit_price` afledes.
 */

// ---------------------------------------------------------------------------
// Tabel-navne (konstanter) — holder suffixet ét sted.
// ---------------------------------------------------------------------------

export const RFQ_TABLE = 'project_rfqs_2026_04_23_10_00';
export const RFQ_LINES_TABLE = 'project_rfq_lines_2026_04_23_10_00';
export const RFQ_SUPPLIERS_TABLE = 'project_rfq_suppliers_2026_04_23_10_00';
export const QUOTE_TABLE = 'project_quotes_2026_04_23_10_00';
export const QUOTE_LINES_TABLE = 'project_quote_lines_2026_04_23_10_00';

export const RFQ_ATTACHMENTS_BUCKET = 'rfq-attachments-2026-04-23';

// ---------------------------------------------------------------------------
// Unions (status-enums)
// ---------------------------------------------------------------------------

export type RfqStatus =
  | 'draft'
  | 'sent'
  | 'partially_received'
  | 'closed'
  | 'awarded'
  | 'cancelled';

export type InviteStatus =
  | 'invited'
  | 'reminded'
  | 'declined'
  | 'no_response'
  | 'responded';

export type QuoteStatus =
  | 'received'
  | 'declined'
  | 'expired'
  | 'selected'
  | 'lost';

export type CreatedBy = 'human' | 'claude_auto';

// ---------------------------------------------------------------------------
// Rækker — matcher DB 1:1 (snake_case for at matche rå Supabase-respons).
// ---------------------------------------------------------------------------

export interface Rfq {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: RfqStatus;
  deadline: string | null;
  first_delivery_date: string | null;
  last_delivery_date: string | null;
  payment_terms: string | null;
  budget_hint_total: number | null;
  currency: string;
  notes: string | null;
  created_by: CreatedBy;
  created_at: string;
  updated_at: string;
}

export interface RfqLine {
  id: string;
  rfq_id: string;
  line_no: number;
  project_material_id: string | null;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  spec: string | null;
  budget_hint_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfqSupplier {
  id: string;
  rfq_id: string;
  supplier_id: string;
  invite_status: InviteStatus;
  invited_at: string | null;
  reminded_at: string | null;
  contact_email: string | null;
  contact_person: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  rfq_id: string;
  supplier_id: string;
  status: QuoteStatus;
  received_at: string | null;
  valid_until: string | null;
  currency: string;
  lead_time_days: number | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  total_price: number | null;
  notes: string | null;

  // Automation hook 1 — source tracking / idempotens
  source_email_id: string | null;
  source_email_received_at: string | null;
  raw_source_text: string | null;

  // Automation hook 2 — review flag
  needs_review: boolean;
  created_by: CreatedBy;
  reviewed_by: string | null;
  reviewed_at: string | null;

  // Automation hook 3 — attachment
  pdf_url: string | null;
  pdf_filename: string | null;

  created_at: string;
  updated_at: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  rfq_line_id: string;
  total_price: number | null;
  quoted_qty: number | null;
  unit: string | null;
  /** GENERATED i DB: total_price / quoted_qty. Må ikke sendes i INSERT/UPDATE. */
  unit_price: number | null;
  lead_time_days: number | null;
  min_qty: number | null;
  alternative_offered: boolean;
  alternative_note: string | null;
  declined: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Aggregeret type — bruges af RFQ-detalje siden.
// ---------------------------------------------------------------------------

/** En quote som den hentes på en RFQ (med sine quote_lines). */
export interface QuoteWithLines extends Quote {
  lines: QuoteLine[];
}

/**
 * En fuldt hydreret RFQ med alle relationer.
 * Hentes via `getRfqWithRelations(rfqId)`.
 */
export interface RfqWithRelations extends Rfq {
  lines: RfqLine[];
  suppliers: RfqSupplier[];
  quotes: QuoteWithLines[];
}

// ---------------------------------------------------------------------------
// Input-typer (data til INSERT/UPDATE). Afviger fra række-typer ved at
// udelade auto-genererede kolonner (id, timestamps, unit_price).
// ---------------------------------------------------------------------------

/** Felter der må sættes når en RFQ oprettes. */
export type CreateRfqInput = {
  project_id: string;
  title: string;
  description?: string | null;
  status?: RfqStatus;
  deadline?: string | null;
  first_delivery_date?: string | null;
  last_delivery_date?: string | null;
  payment_terms?: string | null;
  budget_hint_total?: number | null;
  currency?: string;
  notes?: string | null;
  created_by?: CreatedBy;
};

export type UpdateRfqInput = Partial<Omit<CreateRfqInput, 'project_id'>>;

/** Felter der må sættes når en RFQ-linje oprettes (line_no tildeles af API). */
export type CreateRfqLineInput = {
  project_material_id?: string | null;
  name: string;
  description?: string | null;
  qty: number;
  unit: string;
  spec?: string | null;
  budget_hint_total?: number | null;
  notes?: string | null;
};

/** Felter der må sættes når en quote oprettes/upsertes. */
export type UpsertQuoteInput = {
  rfq_id: string;
  supplier_id: string;
  status?: QuoteStatus;
  received_at?: string | null;
  valid_until?: string | null;
  currency?: string;
  lead_time_days?: number | null;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  total_price?: number | null;
  notes?: string | null;
  source_email_id?: string | null;
  source_email_received_at?: string | null;
  raw_source_text?: string | null;
  needs_review?: boolean;
  created_by?: CreatedBy;
  pdf_url?: string | null;
  pdf_filename?: string | null;
};

/**
 * Felter der må sættes pr. quote-linje ved upsert.
 * `unit_price` er bevidst udeladt — afledes i DB.
 */
export type UpsertQuoteLineInput = {
  rfq_line_id: string;
  total_price?: number | null;
  quoted_qty?: number | null;
  unit?: string | null;
  lead_time_days?: number | null;
  min_qty?: number | null;
  alternative_offered?: boolean;
  alternative_note?: string | null;
  declined?: boolean;
  notes?: string | null;
};
