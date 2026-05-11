-- Drop existing policies and create new ones that allow anonymous access for testing
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.projects_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.standard_suppliers_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.standard_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.material_prices_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.material_documents_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_materials_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_material_approvals_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.purchase_orders_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.purchase_order_lines_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.material_transport_rates_2026_01_15_06_45;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_material_transport_2026_01_15_06_45;

-- Create new policies that allow all access (for testing purposes)
CREATE POLICY "Allow all access" ON public.projects_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.standard_suppliers_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.standard_materials_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.material_prices_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.material_documents_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_materials_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_material_approvals_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.purchase_orders_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.purchase_order_lines_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.material_transport_rates_2026_01_15_06_45 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_material_transport_2026_01_15_06_45 FOR ALL USING (true);