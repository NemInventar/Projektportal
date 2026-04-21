-- Test insert og select på project_budget_lines_2026_01_22_00_00

-- Verificer tabel struktur
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budget_lines_2026_01_22_00_00'
ORDER BY ordinal_position;

-- Test insert af en budget-linje
DO $$
DECLARE
    test_project_id uuid;
    test_budget_id uuid;
    test_budget_line_id uuid;
    test_cost_breakdown jsonb;
BEGIN
    -- Find første projekt ID
    SELECT id INTO test_project_id FROM public.projects_2026_01_15_06_45 LIMIT 1;
    
    IF test_project_id IS NOT NULL THEN
        -- Opret test budget først
        INSERT INTO public.project_budgets_2026_01_22_00_00 (
            project_id,
            budget_number,
            title,
            status
        ) VALUES (
            test_project_id,
            'B-TEST-001',
            'Test Budget for Lines',
            'active'
        ) RETURNING id INTO test_budget_id;
        
        RAISE NOTICE 'Test budget oprettet med ID: %', test_budget_id;
        
        -- Opret test cost breakdown JSON
        test_cost_breakdown := '{
            "materials": 1000,
            "transport": 200,
            "labor_production": 500,
            "labor_dk": 300,
            "other": 100
        }'::jsonb;
        
        -- Insert test budget line
        INSERT INTO public.project_budget_lines_2026_01_22_00_00 (
            project_budget_id,
            title,
            description,
            quantity,
            unit,
            sort_order,
            locked_sell_total,
            baseline_cost_total,
            baseline_cost_breakdown_json,
            baseline_risk_total
        ) VALUES (
            test_budget_id,
            'Test Budget Linje',
            'Test beskrivelse af budget linje',
            5,
            'stk',
            1,
            15000.00,  -- locked_sell_total
            10000.00,  -- baseline_cost_total
            test_cost_breakdown,
            500.00     -- baseline_risk_total
        ) RETURNING id INTO test_budget_line_id;
        
        RAISE NOTICE 'Test budget linje oprettet med ID: %', test_budget_line_id;
        
        -- Test select med join til budget
        PERFORM bl.*, b.title as budget_title 
        FROM public.project_budget_lines_2026_01_22_00_00 bl
        JOIN public.project_budgets_2026_01_22_00_00 b ON bl.project_budget_id = b.id
        WHERE bl.id = test_budget_line_id;
        
        RAISE NOTICE 'Test budget linje kan læses korrekt med join';
        
        -- Test at JSON breakdown kan læses
        PERFORM baseline_cost_breakdown_json->>'materials' as materials_cost
        FROM public.project_budget_lines_2026_01_22_00_00 
        WHERE id = test_budget_line_id;
        
        RAISE NOTICE 'JSON breakdown kan læses korrekt';
        
        -- Slet test data igen (cascade vil slette linjen automatisk)
        DELETE FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        RAISE NOTICE 'Test data slettet igen (med cascade)';
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
WHERE tablename = 'project_budget_lines_2026_01_22_00_00'
ORDER BY indexname;

-- Verificer foreign key constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_budget_lines_2026_01_22_00_00'::regclass
AND contype = 'f';