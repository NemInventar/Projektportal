-- Add new columns for V1 Project Materials
ALTER TABLE project_materials_2026_01_15_06_45 
ADD COLUMN IF NOT EXISTS is_generic boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_time_days integer NULL;