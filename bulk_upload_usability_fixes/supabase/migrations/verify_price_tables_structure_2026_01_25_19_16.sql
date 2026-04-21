-- Verify table structure and constraints
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('project_price_requests_2026_01_25_19_16', 'project_price_quotes_2026_01_25_19_16')
ORDER BY table_name, ordinal_position;

-- Check constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('project_price_requests_2026_01_25_19_16', 'project_price_quotes_2026_01_25_19_16')
ORDER BY tc.table_name, tc.constraint_type;

-- Check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('project_price_requests_2026_01_25_19_16', 'project_price_quotes_2026_01_25_19_16')
ORDER BY tablename, indexname;