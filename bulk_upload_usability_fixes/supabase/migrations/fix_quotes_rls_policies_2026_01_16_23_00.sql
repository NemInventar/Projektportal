-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage quotes" ON project_quotes_2026_01_16_23_00;
DROP POLICY IF EXISTS "Users can manage quote lines" ON project_quote_lines_2026_01_16_23_00;
DROP POLICY IF EXISTS "Users can manage quote line items" ON project_quote_line_items_2026_01_16_23_00;
DROP POLICY IF EXISTS "Users can manage quote line pricing" ON project_quote_line_pricing_2026_01_16_23_00;

-- Create new policies that allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON project_quotes_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_quote_lines_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_quote_line_items_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_quote_line_pricing_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');