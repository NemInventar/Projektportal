// Edge function: generate-living-description
//
// Genererer en sælgende, levende beskrivelse til en tilbudslinje via Gemini.
// Tone tilpasses recipient_profile på det overordnede tilbud.
//
// Deploy via Supabase Dashboard → Edge Functions → New function
// Funktionsnavn i Dashboard: "generate-living-description"
//
// Required env-vars (sættes på edge function i Dashboard):
//   SUPABASE_URL                  (default — sættes automatisk)
//   SUPABASE_SERVICE_ROLE_KEY     (default — sættes automatisk)
//   GEMINI_API_KEY                (skal sættes manuelt)
//
// Kald fra GUI:
//   supabase.functions.invoke('generate-living-description', {
//     body: { quote_line_id: '<uuid>' }
//   })

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
};

const TONE_BY_PROFILE: Record<string, string> = {
  architect: 'præcis, detaljeret, materiale- og designfagligt sprog. Fremhæv håndværkets kvalitet, materialevalg og helhedsindtryk i en tone der respekterer arkitekt-fagligheden.',
  contractor: 'pragmatisk, faktuel og funktionel. Fokus på kvalitet, holdbarhed og leveringssikkerhed — ikke poetisk.',
  enduser: 'varmt, beskrivende og oplevelsesorienteret. Fortæl hvordan løsningen vil opleves i hverdagen, men hold det jordnært og konkret.',
  mixed: 'professionelt og indbydende — balanceret mellem æstetik og funktion, så det virker både for fagfolk og slutkunder.',
};

const MODEL = 'gemini-2.5-flash';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const quoteLineId: string | undefined = body?.quote_line_id;
    if (!quoteLineId) {
      return new Response(JSON.stringify({ error: 'quote_line_id er påkrævet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      console.error('GEMINI_API_KEY ikke sat på edge function');
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY ikke konfigureret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Hent linje
    const { data: line, error: lineErr } = await supabase
      .from('project_quote_lines_2026_01_16_23_00')
      .select('id, title, description, project_quote_id')
      .eq('id', quoteLineId)
      .single();

    if (lineErr || !line) {
      return new Response(JSON.stringify({ error: 'Tilbudslinje ikke fundet' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Hent tilbud (for recipient_profile + recipient_notes)
    const { data: quote } = await supabase
      .from('project_quotes_2026_01_16_23_00')
      .select('recipient_profile, recipient_notes, title, project_id')
      .eq('id', line.project_quote_id)
      .single();

    const profile = (quote?.recipient_profile as string) || 'mixed';
    const tone = TONE_BY_PROFILE[profile] || TONE_BY_PROFILE.mixed;
    const recipientNotes = quote?.recipient_notes
      ? `\n\nSærlige hensyn til modtager: ${quote.recipient_notes}`
      : '';
    const projectContext = quote?.title ? `\n\nProjekt-kontekst: ${quote.title}` : '';

    // 3. Byg prompt
    const prompt = `Du er sælger hos en dansk snedkervirksomhed (Nem Inventar ApS) og skriver levende, sælgende beskrivelser til kundebilag.

Opgave: Skriv én flydende, sælgende beskrivelse (3-5 sætninger, dansk) til denne tilbudslinje, så modtageren får lyst til at sige ja. Beskriv hvordan det opleves og hvilken kvalitet der ligger bag — ikke en gentagelse af den tekniske spec.

Tone: ${tone}${recipientNotes}${projectContext}

Tilbudslinje-titel: ${line.title}

Teknisk beskrivelse (brug som fakta-kontekst, men gentag ikke ord-for-ord): ${line.description || '(ingen yderligere teknisk beskrivelse)'}

Skriv KUN selve beskrivelsen som flydende tekst på dansk. Ingen header, ingen punktopstilling, ingen citationstegn.`;

    // 4. Kald Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
          topP: 0.95,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return new Response(JSON.stringify({ error: `Gemini API fejlede (${geminiRes.status})`, detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();
    const generated: string | undefined = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generated) {
      console.error('Gemini returned empty:', JSON.stringify(geminiData));
      return new Response(JSON.stringify({ error: 'Tomt svar fra Gemini' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Gem til DB
    const generatedAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('project_quote_lines_2026_01_16_23_00')
      .update({
        living_description: generated,
        living_description_generated_at: generatedAt,
        living_description_edited: false,
      })
      .eq('id', quoteLineId);

    if (updateErr) {
      console.error('DB update fejlede:', updateErr);
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        living_description: generated,
        generated_at: generatedAt,
        model: MODEL,
        recipient_profile: profile,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Uventet fejl:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
