-- Test insert og select på project_budgets_2026_01_22_00_00

-- Verificer tabel struktur
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budgets_2026_01_22_00_00'
ORDER BY ordinal_position;

-- Test insert af et budget
DO $$
DECLARE
    test_project_id uuid;
    test_budget_id uuid;
BEGIN
    -- Find første projekt ID
    SELECT id INTO test_project_id FROM public.projects_2026_01_15_06_45 LIMIT 1;
    
    IF test_project_id IS NOT NULL THEN
        -- Insert test budget
        INSERT INTO public.project_budgets_2026_01_22_00_00 (
            project_id,
            budget_number,
            title,
            status
        ) VALUES (
            test_project_id,
            'B-2026-001',
            'Test Budget V1',
            'active'
        ) RETURNING id INTO test_budget_id;
        
        RAISE NOTICE 'Test budget oprettet med ID: %', test_budget_id;
        
        -- Test select
        PERFORM * FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        RAISE NOTICE 'Test budget kan læses korrekt';
        
        -- Slet test budget igen
        DELETE FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        RAISE NOTICE 'Test budget slettet igen';
    ELSE
        RAISE NOTICE 'Ingen projekter fundet til test';
    END IF;
END $$;

-- Verificer indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'project_budgets_2026_01_22_00_00'
ORDER BY indexname;

-- Verificer constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_budgets_2026_01_22_00_00'::regclass;