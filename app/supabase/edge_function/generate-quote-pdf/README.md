# generate-quote-pdf

Headless quote-PDF generator. Producerer identiske PDF'er til GUI'ens "Hent tilbud / bilag / tilbud+bilag"-knapper.

## Genbrug fra GUI

Følgende filer er KOPIER af deres GUI-modparter:
- `QuotePDF.tsx` ← `app/src/components/QuotePDF.tsx`
- `QuoteAppendixPDF.tsx` ← `app/src/components/QuoteAppendixPDF.tsx`
- `quotePricing.ts` ← `app/src/lib/quotePricing.ts`
- `company.ts` ← `app/src/config/company.ts`

**Hvis GUI-versionerne ændres, skal kopierne her opdateres.** Cross-reference-kommentarer i top af hver fil.

## Deploy

Fra `app/` mappen:

```bash
supabase functions deploy generate-quote-pdf --project-ref guhbrpektblabndqttgp
```

## Kald

```bash
curl -X POST \
  https://guhbrpektblabndqttgp.supabase.co/functions/v1/generate-quote-pdf \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"quote_id":"b333c002-3471-4c4c-ae79-b26cb7569570","format":"pdf+bilag"}'
```

## Response

```json
{
  "signed_url": "https://...supabase.co/storage/v1/object/sign/quote-pdfs/...?token=...",
  "expires_at": "2026-05-13T15:30:00.000Z",
  "path": "26013/T02/2026-05-13T1430_pdf+bilag.pdf",
  "filename": "2026-05-13_1430_tilbud+bilag-Langagerskolen-T02.pdf",
  "file_size_bytes": 1234567,
  "quote_number": "T02",
  "project_name": "Langagerskolen",
  "format": "pdf+bilag"
}
```

## Formater

- `pdf` — kun selve tilbuddet (matcher GUI's "Hent tilbud")
- `bilag` — kun bilag med billeder + levende beskrivelser (matcher "Hent bilag")
- `pdf+bilag` — begge flettet til ét dokument (matcher "Hent tilbud+bilag")
