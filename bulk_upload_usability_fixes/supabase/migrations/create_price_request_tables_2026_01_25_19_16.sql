-- Create project_price_requests table
CREATE TABLE IF NOT EXISTS public.project_price_requests_2026_01_25_19_16 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects_2026_01_22_00_00(id),
    project_material_id uuid REFERENCES public.project_materials_2026_01_22_00_00(id),
    title text NOT NULL,
    description text,
    qty numeric,
    unit text,
    first_delivery_date date,
    last_delivery_date date,
    budget_hint numeric,
    payment_terms text,
    deadline date,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'awarded', 'cancelled')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for project_price_requests
CREATE INDEX IF NOT EXISTS idx_project_price_requests_project_id_2026_01_25_19_16 
    ON public.project_price_requests_2026_01_25_19_16(project_id);

CREATE INDEX IF NOT EXISTS idx_project_price_requests_project_material_id_2026_01_25_19_16 
    ON public.project_price_requests_2026_01_25_19_16(project_material_id);

CREATE INDEX IF NOT EXISTS idx_project_price_requests_status_2026_01_25_19_16 
    ON public.project_price_requests_2026_01_25_19_16(status);

-- Create project_price_quotes table
CREATE TABLE IF NOT EXISTS public.project_price_quotes_2026_01_25_19_16 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_price_request_id uuid NOT NULL REFERENCES public.project_price_requests_2026_01_25_19_16(id) ON DELETE CASCADE,
    supplier_id uuid NOT NULL REFERENCES public.standard_suppliers_2026_01_22_00_00(id),
    status text NOT NULL CHECK (status IN ('offered', 'declined', 'expired', 'selected')),
    unit_price numeric,
    currency text DEFAULT 'DKK',
    unit text,
    min_qty numeric,
    lead_time_days integer,
    valid_until date,
    notes text,
    received_at date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for project_price_quotes
CREATE INDEX IF NOT EXISTS idx_project_price_quotes_request_id_2026_01_25_19_16 
    ON public.project_price_quotes_2026_01_25_19_16(project_price_request_id);

CREATE INDEX IF NOT EXISTS idx_project_price_quotes_supplier_id_2026_01_25_19_16 
    ON public.project_price_quotes_2026_01_25_19_16(supplier_id);

CREATE INDEX IF NOT EXISTS idx_project_price_quotes_status_2026_01_25_19_16 
    ON public.project_price_quotes_2026_01_25_19_16(status);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_project_price_requests_updated_at_2026_01_25_19_16
    BEFORE UPDATE ON public.project_price_requests_2026_01_25_19_16
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_price_quotes_updated_at_2026_01_25_19_16
    BEFORE UPDATE ON public.project_price_quotes_2026_01_25_19_16
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE public.project_price_requests_2026_01_25_19_16 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_price_quotes_2026_01_25_19_16 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project_price_requests
CREATE POLICY "Users can view price requests for their projects" ON public.project_price_requests_2026_01_25_19_16
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects_2026_01_22_00_00 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert price requests for their projects" ON public.project_price_requests_2026_01_25_19_16
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM public.projects_2026_01_22_00_00 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update price requests for their projects" ON public.project_price_requests_2026_01_25_19_16
    FOR UPDATE USING (
        project_id IN (
            SELECT id FROM public.projects_2026_01_22_00_00 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete price requests for their projects" ON public.project_price_requests_2026_01_25_19_16
    FOR DELETE USING (
        project_id IN (
            SELECT id FROM public.projects_2026_01_22_00_00 
            WHERE user_id = auth.uid()
        )
    );

-- Create RLS policies for project_price_quotes
CREATE POLICY "Users can view price quotes for their project requests" ON public.project_price_quotes_2026_01_25_19_16
    FOR SELECT USING (
        project_price_request_id IN (
            SELECT id FROM public.project_price_requests_2026_01_25_19_16
            WHERE project_id IN (
                SELECT id FROM public.projects_2026_01_22_00_00 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert price quotes for their project requests" ON public.project_price_quotes_2026_01_25_19_16
    FOR INSERT WITH CHECK (
        project_price_request_id IN (
            SELECT id FROM public.project_price_requests_2026_01_25_19_16
            WHERE project_id IN (
                SELECT id FROM public.projects_2026_01_22_00_00 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update price quotes for their project requests" ON public.project_price_quotes_2026_01_25_19_16
    FOR UPDATE USING (
        project_price_request_id IN (
            SELECT id FROM public.project_price_requests_2026_01_25_19_16
            WHERE project_id IN (
                SELECT id FROM public.projects_2026_01_22_00_00 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete price quotes for their project requests" ON public.project_price_quotes_2026_01_25_19_16
    FOR DELETE USING (
        project_price_request_id IN (
            SELECT id FROM public.project_price_requests_2026_01_25_19_16
            WHERE project_id IN (
                SELECT id FROM public.projects_2026_01_22_00_00 
                WHERE user_id = auth.uid()
            )
        )
    );