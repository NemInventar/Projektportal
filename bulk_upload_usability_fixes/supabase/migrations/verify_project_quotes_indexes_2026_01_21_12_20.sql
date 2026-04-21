-- Verificer at indexes er oprettet korrekt på project_quotes_2026_01_16_23_00
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    obj_description(indexrelid) as index_comment
FROM pg_indexes 
WHERE tablename = 'project_quotes_2026_01_16_23_00'
AND indexname LIKE '%2026_01_21_12_20%'
ORDER BY indexname;

-- Tjek index størrelse og statistikker
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE relname = 'project_quotes_2026_01_16_23_00'
AND indexrelname LIKE '%2026_01_21_12_20%';