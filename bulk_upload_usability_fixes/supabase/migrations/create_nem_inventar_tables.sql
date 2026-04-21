-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    customer TEXT NOT NULL,
    project_number TEXT UNIQUE NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('Tilbud', 'Produktion', 'Afsluttet', 'Arkiv')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Standard Suppliers table
CREATE TABLE IF NOT EXISTS public.standard_suppliers_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cvr TEXT,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    postal_code TEXT,
    city TEXT,
    country TEXT DEFAULT 'Danmark',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Aktiv' CHECK (status IN ('Aktiv', 'Arkiveret')),
    is_standard BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Standard Materials table
CREATE TABLE IF NOT EXISTS public.standard_materials_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aktiv' CHECK (status IN ('Aktiv', 'Arkiveret')),
    primary_supplier_id UUID REFERENCES public.standard_suppliers_2026_01_15_06_45(id),
    supplier_product_code TEXT,
    supplier_product_url TEXT,
    material_type TEXT,
    certifications TEXT[] DEFAULT '{}',
    is_standard BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material Prices table
CREATE TABLE IF NOT EXISTS public.material_prices_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES public.standard_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.standard_suppliers_2026_01_15_06_45(id),
    unit_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'DKK',
    valid_from DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material Documents table
CREATE TABLE IF NOT EXISTS public.material_documents_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES public.standard_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    document_type TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Materials table
CREATE TABLE IF NOT EXISTS public.project_materials_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects_2026_01_15_06_45(id) ON DELETE CASCADE,
    standard_material_id UUID REFERENCES public.standard_materials_2026_01_15_06_45(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    supplier_id UUID REFERENCES public.standard_suppliers_2026_01_15_06_45(id),
    supplier_product_code TEXT,
    supplier_product_url TEXT,
    unit_price DECIMAL(10,2),
    currency TEXT DEFAULT 'DKK',
    price_status TEXT DEFAULT 'estimated' CHECK (price_status IN ('estimated', 'confirmed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Material Approvals table
CREATE TABLE IF NOT EXISTS public.project_material_approvals_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_material_id UUID NOT NULL REFERENCES public.project_materials_2026_01_15_06_45(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('production', 'sustainability')),
    status TEXT NOT NULL DEFAULT 'not_approved' CHECK (status IN ('not_approved', 'approved')),
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects_2026_01_15_06_45(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.standard_suppliers_2026_01_15_06_45(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'delivered', 'cancelled')),
    order_date DATE,
    expected_delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Order Lines table
CREATE TABLE IF NOT EXISTS public.purchase_order_lines_2026_01_15_06_45 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders_2026_01_15_06_45(id) ON DELETE CASCADE,
    project_material_id UUID NOT NULL REFERENCES public.project_materials_2026_01_15_06_45(id),
    supplier_id UUID NOT NULL REFERENCES public.standard_suppliers_2026_01_15_06_45(id),
    supplier_product_code TEXT,
    supplier_product_url TEXT,
    ordered_qty DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    unit_price DECIMAL(10,2),
    currency TEXT DEFAULT 'DKK',
    expected_delivery_date DATE,
    status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'confirmed', 'delivered', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_phase ON public.projects_2026_01_15_06_45(phase);
CREATE INDEX IF NOT EXISTS idx_standard_materials_category ON public.standard_materials_2026_01_15_06_45(category);
CREATE INDEX IF NOT EXISTS idx_project_materials_project_id ON public.project_materials_2026_01_15_06_45(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_supplier ON public.purchase_orders_2026_01_15_06_45(project_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po_id ON public.purchase_order_lines_2026_01_15_06_45(purchase_order_id);

-- Enable RLS on all tables
ALTER TABLE public.projects_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_suppliers_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_materials_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_prices_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_documents_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_approvals_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines_2026_01_15_06_45 ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies (allow all for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON public.projects_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.standard_suppliers_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.standard_materials_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.material_prices_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.material_documents_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.project_materials_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.project_material_approvals_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.purchase_orders_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.purchase_order_lines_2026_01_15_06_45 FOR ALL USING (auth.role() = 'authenticated');