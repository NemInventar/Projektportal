-- Check existing tables to find correct table names
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%project%'
ORDER BY table_name;