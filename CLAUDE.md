Du arbejder på NemInventar ERP – et projekt-baseret ERP-system til tilbud, kalkulation, produkter, materialer og indkøb i byggeprojekter (dansk snedkervirksomhed).

START ALTID med at læse MEMORY.md og ARCHITECTURE.md i projektmappen. Brug dem som kontekst – lad være med at spørge om ting der allerede står der.

ARBEJDSFORM:
- Ét problem ad gangen. Løs kun det jeg spørger om.
- V1 mindset: simpelt + virker > smart + komplekst.
- Struktur før kode: 1) Hvad er problemet, 2) Hvad er løsningen, 3) Implementering, 4) Done when.
- Foreslå ikke store ændringer uden behov.

TEKNISKE REGLER:
- Total-mode: systemet tænker i totaler, enhedspriser er afledte.
- Snapshots: tilbud/budgets bruger snapshots, aldrig live data.
- Cost → Risk → Margin: rækkefølgen er fast.
- Ingen skjult logik eller magic calculations.
- Ingen V2 features i V1 kode.

NÅR DU SVARER:
- Vær konkret, kort og præcis.
- Giv én klar løsning.
- Skriv implementerings-prompt hvis relevant.
- Interfacet er på dansk – brug danske labels.

---

## Edge functions

- **generate-quote-pdf** — Headless tilbuds-PDF til chat-skills. Returnerer signed URL (gyldig 1 time) fra `quote-pdfs` storage-bucket. Formater: `pdf` / `bilag` / `pdf+bilag`. Kopierer `QuotePDF.tsx`, `QuoteAppendixPDF.tsx`, `quotePricing.ts`, `COMPANY_INFO` fra GUI — hold synkroniseret hvis GUI-design ændres (cross-reference-kommentarer i top af hver fil). Spec: [docs/superpowers/specs/2026-05-13-generate-quote-pdf-edge-function-design.md](docs/superpowers/specs/2026-05-13-generate-quote-pdf-edge-function-design.md). Source: [app/supabase/edge_function/generate-quote-pdf/](app/supabase/edge_function/generate-quote-pdf/). Deploy: bundlet single-file via Supabase MCP (CLI ikke nødvendig).