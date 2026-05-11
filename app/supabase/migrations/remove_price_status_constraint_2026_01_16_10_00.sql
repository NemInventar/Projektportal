-- Remove the price_status check constraint that is causing issues
ALTER TABLE project_materials_2026_01_15_06_45 
DROP CONSTRAINT IF EXISTS project_materials_2026_01_15_06_45_price_status_check;