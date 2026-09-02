# NemInventar ERP – Memory

## Hvad er det her
NemInventar ERP er et projektportal-system til Nem Inventar ApS (dansk snedkervirksomhed). Systemet håndterer tilbud, kalkulation, produkter, materialer og indkøb i byggeprojekter.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, React Router (hash routing)
- **UI**: Shadcn UI, Radix UI, Tailwind CSS, Lucide icons
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **State**: React Context (7 providers), TanStack React Query
- **Øvrigt**: PapaParse (CSV), Recharts, React Hook Form + Zod

## Kodebase
Koden ligger i `app/`. 40+ Supabase-migrationer. Edge functions til prisforespørgsler.

## Kerneentiteter
- **Projects** – faser: Ny - ikke regnet → Tilbud → Sendt → Kontrakt og planlægning → Produktion → Garanti → **Afsluttet**. Sidespor: Tabt / Fravalgt / Arkiv. `Afsluttet` (03-08-2026) er terminal for en leveret, betalt og lukket sag — **`Arkiv` er forbeholdt ting der ikke er sager** (backtests, skabelonen 99999, fejloprettelser). Læg aldrig en færdig sag i Arkiv: likviditetsmodellen regner `Arkiv` som tabt, mens `Afsluttet` og `Garanti` er rigtigt arbejde. De to interne omkostningssteder (90001/90002) bor i Arkiv men kendes på `project_type='intern'`
- **Project Products** – det vi bygger/sælger. Typer: curtain, installation, furniture, other
- **Cost Lines** – fire typer pr. produkt: material, labor, transport, other cost
- **Project Materials** – projektspecifikke materialer med pris, leverandør, godkendelser
- **Standard Materials** – master-katalog på tværs af projekter
- **Suppliers** – standard + projektspecifikke
- **Quotes** – tilbudslinjer med cost snapshots og pricing (markup, target price)
- **Budgets** – fra tilbud, med profit-tracking (locked sell vs. current cost)
- **Purchase Orders** – status: draft → ordered → partially_received → received → cancelled
- **Price Requests** – prisforespørgsler til leverandører (via edge functions)

## Aktuel fase
V1-udvikling. Fokus på kerneflows: tilbud, kalkulation, indkøb. Ikke optimering eller enterprise-features.

## Vigtige beslutninger
- **Total-mode først**: Systemet tænker i totaler. Enhedspriser er afledte (total / antal).
- **Snapshot-logik**: Tilbud/budgets bruger snapshots, ikke live data. Historik ændres ikke.
- **Dobbelt materialedatabase**: Standard (master) + projekt (med projektspecifikke priser).
- **Transport-ruter**: Kosovo ↔ DK modelleret med costModel (per_unit / per_shipment).

## Seneste arbejde
- Bulk upload usability fixes (aktiv branch)
- Product import mellem projekter
- Purchase order system
- Budget med profit-tracking

## Kontaktpersoner
- **Joachim Skovbogaard** (js@neminventar.dk) – ejer, driver udviklingen
