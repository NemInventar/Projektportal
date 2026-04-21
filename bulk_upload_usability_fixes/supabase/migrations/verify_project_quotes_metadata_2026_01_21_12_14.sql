-- Verificer at alle nye felter er tilføjet korrekt
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    col_description(pgc.oid, a.attnum) as column_comment
FROM information_schema.columns c
LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
LEFT JOIN pg_attribute a ON a.attrelid = pgc.oid AND a.attname = c.column_name
WHERE table_name = 'project_quotes_2026_01_16_23_00'
AND column_name IN (
    'next_delivery_date', 'delivery_note', 'next_action',
    'owner_user_id', 'priority', 
    'sent_at', 'version_no', 'is_locked', 'locked_at'
)
ORDER BY column_name;

-- Tjek constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_quotes_2026_01_16_23_00'::regclass
AND conname IN ('project_quotes_priority_check', 'project_quotes_version_no_check');