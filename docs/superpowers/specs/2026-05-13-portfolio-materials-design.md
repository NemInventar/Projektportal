# Design: Indkøbsportefølje + godkendelses-flow

_Forfatter: brainstormet med Superpowers brainstorming-skill 2026-05-13._
_Bruger: Joachim Skovbogaard (js@neminventar.dk)._
_Erstatter: `Projektportal/PORTFOLIO_PLAN.md` (overskriver Model A/B/C-debatten)._

---

## 1. Problem

Materialer (især plader, beslag) bestilles i dag projekt-for-projekt. Når projekt A har 24 m² birke 21mm og projekt B har 62 m², bestiller Milot to gange — i stedet for at samle ordrer, ramme bedre prisniveauer og undgå dobbeltarbejde. Der mangler et porteføljeoverblik over hvad der reelt skal købes ind på tværs.

Derudover er der to relaterede friktioner:
- **Ingen formel "klar til bestilling"-status** — Milot kan ikke vide hvilke materialer der er specificeret nok til at sendes til leverandør
- **Ingen breakdown af generiske budgetposter** — tilbud har poster som "Beslag — 1.500 kr" der senere skal brydes op i 6 konkrete varer

## 2. Vigtige findings (kodebasen kan mere end forventet)

Inden vi designede, fandt vi at flere ting allerede eksisterer i systemet:

- **Godkendelses-system**: tabel `project_material_approvals_2026_01_15_06_45` med typer `'production'` og `'sustainability'`. `getApprovalStatus()` i [ProjectMaterialsContext.tsx](app/src/contexts/ProjectMaterialsContext.tsx) returnerer `'fully_approved'` når begge er OK.
- **Approval-override på bestilling**: `purchase_order_lines.approval_override` + reason + by + at — escape-hatch hvis man bestiller før godkendelse er på plads. Brugt i [BOM.tsx](app/src/pages/BOM.tsx) og [PurchaseOrderDetail.tsx](app/src/pages/PurchaseOrderDetail.tsx).
- **`is_generic` flag**: `project_materials.is_generic` (boolean) eksisterer, men ingen parent/child eller breakdown-UI.
- **RFQ-system fuldt bygget**: hele datamodellen (`project_rfqs_2026_04_23_10_00`, lines, suppliers, quotes) + 5 sider ([RFQCreate](app/src/features/purchasing/pages/RFQCreate.tsx), [RFQDetail](app/src/features/purchasing/pages/RFQDetail.tsx), [RFQCompare](app/src/features/purchasing/pages/RFQCompare.tsx), [QuoteReviewQueue](app/src/features/purchasing/pages/QuoteReviewQueue.tsx), [PurchasingOverview](app/src/features/purchasing/pages/PurchasingOverview.tsx)). Bruges sjældent — primært et discovery-værktøj.
- **`project_quote_lines` har ingen materialekobling** — mængder kommer fra `project_product_material_lines.qty` via `project_products`.

Designet bygger på det eksisterende. Ingen ny lock-mekanisme. Ingen ny tenant-kolonne. Ingen projekt-niveau toggle.

## 3. Beslutninger

| # | Spørgsmål | Valgt |
|---|---|---|
| 1 | Hvad er "låst på projekt"? | **Eksisterende `fully_approved`** (production + sustainability = approved). Genbrug, ikke nyt felt. |
| 2 | Default for portefølje-inklusion | **Approval-status driver alt.** Intet projekt-niveau flag. |
| 3 | Scope | **Kun Nem Inventar.** Foresite/Askkon ude. |
| 4 | Fase-mapping (sikker/tentativ) | Sikker: Kontrakt og planlægning, Afventer opstart, Produktion. Tentativ: Tilbud, Sendt. Ude: Tabt, Arkiv, Garanti. |
| 5 | Materialer uden `standard_material_id` | **V1: ignorér i porteføljen.** Aggregering kræver standard_material_id. |
| 6 | Godkendelses-trin | **Ét trin** — `fully_approved`. Ikke spec-lock + pris-lock separat. |
| 7 | RFQ-kobling | **Valgfri detour** — kan udsendes på ethvert godkendt materiale, opdaterer pris/leverandør hvis vundet. RFQ er discovery-værktøj, ikke obligatorisk. |
| 8 | Bulk-PO-flow | **Smart UI**: én knap → N PO'er (én pr. projekt), samme `bulk_order_group_id`. Datamodel-purchase_orders bevares som projekt-bundet. |
| 9 | Generiske materialer | Filtreres ud af porteføljen (`is_generic = false`-filter). Ny "Bryd op"-flow oprettér konkrete children med `parent_project_material_id`. |
| 10 | Skæbne af generisk efter breakdown | **Beholdes** med `replaced_at`-timestamp som audit (Joachim vil vide hvad budgetposten var). Skjult by default i materialesiden. |
| 11 | Bestil ikke-fully_approved | **Brug eksisterende `approval_override`-mekanisme** (modal med "Hvorfor?"). Vi blokerer ikke. |
| 12 | Auto-reset approval ved ændring | **Nej, V1.** Approvals forbliver selv efter materiale-edits. V1.1: visuel advarsel hvis `approved_at < updated_at`. |
| 13 | `ProjectOverview.tsx`-erstatning (oprindelig feature B) | **Parkeret.** Ikke i denne spec. Egen brainstorm-runde senere. |

## 4. Datamodel-ændringer

### 4.1 Nye kolonner

```sql
-- 1. Parent-link på project_materials (for breakdown children)
ALTER TABLE project_materials_2026_01_15_06_45
  ADD COLUMN parent_project_material_id uuid NULL
    REFERENCES project_materials_2026_01_15_06_45(id) ON DELETE SET NULL;

-- 2. Audit-timestamp for breakdown
ALTER TABLE project_materials_2026_01_15_06_45
  ADD COLUMN replaced_at timestamptz NULL;

-- 3. Bulk-order grouping på purchase_orders
ALTER TABLE purchase_orders_2026_01_15_06_45
  ADD COLUMN bulk_order_group_id uuid NULL;

COMMENT ON COLUMN project_materials_2026_01_15_06_45.parent_project_material_id IS
  'Hvis dette materiale stammer fra breakdown af et generisk materiale, peger feltet på det generiske.';
COMMENT ON COLUMN project_materials_2026_01_15_06_45.replaced_at IS
  'Sat når et generisk materiale er brudt op i konkrete children. Filtreret fra default-visning og ekskluderet fra portefølje.';
COMMENT ON COLUMN purchase_orders_2026_01_15_06_45.bulk_order_group_id IS
  'Hvis denne PO blev oprettet som del af en samlet bestilling på tværs af projekter, deler den dette uuid med de andre PO''er i bestillingen.';
```

### 4.2 Views

```sql
-- Helper: hvilke materialer er fully_approved?
CREATE OR REPLACE VIEW v_approved_project_materials AS
SELECT pm.id AS project_material_id
FROM project_materials_2026_01_15_06_45 pm
WHERE EXISTS (
  SELECT 1 FROM project_material_approvals_2026_01_15_06_45 a
  WHERE a.project_material_id = pm.id AND a.type = 'production' AND a.status = 'approved'
)
AND EXISTS (
  SELECT 1 FROM project_material_approvals_2026_01_15_06_45 a
  WHERE a.project_material_id = pm.id AND a.type = 'sustainability' AND a.status = 'approved'
);

-- Helper: hvilke materialer er klar til portefølje?
-- (fully_approved + ikke-generisk + ikke-replaced + har standard_material_id)
CREATE OR REPLACE VIEW v_orderable_project_materials AS
SELECT pm.id AS project_material_id, pm.standard_material_id, pm.project_id, pm.lead_time_days
FROM project_materials_2026_01_15_06_45 pm
WHERE pm.is_generic = false
  AND pm.replaced_at IS NULL
  AND pm.standard_material_id IS NOT NULL
  AND pm.id IN (SELECT project_material_id FROM v_approved_project_materials);

-- Hovedview: aggregeret pr. standard_material på tværs af aktive projekter
CREATE OR REPLACE VIEW v_portfolio_materials AS
WITH demand AS (
  SELECT
    om.standard_material_id,
    p.id AS project_id,
    p.phase,
    SUM(ppml.qty) AS qty,
    MAX(om.lead_time_days) AS lead_time_days
  FROM project_product_material_lines_2026_01_15_12_49 ppml
  JOIN project_products_2026_01_15_12_49 pp ON pp.id = ppml.project_product_id
  JOIN v_orderable_project_materials om ON om.project_material_id = ppml.project_material_id
  JOIN projects_2026_01_15_06_45 p ON p.id = pp.project_id
  WHERE p.phase NOT IN ('Tabt', 'Arkiv', 'Garanti')
    AND pp.status = 'active'
    AND om.project_id = p.id
  GROUP BY om.standard_material_id, p.id, p.phase
),
demand_agg AS (
  SELECT
    standard_material_id,
    SUM(qty) FILTER (WHERE phase IN ('Kontrakt og planlægning', 'Afventer opstart', 'Produktion')) AS qty_secure,
    SUM(qty) FILTER (WHERE phase IN ('Tilbud', 'Sendt')) AS qty_tentative,
    MAX(lead_time_days) AS lead_time_days
  FROM demand
  GROUP BY standard_material_id
),
ordered_agg AS (
  SELECT
    om.standard_material_id,
    SUM(pol.ordered_qty) AS qty_ordered,
    MIN(pol.expected_delivery_date) FILTER (WHERE pol.status IN ('ordered', 'partially_received')) AS next_delivery_date
  FROM purchase_order_lines_2026_01_15_06_45 pol
  JOIN v_orderable_project_materials om ON om.project_material_id = pol.project_material_id
  WHERE pol.status <> 'cancelled'
  GROUP BY om.standard_material_id
)
SELECT
  sm.id                                       AS standard_material_id,
  sm.name                                     AS material_name,
  sm.category,
  sm.unit,
  sm.primary_supplier_id,
  COALESCE(d.qty_secure, 0)                   AS qty_secure,
  COALESCE(d.qty_tentative, 0)                AS qty_tentative,
  COALESCE(d.qty_secure, 0) + COALESCE(d.qty_tentative, 0) AS qty_total,
  COALESCE(o.qty_ordered, 0)                  AS qty_ordered,
  GREATEST(
    COALESCE(d.qty_secure, 0) + COALESCE(d.qty_tentative, 0) - COALESCE(o.qty_ordered, 0),
    0
  )                                           AS qty_missing,
  o.next_delivery_date,
  d.lead_time_days
FROM standard_materials_2026_01_15_06_45 sm
LEFT JOIN demand_agg d ON d.standard_material_id = sm.id
LEFT JOIN ordered_agg o ON o.standard_material_id = sm.id
WHERE COALESCE(d.qty_secure, 0) + COALESCE(d.qty_tentative, 0) + COALESCE(o.qty_ordered, 0) > 0;

-- Drill-down: per material × projekt
CREATE OR REPLACE VIEW v_portfolio_material_projects AS
SELECT
  om.standard_material_id,
  p.id          AS project_id,
  p.name        AS project_name,
  p.project_number,
  p.phase,
  CASE
    WHEN p.phase IN ('Kontrakt og planlægning', 'Afventer opstart', 'Produktion') THEN 'secure'
    WHEN p.phase IN ('Tilbud', 'Sendt') THEN 'tentative'
  END           AS demand_class,
  SUM(ppml.qty) AS qty,
  om.project_material_id
FROM project_product_material_lines_2026_01_15_12_49 ppml
JOIN project_products_2026_01_15_12_49 pp ON pp.id = ppml.project_product_id
JOIN v_orderable_project_materials om ON om.project_material_id = ppml.project_material_id
JOIN projects_2026_01_15_06_45 p ON p.id = pp.project_id
WHERE p.phase NOT IN ('Tabt', 'Arkiv', 'Garanti')
  AND pp.status = 'active'
  AND om.project_id = p.id
GROUP BY om.standard_material_id, p.id, p.name, p.project_number, p.phase, om.project_material_id;
```

**RLS**: Alle underliggende tabeller har RLS. Views arver via `SECURITY INVOKER` (PG15+ default). Ingen separate policies.

## 5. Hovedflow (materiale-livscyklus)

```
1. Kladde (generic eller specific)
   │
2a. Hvis generic → "Bryd op" (UI flow):
   │   • Generic får replaced_at = now()
   │   • Children oprettes med parent_project_material_id = generic.id
   │   • Children er nu i kladde-tilstand selv
   │
2b. Hvis specific (eller efter breakdown):
   │   • Joachim/Christian sætter production+sustainability = 'approved'
   │   • Materialet bliver fully_approved
   │   • Dukker op i porteføljen
   │
3. Bestilt (via porteføljens bulk-dialog eller direkte fra projekt):
   │   • Hvis ikke fully_approved: approval_override-modal med grund
   │   • PO oprettes, evt. med bulk_order_group_id
   │
4. Modtaget (PO status → 'received'):
   │   • Materialet ryger ud af "Mangler at bestille"-gruppen
```

**RFQ-detour** (valgfri): Et fully_approved materiale kan sendes til RFQ. Vundet quote → `project_materials.unit_price` opdateres, evt. `supplier_id` og `lead_time_days`. Materialet er stadig fully_approved gennem hele forløbet.

## 6. UI: Porteføljeside

**Route**: `/portfolio/materials`. Sidebar-link "Portefølje" placeret som ny gruppe "Indkøb" der også inkluderer eksisterende "Indkøbsordrer".

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Produktionsportefølje – Materialer                                   │
│ X materialer mangler bestilling                                      │
├──────────────────────────────────────────────────────────────────────┤
│ [Søg…]  Leverandør▾  Kategori▾  Lead time▾  ☐ Vis fuldt bestilt    │
├──────────────────────────────────────────────────────────────────────┤
│ ▼ MANGLER AT BESTILLE (default åben)                                │
│   Materiale  Enhed  Sikre  Tent.  Total  Bestilt  MANGLER  Lev.    │
│                                                                      │
│ ▼ KLAR / I PROCES (default lukket)                                  │
│ ▼ FULDT BESTILT (default lukket)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Kolonner

| Kolonne | Kilde | Visning |
|---|---|---|
| Materiale | `material_name` + kategori-badge | Bold, klikbar |
| Enhed | `unit` | Mono |
| Sikre | `qty_secure` | Blå |
| Tentative | `qty_tentative` | Grå kursiv |
| Total | `qty_total` | Fed |
| Bestilt | `qty_ordered` | Grøn hvis ≥ sikre |
| **MANGLER** | `qty_missing` | **Rød + ⚠ hvis > 0** |
| Næste levering | `next_delivery_date` | Orange hvis < 7 dage; "—" hvis NULL |
| Lead time | `lead_time_days` | "14 dage"; "Ukendt" hvis NULL |

### Grupperinger (Collapsible)

1. **MANGLER AT BESTILLE** — `qty_missing > 0`. Åben default.
2. **KLAR / I PROCES** — `qty_missing = 0`, har PO med status ≠ 'received'. Lukket default.
3. **FULDT BESTILT** — alt modtaget. Lukket default.

### Filtre + sortering

- **Søg**: free-text på `material_name`, `category`, supplier-navn (lokalt frontend-filter)
- **Leverandør**: dropdown med distinct `primary_supplier_id`
- **Kategori**: dropdown med distinct `category`
- **Lead time**: `<7`, `7–14`, `>14`, `Ukendt`
- **Vis fuldt bestilt**: toggle der inkluderer gruppe 3 i søgning

Default-sortering: `qty_missing DESC`, derefter `next_delivery_date ASC NULLS LAST`. Header-klik sorterer.

### Drill-down (Sheet fra højre)

Klik på materiale-række åbner sidepanel:

```
─ Birke 21mm — m² ────────────────────────────────────
  Total: 110 · Bestilt: 60 · Mangler: 50
  Lead time: 14 dage · Primær leverandør: Spaanex

  ─ Fordeling pr. projekt ─────────────────────────────
   Halbyg              Sikker    24 m²   ──── 8 bestilt
   Frydensberg         Sikker    62 m²   ──── 52 bestilt
   Tilbud Mørkhøj      Tentativ  24 m²   ──── 0 bestilt

  ─ Aktive ordrer (PO, status ≠ received & ≠ cancelled) ──
   PO-2026-018  Spaanex   24 m²   levering 12/06   ordered

  ─ Actions ───────────────────────────────────────────
   [Bestil resterende 50 m²]   [Start RFQ]
─────────────────────────────────────────────────────
```

- **"Bestil resterende"** → bulk-bestillings-dialog (§7)
- **"Start RFQ"** → eksisterende `/project/.../rfqs/new` flow med materialet prefilled (kobles via `project_material_id`)

## 7. UI: Bulk-bestillings-dialog

Åbnes fra portefølje-drill-downens "Bestil resterende"-knap. **Én dialog = én leverandør.**

```
┌─ Bestil materiale ───────────────────────────────────────────┐
│ Birke 21mm — 50 m² der mangler                              │
│                                                              │
│ Leverandør:  [Spaanex                                ▾]     │
│              ☑ Foreslået fra primær leverandør              │
│                                                              │
│ Pris pr. m²: [____________] DKK    ☑ Brug for alle linjer  │
│              (når OFF: individuel pris pr. projekt-linje)  │
│ Lev.dato:    [12-06-2026]                                   │
│ Noter:       [____________________________________]         │
│                                                              │
│ Fordeling pr. projekt:                                       │
│ ☑ Halbyg              Mangler 16 m²    [16]   m²            │
│ ☑ Frydensberg         Mangler 10 m²    [10]   m²            │
│ ☑ Tilbud Mørkhøj      Mangler 24 m²    [24]   m²   ⚠ tent. │
│                                                              │
│ Total bestilling:                       50 m²                │
│ Estimeret pris:                         13.750 DKK           │
│                                                              │
│ ⚠ 1 projekt er i tilbud — du bestiller før vi har vundet   │
│                                                              │
│   [Annullér]               [Opret 3 PO'er og send samlet]   │
└──────────────────────────────────────────────────────────────┘
```

### Backend-transaktion ved "Opret"

1. Generér ét `bulk_order_group_id` uuid
2. For hver tikkede projekt-row:
   - INSERT i `purchase_orders` med project_id, supplier_id, order_date=now, expected_delivery_date, status='ordered', `bulk_order_group_id` = det fælles uuid
   - INSERT i `purchase_order_lines` med purchase_order_id (just-created), project_material_id, supplier_id, ordered_qty, unit, unit_price, expected_delivery_date
3. Hvis materialet ikke er fully_approved på ét eller flere projekter: vis approval_override-modal FØR INSERT. Brugeren skriver reason → felter `approval_override`, `approval_override_reason`, `approval_override_by`, `approval_override_at` sættes på linjen
4. Toast: "X PO'er oprettet"
5. (V1.1: "Send samlet PDF" — én PDF med alle PO'er. V1 har kun "Download PDF pr. PO" via eksisterende infrastruktur.)

### Valideringer

- Mindst én projekt-row skal være tikket
- Pris er valgfri (kan tilføjes efter modtagelse)
- Sum af antal må variere fra "Mangler" — brugeren har final say
- Tentativt projekt: advarselsbanner, ikke blocking
- Enhedsmismatch mellem projekter for samme standard_material: blokér med "Ret data først"-fejl
- Ikke-fully_approved materialer: trigger approval_override-modal

## 8. UI: Breakdown af generisk materiale

Aktiveres på [ProjectMaterialsV1.tsx](app/src/pages/ProjectMaterialsV1.tsx) for materialer hvor `is_generic = true` AND `replaced_at IS NULL`.

**Vigtigt**: Vi udvider kun V1-siden (`/project/materials`). Den legacy `ProjectMaterials.tsx` på `/project/materials-legacy` røres ikke — den er på vej til at blive afviklet.

**Ny knap**: lille "Bryd op"-ikon (scissors/split) ved siden af edit-ikonet på materialerækken.

### Dialog

```
┌─ Bryd op generisk materiale ─────────────────────────────────┐
│ Generisk post: Beslag — 1.500 DKK budget                    │
│ Notes: "Beslag til 8 låger, finalt valg afventer"           │
│                                                              │
│ Erstat med konkrete materialer:                              │
│ Navn               Kategori    Enhed   Antal   Leverandør    │
│ [Hængsel 165° BLUM][Beslag▾]  [stk]   [32]    [BLUM      ▾] │
│ [Greb Furniture..] [Beslag▾]  [stk]   [16]    [HÄFELE    ▾] │
│ [Magnetlukker.. ]  [Beslag▾]  [stk]   [8]     [BLUM      ▾] │
│ [+ Tilføj række]                                             │
│                                                              │
│ Den generiske post beholdes som audit-trail med replaced_at. │
│ Skjules som default men kan vises via "Vis brudt op".       │
│                                                              │
│   [Annullér]                          [Bryd op]              │
└──────────────────────────────────────────────────────────────┘
```

### Backend-transaktion ved "Bryd op"

1. For hver række i listen: INSERT i `project_materials` med:
   - `project_id` = samme som det generiske
   - `parent_project_material_id` = det generiske ID
   - `is_generic` = false
   - `name`, `category`, `unit`, `supplier_id` fra dialogen
   - Ingen approvals oprettes — Joachim godkender efterfølgende
2. UPDATE det generiske: `replaced_at = now()`
3. Toast: "Brudt op i X konkrete materialer — husk at godkende dem før bestilling"

### Visning af brudt-op materialer på materialesiden

Tilføj en toggle "Vis brudt op" øverst (ved siden af eksisterende filtre). Default OFF. Når ON, vises også rows med `replaced_at IS NOT NULL`, gråtonet med badge "Brudt op 12/05".

## 9. Frontend-arkitektur

### Filer der oprettes

```
app/src/pages/PortfolioMaterials.tsx                         — Hovedside
app/src/components/portfolio/PortfolioTable.tsx              — Tabel + grupper
app/src/components/portfolio/PortfolioFilters.tsx            — Filter-row
app/src/components/portfolio/PortfolioMaterialDrilldown.tsx  — Sheet drill-down
app/src/components/portfolio/BulkOrderDialog.tsx             — Bulk-bestilling
app/src/components/materials/BreakdownDialog.tsx             — Bryd op generisk

app/src/contexts/PortfolioMaterialsContext.tsx               — Load + cache v_portfolio_materials
                                                              (eller hook hvis vi går React Query)

app/supabase/migrations/2026-05-13_portfolio_materials.sql   — Alle ALTER + CREATE VIEW
```

### Filer der ændres

```
app/src/App.tsx                       — Tilføj <Route path="/portfolio/materials">
app/src/components/Layout.tsx         — Sidebar: ny "Indkøb"-gruppe med Portefølje øverst
app/src/pages/ProjectMaterialsV1.tsx  — "Bryd op"-knap + "Vis brudt op"-toggle
app/src/contexts/ProjectMaterialsContext.tsx — Tilføj breakdown()-funktion + load af parent_id/replaced_at
```

### Genbrug fra eksisterende kode

- **shadcn**: Table, Card, Badge, Sheet, Dialog, Select, Switch, Input
- **Filter-mønster**: matchen i [PurchaseOrders.tsx](app/src/pages/PurchaseOrders.tsx)
- **Tabel-header-klik-sort**: matchen i [AllQuotes.tsx](app/src/pages/AllQuotes.tsx)
- **Approval-mekanik**: genbrug `getApprovalStatus()`, `validateOrderCreation()` fra [ProjectMaterialsContext.tsx](app/src/contexts/ProjectMaterialsContext.tsx)
- **Approval-override-modal**: lift eksisterende logik fra [BOM.tsx](app/src/pages/BOM.tsx) til en delt komponent

## 10. Edge cases

| Case | Håndtering |
|---|---|
| Materiale ændres efter godkendelse | V1: approvals beholdes. V1.1: visuel advarsel hvis `approved_at < updated_at`. |
| Projekt går fra Sendt → Tabt | Approvals beholdes. Porteføljen filtrerer fasen ud. PO'er forbliver — Joachim afgør om de annulleres. |
| Projekt går fra Tabt → Sendt | Materialerne dukker op igen i porteføljen (approvals stadig gyldige). |
| Forskellige enheder for samme standard_material | Blokér bulk-bestilling med fejl. Stille fejl er værre. |
| Breakdown var en fejl | V1: ingen "fortryd"-knap. Brugeren sletter children + nulstiller `replaced_at` manuelt (eller via SQL). Sjælden case. |
| Materiale uden standard_material_id | Indgår ikke i portefølje. Kan stadig godkendes og bestilles direkte fra projekt. |
| `approval_override` ved bulk-bestilling | Modal vises FØR PO'er oprettes. Reason persisteres per linje. |

## 11. RLS og roller

Aktive brugere: Joachim, Christian, Milot, Pernille. Alle har samme rettigheder via Supabase auth.

| Action | Begrænsning |
|---|---|
| Læse portefølje | Alle autentificerede |
| Godkende materiale | Alle autentificerede — `approved_by` logger |
| Tilbagekalde godkendelse | Alle autentificerede |
| Breakdown | Alle autentificerede |
| Bulk-PO | Alle autentificerede |
| approval_override | Alle autentificerede — felter logger by/at/reason |

**V1: ingen rolle-baseret begrænsning** udover auth. Matcher resten af systemet.

## 12. Performance

Forventet skala 2026: 3-10 aktive projekter, 20-80 materialer/projekt, ~500 project_materials, ~200 PO-linjer. Views performant uden index-arbejde.

Hvis skala 10x'es senere: tilføj indexer på `project_materials(standard_material_id)`, `purchase_order_lines(project_material_id, status)`. Materialiseret view kun hvis aggregering >1s.

## 13. Test-strategi (V1)

Manuelle smoke-tests før release:

1. Opret 2-3 projekter med materialer, godkend en delmængde, verificér portefølje
2. Bryd op et generisk materiale — verificér `parent_project_material_id` og `replaced_at`
3. Bulk-bestilling fra 2 projekter — verificér 2 PO'er oprettes med samme `bulk_order_group_id`
4. Faseskift Sendt → Tabt — verificér materialet forsvinder fra porteføljen
5. `approval_override` — bestil et ikke-fully_approved materiale med grund, verificér PO oprettes og override-felter sættes

Automatiseret test: ikke i V1. Kodebasen har minimal eksisterende test-infrastruktur.

## 14. Out of scope

| Idé | Hvorfor udskudt |
|---|---|
| Pris-totaler i porteføljen | Pris ofte ukendt indtil RFQ |
| Auto-promotion konkret → standard_material | Manuel V1 OK, indikator-data først |
| "Fortryd breakdown"-knap | Sjælden, manuel SQL OK |
| Auto-reset approvals ved ændring | Vises ikke før eksplicit ønske |
| Bulk-PDF til leverandør | V1: én PDF pr. PO |
| Quote-acceptance → bulk-pris-auto | V2 |
| Rolle-baseret RLS | Ikke et reelt problem nu |
| Per-supplier-grupperinger i tabel | V2 hvis Milot savner det |
| Excel-eksport | V2 hvis efterspurgt |
| `/projects/:id` workspace + erstatning af ProjectOverview | Egen brainstorm-runde |

## 15. Open questions — afklaret 2026-05-13

1. **`next_delivery_date` — hvilke PO-statusser?** Mørkhøj har flere store delleverancer, så `partially_received` er allerede aktivt og vigtigt. **Beslutning: filtreret på `status IN ('ordered', 'partially_received')`** — ikke kun 'ordered'.
2. **"Send samlet PDF" i bulk-dialog** — **Beslutning: V1.1.** V1 har kun individuelle PO-PDF'er via eksisterende infrastruktur.
3. **"Vis brudt op"-toggle persistens** — **Beslutning: ja, localStorage pr. bruger** (`localStorage.getItem('show_replaced_materials')`).

---

_Næste skridt: User-review af denne spec → writing-plans-skill → implementering._
