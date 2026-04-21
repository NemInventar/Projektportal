-- Verify the is_starred column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'projects_2026_01_15_06_45' 
AND column_name = 'is_starred';

-- Verify the unique index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'projects_2026_01_15_06_45' 
AND indexname = 'idx_projects_unique_starred_2026_01_20_13_04';

-- Test the constraint by trying to set multiple projects as starred (should fail after first one)
-- First, let's see current projects
SELECT id, name, is_starred FROM public.projects_2026_01_15_06_45 LIMIT 5;