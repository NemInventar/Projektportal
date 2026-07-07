# Plan: Indkøbsoverblik på tværs af projekter

_Status: plan godkendt med åbne punkter — klar til brainstorm-runde inden implementering._
_Forfatter: planlagt af Plan-subagent + Joachims beslutninger. Gemt 2026-05-13._

---

## Hvorfor

Materialer (især plader) bestilles i dag projekt-for-projekt. Når projekt A har 24 m² birke 21mm og projekt B har 62 m², bestilles der to gange — i stedet for at samle ordrer, ramme bedre prisniveauer og undgå dobbeltarbejde. Der mangler et porteføljeoverblik over hvad der reelt skal købes ind på tværs.

## Hvad bygges

Tre konkrete leverancer:

1. **Datamodel-udvidelse** — en boolean-flag på projekter + to nye Supabase-views der aggregerer materialebehov og indkøb på tværs af projekter.
2. **Ny side `/portfolio/materials`** — Milots morgentabel. "Hvad mangler vi at bestille i dag?"
3. **Ny side `/projects/:id`** — projektets arbejdsflade. Erstatter den nuværende stub-`ProjectOverview.tsx`. Status-stribe + sektioner. Materialesektionen viser porteføljekontekst per linje.

---

## Beslutninger taget (2026-05-13)

| # | Spørgsmål | Valgt |
|---|---|---|
| 1 | Default for `include_in_portfolio_forecast` | **False, manuel aktivering**. Ingen auto-binding til fase. |
| 2 | Scope | **Kun Nem Inventar**. Ingen tenant-kolonne. Foresite/Askkon er ude. |
| 3 | Fase-mapping for sikker/tentativ | **Sikker**: Kontrakt og planlægning, Produktion. **Tentativ**: Tilbud, Sendt. **Hverken (demand_class NULL)**: Ny - ikke regnet. **Ude**: Tabt, Arkiv, Garanti. _(Rettet 2026-06-16: 'Ny - ikke regnet' — tidl. 'Afventer opstart' — taget ud af Sikker; den er nu hverken sikker eller tentativ. Matcher v_portfolio_*-views korrigeret 2026-06-08.)_ |
| 4 | Materialer uden `standard_material_id` | **V1: ignorér i porteføljen**. Problem anerkendt (materialer skrives nærmest på ny i tilbudsfasen, afklares først i produktion). Genbesøges når Milot rent faktisk bestiller via porteføljen. |
| 5 | `ProjectOverview.tsx` | **Erstat direkte**. Den nuværende er en stub med hardcodede 0'er — ingen grund til at bevare. |

## Åbne punkter til brainstorm-runden

### Toggle-fleksibilitet — projekt-niveau vs. materiale-niveau

Joachim har sagt: "toggle skal handle om materialer, men måske også om projekter. Måske kan man finde en smart løsning så man har lidt fleksibilitet."

Tre mulige modeller — skal afklares før implementering:

**Model A: Kun projekt-niveau (simpelt)**
- Flag på `projects.include_in_portfolio_forecast`
- ALLE projektets materialer tæller med eller IKKE med
- Pro: minimal datamodel, ét sted at toggle
- Con: ingen granularitet — projekt med 50 materialer hvor kun 5 skal pool'es kræver alt-eller-intet

**Model B: Kun materiale-niveau**
- Flag på `project_materials.include_in_portfolio_forecast`
- Hver materiale-linje vælges individuelt
- Pro: fuld kontrol pr. materiale
- Con: 50 toggles at sætte pr. projekt; ingen "aktivér hele projektet"-knap

**Model C: Hybrid (projekt-default + materiale-override)** ← stærkeste kandidat
- `projects.include_in_portfolio_forecast` — default for projektet
- `project_materials.portfolio_override` — `null` (følg projekt) / `true` (tving ind) / `false` (eksklud)
- "Aktivér projekt"-knap på projektsiden sætter projekt-flag til true. Alle materialer arver med mindre eksplicit overridet.
- På materialesektionen: hver linje har lille toggle-ikon der viser arvet status (gråtonet) eller eksplicit override (markeret).
- Pro: hurtig default + præcis kontrol når nødvendigt
- Con: lidt mere datamodel, lidt mere UI-arbejde

**Anbefaling**: Model C, men vent med materiale-niveau-override til V2 hvis det første pilotforløb viser at projekt-niveau er nok. Start med Model A i V1, lad arkitekturen være forberedt så vi kan tilføje `portfolio_override` uden migration-brud senere.

---

## Datamodel (kopier-klar SQL)

```sql
-- 2026-05-XX_portfolio_forecast.sql

-- 1. Toggle-kolonne på projekter
ALTER TABLE public.projects_2026_01_15_06_45
  ADD COLUMN include_in_portfolio_forecast boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects_2026_01_15_06_45.include_in_portfolio_forecast IS
  'Manuel toggle. Når true, indgår projektets material lines i v_portfolio_materials. Default false — Joachim aktiverer manuelt.';

-- 2. View: porteføljemæssig materiale-aggregering
CREATE OR REPLACE VIEW public.v_portfolio_materials AS
WITH demand AS (
  SELECT
    pm.standard_material_id,
    p.id AS project_id,
    p.name AS project_name,
    p.phase,
    SUM(ppml.qty) AS qty,
    MAX(pm.lead_time_days) AS lead_time_days
  FROM public.project_product_material_lines_2026_01_15_12_49 ppml
  JOIN public.project_products_2026_01_15_12_49 pp
    ON pp.id = ppml.project_product_id
  JOIN public.project_materials_2026_01_15_06_45 pm
    ON pm.id = ppml.project_material_id
  JOIN public.projects_2026_01_15_06_45 p
    ON p.id = pp.project_id
  WHERE p.include_in_portfolio_forecast = true
    AND p.phase NOT IN ('Tabt', 'Arkiv', 'Garanti')
    AND pp.status = 'active'
    AND pm.standard_material_id IS NOT NULL
  GROUP BY pm.standard_material_id, p.id, p.name, p.phase
),
demand_agg AS (
  SELECT
    standard_material_id,
    SUM(qty) FILTER (
      WHERE phase IN ('Kontrakt og planlægning', 'Produktion')
    ) AS qty_secure,
    SUM(qty) FILTER (
      WHERE phase IN ('Tilbud', 'Sendt')
    ) AS qty_tentative,
    MAX(lead_time_days) AS lead_time_days
  FROM demand
  GROUP BY standard_material_id
),
ordered_agg AS (
  SELECT
    pm.standard_material_id,
    SUM(pol.ordered_qty) AS qty_ordered,
    MIN(pol.expected_delivery_date) FILTER (WHERE pol.status = 'ordered') AS next_delivery_date
  FROM public.purchase_order_lines_2026_01_15_06_45 pol
  JOIN public.project_materials_2026_01_15_06_45 pm
    ON pm.id = pol.project_material_id
  JOIN public.projects_2026_01_15_06_45 p
    ON p.id = pm.project_id
  WHERE p.include_in_portfolio_forecast = true
    AND pol.status <> 'cancelled'
    AND pm.standard_material_id IS NOT NULL
  GROUP BY pm.standard_material_id
)
SELECT
  sm.id                            AS standard_material_id,
  sm.name                          AS material_name,
  sm.category,
  sm.unit,
  sm.primary_supplier_id,
  COALESCE(d.qty_secure, 0)        AS qty_secure,
  COALESCE(d.qty_tentative, 0)     AS qty_tentative,
  COALESCE(d.qty_secure, 0) + COALESCE(d.qty_tentative, 0) AS qty_total,
  COALESCE(o.qty_ordered, 0)       AS qty_ordered,
  GREATEST(
    COALESCE(d.qty_secure, 0) + COALESCE(d.qty_tentative, 0) - COALESCE(o.qty_ordered, 0),
    0
  )                                AS qty_missing,
  o.next_delivery_date,
  d.lead_time_days
FROM public.standard_materials_2026_01_15_06_45 sm
LEFT JOIN demand_agg d ON d.standard_material_id = sm.id
LEFT JOIN ordered_agg o ON o.standard_material_id = sm.id
WHERE COALESCE(d.qty_secure, 0) + COALESCE(d.qty_tentative, 0) + COALESCE(o.qty_ordered, 0) > 0;

-- 3. Drill-down view: per material × projekt
CREATE OR REPLACE VIEW public.v_portfolio_material_projects AS
SELECT
  pm.standard_material_id,
  p.id          AS project_id,
  p.name        AS project_name,
  p.project_number,
  p.phase,
  CASE
    WHEN p.phase IN ('Kontrakt og planlægning', 'Produktion') THEN 'secure'
    WHEN p.phase IN ('Tilbud', 'Sendt') THEN 'tentative'
  END           AS demand_class,
  SUM(ppml.qty) AS qty
FROM public.project_product_material_lines_2026_01_15_12_49 ppml
JOIN public.project_products_2026_01_15_12_49 pp ON pp.id = ppml.project_product_id
JOIN public.project_materials_2026_01_15_06_45 pm ON pm.id = ppml.project_material_id
JOIN public.projects_2026_01_15_06_45 p ON p.id = pp.project_id
WHERE p.include_in_portfolio_forecast = true
  AND p.phase NOT IN ('Tabt', 'Arkiv', 'Garanti')
  AND pp.status = 'active'
  AND pm.standard_material_id IS NOT NULL
GROUP BY pm.standard_material_id, p.id, p.name, p.project_number, p.phase;
```

**RLS**: alle underliggende tabeller har RLS. Views arver via `SECURITY INVOKER` (PG15+ default). Ingen separate policies behøves — mønster matcher `v_suppliers_compat` og andre eksisterende views.

**Join-finding**: `project_quote_lines` har ingen materialekobling. Mængder kommer fra `project_product_material_lines.qty` (NOT NULL, inkl. waste). Det er en vigtig rettelse i forhold til den oprindelige Claude Desktop-samtale som antog `project_quote_lines.quoted_qty`.

---

## Implementeringsplan — 7 checkpoints

### Checkpoint 1: Database (kun migration)
- Anvend SQL ovenfor.
- Filer: én migration i `app/supabase/migrations/` (følg navnekonvention `YYYY-MM-DD_<topic>.sql`).
- **Done when**: `SELECT * FROM v_portfolio_materials LIMIT 5` returnerer rows for projekter hvor toggle manuelt sættes true.

### Checkpoint 2: Frontend types + context
- Udvid Project-type med `includeInPortfolioForecast: boolean`.
- Filer: udvid [ProjectContext.tsx](app/src/contexts/ProjectContext.tsx). Ny: `app/src/contexts/PortfolioMaterialsContext.tsx` der loader fra `v_portfolio_materials`.
- Wrap `PortfolioMaterialsProvider` i `AppProviders` ([App.tsx](app/src/App.tsx)) mellem `PurchaseOrdersProvider` og `TransportProvider`.
- Genbrug load-pattern fra `StandardMaterialsContext`.
- **Done when**: `useProject().activeProject.includeInPortfolioForecast` returnerer korrekt boolean; `usePortfolioMaterials()` returnerer typed array.

### Checkpoint 3: Toggle på materialesiden
- Tilføj `<Switch>` øverst i [ProjectMaterialsV1.tsx](app/src/pages/ProjectMaterialsV1.tsx) header-row. Label: "Indgå i indkøbsportefølje".
- Persistér til DB via context.
- **Done when**: Toggle persisteres; uden refresh ses materialer i `/portfolio/materials` (når den eksisterer).

> **NB**: Denne checkpoint afhænger af afgørelsen i åbent punkt (Model A/B/C). Model A er det her. Model C kræver ekstra materiale-niveau-override.

### Checkpoint 4: Ny side `/portfolio/materials`
- Nye filer:
  - `app/src/pages/PortfolioMaterials.tsx`
  - `app/src/components/portfolio/PortfolioMaterialDrilldown.tsx` (valgfrit, kan starte inline)
- Eksisterende filer:
  - [App.tsx](app/src/App.tsx) — tilføj `<Route path="/portfolio/materials" ...>`
  - [Layout.tsx](app/src/components/Layout.tsx) — tilføj sidebar-link "Portefølje" over "Indkøb"
- Genbrug: `Table`, `Card`, `Badge` fra shadcn. Filter-mønster fra [PurchaseOrders.tsx](app/src/pages/PurchaseOrders.tsx). Leverandør-opslag fra ProjectMaterialsV1.
- Default-sort: `qty_missing DESC`.
- Filtre: leverandør, kategori, lead time-bånd (`<7`, `7–14`, `>14`).
- Klik på række → Dialog med `v_portfolio_material_projects`-rows + PO-liste filtreret pr. `standard_material_id`.
- **Done when**: Tabel viser aggregerede tal; drill-down virker mod live data.

### Checkpoint 5: Ny projektside `/projects/:id`
- Erstatter [ProjectOverview.tsx](app/src/pages/ProjectOverview.tsx). Slet den gamle som del af checkpoint.
- Nye filer:
  - `app/src/pages/ProjectWorkspace.tsx`
  - `app/src/components/project/ProjectStatusStripe.tsx`
  - `app/src/components/project/ProjectContractSection.tsx`
  - `app/src/components/project/ProjectMilestonesSection.tsx`
  - `app/src/components/project/ProjectMaterialsSection.tsx`
  - `app/src/components/project/ProjectOpenQuestionsSection.tsx`
  - `app/src/components/project/ProjectTeamSection.tsx`
  - `app/src/components/project/ProjectPhaseSuggester.tsx`
- Eksisterende filer:
  - [App.tsx](app/src/App.tsx) — tilføj `<Route path="/projects/:id" ...>` + redirect fra `/project/overview` (eller fjern).
  - [Layout.tsx](app/src/components/Layout.tsx) — opdater sidebar-link.
- Genbrug: `useProject`, `useProjectProducts`, `useStandardMaterials`, `usePurchaseOrders`. Milestones direkte fra `project_milestones_2026_04_04`. Tilbud-totaler fra [quotePricing.ts](app/src/lib/quotePricing.ts).
- Faseskift: manuel `<Select>` med phase-værdier. `PhaseSuggester` viser banner med foreslået fase + grund. Aldrig auto-skift.
- **Done when**: Alle 6 status-chips med beregnede tal; alle 6 sektioner renderer; phase-skift kun via brugerklik.

### Checkpoint 6: Porteføljekontekst i materialesektionen
- I `ProjectMaterialsSection.tsx`: for hver projekt-materiale med `standard_material_id`, slå op i `PortfolioMaterialsContext`. Vis tekst: "X på dette projekt · Y i porteføljen · Z bestilt på tværs".
- Linjer uden `standard_material_id` viser kun lokal mængde (ingen porteføljekontekst).
- **Done when**: Tekst vises korrekt for materialer med standard-link.

### Checkpoint 7: Polish + dokumentation
- Tilføj kort note til [Projektportal/CLAUDE.md](CLAUDE.md) om porteføljekonceptet.
- Smoke-test med 2-3 reelle projekter aktiveret.
- Tjek RLS virker (anon-bruger må læse view'et hvis vedkommende kan læse basistabellerne).
- **Done when**: Milot kan åbne `/portfolio/materials` om morgenen, se "Mangler at bestille" øverst, og dykke ned i hvilke projekter der driver behovet.

---

## UI-skitse

### Status-stribe (projektside, sticky øverst)

Vandret stribe med 6 chips, hver chip = `Card` med ikon + 2 linjer:

- **Kontrakt** — "3 låste tilbud" / "412.000 kr" → scroll til Kontrakt
- **Milestones** — "4 planlagt · 1 leveret" → scroll til Milestones
- **Indkøb** — "8 af 14 materialer bestilt" → scroll til Materialer (filteret på mangler)
- **Cashflow** — "127.000 kr forfaldent juni · 0 kr fakturerbart nu" → scroll til Fakturering
- **Åbne spørgsmål** — "3" → scroll til Open Questions
- **Risici** — "1 høj" → scroll til Risici (læser fra `projects.risk_notes`)

Under striben: phase-badge + banner med "Foreslår: Skift til Produktion fordi alle tilbud er låste" hvis betingelser er opfyldt. Knap "Skift fase" åbner Select.

Toggle "Indgå i indkøbsportefølje" placeres som chip-style switch lige under metadata (kunde, projektnr) — striben er status, toggle er konfiguration.

### Porteføljetabel

Side-overskrift: "Produktionsportefølje – Materialer".
Filter-rækker: Søg · Leverandør · Kategori · Lead time.
Default sort: `Mangler ↓`.

| Materiale | Enhed | Sikre | Tentative | I alt | Bestilt | Mangler | Næste levering | Lead time |
|---|---|---|---|---|---|---|---|---|
| Birke 21mm | m² | 86 | 24 | 110 | 60 | 50 | 12. juni | 14 dage |

- **Sikre**: blå
- **Tentative**: grå kursiv (visuelt klart at det er usikkert)
- **Mangler**: rød hvis > 0, ellers "—"
- **Bestilt**: grøn hvis ≥ sikker

Klik åbner drill-down: tabel med projektrækker (projektnavn, fase-badge, sikker/tentativ, mængde) + PO-sub-tabel (PO-nummer, leverandør, antal, expected delivery, status).

---

## Risici og noter

1. **Materiale-input-disciplin**: Materialer skrives nærmest på ny pr. projekt i tilbudsfasen, afklares først i produktion. Det er præcis det denne plan ikke løser — den synliggør problemet ved at lade ikke-linkede materialer være usynlige. V2-arbejde: skarp input-pattern når Milot rent faktisk bestiller via porteføljen.

2. **Enhedskonsistens**: Aggregering antager at alle `project_materials.unit` for samme `standard_material_id` er identiske. Sample-data viser `unit='m'` på en m²-plade. Risiko for fejlsummer. V1: dokumentér i CLAUDE.md, fix data-input fremad. V2: tilføj `unit_conflict boolean` i view'et.

3. **Lead time-kilde**: `lead_time_days` ligger på `project_materials`, ikke `standard_materials`. View bruger MAX som worst-case. V2: tilføj default på `standard_materials`.

4. **Hardcoded phase-mapping**: "Sikker/tentativ"-definitionen sidder i SQL. Hvis ny phase tilføjes, opdateres view-definitionen. V1 accept.

5. **Vurdering: ingen ny "porteføljeindstillinger"-tabel**. Flag direkte på projekt = simpelt. Hvis senere behov for "per material type-toggle" pr. projekt, så ny tabel.

---

## Estimat

Hvis Model A (kun projekt-niveau toggle) — **1-2 fulde arbejdsdage** hvis tingene går glat.

Anbefalet opdeling:
- **Fase 1** (½–1 dag): Checkpoints 1+2+3+4 — datamodel + porteføljesiden. Standalone leverance. Løser hovedproblemet.
- **Fase 2** (½–1 dag): Checkpoints 5+6+7 — projektworkspace + porteføljekontekst på linjer.

---

_Næste skridt: kør planen igennem en brainstorm-runde for at hærde Model A/B/C-valget og finde overset edge cases. Derefter Checkpoint 1 (migration) som første implementeringsskridt._
