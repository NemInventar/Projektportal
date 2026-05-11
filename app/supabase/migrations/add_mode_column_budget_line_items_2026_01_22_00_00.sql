-- B-V1-01D: Tilføj mode (baseline/current) + index på line_items
-- Gør det muligt at have både baseline og current items i samme tabel

-- Tilføj mode kolonne til project_budget_line_items_2026_01_22_00_00
ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD COLUMN mode text NOT NULL DEFAULT 'current';

-- Tilføj CHECK constraint for mode
ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD CONSTRAINT project_budget_line_items_mode_check 
CHECK (mode IN ('baseline', 'current'));

-- Tilføj composite index på project_budget_line_id og mode
CREATE INDEX idx_budget_line_items_line_mode_2026_01_22_00_00 
ON public.project_budget_line_items_2026_01_22_00_00 (project_budget_line_id, mode);

-- Kommentar til ny kolonne
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.mode 
IS 'Mode: baseline (oprindelig snapshot) eller current (aktuelle værdier)';