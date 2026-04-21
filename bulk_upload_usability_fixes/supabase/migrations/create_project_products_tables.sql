-- Create project products table
CREATE TABLE IF NOT EXISTS public.project_products_2026_01_15_12_49 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects_2026_01_15_06_45(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK (product_type IN ('curtain', 'installation', 'furniture', 'other')),
    unit TEXT NOT NULL DEFAULT 'stk',
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    description TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project product material lines table
CREATE TABLE IF NOT EXISTS public.project_product_material_lines_2026_01_15_12_49 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_product_id UUID NOT NULL REFERENCES public.project_products_2026_01_15_12_49(id) ON DELETE CASCADE,
    project_material_id UUID NOT NULL REFERENCES public.project_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
    -- Produktdel
    line_title TEXT NOT NULL,
    line_description TEXT,
    -- Beregning
    calc_enabled BOOLEAN DEFAULT false,
    calc_length_m DECIMAL(10,3),
    calc_width_m DECIMAL(10,3),
    calc_count DECIMAL(10,2),
    -- Mængder
    base_qty DECIMAL(10,3) NOT NULL,
    waste_pct DECIMAL(5,2) DEFAULT 0,
    qty DECIMAL(10,3) NOT NULL,
    -- Pris
    unit TEXT NOT NULL,
    unit_cost_override DECIMAL(10,2),
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project product labor lines table
CREATE TABLE IF NOT EXISTS public.project_product_labor_lines_2026_01_15_12_49 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_product_id UUID NOT NULL REFERENCES public.project_products_2026_01_15_12_49(id) ON DELETE CASCADE,
    labor_type TEXT NOT NULL CHECK (labor_type IN ('production', 'dk_installation', 'other')),
    title TEXT NOT NULL,
    qty DECIMAL(10,2) NOT NULL,
    unit TEXT DEFAULT 'timer',
    unit_cost DECIMAL(10,2) NOT NULL,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project product transport lines table
CREATE TABLE IF NOT EXISTS public.project_product_transport_lines_2026_01_15_12_49 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_product_id UUID NOT NULL REFERENCES public.project_products_2026_01_15_12_49(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Transport samlet produkt → DK',
    qty DECIMAL(10,2) DEFAULT 1,
    unit TEXT DEFAULT 'shipment',
    unit_cost DECIMAL(10,2) NOT NULL,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project product other cost lines table
CREATE TABLE IF NOT EXISTS public.project_product_other_cost_lines_2026_01_15_12_49 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_product_id UUID NOT NULL REFERENCES public.project_products_2026_01_15_12_49(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    qty DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_products_project_id ON public.project_products_2026_01_15_12_49(project_id);
CREATE INDEX IF NOT EXISTS idx_project_product_material_lines_product_id ON public.project_product_material_lines_2026_01_15_12_49(project_product_id);
CREATE INDEX IF NOT EXISTS idx_project_product_material_lines_material_id ON public.project_product_material_lines_2026_01_15_12_49(project_material_id);
CREATE INDEX IF NOT EXISTS idx_project_product_labor_lines_product_id ON public.project_product_labor_lines_2026_01_15_12_49(project_product_id);
CREATE INDEX IF NOT EXISTS idx_project_product_transport_lines_product_id ON public.project_product_transport_lines_2026_01_15_12_49(project_product_id);
CREATE INDEX IF NOT EXISTS idx_project_product_other_cost_lines_product_id ON public.project_product_other_cost_lines_2026_01_15_12_49(project_product_id);

-- Enable RLS on all tables
ALTER TABLE public.project_products_2026_01_15_12_49 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_product_material_lines_2026_01_15_12_49 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_product_labor_lines_2026_01_15_12_49 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_product_transport_lines_2026_01_15_12_49 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_product_other_cost_lines_2026_01_15_12_49 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all access" ON public.project_products_2026_01_15_12_49 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_product_material_lines_2026_01_15_12_49 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_product_labor_lines_2026_01_15_12_49 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_product_transport_lines_2026_01_15_12_49 FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.project_product_other_cost_lines_2026_01_15_12_49 FOR ALL USING (true);

-- Add comments to document the tables
COMMENT ON TABLE public.project_products_2026_01_15_12_49 IS 'Products within projects (curtains, furniture, installations, etc.)';
COMMENT ON TABLE public.project_product_material_lines_2026_01_15_12_49 IS 'Material lines for products with calculation and waste management';
COMMENT ON TABLE public.project_product_labor_lines_2026_01_15_12_49 IS 'Labor lines for products (production, DK installation, other)';
COMMENT ON TABLE public.project_product_transport_lines_2026_01_15_12_49 IS 'Transport lines for complete products (shipment-based)';
COMMENT ON TABLE public.project_product_other_cost_lines_2026_01_15_12_49 IS 'Other cost lines for products';

COMMENT ON COLUMN public.project_product_material_lines_2026_01_15_12_49.calc_enabled IS 'Whether to use automatic calculation (length × width × count)';
COMMENT ON COLUMN public.project_product_material_lines_2026_01_15_12_49.base_qty IS 'Base quantity before waste (calculated or manual)';
COMMENT ON COLUMN public.project_product_material_lines_2026_01_15_12_49.waste_pct IS 'Waste percentage (0-100)';
COMMENT ON COLUMN public.project_product_material_lines_2026_01_15_12_49.qty IS 'Final quantity including waste';
COMMENT ON COLUMN public.project_product_material_lines_2026_01_15_12_49.unit_cost_override IS 'Override unit cost (if different from project material)';

COMMENT ON COLUMN public.project_product_labor_lines_2026_01_15_12_49.labor_type IS 'Type of labor: production, dk_installation (Denmark assembly), other';
COMMENT ON COLUMN public.project_product_transport_lines_2026_01_15_12_49.unit IS 'Usually shipment for complete product transport';
COMMENT ON COLUMN public.project_product_other_cost_lines_2026_01_15_12_49.title IS 'Description of the other cost';