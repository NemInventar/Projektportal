-- Tilføj display_order felt til project_quote_lines tabellen
ALTER TABLE project_quote_lines_2026_01_16_23_00 
ADD COLUMN display_order INTEGER;

-- Opdater eksisterende rækker med display_order baseret på created_at
WITH numbered_lines AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_quote_id ORDER BY created_at) as row_num
  FROM project_quote_lines_2026_01_16_23_00
)
UPDATE project_quote_lines_2026_01_16_23_00 
SET display_order = numbered_lines.row_num
FROM numbered_lines
WHERE project_quote_lines_2026_01_16_23_00.id = numbered_lines.id;

-- Tilføj index for bedre performance ved sortering
CREATE INDEX IF NOT EXISTS idx_quote_lines_display_order 
ON project_quote_lines_2026_01_16_23_00(project_quote_id, display_order);