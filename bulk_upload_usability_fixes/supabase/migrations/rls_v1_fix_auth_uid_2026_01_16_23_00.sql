-- RLS V1 fix: Brug auth.uid() IS NOT NULL i stedet for auth.role() = 'authenticated'
-- Dette er mere pålideligt for at tjekke om brugeren er authenticated

-- Drop eksisterende policies og opret nye med auth.uid()

-- Projects
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON projects_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON projects_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Standard suppliers
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON standard_suppliers_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON standard_suppliers_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Standard materials
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON standard_materials_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON standard_materials_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Material prices
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON material_prices_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON material_prices_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Project materials
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_materials_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON project_materials_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Project material approvals
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_material_approvals_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON project_material_approvals_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Purchase orders
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON purchase_orders_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON purchase_orders_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Purchase order lines
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON purchase_order_lines_2026_01_15_06_45;
CREATE POLICY "v1_allow_all_authenticated" ON purchase_order_lines_2026_01_15_06_45
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Project quotes
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quotes_2026_01_16_23_00;
CREATE POLICY "v1_allow_all_authenticated" ON project_quotes_2026_01_16_23_00
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Project quote lines
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quote_lines_2026_01_16_23_00;
CREATE POLICY "v1_allow_all_authenticated" ON project_quote_lines_2026_01_16_23_00
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Project quote line items
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quote_line_items_2026_01_16_23_00;
CREATE POLICY "v1_allow_all_authenticated" ON project_quote_line_items_2026_01_16_23_00
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Project quote line pricing
DROP POLICY IF EXISTS "v1_allow_all_authenticated" ON project_quote_line_pricing_2026_01_16_23_00;
CREATE POLICY "v1_allow_all_authenticated" ON project_quote_line_pricing_2026_01_16_23_00
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);