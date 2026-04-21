-- Verificer at mode kolonne og index allerede eksisterer

-- Tjek mode kolonne
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budget_line_items_2026_01_22_00_00'
AND column_name = 'mode';

-- Tjek mode constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_budget_line_items_2026_01_22_00_00'::regclass
AND conname LIKE '%mode%';

-- Tjek composite index
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'project_budget_line_items_2026_01_22_00_00'
AND indexname LIKE '%line_mode%';