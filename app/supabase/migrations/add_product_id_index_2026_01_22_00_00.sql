-- Tilføj index på project_product_id (valgfrit men fint i V1)

-- Tilføj index på project_product_id for hurtigere lookup
CREATE INDEX IF NOT EXISTS idx_budget_line_items_product_id_2026_01_22_00_00 
ON public.project_budget_line_items_2026_01_22_00_00 (project_product_id);

-- Kommentar til index
COMMENT ON INDEX idx_budget_line_items_product_id_2026_01_22_00_00 
IS 'Index for hurtig lookup af budget line items baseret på project_product_id';