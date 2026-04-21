-- Test the unique constraint
-- First, set one project as starred (should work)
UPDATE public.projects_2026_01_15_06_45 
SET is_starred = true 
WHERE id = (SELECT id FROM public.projects_2026_01_15_06_45 LIMIT 1);

-- Verify it worked
SELECT id, name, is_starred FROM public.projects_2026_01_15_06_45 WHERE is_starred = true;

-- Now try to set another project as starred (should fail due to unique constraint)
-- This will be wrapped in a transaction that we'll rollback
BEGIN;
  UPDATE public.projects_2026_01_15_06_45 
  SET is_starred = true 
  WHERE id != (SELECT id FROM public.projects_2026_01_15_06_45 WHERE is_starred = true LIMIT 1)
  LIMIT 1;
ROLLBACK;

-- Reset for clean state
UPDATE public.projects_2026_01_15_06_45 SET is_starred = false;