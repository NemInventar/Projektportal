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
  WHERE p.phase NOT IN ('Tabt', 'Fravalgt', 'Arkiv', 'Garanti')
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
      FILTER (WHERE pol.status IN ('ordered', 'confirmed')) AS next_delivery_date
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
WHERE p.phase NOT IN ('Tabt', 'Fravalgt', 'Arkiv', 'Garanti')
  AND pp.status = 'active'
  AND om.project_id = p.id
GROUP BY om.standard_material_id, p.id, p.name, p.project_number, p.phase, om.project_material_id;
