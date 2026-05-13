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
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { QuotePDF } from './QuotePDF.tsx';
import { QuoteAppendixPDF } from './QuoteAppendixPDF.tsx';
import { calculateLine, pricingFromLine } from './quotePricing.ts';
import { PDFDocument } from 'pdf-lib';

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

function formatDk(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('da-DK').format(new Date(iso));
}

function lineEffectiveImageUrl(line: LineRow): string | null {
  if (line.active_image_source === 'custom') return line.custom_image_url ?? null;
  if (line.active_image_source === 'render') return line.render_image_url ?? null;
  if (line.active_image_source === 'none') return null;
  // Fallback when active_image_source is null/unknown: prefer custom > render
  return line.custom_image_url || line.render_image_url || null;
}

async function renderQuotePdf(loaded: LoadedQuoteData): Promise<Uint8Array> {
  const { quote, lines, project, companyDefaultContactName } = loaded;

  // Mirror GUI's buildQuotePdfBlob (ProjectQuoteDetail.tsx:2670-2725).
  const pdfLines = lines.map((line) => {
    const items = (line.project_quote_line_items_2026_01_16_23_00 ?? []).map((it) => ({
      qty: Number(it.qty ?? 0),
      cost_total_per_unit: it.cost_total_per_unit != null ? Number(it.cost_total_per_unit) : 0,
      cost_breakdown_json: it.cost_breakdown_json,
    }));
    const pricing = pricingFromLine(line);
    const t = calculateLine(items, Number(line.quantity ?? 0), pricing);
    return {
      title: line.title,
      description: line.description ?? undefined,
      quantity: Number(line.quantity ?? 0),
      unit: line.unit,
      sellingPricePerUnit: t.sellingPricePerUnit,
      totalSellingPrice: t.totalSellingPrice,
    };
  });

  const date = formatDk(quote.created_at);
  const validUntil = quote.valid_until ? formatDk(quote.valid_until) : null;

  const recipientName =
    quote.recipient_name ??
    quote.customer_contact_name ??
    companyDefaultContactName ??
    null;

  // Customer block: prefer denormalized company_* from v_quotes_resolved; fall back to project.customer; fall back to bare contact.
  const customer = quote.company_name
    ? {
        name: quote.company_name,
        cvr: quote.company_cvr ?? null,
        addressLine1: quote.company_address_line1 ?? null,
        addressZip: quote.company_address_zip ?? null,
        addressCity: quote.company_address_city ?? null,
        contactName: recipientName,
      }
    : project.customer
    ? { name: project.customer, contactName: recipientName }
    : { contactName: recipientName };

  const quoteDateStr = quote.resolved_quote_date ? formatDk(quote.resolved_quote_date) : date;

  const doc = React.createElement(QuotePDF as any, {
    projectName: project.name,
    quoteTitle: quote.title,
    quoteNumber: quote.quote_number,
    quoteDate: quoteDateStr,
    validUntil,
    lines: pdfLines,
    customer,
    paymentTerms: quote.resolved_payment_terms ?? null,
    deliveryPeriod: quote.resolved_delivery_period ?? null,
    deliveryNote: quote.customer_delivery_note ?? null,
    reservations: quote.resolved_reservations ?? null,
    paymentTermsTemplate: quote.resolved_payment_terms_template ?? quote.payment_terms_template ?? '50_50_levering',
    introText: quote.intro_text ?? null,
    notes: quote.customer_remarks ?? null,
    createdBy: {
      name: quote.created_by_name_resolved ?? quote.created_by_name ?? null,
      email: quote.created_by_email_resolved ?? quote.created_by_email ?? null,
      phone: quote.created_by_phone_resolved ?? quote.created_by_phone ?? null,
    },
  });

  // Use toBlob() (same path as GUI) — most reliable cross-runtime way to get bytes.
  // .toBuffer() in @react-pdf/renderer v4 returns a Node ReadableStream that requires manual
  // collection; .toBlob() returns a standard Blob that Deno can convert directly.
  const blob = await pdf(doc as any).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

async function renderAppendixPdf(loaded: LoadedQuoteData): Promise<Uint8Array> {
  const { quote, lines, project, companyDefaultContactName } = loaded;

  // Mirror GUI's buildAppendixPdfBlob (ProjectQuoteDetail.tsx:2753-2799).
  // Note: the appendix customer block uses a SLIGHTLY different fallback chain than the
  // main quote (no addressLine1/zip/city, only name + contactName).
  const customer = quote.company_name
    ? {
        name: quote.company_name,
        cvr: quote.company_cvr ?? null,
        contactName: quote.customer_contact_name ?? companyDefaultContactName ?? null,
      }
    : project.customer
    ? { name: project.customer, contactName: quote.customer_contact_name ?? null }
    : { contactName: quote.customer_contact_name ?? null };

  const sortedLines = [...lines]
    .filter((l) => l.include_in_appendix !== false)
    .sort((a, b) => {
      const aOrder = a.display_order;
      const bOrder = b.display_order;
      if (aOrder != null && bOrder != null) return aOrder - bOrder;
      if (aOrder != null) return -1;
      if (bOrder != null) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const appendixLines = sortedLines.map((line) => ({
    title: line.title,
    description: line.description ?? null,
    livingDescription: line.living_description ?? null,
    technicalSpec: line.technical_spec ?? null,
    imageUrl: lineEffectiveImageUrl(line),
    imageCaption:
      line.active_image_source === 'custom' ? line.custom_image_caption ?? null : null,
  }));

  const date = formatDk(quote.created_at);
  const quoteDateStr = quote.resolved_quote_date ? formatDk(quote.resolved_quote_date) : date;

  const doc = React.createElement(QuoteAppendixPDF as any, {
    projectName: project.name,
    quoteTitle: quote.title,
    quoteNumber: quote.quote_number,
    quoteDate: quoteDateStr,
    customer,
    lines: appendixLines,
    introText: quote.appendix_intro_text ?? null,
  });

  const blob = await pdf(doc as any).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

async function mergePdfs(quoteBytes: Uint8Array, appendixBytes: Uint8Array): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  const quoteDoc = await PDFDocument.load(quoteBytes);
  const appendixDoc = await PDFDocument.load(appendixBytes);

  const quotePages = await merged.copyPages(quoteDoc, quoteDoc.getPageIndices());
  quotePages.forEach((p) => merged.addPage(p));

  const appendixPages = await merged.copyPages(appendixDoc, appendixDoc.getPageIndices());
  appendixPages.forEach((p) => merged.addPage(p));

  return await merged.save();
}

const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

interface UploadResult {
  signed_url: string;
  expires_at: string;
  path: string;
  filename: string;
  file_size_bytes: number;
}

async function uploadAndSign(
  supabase: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  loaded: LoadedQuoteData,
  format: Format,
): Promise<UploadResult | { error: string; status: number }> {
  const { quote, project } = loaded;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}`;

  const projectNumber = project.project_number || 'unknown';
  const quoteNumber = quote.quote_number || quote.id.slice(0, 8);

  // Storage path: {project_number}/{quote_number}/{timestamp}_{format}.pdf
  const path = `${projectNumber}/${quoteNumber}/${timestamp}_${format}.pdf`;

  // Human-friendly download filename
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '-').replace(/^-+|-+$/g, '');
  const formatLabel = format === 'pdf' ? 'tilbud' : format === 'bilag' ? 'bilag' : 'tilbud+bilag';
  const filename = `${timestamp.replace('T', '_')}_${formatLabel}-${sanitize(project.name)}-${sanitize(quoteNumber)}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('quote-pdfs')
    .upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Storage upload fejlede:', uploadErr);
    return { error: `Storage upload fejlede: ${uploadErr.message}`, status: 502 };
  }

  const { data: signedData, error: signErr } = await supabase.storage
    .from('quote-pdfs')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
      download: filename,
    });

  if (signErr || !signedData?.signedUrl) {
    console.error('Signed URL generation fejlede:', signErr);
    return { error: 'Kunne ikke generere signed URL', status: 500 };
  }

  const expiresAt = new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  return {
    signed_url: signedData.signedUrl,
    expires_at: expiresAt,
    path,
    filename,
    file_size_bytes: bytes.byteLength,
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

    let pdfBytes: Uint8Array;
    if (format === 'pdf') {
      pdfBytes = await renderQuotePdf(loaded);
    } else if (format === 'bilag') {
      pdfBytes = await renderAppendixPdf(loaded);
    } else {
      // format === 'pdf+bilag' — render both, merge with pdf-lib
      const [quoteBytes, appendixBytes] = await Promise.all([
        renderQuotePdf(loaded),
        renderAppendixPdf(loaded),
      ]);
      pdfBytes = await mergePdfs(quoteBytes, appendixBytes);
    }

    const uploaded = await uploadAndSign(supabase, pdfBytes, loaded, format);
    if ('error' in uploaded) {
      return jsonResponse({ error: uploaded.error }, uploaded.status);
    }

    return jsonResponse({
      ...uploaded,
      quote_number: loaded.quote.quote_number,
      project_name: loaded.project.name,
      format,
    }, 200);

  } catch (err) {
    console.error('Uventet fejl:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
