-- Tilføj display_order felt til project_quote_lines tabellen
ALTER TABLE project_quote_lines_2026_01_16_23_00 
ADD COLUMN display_order INTEGER;

-- Opdater eksisterende rækker med display_order baseret på created_at
UPDATE project_quote_lines_2026_01_16_23_00 
SET display_order = (
  SELECT ROW_NUMBER() OVER (PARTITION BY quote_id ORDER BY created_at)
  FROM project_quote_lines_2026_01_16_23_00 AS inner_table 
  WHERE inner_table.id = project_quote_lines_2026_01_16_23_00.id
);

-- Tilføj index for bedre performance ved sortering
CREATE INDEX IF NOT EXISTS idx_quote_lines_display_order 
ON project_quote_lines_2026_01_16_23_00(quote_id, display_order);