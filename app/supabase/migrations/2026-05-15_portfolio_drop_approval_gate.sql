-- Drop approval-gate fra v_orderable_project_materials.
-- Joachims beslutning 2026-05-15: god-flow er for tung disciplin for et 3-mands hold.
-- Materialer skal indgå i portefølje så snart de er specificeret (ikke generisk og ikke brudt op).
-- v_approved_project_materials beholdes som helper for evt. fremtidigt brug, men er ikke længere required.

CREATE OR REPLACE VIEW v_orderable_project_materials AS
SELECT pm.id AS project_material_id, pm.standard_material_id, pm.project_id, pm.lead_time_days
FROM project_materials_2026_01_15_06_45 pm
WHERE pm.is_generic = false
  AND pm.replaced_at IS NULL
  AND pm.standard_material_id IS NOT NULL;
