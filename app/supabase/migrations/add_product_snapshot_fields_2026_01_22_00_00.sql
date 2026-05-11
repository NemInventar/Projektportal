-- B-V1-01E: Tilføj product snapshot-felter på budget line items
-- Budget-items skal kunne bevare historik og give advarsel når produktet er ændret

-- Tilføj product snapshot felter til project_budget_line_items_2026_01_22_00_00
ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD COLUMN product_snapshot_updated_at timestamptz NULL;

ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD COLUMN snapshot_cost_breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD COLUMN snapshot_cost_total_per_unit numeric NOT NULL DEFAULT 0;

-- Kommentarer til nye kolonner
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.product_snapshot_updated_at 
IS 'Tidspunkt for sidste snapshot opdatering af produktdata';

COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.snapshot_cost_breakdown_json 
IS 'Snapshot af produktets omkostnings breakdown (bruges til beregninger indtil opdatering)';

COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.snapshot_cost_total_per_unit 
IS 'Snapshot af total omkostning pr unit (bruges til beregninger indtil opdatering)';