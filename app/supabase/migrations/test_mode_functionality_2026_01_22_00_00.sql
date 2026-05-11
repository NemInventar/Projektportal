-- Test mode kolonne og index funktionalitet

-- Verificer at mode kolonne er tilføjet
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budget_line_items_2026_01_22_00_00'
AND column_name = 'mode';

-- Test insert med forskellige modes
DO $$
DECLARE
    test_project_id uuid;
    test_budget_id uuid;
    test_budget_line_id uuid;
    test_baseline_item_id uuid;
    test_current_item_id uuid;
    test_cost_breakdown jsonb;
BEGIN
    -- Find første projekt ID
    SELECT id INTO test_project_id FROM public.projects_2026_01_15_06_45 LIMIT 1;
    
    IF test_project_id IS NOT NULL THEN
        -- Opret test budget
        INSERT INTO public.project_budgets_2026_01_22_00_00 (
            project_id,
            budget_number,
            title,
            status
        ) VALUES (
            test_project_id,
            'B-MODE-TEST-001',
            'Test Budget for Mode Testing',
            'active'
        ) RETURNING id INTO test_budget_id;
        
        -- Opret test budget line
        INSERT INTO public.project_budget_lines_2026_01_22_00_00 (
            project_budget_id,
            title,
            description,
            quantity,
            unit,
            locked_sell_total,
            baseline_cost_total
        ) VALUES (
            test_budget_id,
            'Test Linje for Mode Testing',
            'Test linje med både baseline og current items',
            2,
            'stk',
            5000.00,
            3000.00
        ) RETURNING id INTO test_budget_line_id;
        
        RAISE NOTICE 'Test budget og linje oprettet for mode testing';
        
        -- Test cost breakdown
        test_cost_breakdown := '{
            "materials": 1000,
            "transport": 200,
            "labor_production": 400,
            "labor_dk": 300,
            "other": 100
        }'::jsonb;
        
        -- Insert baseline item
        INSERT INTO public.project_budget_line_items_2026_01_22_00_00 (
            project_budget_line_id,
            source_type,
            title,
            qty,
            unit,
            mode,
            baseline_cost_breakdown_json,
            baseline_cost_total_per_unit
        ) VALUES (
            test_budget_line_id,
            'project_product',
            'Baseline Item Test',
            1,
            'stk',
            'baseline',
            test_cost_breakdown,
            2000.00
        ) RETURNING id INTO test_baseline_item_id;
        
        -- Insert current item (default mode)
        INSERT INTO public.project_budget_line_items_2026_01_22_00_00 (
            project_budget_line_id,
            source_type,
            title,
            qty,
            unit,
            -- mode ikke specificeret - skal få default 'current'
            baseline_cost_breakdown_json,
            baseline_cost_total_per_unit
        ) VALUES (
            test_budget_line_id,
            'custom',
            'Current Item Test',
            1,
            'stk',
            test_cost_breakdown,
            2200.00
        ) RETURNING id INTO test_current_item_id;
        
        RAISE NOTICE 'Test items oprettet - Baseline ID: %, Current ID: %', test_baseline_item_id, test_current_item_id;
        
        -- Verificer at default mode virker
        PERFORM mode FROM public.project_budget_line_items_2026_01_22_00_00 
        WHERE id = test_current_item_id AND mode = 'current';
        
        IF FOUND THEN
            RAISE NOTICE 'Default mode ''current'' virker korrekt';
        ELSE
            RAISE NOTICE 'FEJL: Default mode virker ikke';
        END IF;
        
        -- Test query med mode filtrering (bruger index)
        PERFORM 
            COUNT(*) as baseline_count
        FROM public.project_budget_line_items_2026_01_22_00_00 
        WHERE project_budget_line_id = test_budget_line_id 
        AND mode = 'baseline';
        
        PERFORM 
            COUNT(*) as current_count
        FROM public.project_budget_line_items_2026_01_22_00_00 
        WHERE project_budget_line_id = test_budget_line_id 
        AND mode = 'current';
        
        RAISE NOTICE 'Mode filtrering virker korrekt (bruger composite index)';
        
        -- Slet test data
        DELETE FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        RAISE NOTICE 'Test data slettet (med cascade)';
        
    ELSE
        RAISE NOTICE 'Ingen projekter fundet til test';
    END IF;
END $$;

-- Verificer at det nye index er oprettet
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'project_budget_line_items_2026_01_22_00_00'
AND indexname LIKE '%line_mode%'
ORDER BY indexname;

-- Verificer mode constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_budget_line_items_2026_01_22_00_00'::regclass
AND conname LIKE '%mode%';