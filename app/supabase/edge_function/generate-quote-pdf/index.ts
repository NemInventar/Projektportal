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

    // TODO: load data, render PDF, upload, return signed URL
    return jsonResponse({ error: 'Not yet implemented', quote_id: quoteId, format }, 501);

  } catch (err) {
    console.error('Uventet fejl:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
