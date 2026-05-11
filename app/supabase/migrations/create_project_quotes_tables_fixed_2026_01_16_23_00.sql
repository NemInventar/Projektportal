-- Create project quotes tables
CREATE TABLE IF NOT EXISTS project_quotes_2026_01_16_23_00 (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  quote_number text NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'archived')),
  valid_until date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_quote_lines_2026_01_16_23_00 (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_quote_id uuid NOT NULL REFERENCES project_quotes_2026_01_16_23_00(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'stk',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_quote_line_items_2026_01_16_23_00 (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_quote_line_id uuid NOT NULL REFERENCES project_quote_lines_2026_01_16_23_00(id) ON DELETE CASCADE,
  source_type text DEFAULT 'custom' CHECK (source_type IN ('project_product', 'custom')),
  project_product_id uuid NULL,
  title text NOT NULL,
  qty numeric DEFAULT 1,
  unit text DEFAULT 'stk',
  cost_breakdown_json jsonb DEFAULT '{}',
  cost_total_per_unit numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_quote_line_pricing_2026_01_16_23_00 (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_quote_line_id uuid NOT NULL REFERENCES project_quote_lines_2026_01_16_23_00(id) ON DELETE CASCADE,
  pricing_mode text DEFAULT 'markup_pct' CHECK (pricing_mode IN ('markup_pct', 'gross_margin_pct', 'target_unit_price')),
  markup_pct numeric NULL,
  gross_margin_pct numeric NULL,
  target_unit_price numeric NULL,
  risk_per_unit numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add RLS policies
ALTER TABLE project_quotes_2026_01_16_23_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_quote_lines_2026_01_16_23_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_quote_line_items_2026_01_16_23_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_quote_line_pricing_2026_01_16_23_00 ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Users can manage quotes" ON project_quotes_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage quote lines" ON project_quote_lines_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage quote line items" ON project_quote_line_items_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage quote line pricing" ON project_quote_line_pricing_2026_01_16_23_00
  FOR ALL USING (auth.role() = 'authenticated');