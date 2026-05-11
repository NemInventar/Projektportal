-- RLS V1: Minimér friktion - alle authenticated brugere kan alt
-- Drop alle eksisterende policies først

-- Projects tabeller
DROP POLICY IF EXISTS "Users can view projects" ON projects_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create projects" ON projects_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update projects" ON projects_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete projects" ON projects_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON projects_2026_01_15_06_45;

-- Standard suppliers
DROP POLICY IF EXISTS "Users can view standard suppliers" ON standard_suppliers_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create standard suppliers" ON standard_suppliers_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update standard suppliers" ON standard_suppliers_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete standard suppliers" ON standard_suppliers_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON standard_suppliers_2026_01_15_06_45;

-- Standard materials
DROP POLICY IF EXISTS "Users can view standard materials" ON standard_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create standard materials" ON standard_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update standard materials" ON standard_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete standard materials" ON standard_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON standard_materials_2026_01_15_06_45;

-- Material prices
DROP POLICY IF EXISTS "Users can view material prices" ON material_prices_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create material prices" ON material_prices_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update material prices" ON material_prices_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete material prices" ON material_prices_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON material_prices_2026_01_15_06_45;

-- Project materials
DROP POLICY IF EXISTS "Users can view project materials" ON project_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project materials" ON project_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project materials" ON project_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project materials" ON project_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_materials_2026_01_15_06_45;

-- Project material approvals
DROP POLICY IF EXISTS "Users can view project material approvals" ON project_material_approvals_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project material approvals" ON project_material_approvals_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project material approvals" ON project_material_approvals_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project material approvals" ON project_material_approvals_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_material_approvals_2026_01_15_06_45;

-- Purchase orders
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create purchase orders" ON purchase_orders_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update purchase orders" ON purchase_orders_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete purchase orders" ON purchase_orders_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON purchase_orders_2026_01_15_06_45;

-- Purchase order lines
DROP POLICY IF EXISTS "Users can view purchase order lines" ON purchase_order_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create purchase order lines" ON purchase_order_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update purchase order lines" ON purchase_order_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete purchase order lines" ON purchase_order_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON purchase_order_lines_2026_01_15_06_45;

-- Project products
DROP POLICY IF EXISTS "Users can view project products" ON project_products_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project products" ON project_products_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project products" ON project_products_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project products" ON project_products_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_products_2026_01_15_06_45;

-- Project product material lines
DROP POLICY IF EXISTS "Users can view project product material lines" ON project_product_material_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project product material lines" ON project_product_material_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project product material lines" ON project_product_material_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project product material lines" ON project_product_material_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_product_material_lines_2026_01_15_06_45;

-- Project product labor lines
DROP POLICY IF EXISTS "Users can view project product labor lines" ON project_product_labor_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project product labor lines" ON project_product_labor_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project product labor lines" ON project_product_labor_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project product labor lines" ON project_product_labor_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_product_labor_lines_2026_01_15_06_45;

-- Project product transport lines
DROP POLICY IF EXISTS "Users can view project product transport lines" ON project_product_transport_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project product transport lines" ON project_product_transport_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project product transport lines" ON project_product_transport_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project product transport lines" ON project_product_transport_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_product_transport_lines_2026_01_15_06_45;

-- Project product other cost lines
DROP POLICY IF EXISTS "Users can view project product other cost lines" ON project_product_other_cost_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can create project product other cost lines" ON project_product_other_cost_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can update project product other cost lines" ON project_product_other_cost_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Users can delete project product other cost lines" ON project_product_other_cost_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_product_other_cost_lines_2026_01_15_06_45;

-- Project quotes
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_quotes_2026_01_16_23_00;

-- Project quote lines
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_quote_lines_2026_01_16_23_00;

-- Project quote line items
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_quote_line_items_2026_01_16_23_00;

-- Project quote line pricing
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_quote_line_pricing_2026_01_16_23_00;

-- Nu opretter vi simple "allow all for authenticated" policies for alle tabeller

-- Projects
CREATE POLICY "v1_allow_all_authenticated" ON projects_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Standard suppliers
CREATE POLICY "v1_allow_all_authenticated" ON standard_suppliers_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Standard materials
CREATE POLICY "v1_allow_all_authenticated" ON standard_materials_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Material prices
CREATE POLICY "v1_allow_all_authenticated" ON material_prices_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project materials
CREATE POLICY "v1_allow_all_authenticated" ON project_materials_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project material approvals
CREATE POLICY "v1_allow_all_authenticated" ON project_material_approvals_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Purchase orders
CREATE POLICY "v1_allow_all_authenticated" ON purchase_orders_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Purchase order lines
CREATE POLICY "v1_allow_all_authenticated" ON purchase_order_lines_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project products
CREATE POLICY "v1_allow_all_authenticated" ON project_products_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project product material lines
CREATE POLICY "v1_allow_all_authenticated" ON project_product_material_lines_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project product labor lines
CREATE POLICY "v1_allow_all_authenticated" ON project_product_labor_lines_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project product transport lines
CREATE POLICY "v1_allow_all_authenticated" ON project_product_transport_lines_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project product other cost lines
CREATE POLICY "v1_allow_all_authenticated" ON project_product_other_cost_lines_2026_01_15_06_45
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project quotes
CREATE POLICY "v1_allow_all_authenticated" ON project_quotes_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project quote lines
CREATE POLICY "v1_allow_all_authenticated" ON project_quote_lines_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project quote line items
CREATE POLICY "v1_allow_all_authenticated" ON project_quote_line_items_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Project quote line pricing
CREATE POLICY "v1_allow_all_authenticated" ON project_quote_line_pricing_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');