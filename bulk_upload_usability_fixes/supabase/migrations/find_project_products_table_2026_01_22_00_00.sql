-- Find korrekt project_products tabel navn
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%project_product%'
ORDER BY table_name;