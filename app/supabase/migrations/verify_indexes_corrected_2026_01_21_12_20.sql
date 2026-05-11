-- Verificer at indexes er oprettet korrekt på project_quotes_2026_01_16_23_00
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'project_quotes_2026_01_16_23_00'
AND indexname LIKE '%2026_01_21_12_20%'
ORDER BY indexname;

-- Tjek alle indexes på tabellen
SELECT 
    i.relname as index_name,
    a.attname as column_name,
    am.amname as index_type
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
JOIN pg_am am ON i.relam = am.oid
WHERE t.relname = 'project_quotes_2026_01_16_23_00'
AND i.relname LIKE '%2026_01_21_12_20%'
ORDER BY i.relname, a.attnum;