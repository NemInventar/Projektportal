-- Midlertidigt disable RLS for tilbud tabeller for at eliminere friktion
-- Dette er kun til V1 udvikling/test

-- Disable RLS på tilbud tabeller
ALTER TABLE project_quotes_2026_01_16_23_00 DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_quote_lines_2026_01_16_23_00 DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_quote_line_items_2026_01_16_23_00 DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_quote_line_pricing_2026_01_16_23_00 DISABLE ROW LEVEL SECURITY;

-- Drop alle policies på disse tabeller
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quotes_2026_01_16_23_00;
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quote_lines_2026_01_16_23_00;
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quote_line_items_2026_01_16_23_00;
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quote_line_pricing_2026_01_16_23_00;