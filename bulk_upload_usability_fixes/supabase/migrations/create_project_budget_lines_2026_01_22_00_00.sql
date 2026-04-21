-- B-V1-01B: Opret project_budget_lines (kun totals)
-- Opretter budget-linjer med locked salg og baseline totals, ingen items endnu

-- Opret project_budget_lines tabel
CREATE TABLE public.project_budget_lines_2026_01_22_00_00 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_budget_id uuid NOT NULL,
    source_quote_line_id uuid NULL,
    title text NOT NULL,
    description text NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit text NOT NULL DEFAULT 'stk',
    sort_order int NOT NULL DEFAULT 0,
    
    -- Locked salg (TOTAL – sandhed)
    locked_sell_total numeric NOT NULL DEFAULT 0,
    
    -- Baseline cost (TOTAL – sandhed)
    baseline_cost_total numeric NOT NULL DEFAULT 0,
    baseline_cost_breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    baseline_risk_total numeric NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tilføj foreign key constraints
ALTER TABLE public.project_budget_lines_2026_01_22_00_00 
ADD CONSTRAINT fk_project_budget_lines_budget_id 
FOREIGN KEY (project_budget_id) REFERENCES public.project_budgets_2026_01_22_00_00(id) ON DELETE CASCADE;

ALTER TABLE public.project_budget_lines_2026_01_22_00_00 
ADD CONSTRAINT fk_project_budget_lines_source_quote_line_id 
FOREIGN KEY (source_quote_line_id) REFERENCES public.project_quote_lines_2026_01_16_23_00(id) ON DELETE SET NULL;

-- Opret index
CREATE INDEX idx_project_budget_lines_budget_id_2026_01_22_00_00 
ON public.project_budget_lines_2026_01_22_00_00 (project_budget_id);

-- Opret updated_at trigger
CREATE OR REPLACE FUNCTION update_project_budget_lines_updated_at_2026_01_22_00_00()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_budget_lines_updated_at_2026_01_22_00_00
    BEFORE UPDATE ON public.project_budget_lines_2026_01_22_00_00
    FOR EACH ROW
    EXECUTE FUNCTION update_project_budget_lines_updated_at_2026_01_22_00_00();

-- Kommentarer til tabellen
COMMENT ON TABLE public.project_budget_lines_2026_01_22_00_00 IS 'Budget linjer med locked salg og baseline totals - V1 uden items';
COMMENT ON COLUMN public.project_budget_lines_2026_01_22_00_00.project_budget_id IS 'Reference til budget header';
COMMENT ON COLUMN public.project_budget_lines_2026_01_22_00_00.source_quote_line_id IS 'Valgfri reference til kildetilbudslinje';
COMMENT ON COLUMN public.project_budget_lines_2026_01_22_00_00.locked_sell_total IS 'Låst salgspris total (sandhed)';
COMMENT ON COLUMN public.project_budget_lines_2026_01_22_00_00.baseline_cost_total IS 'Baseline omkostning total (sandhed)';
COMMENT ON COLUMN public.project_budget_lines_2026_01_22_00_00.baseline_cost_breakdown_json IS 'Breakdown af baseline omkostninger i JSON format';
COMMENT ON COLUMN public.project_budget_lines_2026_01_22_00_00.baseline_risk_total IS 'Baseline risiko total';