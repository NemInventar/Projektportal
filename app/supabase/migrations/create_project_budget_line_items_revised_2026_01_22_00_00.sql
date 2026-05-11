-- B-V1-01C: Opret project_budget_line_items (baseline snapshot) - Revideret
-- Muliggør breakdown + "genberegn nu" senere, ingen beregninger i dette step

-- Opret project_budget_line_items tabel
CREATE TABLE public.project_budget_line_items_2026_01_22_00_00 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_budget_line_id uuid NOT NULL,
    source_quote_line_item_id uuid NULL,
    source_type text NOT NULL DEFAULT 'custom',
    project_product_id uuid NULL,
    title text NOT NULL,
    qty numeric NOT NULL DEFAULT 1,
    unit text NOT NULL DEFAULT 'stk',
    
    -- Baseline snapshot pr unit
    baseline_cost_breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    baseline_cost_total_per_unit numeric NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tilføj CHECK constraint for source_type
ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD CONSTRAINT project_budget_line_items_source_type_check 
CHECK (source_type IN ('project_product', 'custom'));

-- Tilføj foreign key constraint til budget lines (denne eksisterer)
ALTER TABLE public.project_budget_line_items_2026_01_22_00_00 
ADD CONSTRAINT fk_project_budget_line_items_line_id 
FOREIGN KEY (project_budget_line_id) REFERENCES public.project_budget_lines_2026_01_22_00_00(id) ON DELETE CASCADE;

-- Note: Andre FK's tilføjes senere når tabellerne eksisterer
-- source_quote_line_item_id -> project_quote_line_items (eksisterer måske ikke endnu)
-- project_product_id -> project_products (eksisterer måske ikke endnu)

-- Opret index
CREATE INDEX idx_project_budget_line_items_line_id_2026_01_22_00_00 
ON public.project_budget_line_items_2026_01_22_00_00 (project_budget_line_id);

-- Opret updated_at trigger
CREATE OR REPLACE FUNCTION update_project_budget_line_items_updated_at_2026_01_22_00_00()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_budget_line_items_updated_at_2026_01_22_00_00
    BEFORE UPDATE ON public.project_budget_line_items_2026_01_22_00_00
    FOR EACH ROW
    EXECUTE FUNCTION update_project_budget_line_items_updated_at_2026_01_22_00_00();

-- Kommentarer til tabellen
COMMENT ON TABLE public.project_budget_line_items_2026_01_22_00_00 IS 'Budget line items med baseline snapshots - muliggør breakdown og genberegning';
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.project_budget_line_id IS 'Reference til budget linje';
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.source_quote_line_item_id IS 'Valgfri reference til kildetilbuds line item (FK tilføjes senere)';
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.source_type IS 'Type: project_product eller custom';
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.project_product_id IS 'Reference til projektprodukt (FK tilføjes senere når tabel eksisterer)';
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.baseline_cost_breakdown_json IS 'Baseline omkostnings breakdown pr unit i JSON format';
COMMENT ON COLUMN public.project_budget_line_items_2026_01_22_00_00.baseline_cost_total_per_unit IS 'Total baseline omkostning pr unit';