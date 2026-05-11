-- B-V1-01A: Opret project_budgets (kun header)
-- Opretter budget-header tabel uden linjer eller items

-- Opret project_budgets tabel
CREATE TABLE public.project_budgets_2026_01_22_00_00 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    source_quote_id uuid NULL,
    budget_number text NULL,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tilføj foreign key constraints
ALTER TABLE public.project_budgets_2026_01_22_00_00 
ADD CONSTRAINT fk_project_budgets_project_id 
FOREIGN KEY (project_id) REFERENCES public.projects_2026_01_15_06_45(id) ON DELETE CASCADE;

ALTER TABLE public.project_budgets_2026_01_22_00_00 
ADD CONSTRAINT fk_project_budgets_source_quote_id 
FOREIGN KEY (source_quote_id) REFERENCES public.project_quotes_2026_01_16_23_00(id) ON DELETE SET NULL;

-- Tilføj CHECK constraint for status
ALTER TABLE public.project_budgets_2026_01_22_00_00 
ADD CONSTRAINT project_budgets_status_check 
CHECK (status IN ('active', 'archived'));

-- Opret indexes
CREATE INDEX idx_project_budgets_project_id_2026_01_22_00_00 
ON public.project_budgets_2026_01_22_00_00 (project_id);

CREATE INDEX idx_project_budgets_source_quote_id_2026_01_22_00_00 
ON public.project_budgets_2026_01_22_00_00 (source_quote_id);

-- Opret updated_at trigger
CREATE OR REPLACE FUNCTION update_project_budgets_updated_at_2026_01_22_00_00()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_budgets_updated_at_2026_01_22_00_00
    BEFORE UPDATE ON public.project_budgets_2026_01_22_00_00
    FOR EACH ROW
    EXECUTE FUNCTION update_project_budgets_updated_at_2026_01_22_00_00();

-- Kommentarer til tabellen
COMMENT ON TABLE public.project_budgets_2026_01_22_00_00 IS 'Budget headers for projekter - V1 kun header uden linjer';
COMMENT ON COLUMN public.project_budgets_2026_01_22_00_00.project_id IS 'Reference til projekt';
COMMENT ON COLUMN public.project_budgets_2026_01_22_00_00.source_quote_id IS 'Valgfri reference til kildetilbud';
COMMENT ON COLUMN public.project_budgets_2026_01_22_00_00.budget_number IS 'Budgetnummer (kan være auto-genereret)';
COMMENT ON COLUMN public.project_budgets_2026_01_22_00_00.title IS 'Budgettitel';
COMMENT ON COLUMN public.project_budgets_2026_01_22_00_00.status IS 'Status: active eller archived';