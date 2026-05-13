# Design: Headless quote-PDF generation via Supabase Edge Function

_Status: design godkendt af Joachim 2026-05-13 — klar til implementeringsplan._
_Forfatter: brainstorm-flow med Joachim. Spec gemt 2026-05-13._

---

## Problem

I dag genereres tilbuds-PDF'er udelukkende fra GUI'en på `/project/quote/:id` ved at trykke på "Hent tilbud", "Hent bilag" eller "Hent tilbud+bilag". Det betyder at PDF-generering kræver at Joachim sidder i browseren med tilbuddet åbnet.

Joachim vil kunne udløse den samme PDF fra **chat-kontekst** (Claude Desktop / Claude Code / kommende tilbuds-skill). Når en chat-skill kalder funktionen, skal der lande et download-link til Joachims chat som han kan klikke for at få den **identiske** PDF som GUI-knappen ville have lavet.

## Mål og succes-kriterier

- En chat-skill kan POST'e `{ quote_id, format }` til en Supabase Edge Function og få et signed URL retur
- Genererede PDF'er er **bit-for-bit visuelt identiske** med GUI-output for samme tilbud
- Tre formater supporteres: `pdf` (kun tilbud), `bilag` (kun bilag), `pdf+bilag` (flettet)
- Ingen ændringer i GUI'en. Eksisterende PDF-knapper rør vi ikke
- Test-case: `quote_id = b333c002-3471-4c4c-ae79-b26cb7569570` (T02 på Langagerskolen 26013) genererer korrekt PDF til Casper Kirkemann @ Høgh & Sønberg

## Beslutninger taget i brainstorm (2026-05-13)

| # | Spørgsmål | Valgt |
|---|---|---|
| 1 | Render-strategi | **Kopier `QuotePDF.tsx`, `QuoteAppendixPDF.tsx`, `quotePricing.ts`, `COMPANY_INFO` ind i edge function-mappen.** Ingen build-step. Risiko: drift mellem GUI- og edge-kopi — afhjælpes med cross-reference-kommentarer i top af hver fil. |
| 2 | Return-mode | **Upload til Supabase Storage bucket `quote-pdfs/`, returner signed URL (gyldig 1 time).** PDF persisterer, kan deles videre, lille JSON-svar. |
| 3 | Deploy-mekanisme | **Supabase CLI fra mappen** (`supabase functions deploy generate-quote-pdf`). Folder-struktur med `index.ts` + helpers. |
| 4 | Format-support | **Alle tre** (`pdf`, `bilag`, `pdf+bilag`) — matcher GUI'ens tre knapper 1:1. |
| 5 | Auth | **Service-role-key i Authorization-header**, `verify_jwt = false` på funktionen. Funktionen er admin-only (skills, ikke browser-brugere). |

---

## Arkitektur

### Data-flow

```
Claude Code skill / Claude Desktop
   │  POST /functions/v1/generate-quote-pdf
   │  Authorization: Bearer <SERVICE_ROLE_KEY>
   │  Body: { quote_id: uuid, format: 'pdf' | 'bilag' | 'pdf+bilag' }
   ▼
Edge function (Deno + npm:@react-pdf/renderer + npm:react + npm:pdf-lib)
   │
   1. Validér input (uuid + format-enum)
   2. Hent quote fra v_quotes_resolved (resolved_* felter, intro_text, customer_remarks,
      appendix_intro_text, recipient_name, company_id, project_id, quote_number, valid_until)
   3. Hent lines fra project_quote_lines_2026_01_16_23_00 (alle relevante felter inkl.
      living_description, technical_spec, custom_image_url, ai_image_url, active_image_source,
      include_in_appendix, display_order, created_at, pricing-felter)
   4. Hent line items fra project_quote_line_items_2026_01_16_23_00 (qty, cost_breakdown_json,
      cost_total_per_unit) for hver line
   5. Hent project (name, customer fallback) + linkede company (name, cvr, address, contactName)
   6. For hver line: kør calculateLine(items, qty, pricing) → sellingPricePerUnit, totalSellingPrice
      Identisk med GUI's calculateLineTotals
   7. Render <QuotePDF .../> via @react-pdf/renderer → Uint8Array
   8. Hvis format !== 'pdf': render <QuoteAppendixPDF/> → Uint8Array
   9. Hvis format === 'pdf+bilag': flet via pdf-lib (samme mønster som GUI's
      handleDownloadCombined) → samlet Uint8Array
   10. Upload til Supabase Storage 'quote-pdfs' bucket
       Path: {project_number}/{quote_number}/{YYYY-MM-DDTHHmm}_{format}.pdf
   11. Generér signed URL (1 time gyldighed)
   │
   ▼
Response: { signed_url, expires_at, path, filename, file_size_bytes, quote_number, project_name, format }
```

### Filer

```
app/supabase/
├── config.toml                                 ← NY (registrerer funktion + verify_jwt=false)
└── edge_function/
    └── generate-quote-pdf/                     ← NY mappe
        ├── index.ts                            ← Entry point (serve handler)
        ├── QuotePDF.tsx                        ← KOPI af app/src/components/QuotePDF.tsx
        ├── QuoteAppendixPDF.tsx                ← KOPI af app/src/components/QuoteAppendixPDF.tsx
        ├── quotePricing.ts                     ← KOPI af app/src/lib/quotePricing.ts
        ├── company.ts                          ← KOPI af COMPANY_INFO fra app/src/config/company
        ├── deno.json                           ← npm-imports (react, @react-pdf/renderer, pdf-lib, supabase-js)
        └── README.md                           ← Dokumentation + cURL-eksempel
```

**Cross-reference-kommentar** i top af hver kopieret fil:
```typescript
// KOPI af app/src/components/QuotePDF.tsx (commit X)
// Skal holdes synkroniseret. Hvis GUI-versionen ændres, opdater også denne fil.
// Se generate-quote-pdf/README.md for hvorfor det er kopieret.
```

Tilsvarende kommentar i top af GUI-filerne:
```typescript
// Bemærk: Denne fil er også kopieret til app/supabase/edge_function/generate-quote-pdf/
// for headless PDF-generering. Hvis du ændrer her, opdater også kopien.
```

### Imports — konvertering ved kopiering

GUI-imports der skal ændres i kopierne:

| GUI-import | Edge-version |
|---|---|
| `from '@react-pdf/renderer'` | `from 'npm:@react-pdf/renderer@^4.0.0'` |
| `from '@/config/company'` | `from './company.ts'` |
| `from '@/lib/quotePricing'` | `from './quotePricing.ts'` |
| `import React from 'react'` (hvis tilstede) | `from 'npm:react@^18.0.0'` |

`pdf-lib` importeres via `'npm:pdf-lib@^1.17.0'` i `index.ts` (kun ved flet-flow).

---

## API-kontrakt

### Request

```http
POST /functions/v1/generate-quote-pdf
Host: guhbrpektblabndqttgp.supabase.co
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json

{
  "quote_id": "b333c002-3471-4c4c-ae79-b26cb7569570",
  "format": "pdf+bilag"
}
```

- `quote_id`: påkrævet, UUID. Skal eksistere i `project_quotes_2026_01_16_23_00`.
- `format`: påkrævet, enum (`pdf` | `bilag` | `pdf+bilag`).

### Response — 200 OK

```json
{
  "signed_url": "https://guhbrpektblabndqttgp.supabase.co/storage/v1/object/sign/quote-pdfs/26013/T02/2026-05-13T1430_pdf+bilag.pdf?token=...",
  "expires_at": "2026-05-13T15:30:00.000Z",
  "path": "26013/T02/2026-05-13T1430_pdf+bilag.pdf",
  "filename": "2026-05-13_1430_tilbud+bilag-Langagerskolen-T02.pdf",
  "file_size_bytes": 1234567,
  "quote_number": "T02",
  "project_name": "Langagerskolen",
  "format": "pdf+bilag"
}
```

### Fejl-responser

| Status | Body | Hvornår |
|---|---|---|
| 400 | `{ error: "quote_id er påkrævet" }` | Mangler input |
| 400 | `{ error: "format skal være pdf, bilag eller pdf+bilag" }` | Ugyldigt format |
| 401 | `{ error: "Unauthorized" }` | Mangler/ugyldig service-role-key |
| 404 | `{ error: "Tilbud ikke fundet" }` | quote_id eksisterer ikke |
| 500 | `{ error: "<detalje>" }` | PDF-render eller storage-upload fejlede |
| 502 | `{ error: "Storage upload fejlede" }` | Supabase Storage utilgængelig |

### cURL-eksempel

```bash
curl -X POST \
  https://guhbrpektblabndqttgp.supabase.co/functions/v1/generate-quote-pdf \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"quote_id":"b333c002-3471-4c4c-ae79-b26cb7569570","format":"pdf+bilag"}'
```

---

## Storage-opsætning

**Bucket:** `quote-pdfs`
- **Visibility:** Private (kun adgang via signed URLs)
- **File size limit:** 10 MB (samlet PDF + bilag forventes <5 MB)
- **Allowed mime types:** `application/pdf`

**Path-struktur:** `{project_number}/{quote_number}/{YYYY-MM-DDTHHmm}_{format}.pdf`
- Eksempel: `26013/T02/2026-05-13T1430_pdf+bilag.pdf`
- Samme tilbud akkumulerer historik (gamle PDF'er overskrives ikke)
- `project_number` og `quote_number` hentes fra `v_quotes_resolved`

**Retention:** PDF'er kan auto-slettes efter 30 dage via storage object lifecycle (kan opsættes senere, ikke V1-blocker). V1 manuel oprydning hvis det skal være.

**Adgang fra browser/skill:** Signed URLs gyldige 1 time. URL'en kan deles videre, men dør efter 1 time.

---

## Server-side beregninger

PDF-rendering kræver `sellingPricePerUnit` og `totalSellingPrice` pr. line. Disse er IKKE persisteret i `project_quote_lines` — de beregnes i JS via `calculateLine` fra `quotePricing.ts`.

I edge function'en (`index.ts`):

```typescript
import { calculateLine } from './quotePricing.ts';

for (const line of lines) {
  const items = lineItems.filter(i => i.quote_line_id === line.id);
  const sharedItems = items.map(it => ({
    qty: it.qty,
    cost_total_per_unit: it.cost_total_per_unit ?? null,
    cost_breakdown_json: it.cost_breakdown_json,
  }));
  const sharedPricing = line.pricing_mode ? {
    pricing_mode: line.pricing_mode === 'target_unit_price' ? 'target_unit_price' : 'markup_pct',
    markup_pct: line.markup_pct ?? 25,
    target_unit_price: line.target_unit_price ?? null,
    risk_per_unit: line.risk_per_unit ?? 0,
  } : null;
  const t = calculateLine(sharedItems, line.quantity, sharedPricing);
  // → t.sellingPricePerUnit, t.totalCostPerUnit, etc.
}
```

Logikken er **identisk** med GUI's `calculateLineTotals` i `ProjectQuoteDetail.tsx:1206-1278` — fordi vi kalder samme `calculateLine`-helper. Det er præcis derfor vi kopierer `quotePricing.ts` ind i edge-mappen.

### Data-assembly: bit-for-bit-paritet med GUI

Hele data-assembly-laget i edge function'en spejler `buildQuotePdfBlob` (`ProjectQuoteDetail.tsx:2670-2725`) og `buildAppendixPdfBlob` (`ProjectQuoteDetail.tsx:2753-2799`). Det inkluderer:

- **Recipient-fallback-kæde** (vigtigt!): `quote.recipient_name ?? quote.customer_contact_name ?? linkedCompany?.defaultContactName ?? null`
- **Customer-fallback**: linkedCompany (hvis `company_id`) → `project.customer` (hvis sat) → kun `contactName`
- **Date-format**: ISO → `da-DK` locale via `new Date(iso).toLocaleDateString('da-DK')`. I Deno bruges `Intl.DateTimeFormat('da-DK')` — samme output
- **Quote-date-resolve**: `quote.resolved_quote_date ?? quote.created_at`
- **Appendix line-sortering**: filter på `include_in_appendix !== false`, sortér på `display_order` derefter `created_at`
- **Image-source-select**: `lineEffectiveImageUrl(line)` — `active_image_source === 'custom'` → `custom_image_url`, ellers `ai_image_url`
- **Payment-terms-template fallback**: hvis `null` → `'50_50_levering'` (matcher GUI default)

Hvis nogen af disse mismatch'er GUI, vil PDF'erne afvige visuelt. Dette er den primære regression-risiko.

---

## Image-handling i bilag

`QuoteAppendixPDF.tsx` viser billeder via `<Image src={imageUrl} />` fra `@react-pdf/renderer`. Billeder hentes fra:
- `line.custom_image_url` (hvis `active_image_source === 'custom'`)
- `line.ai_image_url` (hvis `active_image_source === 'ai'`)
- Fallback: ingen billede

I edge function-konteksten:
- `@react-pdf/renderer` fetcher selv URL'erne under render (samme som i GUI)
- Billeder antages at være public URLs (Supabase Storage offentlige buckets) — dette er allerede sandt i V1
- **Risiko**: hvis et billede peger på en signed URL der er udløbet, fejler render. V1: dokumentér i README. V2: server-side image-resolve.

GUI's `lineEffectiveImageUrl(line)` helper kopieres ind i edge function for at vælge mellem `custom_image_url` og `ai_image_url` baseret på `active_image_source`. Den er enkel (~10 LOC).

---

## Database-touchpoints

Edge function læser fra:

| Tabel/view | Hvorfor |
|---|---|
| `v_quotes_resolved` | Quote-metadata med resolved-defaults (payment_terms, delivery_period, reservations, created_by_*) |
| `project_quote_lines_2026_01_16_23_00` | Tilbudslinjer (title, description, quantity, unit, living_description, technical_spec, image-felter, pricing-felter) |
| `project_quote_line_items_2026_01_16_23_00` | Items pr. linje (qty, cost_breakdown_json, cost_total_per_unit) |
| `projects_2026_01_15_06_45` | Project name + fallback customer |
| `companies_2026_01_16_23_00` | Kunde-details (name, cvr, addresses, defaultContactName) hvis `quote.company_id` er sat |

**Ingen writes** til database. Edge function er læs-kun mod DB. Kun writes er til Supabase Storage bucket.

**RLS-bypass**: Service-role-key bypasser RLS — det er meningen. Edge function har fuld læseadgang til alle tilbud.

---

## Test-strategi

### Manuel rygertest (efter deploy)

1. Hent `SUPABASE_SERVICE_ROLE_KEY` fra Supabase Dashboard → Project Settings → API
2. Kør cURL-eksemplet mod Langagerskolen T02 (`quote_id = b333c002-3471-4c4c-ae79-b26cb7569570`) med `format=pdf+bilag`
3. Åbn returneret `signed_url` i browseren
4. **Verifikation**: PDF skal være visuelt identisk med output fra GUI-knappen "Hent tilbud+bilag" på samme quote. Side-for-side sammenlign.
5. Gentag for `format=pdf` og `format=bilag` separat.

### Edge-cases der testes manuelt

| Case | Forventet |
|---|---|
| Ikke-eksisterende `quote_id` | 404 |
| Tom `quote_id` | 400 |
| Ugyldigt format | 400 |
| Forkert auth header | 401 |
| Quote uden lines | 200, PDF med tom linje-tabel |
| Quote uden company_id (fallback til project.customer) | 200, korrekt kunde-blok |
| Quote med billeder i bilag (custom + ai mix) | 200, billeder vises |

### Ikke-automatiserede tests i V1

Ingen automatiserede tests for edge function'en. Pattern i `app/supabase/edge_function/tests/` er deno-test setup, men test-coverage er minimal allerede. PDF-output-tests er svære (binær diff). Manuel rygertest er V1-accept.

---

## Risici og noter

1. **Drift mellem GUI- og edge-kopi**: Kopieret kode kan komme ud af sync. Mitigation: cross-reference-kommentarer i begge filer. Hvis det bliver et reelt problem, refactor til shared package (V2).

2. **Cold-start tid**: Første kald loader npm:react + npm:@react-pdf/renderer + pdf-lib. Forventet 2-5s cold-start, 200-500ms warm. Skill'en skal håndtere det med en "genererer PDF..."-besked.

3. **Image-resolve-fejl**: Hvis et billede i bilag peger på en død URL, fejler render med uklart fejl. V1: 500-fejl med detalje. V2: pre-flight image-check.

4. **Storage-bucket lifecycle**: PDF'er ophober sig. V1 accept (manuel rens). V2: object lifecycle policy.

5. **Service-role-key håndtering**: Skill'en skal læse key'en fra et sikkert sted (env-var eller user-vault). Ikke hardkodet i skill-prompts. Det er skill-design-ansvar, ikke edge function-ansvar.

6. **pdf-lib + @react-pdf/renderer i Deno**: Begge pakker er npm:-imports. Deno's npm-kompatibilitetslag understøtter dem, men der er en lille risiko for kompatibilitetsproblemer. Mitigation: testes tidligt i Checkpoint 3 før vi bygger resten.

---

## Out of scope

- **Skill'en der kalder edge function'en**: Bygges i `plugins/` efter edge function virker. Egen design-pass.
- **Quote-data-ændringer fra chat**: Edge function er ren PDF-generator. Hvis chat skal redigere quote først → separat edge function eller direkte DB-write via supabase MCP.
- **PDF-customization fra request**: Ingen `intro_text_override` eller lignende i request. Hvad der står i DB, det rendres.
- **Andre output-formater**: HTML, Word, Excel — kun PDF.
- **Sending af email med PDF som vedhæftet fil**: Skill'en kan gøre det efter den har URL'en, men edge function sender ikke selv mail.

---

## Næste skridt

Implementerings-plan i `docs/superpowers/plans/2026-05-13-generate-quote-pdf-plan.md` med 6 checkpoints:

1. Storage-bucket setup + RLS-policies
2. Kopier GUI-filer til edge function-mappen + opdater imports
3. Implementér `index.ts` med data-load + cost-calc + render
4. Implementér flet-flow med pdf-lib
5. Implementér storage-upload + signed URL
6. Deploy + test mod Langagerskolen T02

Hver checkpoint har egne done-when-kriterier i implementerings-planen.
