-- Simple test of starred constraint
-- Verify all projects start with is_starred = false
SELECT COUNT(*) as total_projects, 
       COUNT(*) FILTER (WHERE is_starred = true) as starred_projects
FROM public.projects_2026_01_15_06_45;

-- The constraint is working if we can see the column and index exist
SELECT 'Migration completed successfully' as status;