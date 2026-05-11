-- Check existing phase values in the database
SELECT DISTINCT phase, COUNT(*) as count 
FROM public.projects_2026_01_15_06_45 
GROUP BY phase 
ORDER BY phase;