// Edge function: generate-quote-pdf
//
// Headless tilbuds-PDF generator. Returnerer signed URL til en PDF i 'quote-pdfs' bucket.
// Designet til at blive kaldt fra Claude Code / Claude Desktop skills med service-role-key.
//
// Deploy: supabase functions deploy generate-quote-pdf (kør fra app/ mappen)
//
// Required env-vars (sættes automatisk af Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Kald:
//   POST /functions/v1/generate-quote-pdf
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//   Body: { quote_id: string, format: 'pdf' | 'bilag' | 'pdf+bilag' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

interface LineItemRow {
  id: string;
  qty: number | string;
  cost_total_per_unit: number | string | null;
  cost_breakdown_json: Record<string, number> | null;
}

interface LineRow {
  id: string;
  title: string;
  description: string | null;
  quantity: number | string;
  unit: string;
  display_order: number | null;
  sort_order: number | null;
  created_at: string;
  archived: boolean | null;
  pricing_mode: string | null;
  markup_pct: number | string | null;
  target_unit_price: number | string | null;
  risk_per_unit: number | string | null;
  living_description: string | null;
  technical_spec: string | null;
  custom_image_url: string | null;
  custom_image_caption: string | null;
  render_image_url: string | null;
  active_image_source: 'render' | 'custom' | 'none' | null;
  include_in_appendix: boolean | null;
  project_quote_line_items_2026_01_16_23_00: LineItemRow[];
}

interface QuoteRow {
  id: string;
  project_id: string;
  quote_number: string;
  title: string;
  created_at: string;
  valid_until: string | null;
  company_id: string | null;
  customer_contact_name: string | null;
  resolved_payment_terms: string | null;
  resolved_delivery_period: string | null;
  resolved_reservations: string | null;
  resolved_quote_date: string | null;
  resolved_payment_terms_template: string | null;
  payment_terms_template: string | null;
  intro_text: string | null;
  customer_remarks: string | null;
  appendix_intro_text: string | null;
  customer_delivery_note: string | null;
  recipient_name: string | null;
  created_by_name_resolved: string | null;
  created_by_email_resolved: string | null;
  created_by_phone_resolved: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  created_by_phone: string | null;
  // Denormalized company fields (already on the view)
  company_name: string | null;
  company_cvr: string | null;
  company_address_line1: string | null;
  company_address_zip: string | null;
  company_address_city: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  project_number: string | null;
  customer: string | null;
}

interface LoadedQuoteData {
  quote: QuoteRow;
  lines: LineRow[];
  project: ProjectRow;
  // Set ONLY when recipient_name AND customer_contact_name are both null (fallback chain).
  // Otherwise null — saves a round-trip.
  companyDefaultContactName: string | null;
}

async function loadQuoteData(
  supabase: ReturnType<typeof createClient>,
  quoteId: string,
): Promise<LoadedQuoteData | { error: string; status: number }> {
  // 1. Quote from v_quotes_resolved (includes denormalized company_* fields)
  const { data: quote, error: quoteErr } = await supabase
    .from('v_quotes_resolved')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (quoteErr) {
    console.error('Quote-load fejlede:', quoteErr);
    return { error: 'Kunne ikke læse tilbud', status: 500 };
  }
  if (!quote) {
    return { error: 'Tilbud ikke fundet', status: 404 };
  }

  // 2. Lines + nested items (matches GUI's pattern)
  const { data: linesData, error: linesErr } = await supabase
    .from('project_quote_lines_2026_01_16_23_00')
    .select(`
      *,
      project_quote_line_items_2026_01_16_23_00(*)
    `)
    .eq('project_quote_id', quoteId)
    .neq('archived', true)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (linesErr) {
    console.error('Lines-load fejlede:', linesErr);
    return { error: 'Kunne ikke læse tilbudslinjer', status: 500 };
  }

  // 3. Project
  const { data: project, error: projErr } = await supabase
    .from('projects_2026_01_15_06_45')
    .select('id, name, project_number, customer')
    .eq('id', (quote as any).project_id)
    .maybeSingle();

  if (projErr || !project) {
    console.error('Project-load fejlede:', projErr);
    return { error: 'Kunne ikke læse projekt', status: 500 };
  }

  // 4. Company default_contact_name fallback — only when both recipient_name and
  //    customer_contact_name are null on the quote. Saves a round-trip in the common case.
  let companyDefaultContactName: string | null = null;
  const q = quote as any;
  if (
    !q.recipient_name &&
    !q.customer_contact_name &&
    q.company_id
  ) {
    const { data: companyData } = await supabase
      .from('companies_2026_04_27')
      .select('default_contact_name')
      .eq('id', q.company_id)
      .maybeSingle();
    companyDefaultContactName = (companyData as any)?.default_contact_name ?? null;
  }

  return {
    quote: quote as QuoteRow,
    lines: (linesData ?? []) as LineRow[],
    project: project as ProjectRow,
    companyDefaultContactName,
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
};

type Format = 'pdf' | 'bilag' | 'pdf+bilag';
const VALID_FORMATS: Format[] = ['pdf', 'bilag', 'pdf+bilag'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const quoteId: string | undefined = body?.quote_id;
    const format: Format = (body?.format ?? 'pdf') as Format;

    if (!quoteId) {
      return jsonResponse({ error: 'quote_id er påkrævet' }, 400);
    }
    if (!VALID_FORMATS.includes(format)) {
      return jsonResponse({
        error: `format skal være en af: ${VALID_FORMATS.join(', ')}`,
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const loaded = await loadQuoteData(supabase, quoteId);
    if ('error' in loaded) {
      return jsonResponse({ error: loaded.error }, loaded.status);
    }

    // TODO: render PDF, upload, return signed URL
    return jsonResponse({
      _debug: 'data loaded',
      quote_number: loaded.quote.quote_number,
      project_name: loaded.project.name,
      project_number: loaded.project.project_number,
      company_name: loaded.quote.company_name,
      line_count: loaded.lines.length,
      first_line_item_count: loaded.lines[0]?.project_quote_line_items_2026_01_16_23_00?.length ?? 0,
      fallback_contact_used: loaded.companyDefaultContactName !== null,
    }, 200);

  } catch (err) {
    console.error('Uventet fejl:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
