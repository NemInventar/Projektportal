-- Q-V1-07: Tilføj profit_by_category_json til pricing tabel
ALTER TABLE project_quote_line_pricing_2026_01_16_23_00 
ADD COLUMN profit_by_category_json jsonb DEFAULT '{}';

-- Opdater pricing_mode constraint til at inkludere ny værdi
ALTER TABLE project_quote_line_pricing_2026_01_16_23_00 
DROP CONSTRAINT IF EXISTS project_quote_line_pricing_2026_01_16_23_00_pricing_mode_check;

ALTER TABLE project_quote_line_pricing_2026_01_16_23_00 
ADD CONSTRAINT project_quote_line_pricing_2026_01_16_23_00_pricing_mode_check 
CHECK (pricing_mode IN ('markup_pct', 'gross_margin_pct', 'target_unit_price', 'profit_by_category'));