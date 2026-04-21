-- Tilføj indexes til project_quotes_2026_01_16_23_00 for oversigt og sortering

-- Index for filtrering på status og sortering på next_delivery_date
-- Dette understøtter queries som: WHERE status = 'draft' ORDER BY next_delivery_date
CREATE INDEX IF NOT EXISTS idx_project_quotes_status_delivery_date_2026_01_21_12_20
ON public.project_quotes_2026_01_16_23_00 (status, next_delivery_date);

-- Index for opslag pr project_id
-- Dette understøtter queries som: WHERE project_id = 'uuid'
CREATE INDEX IF NOT EXISTS idx_project_quotes_project_id_2026_01_21_12_20
ON public.project_quotes_2026_01_16_23_00 (project_id);

-- Kommentarer til indexes for dokumentation
COMMENT ON INDEX public.idx_project_quotes_status_delivery_date_2026_01_21_12_20 
IS 'Composite index for filtrering på status og sortering på next_delivery_date';

COMMENT ON INDEX public.idx_project_quotes_project_id_2026_01_21_12_20 
IS 'Index for hurtige opslag på project_id';