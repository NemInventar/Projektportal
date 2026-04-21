-- Add transport estimate columns to project_materials table
ALTER TABLE project_materials_2026_01_15_06_45 
ADD COLUMN IF NOT EXISTS transport_estimated_cost numeric NULL,
ADD COLUMN IF NOT EXISTS transport_currency text DEFAULT 'DKK',
ADD COLUMN IF NOT EXISTS transport_note text NULL;