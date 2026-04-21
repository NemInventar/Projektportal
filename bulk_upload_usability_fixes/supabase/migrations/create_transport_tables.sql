-- Create material transport rates table for standard materials
CREATE TABLE IF NOT EXISTS public.material_transport_rates_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_material_id UUID NOT NULL REFERENCES public.standard_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
    route_type TEXT NOT NULL CHECK (route_type IN ('to_kosovo', 'from_kosovo_to_dk', 'other')),
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    cost_model TEXT NOT NULL CHECK (cost_model IN ('per_unit', 'per_shipment')),
    unit_cost DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'DKK',
    valid_from DATE NOT NULL,
    valid_to DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project material transport table
CREATE TABLE IF NOT EXISTS public.project_material_transport_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_material_id UUID NOT NULL REFERENCES public.project_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
    route_type TEXT NOT NULL CHECK (route_type IN ('to_kosovo', 'from_kosovo_to_dk', 'other')),
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    -- Expected transport (V1)
    expected_cost_model TEXT NOT NULL CHECK (expected_cost_model IN ('per_unit', 'per_shipment')),
    expected_unit_cost DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'DKK',
    expected_note TEXT,
    -- Actual transport (V2-ready)
    actual_cost_model TEXT CHECK (actual_cost_model IN ('per_unit', 'per_shipment')),
    actual_unit_cost DECIMAL(10,2),
    actual_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_material_transport_rates_material_id ON public.material_transport_rates_2026_01_15_06_45(standard_material_id);
CREATE INDEX IF NOT EXISTS idx_material_transport_rates_route_type ON public.material_transport_rates_2026_01_15_06_45(route_type);
CREATE INDEX IF NOT EXISTS idx_material_transport_rates_valid_dates ON public.material_transport_rates_2026_01_15_06_45(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_project_material_transport_material_id ON public.project_material_transport_2026_01_15_06_45(project_material_id);
CREATE INDEX IF NOT EXISTS idx_project_material_transport_route_type ON public.project_material_transport_2026_01_15_06_45(route_type);

-- Enable RLS on transport tables
ALTER TABLE public.material_transport_rates_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_transport_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all for authenticated users" ON public.material_transport_rates_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.project_material_transport_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');

-- Add comments to document the tables
COMMENT ON TABLE public.material_transport_rates_2026_01_15_06_45 IS 'Historical expected transport rates for standard materials';
COMMENT ON TABLE public.project_material_transport_2026_01_15_06_45 IS 'Project-specific transport rates (expected and actual)';

COMMENT ON COLUMN public.material_transport_rates_2026_01_15_06_45.route_type IS 'Type of transport route: to_kosovo, from_kosovo_to_dk, other';
COMMENT ON COLUMN public.material_transport_rates_2026_01_15_06_45.cost_model IS 'Pricing model: per_unit (per material unit) or per_shipment (per delivery)';
COMMENT ON COLUMN public.material_transport_rates_2026_01_15_06_45.unit_cost IS 'Cost per unit or per shipment depending on cost_model';

COMMENT ON COLUMN public.project_material_transport_2026_01_15_06_45.expected_cost_model IS 'Expected pricing model copied from standard material';
COMMENT ON COLUMN public.project_material_transport_2026_01_15_06_45.actual_cost_model IS 'Actual pricing model (V2 - for recording real costs)';
COMMENT ON COLUMN public.project_material_transport_2026_01_15_06_45.expected_unit_cost IS 'Expected transport cost';
COMMENT ON COLUMN public.project_material_transport_2026_01_15_06_45.actual_unit_cost IS 'Actual transport cost (V2 - from delivery receipts)';