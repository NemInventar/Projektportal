-- Add missing notes column to project_materials table
ALTER TABLE project_materials_2026_01_15_06_45 
ADD COLUMN IF NOT EXISTS notes TEXT;