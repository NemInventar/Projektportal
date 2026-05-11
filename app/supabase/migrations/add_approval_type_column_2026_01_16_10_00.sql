-- Add missing approval_type column to project_material_approvals table
ALTER TABLE project_material_approvals_2026_01_15_06_45 
ADD COLUMN IF NOT EXISTS approval_type TEXT;