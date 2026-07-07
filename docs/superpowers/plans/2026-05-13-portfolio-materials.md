# Portfolio Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementér en porteføljeside (`/portfolio/materials`) der aggregerer godkendte materialer på tværs af projekter, en bulk-bestillings-dialog der opretter N PO'er fra én knap, og en breakdown-flow der bryder generiske materialer op i konkrete children.

**Architecture:** Genbruger eksisterende `fully_approved`-koncept i `project_material_approvals` som lås. Nye nullable kolonner (`parent_project_material_id`, `replaced_at`, `bulk_order_group_id`) sikrer at eksisterende data og kode fortsætter uændret. Aggregering sker via tre nye Postgres-views; ingen materialiserede views (skala er lille). Frontend bruger eksisterende shadcn-komponenter og context-pattern.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind, shadcn UI (Table, Card, Badge, Sheet, Dialog, Select, Switch), Supabase (Postgres + RLS + edge functions), React Context for state, React Router (hash routing).

**Reference spec:** [docs/superpowers/specs/2026-05-13-portfolio-materials-design.md](../specs/2026-05-13-portfolio-materials-design.md)

---

## Task-rækkefølge og afhængigheder

```
Task 1 (Migration) ──┬─ Task 2 (Context types)
                     └─ Task 3 (PortfolioMaterialsContext)
                            │
                            └─ Task 4 (Portfolio page skeleton + route)
                                  │
                                  └─ Task 5 (Portfolio table + filters)
                                         │
                                         └─ Task 6 (Drill-down sheet)
                                                │
                                                └─ Task 7 (BulkOrderDialog)

Task 1 (Migration) ──── Task 8 (BreakdownDialog) ── Task 9 (ProjectMaterialsV1 toggles)

Task 10 (Smoke test + empty-state polish) — sidst
```

Task 1 er fælles forudsætning. Task 2-7 og Task 8-9 kan teoretisk køre parallelt, men i praksis bør de køres sekventielt for at undgå merge-konflikter i ProjectMaterialsContext.tsx.

---

## Task 1: Database migration

**Files:**
- Create: `app/supabase/migrations/2026-05-13_portfolio_materials.sql`

- [ ] **Step 1.1: Inspect current schema for sanity-check**

Run via Supabase MCP:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'project_materials_2026_01_15_06_45'
  AND column_name IN ('parent_project_material_id', 'replaced_at');
```

Expected: empty result (kolonner findes ikke endnu).

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'purchase_orders_2026_01_15_06_45'
  AND column_name = 'bulk_order_group_id';
```

Expected: empty result.

- [ ] **Step 1.2: Write migration file**

Create `app/supabase/migrations/2026-05-13_portfolio_materials.sql`:

```sql
-- Portfolio materials: tværgående indkøbsoverblik + breakdown af generiske materialer
-- Spec: docs/superpowers/specs/2026-05-13-portfolio-materials-design.md

-- 1. Parent-link på project_materials (children fra breakdown peger på generisk parent)
ALTER TABLE project_materials_2026_01_15_06_45
  ADD COLUMN parent_project_material_id uuid NULL
    REFERENCES project_materials_2026_01_15_06_45(id) ON DELETE SET NULL;

COMMENT ON COLUMN project_materials_2026_01_15_06_45.parent_project_material_id IS
  'Hvis dette materiale stammer fra breakdown af et generisk materiale, peger feltet på det generiske.';

-- 2. Audit-timestamp: sat når et generisk materiale er brudt op i konkrete children
ALTER TABLE project_materials_2026_01_15_06_45
  ADD COLUMN replaced_at timestamptz NULL;

COMMENT ON COLUMN project_materials_2026_01_15_06_45.replaced_at IS
  'Sat når et generisk materiale er brudt op i konkrete children. Filtreret fra default-visning og ekskluderet fra portefølje.';

-- 3. Bulk-order grouping: PO''er oprettet fra samme portefølje-bestilling deler dette uuid
ALTER TABLE purchase_orders_2026_01_15_06_45
  ADD COLUMN bulk_order_group_id uuid NULL;

COMMENT ON COLUMN purchase_orders_2026_01_15_06_45.bulk_order_group_id IS
  'Hvis denne PO blev oprettet som del af en samlet bestilling på tværs af projekter, deler den dette uuid med de andre PO''er i bestillingen.';

-- 4. Helper view: hvilke project_materials er fully_approved?
CREATE OR REPLACE VIEW v_approved_project_materials AS
SELECT pm.id AS project_material_id
FROM project_materials_2026_01_15_06_45 pm
WHERE EXISTS (
  SELECT 1 FROM project_material_approvals_2026_01_15_06_45 a
  WHERE a.project_material_id = pm.id
    AND a.type = 'production'
    AND a.status = 'approved'
)
AND EXISTS (
  SELECT 1 FROM project_material_approvals_2026_01_15_06_45 a
  WHERE a.project_material_id = pm.id
    AND a.type = 'sustainability'
    AND a.status = 'approved'
);

-- 5. Helper view: hvilke materialer er klar til portefølje?
CREATE OR REPLACE VIEW v_orderable_project_materials AS
SELECT pm.id AS project_material_id, pm.standard_material_id, pm.project_id, pm.lead_time_days
FROM project_materials_2026_01_15_06_45 pm
WHERE pm.is_generic = false
  AND pm.replaced_at IS NULL
  AND pm.standard_material_id IS NOT NULL
  AND pm.id IN (SELECT project_material_id FROM v_approved_project_materials);

-- 6. Hovedview: aggregeret pr. standard_material på tværs af aktive projekter
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
    MIN(pol.expected_delivery_date)
      FILTER (WHERE pol.status IN ('ordered', 'partially_received')) AS next_delivery_date
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

-- 7. Drill-down view: per material × projekt
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

- [ ] **Step 1.3: Apply migration via Supabase MCP**

Brug `mcp__claude_ai_Supabase__apply_migration` med name=`2026-05-13_portfolio_materials` og SQL fra ovenstående fil.

- [ ] **Step 1.4: Verify migration succeeded**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'project_materials_2026_01_15_06_45'
  AND column_name IN ('parent_project_material_id', 'replaced_at');
```

Expected: 2 rows.

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'purchase_orders_2026_01_15_06_45'
  AND column_name = 'bulk_order_group_id';
```

Expected: 1 row.

```sql
SELECT table_name FROM information_schema.views
WHERE table_name IN ('v_approved_project_materials', 'v_orderable_project_materials', 'v_portfolio_materials', 'v_portfolio_material_projects');
```

Expected: 4 rows.

- [ ] **Step 1.5: Smoke-test views med eksisterende data**

```sql
SELECT COUNT(*) FROM v_portfolio_materials;
```

Expected: tal (kan være 0 hvis ingen materialer er fully_approved endnu — det er forventet).

```sql
SELECT * FROM v_portfolio_materials LIMIT 5;
```

Expected: 0-5 rows. Kontroller at kolonnerne matcher spec'en.

- [ ] **Step 1.6: Audit-log + commit**

Audit-log via Supabase MCP:

```sql
INSERT INTO aios_events_2026_05_12 (actor, type, file, summary)
VALUES ('js@neminventar.dk', 'migration', 'app/supabase/migrations/2026-05-13_portfolio_materials.sql',
        'Portfolio: 3 nye kolonner + 4 views (v_approved, v_orderable, v_portfolio_materials, v_portfolio_material_projects).');
```

Commit:

```bash
git add app/supabase/migrations/2026-05-13_portfolio_materials.sql
git commit -m "Add portfolio materials migration: 3 columns + 4 views"
```

---

## Task 2: Udvid ProjectMaterialsContext med nye felter + breakdown()

**Files:**
- Modify: `app/src/contexts/ProjectMaterialsContext.tsx`

- [ ] **Step 2.1: Verify current interface**

Read `app/src/contexts/ProjectMaterialsContext.tsx` lines 26-56 to confirm `ProjectMaterial` interface starts as shown in spec (sektion 9).

Expected: `ProjectMaterial` har felter som `id`, `projectId`, `standardMaterialId`, `name`, `category`, `unit` osv. Ingen `parentProjectMaterialId` eller `replacedAt` endnu.

- [ ] **Step 2.2: Add new fields to interface**

Modify `app/src/contexts/ProjectMaterialsContext.tsx`, find the `ProjectMaterial` interface and add to it (after `priceNote?`):

```typescript
  // Breakdown linking (V1: portfolio)
  parentProjectMaterialId?: string;
  replacedAt?: Date;
  isGeneric: boolean;
```

(`isGeneric` skal allerede være der via tidligere arbejde — verificér via grep `is_generic` i samme fil. Hvis ikke, tilføj den.)

- [ ] **Step 2.3: Update load-mapping**

Find linje ~196-220 i samme fil hvor rows mappes fra Supabase til `ProjectMaterial`-objekter. Tilføj felter i mapping:

```typescript
        parentProjectMaterialId: m.parent_project_material_id ?? undefined,
        replacedAt: m.replaced_at ? new Date(m.replaced_at) : undefined,
        isGeneric: m.is_generic ?? false,
```

- [ ] **Step 2.4: Add breakdown function to context type**

I `ProjectMaterialsContextType` (omkring linje 58-77), tilføj:

```typescript
  breakdownGenericMaterial: (genericId: string, children: BreakdownChild[]) => Promise<void>;
```

Tilføj også typedefintionen lige før interface'et:

```typescript
export interface BreakdownChild {
  name: string;
  category: string;
  unit: string;
  qty?: number;
  supplierId?: string;
  standardMaterialId?: string;
  notes?: string;
}
```

- [ ] **Step 2.5: Implement breakdownGenericMaterial**

I selve provider-implementationen, find hvor andre funktioner som `addProjectMaterial` ligger og tilføj:

```typescript
  const breakdownGenericMaterial = async (genericId: string, children: BreakdownChild[]) => {
    if (children.length === 0) {
      throw new Error('Mindst én konkret variant skal tilføjes');
    }

    const generic = projectMaterials.find(m => m.id === genericId);
    if (!generic) {
      throw new Error('Generisk materiale ikke fundet');
    }
    if (!generic.isGeneric) {
      throw new Error('Materialet er ikke generisk');
    }
    if (generic.replacedAt) {
      throw new Error('Materialet er allerede brudt op');
    }

    // 1. Insert children
    const childRows = children.map(c => ({
      project_id: generic.projectId,
      parent_project_material_id: genericId,
      is_generic: false,
      name: c.name,
      category: c.category,
      unit: c.unit,
      supplier_id: c.supplierId ?? null,
      standard_material_id: c.standardMaterialId ?? null,
      currency: 'DKK',
      price_status: 'estimated',
      notes: c.notes ?? null,
    }));

    const { error: insertErr } = await supabase
      .from('project_materials_2026_01_15_06_45')
      .insert(childRows);
    if (insertErr) throw insertErr;

    // 2. Mark generic as replaced
    const replacedAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('project_materials_2026_01_15_06_45')
      .update({ replaced_at: replacedAt })
      .eq('id', genericId);
    if (updateErr) throw updateErr;

    // 3. Reload to reflect changes
    await loadProjectMaterials(generic.projectId);
  };
```

(Reload-funktionen hedder `loadProjectMaterials` og tager `projectId` som argument — bekræftet i [ProjectMaterialsContext.tsx:189](app/src/contexts/ProjectMaterialsContext.tsx).)

Tilføj `breakdownGenericMaterial` til provider-value:

```typescript
    <ProjectMaterialsContext.Provider value={{
      // ... existing
      breakdownGenericMaterial,
    }}>
```

- [ ] **Step 2.6: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0. Hvis fejl, fix dem inden commit.

- [ ] **Step 2.7: Commit**

```bash
git add app/src/contexts/ProjectMaterialsContext.tsx
git commit -m "Extend ProjectMaterialsContext with parent_id, replaced_at, breakdown()"
```

---

## Task 3: New PortfolioMaterialsContext

**Files:**
- Create: `app/src/contexts/PortfolioMaterialsContext.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 3.1: Create context file**

Create `app/src/contexts/PortfolioMaterialsContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioMaterial {
  standardMaterialId: string;
  materialName: string;
  category: string | null;
  unit: string;
  primarySupplierId: string | null;
  qtySecure: number;
  qtyTentative: number;
  qtyTotal: number;
  qtyOrdered: number;
  qtyMissing: number;
  nextDeliveryDate: string | null;
  leadTimeDays: number | null;
}

export interface PortfolioMaterialProject {
  standardMaterialId: string;
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  phase: string;
  demandClass: 'secure' | 'tentative';
  qty: number;
  projectMaterialId: string;
}

interface PortfolioMaterialsContextType {
  materials: PortfolioMaterial[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getProjectsForMaterial: (standardMaterialId: string) => Promise<PortfolioMaterialProject[]>;
}

const PortfolioMaterialsContext = createContext<PortfolioMaterialsContextType | undefined>(undefined);

export function PortfolioMaterialsProvider({ children }: { children: ReactNode }) {
  const [materials, setMaterials] = useState<PortfolioMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('v_portfolio_materials')
      .select('*')
      .order('qty_missing', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMaterials(
      (data ?? []).map((r: any) => ({
        standardMaterialId: r.standard_material_id,
        materialName: r.material_name,
        category: r.category,
        unit: r.unit,
        primarySupplierId: r.primary_supplier_id,
        qtySecure: Number(r.qty_secure),
        qtyTentative: Number(r.qty_tentative),
        qtyTotal: Number(r.qty_total),
        qtyOrdered: Number(r.qty_ordered),
        qtyMissing: Number(r.qty_missing),
        nextDeliveryDate: r.next_delivery_date,
        leadTimeDays: r.lead_time_days,
      }))
    );
    setLoading(false);
  }, []);

  const getProjectsForMaterial = useCallback(async (standardMaterialId: string) => {
    const { data, error: err } = await supabase
      .from('v_portfolio_material_projects')
      .select('*')
      .eq('standard_material_id', standardMaterialId);
    if (err) throw err;
    return (data ?? []).map((r: any) => ({
      standardMaterialId: r.standard_material_id,
      projectId: r.project_id,
      projectName: r.project_name,
      projectNumber: r.project_number,
      phase: r.phase,
      demandClass: r.demand_class,
      qty: Number(r.qty),
      projectMaterialId: r.project_material_id,
    }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PortfolioMaterialsContext.Provider value={{ materials, loading, error, refresh, getProjectsForMaterial }}>
      {children}
    </PortfolioMaterialsContext.Provider>
  );
}

export function usePortfolioMaterials() {
  const ctx = useContext(PortfolioMaterialsContext);
  if (!ctx) throw new Error('usePortfolioMaterials must be used within PortfolioMaterialsProvider');
  return ctx;
}
```

- [ ] **Step 3.2: Wrap provider in AppProviders**

Read `app/src/App.tsx` and find `AppProviders` (eller hvor andre Providers stables). Tilføj import:

```typescript
import { PortfolioMaterialsProvider } from '@/contexts/PortfolioMaterialsContext';
```

Wrap `PortfolioMaterialsProvider` mellem `PurchaseOrdersProvider` og det inderste lag (følg eksisterende ordrer):

```tsx
<PurchaseOrdersProvider>
  <PortfolioMaterialsProvider>
    {/* eksisterende children */}
  </PortfolioMaterialsProvider>
</PurchaseOrdersProvider>
```

- [ ] **Step 3.3: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 3.4: Smoke-test i browser**

Start dev server (`npm run dev` via bash for at undgå Unix-syntax-fejl på Windows):

```bash
cd app && VITE_ENABLE_ROUTE_MESSAGING=true npx vite
```

Åbn dev tools console. Verificér ingen errors om PortfolioMaterials. Forventet log: `usePortfolioMaterials` rejser ikke hvis du ikke kalder den endnu.

- [ ] **Step 3.5: Commit**

```bash
git add app/src/contexts/PortfolioMaterialsContext.tsx app/src/App.tsx
git commit -m "Add PortfolioMaterialsContext + provider wrapping"
```

---

## Task 4: Portfolio page skeleton + route

**Files:**
- Create: `app/src/pages/PortfolioMaterials.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/Sidebar.tsx`

- [ ] **Step 4.1: Create page skeleton**

Create `app/src/pages/PortfolioMaterials.tsx`:

```typescript
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { usePortfolioMaterials } from '@/contexts/PortfolioMaterialsContext';

export default function PortfolioMaterials() {
  const { materials, loading, error } = usePortfolioMaterials();

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Produktionsportefølje – Materialer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Indlæser…'
              : error
                ? `Fejl: ${error}`
                : `${materials.filter(m => m.qtyMissing > 0).length} materialer mangler bestilling`}
          </p>
        </div>

        {!loading && !error && materials.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-base font-medium mb-2">Ingen materialer i porteføljen endnu</p>
              <p className="text-sm">
                Materialer dukker op her når de er fuldt godkendt (production + sustainability)
                på et projekt der ikke er Tabt, Arkiv eller Garanti.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && materials.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {/* Placeholder — tabel kommer i Task 5 */}
                {materials.length} materialer fundet. Tabel implementeres næste step.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 4.2: Add route**

Modify `app/src/App.tsx`. Find sektionen med `<Route ...>`-elementer (omkring linje 119-140). Tilføj efter `/quotes`-route:

```tsx
<Route path="/portfolio/materials" element={<ProtectedRoute><AppProviders><PortfolioMaterials /></AppProviders></ProtectedRoute>} />
```

Tilføj import øverst:

```typescript
import PortfolioMaterials from '@/pages/PortfolioMaterials';
```

- [ ] **Step 4.3: Add sidebar link**

Modify `app/src/components/Sidebar.tsx`. Sidebar er en flad menu (ingen grupper) struktureret som array af menu items. Find array-elementet for "Purchase Orders" (omkring linje 155-160) og indsæt et nyt item lige før det:

```tsx
{
  label: 'Portefølje',
  icon: Layers,
  path: '/portfolio/materials',
  active: isActive('/portfolio/materials')
},
```

Tilføj `Layers` til lucide-react-importen øverst i filen hvis den ikke allerede er der:

```tsx
import { ..., Layers } from 'lucide-react';
```

(Bekræft via grep at Layers ikke allerede er importeret.)

- [ ] **Step 4.4: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 4.5: Smoke-test i browser**

Start dev server. Naviger til `/#/portfolio/materials`. Verificér:
- Siden loader uden errors
- Hvis ingen approved materials: empty-state-tekst vises
- Hvis approved materials findes: "X materialer fundet"-tekst
- Sidebar-link "Portefølje" virker

- [ ] **Step 4.6: Commit**

```bash
git add app/src/pages/PortfolioMaterials.tsx app/src/App.tsx app/src/components/Sidebar.tsx
git commit -m "Add /portfolio/materials route + skeleton page + sidebar link"
```

---

## Task 5: Portfolio table + filters

**Files:**
- Create: `app/src/components/portfolio/PortfolioTable.tsx`
- Create: `app/src/components/portfolio/PortfolioFilters.tsx`
- Modify: `app/src/pages/PortfolioMaterials.tsx`

- [ ] **Step 5.1: Create PortfolioFilters component**

Create `app/src/components/portfolio/PortfolioFilters.tsx`:

```typescript
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

export interface PortfolioFiltersState {
  search: string;
  supplierId: string;
  category: string;
  leadTimeBand: 'all' | 'lt7' | '7-14' | 'gt14' | 'unknown';
  showFullyOrdered: boolean;
}

interface Props {
  state: PortfolioFiltersState;
  onChange: (state: PortfolioFiltersState) => void;
  suppliers: { id: string; name: string }[];
  categories: string[];
}

export default function PortfolioFilters({ state, onChange, suppliers, categories }: Props) {
  const update = (patch: Partial<PortfolioFiltersState>) => onChange({ ...state, ...patch });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søg på materiale, kategori, leverandør…"
          value={state.search}
          onChange={e => update({ search: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={state.supplierId || 'all'} onValueChange={v => update({ supplierId: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Leverandør" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle leverandører</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={state.category || 'all'} onValueChange={v => update({ category: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={state.leadTimeBand} onValueChange={v => update({ leadTimeBand: v as PortfolioFiltersState['leadTimeBand'] })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Lead time" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle lead times</SelectItem>
            <SelectItem value="lt7">&lt; 7 dage</SelectItem>
            <SelectItem value="7-14">7–14 dage</SelectItem>
            <SelectItem value="gt14">&gt; 14 dage</SelectItem>
            <SelectItem value="unknown">Ukendt</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="show-fully-ordered"
            checked={state.showFullyOrdered}
            onCheckedChange={v => update({ showFullyOrdered: v })}
          />
          <Label htmlFor="show-fully-ordered" className="text-sm cursor-pointer">
            Vis fuldt bestilt
          </Label>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: Create PortfolioTable component**

Create `app/src/components/portfolio/PortfolioTable.tsx`:

```typescript
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { PortfolioMaterial } from '@/contexts/PortfolioMaterialsContext';

interface Props {
  materials: PortfolioMaterial[];
  onRowClick: (material: PortfolioMaterial) => void;
}

type GroupKey = 'missing' | 'in_progress' | 'fully_ordered';

function classifyMaterial(m: PortfolioMaterial): GroupKey {
  if (m.qtyMissing > 0) return 'missing';
  // qty_missing === 0
  // Antagelse: hvis qtyOrdered > 0 og qty_missing = 0 = i proces eller fuldt bestilt.
  // Vi har ikke i view'et "alt modtaget"-flag — derfor klassificerer vi alt med qty_missing=0 som "in_progress"
  // medmindre der er en fremtidig udvidelse. Spec siger "fully ordered" = alt modtaget; det kræver et ekstra felt.
  // V1: vi viser kun missing + in_progress. "FULDT BESTILT" forbliver tom indtil V1.1.
  return 'in_progress';
}

const groupLabels: Record<GroupKey, string> = {
  missing: 'MANGLER AT BESTILLE',
  in_progress: 'KLAR / I PROCES',
  fully_ordered: 'FULDT BESTILT',
};

const groupOpenDefault: Record<GroupKey, boolean> = {
  missing: true,
  in_progress: false,
  fully_ordered: false,
};

export default function PortfolioTable({ materials, onRowClick }: Props) {
  const groups = useMemo(() => {
    const m = new Map<GroupKey, PortfolioMaterial[]>();
    m.set('missing', []);
    m.set('in_progress', []);
    m.set('fully_ordered', []);
    for (const mat of materials) {
      m.get(classifyMaterial(mat))!.push(mat);
    }
    return m;
  }, [materials]);

  return (
    <div className="space-y-4">
      {(['missing', 'in_progress', 'fully_ordered'] as GroupKey[]).map(g => (
        <GroupCard
          key={g}
          label={groupLabels[g]}
          materials={groups.get(g) ?? []}
          defaultOpen={groupOpenDefault[g]}
          onRowClick={onRowClick}
        />
      ))}
    </div>
  );
}

function GroupCard({ label, materials, defaultOpen, onRowClick }: {
  label: string; materials: PortfolioMaterial[]; defaultOpen: boolean; onRowClick: (m: PortfolioMaterial) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted/30">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold text-sm tracking-wide">{label}</span>
            <Badge variant="outline" className="ml-2">{materials.length}</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            {materials.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Ingen materialer i denne gruppe</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Materiale</TableHead>
                    <TableHead>Enhed</TableHead>
                    <TableHead className="text-right">Sikre</TableHead>
                    <TableHead className="text-right">Tent.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Bestilt</TableHead>
                    <TableHead className="text-right">Mangler</TableHead>
                    <TableHead>Næste lev.</TableHead>
                    <TableHead>Lead time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map(m => (
                    <TableRow key={m.standardMaterialId} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(m)}>
                      <TableCell className="font-medium">
                        {m.materialName}
                        {m.category && <Badge variant="secondary" className="ml-2 text-xs">{m.category}</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.unit}</TableCell>
                      <TableCell className="text-right text-blue-700">{m.qtySecure || '—'}</TableCell>
                      <TableCell className="text-right text-muted-foreground italic">{m.qtyTentative || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{m.qtyTotal}</TableCell>
                      <TableCell className={`text-right ${m.qtyOrdered >= m.qtySecure && m.qtyOrdered > 0 ? 'text-green-700' : ''}`}>
                        {m.qtyOrdered || '—'}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${m.qtyMissing > 0 ? 'text-red-600' : ''}`}>
                        {m.qtyMissing > 0 && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {m.qtyMissing || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.nextDeliveryDate ? new Date(m.nextDeliveryDate).toLocaleDateString('da-DK') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.leadTimeDays != null ? `${m.leadTimeDays} dage` : 'Ukendt'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

- [ ] **Step 5.3: Integrate into PortfolioMaterials page**

Modify `app/src/pages/PortfolioMaterials.tsx`. Replace placeholder section with:

```typescript
import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { usePortfolioMaterials, PortfolioMaterial } from '@/contexts/PortfolioMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import PortfolioFilters, { PortfolioFiltersState } from '@/components/portfolio/PortfolioFilters';
import PortfolioTable from '@/components/portfolio/PortfolioTable';

export default function PortfolioMaterials() {
  const { materials, loading, error } = usePortfolioMaterials();
  const { suppliers: standardSuppliers } = useStandardSuppliers();

  const [filters, setFilters] = useState<PortfolioFiltersState>({
    search: '',
    supplierId: '',
    category: '',
    leadTimeBand: 'all',
    showFullyOrdered: false,
  });

  const supplierMap = useMemo(() => {
    const m = new Map<string, string>();
    standardSuppliers.forEach(s => m.set(s.id, s.name));
    return m;
  }, [standardSuppliers]);

  const supplierOptions = useMemo(() => {
    const ids = new Set<string>();
    materials.forEach(m => { if (m.primarySupplierId) ids.add(m.primarySupplierId); });
    return Array.from(ids).map(id => ({ id, name: supplierMap.get(id) ?? '(ukendt)' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, supplierMap]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    materials.forEach(m => { if (m.category) s.add(m.category); });
    return Array.from(s).sort();
  }, [materials]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return materials.filter(m => {
      if (search) {
        const supplierName = m.primarySupplierId ? (supplierMap.get(m.primarySupplierId) ?? '').toLowerCase() : '';
        const hay = [m.materialName, m.category ?? '', supplierName].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (filters.supplierId && m.primarySupplierId !== filters.supplierId) return false;
      if (filters.category && m.category !== filters.category) return false;
      if (filters.leadTimeBand !== 'all') {
        const lt = m.leadTimeDays;
        if (filters.leadTimeBand === 'unknown' && lt != null) return false;
        if (filters.leadTimeBand === 'lt7' && (lt == null || lt >= 7)) return false;
        if (filters.leadTimeBand === '7-14' && (lt == null || lt < 7 || lt > 14)) return false;
        if (filters.leadTimeBand === 'gt14' && (lt == null || lt <= 14)) return false;
      }
      return true;
    });
  }, [materials, filters, supplierMap]);

  const [selected, setSelected] = useState<PortfolioMaterial | null>(null);

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Produktionsportefølje – Materialer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Indlæser…'
              : error
                ? `Fejl: ${error}`
                : `${filtered.filter(m => m.qtyMissing > 0).length} materialer mangler bestilling`}
          </p>
        </div>

        {!loading && !error && (
          <Card>
            <CardContent className="pt-4">
              <PortfolioFilters
                state={filters}
                onChange={setFilters}
                suppliers={supplierOptions}
                categories={categoryOptions}
              />
            </CardContent>
          </Card>
        )}

        {!loading && !error && materials.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-base font-medium mb-2">Ingen materialer i porteføljen endnu</p>
              <p className="text-sm">
                Materialer dukker op her når de er fuldt godkendt (production + sustainability)
                på et projekt der ikke er Tabt, Arkiv eller Garanti.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && materials.length > 0 && (
          <PortfolioTable
            materials={filtered}
            onRowClick={m => setSelected(m)}
          />
        )}

        {/* Drill-down sheet kommer i Task 6 */}
        {selected && (
          <div className="text-xs text-muted-foreground">
            (Drill-down for {selected.materialName} kommer i næste task)
          </div>
        )}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 5.4: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 5.5: Smoke-test i browser**

Hvis du har et eller flere materialer der er fully_approved: åbn `/#/portfolio/materials` og verificér:
- Tabel-grupperne renderes
- Filtre fungerer (søg, leverandør, kategori, lead time)
- Klik på en række sætter `selected` (toggler placeholder-tekst)

Hvis ingen materialer er fully_approved: empty-state vises stadig.

- [ ] **Step 5.6: Commit**

```bash
git add app/src/components/portfolio/ app/src/pages/PortfolioMaterials.tsx
git commit -m "Add PortfolioTable + PortfolioFilters with grouping and filtering"
```

---

## Task 6: Drill-down sheet

**Files:**
- Create: `app/src/components/portfolio/PortfolioMaterialDrilldown.tsx`
- Modify: `app/src/pages/PortfolioMaterials.tsx`

- [ ] **Step 6.1: Create drill-down component**

Create `app/src/components/portfolio/PortfolioMaterialDrilldown.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioMaterial, PortfolioMaterialProject, usePortfolioMaterials } from '@/contexts/PortfolioMaterialsContext';

interface Props {
  material: PortfolioMaterial | null;
  onClose: () => void;
  onClickBulkOrder: (material: PortfolioMaterial, projects: PortfolioMaterialProject[]) => void;
}

interface ActivePO {
  id: string;
  project_id: string;
  supplier_id: string;
  status: string;
  expected_delivery_date: string | null;
  ordered_qty: number;
  unit: string;
}

export default function PortfolioMaterialDrilldown({ material, onClose, onClickBulkOrder }: Props) {
  const { getProjectsForMaterial } = usePortfolioMaterials();
  const [projects, setProjects] = useState<PortfolioMaterialProject[]>([]);
  const [activePOs, setActivePOs] = useState<ActivePO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!material) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const projs = await getProjectsForMaterial(material.standardMaterialId);
      const projectMaterialIds = projs.map(p => p.projectMaterialId);

      let pos: ActivePO[] = [];
      if (projectMaterialIds.length > 0) {
        const { data } = await supabase
          .from('purchase_order_lines_2026_01_15_06_45')
          .select('id, purchase_order_id, ordered_qty, unit, status, expected_delivery_date, supplier_id, purchase_orders_2026_01_15_06_45(id, project_id)')
          .in('project_material_id', projectMaterialIds)
          .neq('status', 'cancelled')
          .neq('status', 'received');
        if (data) {
          pos = data.map((r: any) => ({
            id: r.purchase_order_id,
            project_id: r.purchase_orders_2026_01_15_06_45?.project_id ?? '',
            supplier_id: r.supplier_id,
            status: r.status,
            expected_delivery_date: r.expected_delivery_date,
            ordered_qty: Number(r.ordered_qty),
            unit: r.unit,
          }));
        }
      }

      if (!cancelled) {
        setProjects(projs);
        setActivePOs(pos);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [material, getProjectsForMaterial]);

  if (!material) return null;

  return (
    <Sheet open={!!material} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{material.materialName}</SheetTitle>
          <SheetDescription>
            Total: {material.qtyTotal} {material.unit} ·
            Bestilt: {material.qtyOrdered} ·
            Mangler: {material.qtyMissing}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Fordeling pr. projekt
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Indlæser…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead className="text-right">Mængde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(p => (
                    <TableRow key={p.projectMaterialId}>
                      <TableCell className="font-medium">{p.projectName}</TableCell>
                      <TableCell>
                        <Badge variant={p.demandClass === 'secure' ? 'default' : 'outline'}>
                          {p.demandClass === 'secure' ? 'Sikker' : 'Tentativ'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{p.qty} {material.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Aktive ordrer (PO, status ≠ received & ≠ cancelled)
            </h3>
            {activePOs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen aktive ordrer</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead className="text-right">Mængde</TableHead>
                    <TableHead>Forventet</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePOs.map(po => (
                    <TableRow key={po.id + po.expected_delivery_date}>
                      <TableCell className="font-mono text-xs">{po.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-right">{po.ordered_qty} {po.unit}</TableCell>
                      <TableCell>{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('da-DK') : '—'}</TableCell>
                      <TableCell><Badge variant="outline">{po.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => onClickBulkOrder(material, projects)}
              disabled={material.qtyMissing === 0 || loading || projects.length === 0}
            >
              Bestil resterende {material.qtyMissing} {material.unit}
            </Button>
            <Button variant="outline" disabled>
              Start RFQ (V1.1)
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 6.2: Wire drill-down into page**

Modify `app/src/pages/PortfolioMaterials.tsx`. Erstat den eksisterende `{selected && ...}`-blok med:

```tsx
        <PortfolioMaterialDrilldown
          material={selected}
          onClose={() => setSelected(null)}
          onClickBulkOrder={(mat, projs) => {
            // BulkOrderDialog kommer i Task 7 — for nu, log til console
            console.log('Bulk order clicked for', mat, projs);
          }}
        />
```

Add import:

```typescript
import PortfolioMaterialDrilldown from '@/components/portfolio/PortfolioMaterialDrilldown';
```

- [ ] **Step 6.3: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 6.4: Smoke-test i browser**

Klik på en række i porteføljetabellen. Verificér:
- Sheet åbner fra højre
- "Fordeling pr. projekt" viser de korrekte projekter med fase-badges
- "Aktive ordrer" viser PO'er hvis de findes
- "Bestil resterende"-knap er disabled hvis qtyMissing er 0, ellers enabled (men loggers kun til console)
- Klik X eller udenfor lukker sheet

- [ ] **Step 6.5: Commit**

```bash
git add app/src/components/portfolio/PortfolioMaterialDrilldown.tsx app/src/pages/PortfolioMaterials.tsx
git commit -m "Add portfolio drill-down sheet with projects + active POs"
```

---

## Task 7: BulkOrderDialog

**Files:**
- Create: `app/src/components/portfolio/BulkOrderDialog.tsx`
- Modify: `app/src/pages/PortfolioMaterials.tsx`

- [ ] **Step 7.1: Create BulkOrderDialog**

Create `app/src/components/portfolio/BulkOrderDialog.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { usePortfolioMaterials, PortfolioMaterial, PortfolioMaterialProject } from '@/contexts/PortfolioMaterialsContext';
import { useToast } from '@/hooks/use-toast';

// Note: PurchaseOrdersContext har ingen refresh()-funktion. Den indlæses automatisk når
// activeProject skifter. Portfolio-view'et opdateres via usePortfolioMaterials().refresh()
// efter bulk-bestillingen, og hvis brugeren navigerer til /project/purchase-orders
// vil de nye PO'er være synlige fra næste reload.

interface Props {
  open: boolean;
  material: PortfolioMaterial | null;
  projects: PortfolioMaterialProject[];
  onClose: () => void;
}

interface RowState {
  projectMaterialId: string;
  projectId: string;
  projectName: string;
  demandClass: 'secure' | 'tentative';
  needed: number;
  selected: boolean;
  qty: number;
  unitPrice?: number;
  approvalOverrideReason?: string;
}

function generateUuid(): string {
  // crypto.randomUUID er tilgængelig i moderne browsere
  // @ts-ignore
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function BulkOrderDialog({ open, material, projects, onClose }: Props) {
  const { suppliers: standardSuppliers } = useStandardSuppliers();
  const { projectMaterials, isFullyApproved } = useProjectMaterials();
  const { refresh: refreshPortfolio } = usePortfolioMaterials();
  const { toast } = useToast();

  const [supplierId, setSupplierId] = useState<string>('');
  const [globalPrice, setGlobalPrice] = useState<string>('');
  const [usePriceForAll, setUsePriceForAll] = useState(true);
  const [expectedDelivery, setExpectedDelivery] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<RowState[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!material) return;
    setSupplierId(material.primarySupplierId ?? '');
    setRows(projects.map(p => {
      const ordered = 0; // backend kunne aggregere bedre; for V1 viser vi behov fra view
      const needed = Math.max(p.qty - ordered, 0);
      return {
        projectMaterialId: p.projectMaterialId,
        projectId: p.projectId,
        projectName: p.projectName,
        demandClass: p.demandClass,
        needed,
        selected: needed > 0,
        qty: needed,
      };
    }));
    setGlobalPrice('');
    setUsePriceForAll(true);
    setExpectedDelivery('');
    setNotes('');
  }, [material, projects]);

  if (!material) return null;

  const selectedRows = rows.filter(r => r.selected);
  const totalQty = selectedRows.reduce((sum, r) => sum + (r.qty || 0), 0);
  const numericPrice = parseFloat(globalPrice);
  const estimatedPrice = (Number.isFinite(numericPrice) && usePriceForAll)
    ? numericPrice * totalQty
    : selectedRows.reduce((sum, r) => sum + ((r.unitPrice ?? 0) * (r.qty || 0)), 0);

  const hasTentative = selectedRows.some(r => r.demandClass === 'tentative');
  const notApprovedRows = selectedRows.filter(r => !isFullyApproved(r.projectMaterialId));
  const hasOverrideNeeds = notApprovedRows.length > 0;

  // Enhedsmismatch-validering: alle valgte projektmaterialer skal have samme enhed som standard_material
  const selectedProjectMaterials = selectedRows
    .map(r => projectMaterials.find(pm => pm.id === r.projectMaterialId))
    .filter(Boolean);
  const distinctUnits = new Set(selectedProjectMaterials.map(pm => pm!.unit));
  const hasUnitMismatch = distinctUnits.size > 1
    || (distinctUnits.size === 1 && !distinctUnits.has(material.unit));

  const canSubmit = !!supplierId
    && selectedRows.length > 0
    && selectedRows.every(r => r.qty > 0)
    && !hasUnitMismatch
    && (!hasOverrideNeeds || notApprovedRows.every(r => (r.approvalOverrideReason ?? '').trim().length > 0));

  async function handleSubmit() {
    if (!material || !canSubmit) return;
    setSubmitting(true);
    const bulkGroupId = generateUuid();
    const today = new Date().toISOString().split('T')[0];

    try {
      for (const row of selectedRows) {
        // 1. Opret PO
        const { data: po, error: poErr } = await supabase
          .from('purchase_orders_2026_01_15_06_45')
          .insert({
            project_id: row.projectId,
            supplier_id: supplierId,
            status: 'ordered',
            order_date: today,
            expected_delivery_date: expectedDelivery || null,
            notes: notes || null,
            bulk_order_group_id: bulkGroupId,
          })
          .select('id')
          .single();
        if (poErr) throw poErr;

        const pmRow = projectMaterials.find(pm => pm.id === row.projectMaterialId);
        const unit = pmRow?.unit ?? material.unit;
        const rowPrice = usePriceForAll
          ? (Number.isFinite(numericPrice) ? numericPrice : null)
          : (row.unitPrice ?? null);

        const needsOverride = !isFullyApproved(row.projectMaterialId);

        // 2. Opret PO-linje
        const { error: lineErr } = await supabase
          .from('purchase_order_lines_2026_01_15_06_45')
          .insert({
            purchase_order_id: po.id,
            project_material_id: row.projectMaterialId,
            supplier_id: supplierId,
            ordered_qty: row.qty,
            unit,
            unit_price: rowPrice,
            currency: 'DKK',
            expected_delivery_date: expectedDelivery || null,
            status: 'ordered',
            approval_override: needsOverride,
            approval_override_reason: needsOverride ? (row.approvalOverrideReason ?? null) : null,
            approval_override_by: needsOverride ? 'current_user' : null, // TODO: replace with actual user when auth context is wired
            approval_override_at: needsOverride ? new Date().toISOString() : null,
          });
        if (lineErr) throw lineErr;
      }

      toast({
        title: 'Bestilling oprettet',
        description: `${selectedRows.length} PO'er oprettet og grupperet.`,
      });

      await refreshPortfolio();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Fejl ved oprettelse',
        description: err.message ?? 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bestil {material.materialName}</DialogTitle>
          <DialogDescription>
            {material.qtyMissing} {material.unit} mangler at blive bestilt på tværs af projekter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="supplier">Leverandør</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier"><SelectValue placeholder="Vælg leverandør" /></SelectTrigger>
              <SelectContent>
                {standardSuppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {material.primarySupplierId && supplierId === material.primarySupplierId && (
              <p className="text-xs text-muted-foreground mt-1">Foreslået fra primær leverandør</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Pris pr. {material.unit} (DKK)</Label>
              <Input id="price" type="number" step="0.01" value={globalPrice} onChange={e => setGlobalPrice(e.target.value)} placeholder="(valgfri)" />
              <div className="flex items-center gap-2 mt-2">
                <Switch id="use-for-all" checked={usePriceForAll} onCheckedChange={setUsePriceForAll} />
                <Label htmlFor="use-for-all" className="text-xs cursor-pointer">Brug for alle linjer (når OFF: individuel pris pr. projekt-linje)</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="delivery">Forventet levering</Label>
              <Input id="delivery" type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Noter</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block">Fordeling pr. projekt</Label>
            <div className="space-y-2">
              {rows.map((row, idx) => {
                const needsOverride = row.selected && !isFullyApproved(row.projectMaterialId);
                return (
                  <div key={row.projectMaterialId} className="space-y-1 border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={v => {
                          const next = [...rows];
                          next[idx] = { ...row, selected: !!v };
                          setRows(next);
                        }}
                      />
                      <span className="flex-1 text-sm font-medium">{row.projectName}</span>
                      {row.demandClass === 'tentative' && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> tent.
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">Mangler {row.needed}</span>
                      <Input
                        type="number"
                        value={row.qty}
                        onChange={e => {
                          const next = [...rows];
                          next[idx] = { ...row, qty: parseFloat(e.target.value) || 0 };
                          setRows(next);
                        }}
                        className="w-24 h-8"
                      />
                      <span className="text-xs">{material.unit}</span>
                    </div>
                    {!usePriceForAll && row.selected && (
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`Pris pr. ${material.unit}`}
                        value={row.unitPrice ?? ''}
                        onChange={e => {
                          const next = [...rows];
                          next[idx] = { ...row, unitPrice: parseFloat(e.target.value) || undefined };
                          setRows(next);
                        }}
                        className="h-8"
                      />
                    )}
                    {needsOverride && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                        <p className="text-xs text-amber-800 mb-1">
                          ⚠ Materialet er ikke fully_approved på dette projekt. Skriv en grund:
                        </p>
                        <Textarea
                          value={row.approvalOverrideReason ?? ''}
                          onChange={e => {
                            const next = [...rows];
                            next[idx] = { ...row, approvalOverrideReason: e.target.value };
                            setRows(next);
                          }}
                          placeholder="Fx 'Hastebestilling, godkendelse afventer DGNB-svar'"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span>Total bestilling:</span>
              <span className="font-semibold">{totalQty} {material.unit}</span>
            </div>
            {estimatedPrice > 0 && (
              <div className="flex justify-between text-sm">
                <span>Estimeret pris:</span>
                <span className="font-semibold">{estimatedPrice.toLocaleString('da-DK')} DKK</span>
              </div>
            )}
            {hasTentative && (
              <p className="text-xs text-amber-700 mt-2">
                ⚠ Mindst ét projekt er tentativt (Tilbud/Sendt) — du bestiller før vi har vundet
              </p>
            )}
            {hasUnitMismatch && (
              <p className="text-xs text-red-700 mt-2">
                ⛔ Enheder matcher ikke mellem projekterne. Ret data på materialerne først (alle skal have enhed "{material.unit}").
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Opretter…' : `Opret ${selectedRows.length} PO'er`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7.2: Wire into PortfolioMaterials**

Modify `app/src/pages/PortfolioMaterials.tsx`. Add state og component:

```typescript
const [bulkOrderState, setBulkOrderState] = useState<{ material: PortfolioMaterial; projects: PortfolioMaterialProject[] } | null>(null);
```

Erstat console.log-blokken i `onClickBulkOrder`:

```tsx
onClickBulkOrder={(mat, projs) => {
  setBulkOrderState({ material: mat, projects: projs });
  setSelected(null);
}}
```

Add component nederst (før lukke-tag på div):

```tsx
<BulkOrderDialog
  open={!!bulkOrderState}
  material={bulkOrderState?.material ?? null}
  projects={bulkOrderState?.projects ?? []}
  onClose={() => setBulkOrderState(null)}
/>
```

Add import + import PortfolioMaterialProject:

```typescript
import BulkOrderDialog from '@/components/portfolio/BulkOrderDialog';
import { PortfolioMaterialProject } from '@/contexts/PortfolioMaterialsContext';
```

- [ ] **Step 7.3: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 7.4: Smoke-test i browser**

1. Åbn `/#/portfolio/materials`
2. Klik på en række hvor `qty_missing > 0`
3. Klik "Bestil resterende"
4. Verificér dialog åbner med projekter listet
5. Vælg leverandør, sæt pris, tryk "Opret"
6. Verificér toast siger "Bestilling oprettet"
7. Verificér i Supabase at PO'er er oprettet med samme `bulk_order_group_id`:

```sql
SELECT id, project_id, supplier_id, bulk_order_group_id, created_at
FROM purchase_orders_2026_01_15_06_45
ORDER BY created_at DESC LIMIT 5;
```

- [ ] **Step 7.5: Commit**

```bash
git add app/src/components/portfolio/BulkOrderDialog.tsx app/src/pages/PortfolioMaterials.tsx
git commit -m "Add bulk-order dialog: create N POs with shared bulk_order_group_id"
```

---

## Task 8: BreakdownDialog

**Files:**
- Create: `app/src/components/materials/BreakdownDialog.tsx`

- [ ] **Step 8.1: Create BreakdownDialog**

Create `app/src/components/materials/BreakdownDialog.tsx`:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { useProjectMaterials, BreakdownChild, ProjectMaterial } from '@/contexts/ProjectMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { useStandardMaterials } from '@/contexts/StandardMaterialsContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  material: ProjectMaterial | null;
  onClose: () => void;
}

interface ChildRow extends BreakdownChild {
  id: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export default function BreakdownDialog({ open, material, onClose }: Props) {
  const { breakdownGenericMaterial } = useProjectMaterials();
  const { suppliers: standardSuppliers } = useStandardSuppliers();
  const { standardMaterials } = useStandardMaterials();
  const { toast } = useToast();

  const [rows, setRows] = useState<ChildRow[]>([
    { id: uid(), name: '', category: material?.category ?? '', unit: material?.unit ?? 'stk' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  if (!material) return null;

  const update = (id: string, patch: Partial<BreakdownChild>) => {
    setRows(rows.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const addRow = () => {
    setRows([...rows, { id: uid(), name: '', category: material.category, unit: material.unit }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const canSubmit = rows.length > 0 && rows.every(r => r.name.trim().length > 0 && r.unit.trim().length > 0);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const children: BreakdownChild[] = rows.map(r => ({
        name: r.name.trim(),
        category: r.category.trim() || 'Generel',
        unit: r.unit.trim(),
        qty: r.qty,
        supplierId: r.supplierId,
        standardMaterialId: r.standardMaterialId,
        notes: r.notes,
      }));

      await breakdownGenericMaterial(material.id, children);

      toast({
        title: 'Brudt op',
        description: `${children.length} konkrete materialer oprettet. Husk at godkende dem før bestilling.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err.message ?? 'Ukendt fejl', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bryd op: {material.name}</DialogTitle>
          <DialogDescription>
            {material.notes && <span>"{material.notes}" · </span>}
            Den generiske post beholdes som audit-trail med replaced_at. Skjules som default på materialesiden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {rows.map(row => (
            <div key={row.id} className="grid grid-cols-[1fr_140px_100px_100px_160px_40px] gap-2 items-end border rounded p-2">
              <div>
                <Label className="text-xs">Navn</Label>
                <Input value={row.name} onChange={e => update(row.id, { name: e.target.value })} placeholder="Fx Hængsel 165° BLUM" />
              </div>
              <div>
                <Label className="text-xs">Kategori</Label>
                <Input value={row.category} onChange={e => update(row.id, { category: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Enhed</Label>
                <Input value={row.unit} onChange={e => update(row.id, { unit: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Antal</Label>
                <Input
                  type="number"
                  value={row.qty ?? ''}
                  onChange={e => update(row.id, { qty: parseFloat(e.target.value) || undefined })}
                />
              </div>
              <div>
                <Label className="text-xs">Leverandør</Label>
                <Select value={row.supplierId ?? ''} onValueChange={v => update(row.id, { supplierId: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="(valgfri)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">(ingen)</SelectItem>
                    {standardSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" /> Tilføj række
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Bryder op…' : 'Bryd op'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8.2: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 8.3: Commit**

```bash
git add app/src/components/materials/BreakdownDialog.tsx
git commit -m "Add BreakdownDialog component for splitting generic materials"
```

---

## Task 9: ProjectMaterialsV1 updates ("Bryd op"-knap + "Vis brudt op"-toggle)

**Files:**
- Modify: `app/src/pages/ProjectMaterialsV1.tsx`

- [ ] **Step 9.1: Read existing structure**

Read `app/src/pages/ProjectMaterialsV1.tsx` til konteksten omkring header (linje ~220-240) hvor filtre ligger, og hvor materiale-rækker renderes (linje ~940-960).

- [ ] **Step 9.2: Add showReplaced state + localStorage**

I komponentens state-section, tilføj:

```typescript
const [showReplaced, setShowReplaced] = useState<boolean>(() => {
  try {
    return localStorage.getItem('show_replaced_materials') === 'true';
  } catch { return false; }
});

useEffect(() => {
  try {
    localStorage.setItem('show_replaced_materials', showReplaced ? 'true' : 'false');
  } catch { /* ignore */ }
}, [showReplaced]);
```

- [ ] **Step 9.3: Add toggle to header**

I header-row (find hvor genericFilter eller andre filter-elementer er), tilføj efter eksisterende filtre:

```tsx
<div className="flex items-center gap-2">
  <Switch
    id="show-replaced"
    checked={showReplaced}
    onCheckedChange={setShowReplaced}
  />
  <Label htmlFor="show-replaced" className="text-sm cursor-pointer">
    Vis brudt op
  </Label>
</div>
```

Import Switch og Label hvis ikke importeret:

```typescript
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
```

- [ ] **Step 9.4: Filter out replaced materials by default**

I [ProjectMaterialsV1.tsx](app/src/pages/ProjectMaterialsV1.tsx) eksisterer der i forvejen et filter-udtryk omkring linje 235-245 hvor `genericFilter` checkes. Tilføj en ny linje INDE I dette filter-udtryk (det er sandsynligvis en `.filter(material => ...)` chain):

```typescript
// Skjul brudt-op materialer hvis showReplaced er false
const matchesReplacedFilter = showReplaced || !material.replacedAt;
```

Inkluder `matchesReplacedFilter` i den eksisterende boolean-kæde der returneres. F.eks. hvis nuværende return er `return matchesGeneric && matchesSearch;`, så bliver det `return matchesGeneric && matchesSearch && matchesReplacedFilter;`.

- [ ] **Step 9.5: Add "Bryd op"-knap til materiale-rækker**

Find hvor edit-ikon vises på en materialerække (sandsynligvis omkring linje 1000-1050). Tilføj betinget en "Bryd op"-knap:

```tsx
{material.isGeneric && !material.replacedAt && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setBreakdownTarget(material)}
    title="Bryd op i konkrete materialer"
  >
    <Scissors className="h-4 w-4" />
  </Button>
)}
```

Hvor `material.replacedAt` markerer at den allerede er brudt op (gråtonet, badge "Brudt op").

For rækker hvor `replacedAt` er sat, tilføj badge:

```tsx
{material.replacedAt && (
  <Badge variant="secondary" className="text-xs">Brudt op</Badge>
)}
```

Import:

```typescript
import { Scissors } from 'lucide-react';
import BreakdownDialog from '@/components/materials/BreakdownDialog';
import { ProjectMaterial } from '@/contexts/ProjectMaterialsContext';
```

- [ ] **Step 9.6: Wire BreakdownDialog**

State:

```typescript
const [breakdownTarget, setBreakdownTarget] = useState<ProjectMaterial | null>(null);
```

Component nederst (før Layout-lukke-tag):

```tsx
<BreakdownDialog
  open={!!breakdownTarget}
  material={breakdownTarget}
  onClose={() => setBreakdownTarget(null)}
/>
```

- [ ] **Step 9.7: Type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 9.8: Smoke-test i browser**

1. Åbn et projekt med generisk materiale
2. Verificér "Bryd op"-knap vises på generic-rækker
3. Klik på knap → dialog åbner
4. Tilføj 2-3 children, tryk "Bryd op"
5. Verificér toast og refresh
6. Verificér den generiske row forsvinder (eller vises gråtonet hvis "Vis brudt op" er ON)
7. Tilbage til materialesiden — toggle "Vis brudt op" og se at den generiske dukker op igen med "Brudt op"-badge
8. Verificér i Supabase:

```sql
SELECT id, name, is_generic, parent_project_material_id, replaced_at
FROM project_materials_2026_01_15_06_45
WHERE parent_project_material_id IS NOT NULL OR replaced_at IS NOT NULL
ORDER BY created_at DESC LIMIT 10;
```

- [ ] **Step 9.9: Commit**

```bash
git add app/src/pages/ProjectMaterialsV1.tsx
git commit -m "Wire 'Bryd op' button + 'Vis brudt op' toggle in ProjectMaterialsV1"
```

---

## Task 10: Smoke-test + polish

**Files:** none

- [ ] **Step 10.1: Full end-to-end smoke-test**

Kør i rækkefølge:

1. **Database**: Verificér views eksisterer (`SELECT * FROM v_portfolio_materials LIMIT 1`)
2. **Project setup**: Vælg et projekt med min. 2 materialer (1 generisk, 1 specifik med standard_material_id)
3. **Approve**: Brug eksisterende UI til at sætte production + sustainability approval på det specifikke materiale → fully_approved
4. **Verify portfolio**: Åbn `/#/portfolio/materials` → materialet skal vises i "MANGLER AT BESTILLE"
5. **Drill-down**: Klik på materialet → sheet åbner med projektet listet
6. **Breakdown**: Naviger til projektets materialeside → klik "Bryd op" på den generiske → tilføj 2 children → submit
7. **Verify children**: De konkrete materialer vises i listen (med parentlink ikke vist i V1)
8. **Approve children**: Sæt approval på minst én child → den dukker op i porteføljen
9. **Bulk order**: Tilbage til porteføljen → "Bestil resterende" → vælg leverandør, sæt pris, opret
10. **Verify POs**: Tjek `purchase_orders` med samme `bulk_order_group_id`

- [ ] **Step 10.2: Final type-check**

```bash
cd app && npx tsc --noEmit
```

Expected: Exit 0.

- [ ] **Step 10.3: Verify ingen regressions på eksisterende sider**

Åbn og verificér disse sider stadig fungerer:
- `/#/` (Dashboard)
- `/#/project/quotes` + `/#/project/quotes/<id>`
- `/#/project/materials`
- `/#/project/purchase-orders`
- `/#/quotes`

- [ ] **Step 10.4: Audit-log**

```sql
INSERT INTO aios_events_2026_05_12 (actor, type, file, summary)
VALUES ('js@neminventar.dk', 'feature_release', 'docs/superpowers/plans/2026-05-13-portfolio-materials.md',
        'V1 lanceret: porteføljeside, bulk-bestilling, breakdown af generiske materialer.');
```

- [ ] **Step 10.5: Final commit + (optional) merge**

Hvis arbejdet er på en feature-branch:

```bash
git log --oneline -15
```

Verificér alle commits er der. Sig til Joachim før evt. merge til main eller PR.

---

## Out of scope (eksplicit, fra spec)

| Idé | Hvorfor udskudt |
|---|---|
| Pris-totaler i porteføljen | Pris ofte ukendt indtil RFQ |
| Auto-promotion konkret → standard_material | Manuel V1 OK |
| "Fortryd breakdown"-knap | Sjælden, manuel SQL OK |
| Auto-reset approvals ved ændring | Vises ikke før eksplicit ønske |
| Bulk-PDF til leverandør | V1: én PDF pr. PO |
| Quote-acceptance → bulk-pris-auto | V2 |
| Rolle-baseret RLS | Ikke et reelt problem nu |
| Per-supplier-grupperinger i tabel | V2 hvis Milot savner |
| Excel-eksport | V2 hvis efterspurgt |
| `/projects/:id` workspace + erstatning af ProjectOverview | Egen brainstorm-runde |
| RFQ-integration fra portefølje | "Start RFQ"-knap er disabled i Task 6 — V1.1 |
| `current_user` reelt logget | TODO i bulk-order — venter på AuthContext-udvidelse |

---

## Risiko-checklist (fra brainstorm)

| Risiko | Mitigation |
|---|---|
| Eksisterende materialer er ikke fully_approved → tom portefølje ved release | Empty-state-tekst implementeret i Task 4. Joachim kan vælge at masse-godkende materialer som migration hvis ønsket |
| ProjectMaterialsContext bruges af 11 filer | Kun additive ændringer. Alle felter nullable. TypeScript verificerer typer i Task 2.6 |
| ProjectMaterialsV1.tsx er stor (1100+ linjer) | Task 9 deler i flere steps. Hver step er additivt. Smoke-test efter |
| Enhedsmismatch i bulk-order | Validering i Task 7 (kun samme enhed). Block med fejl-toast |
| Faseskift kan have utilsigtede effekter | Approvals beholdes (audit). View filtrerer aktive faser. Manuel test af Sendt → Tabt i Task 10 |
