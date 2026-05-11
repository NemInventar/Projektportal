-- Tjek eksisterende tabeller for prissnapshots
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%price%' OR table_name LIKE '%snapshot%'
ORDER BY table_name;