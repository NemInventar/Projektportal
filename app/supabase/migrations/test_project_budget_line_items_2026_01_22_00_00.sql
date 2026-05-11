-- Test insert og select på project_budget_line_items_2026_01_22_00_00

-- Verificer tabel struktur
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budget_line_items_2026_01_22_00_00'
ORDER BY ordinal_position;

-- Test insert af budget line items
DO $$
DECLARE
    test_project_id uuid;
    test_budget_id uuid;
    test_budget_line_id uuid;
    test_item_id_1 uuid;
    test_item_id_2 uuid;
    test_cost_breakdown_1 jsonb;
    test_cost_breakdown_2 jsonb;
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
            'B-TEST-ITEMS-001',
            'Test Budget for Items',
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
            'Test Budget Linje med Items',
            'Test linje til items test',
            3,
            'stk',
            9000.00,
            6000.00
        ) RETURNING id INTO test_budget_line_id;
        
        RAISE NOTICE 'Test budget og linje oprettet. Line ID: %', test_budget_line_id;
        
        -- Opret test cost breakdowns
        test_cost_breakdown_1 := '{
            "materials": 800,
            "transport": 100,
            "labor_production": 300,
            "labor_dk": 200,
            "other": 50
        }'::jsonb;
        
        test_cost_breakdown_2 := '{
            "materials": 1200,
            "transport": 150,
            "labor_production": 400,
            "labor_dk": 250,
            "other": 100
        }'::jsonb;
        
        -- Insert første budget line item (project_product type)
        INSERT INTO public.project_budget_line_items_2026_01_22_00_00 (
            project_budget_line_id,
            source_type,
            title,
            qty,
            unit,
            baseline_cost_breakdown_json,
            baseline_cost_total_per_unit
        ) VALUES (
            test_budget_line_id,
            'project_product',
            'Test Projektprodukt Item',
            2,
            'stk',
            test_cost_breakdown_1,
            1450.00
        ) RETURNING id INTO test_item_id_1;
        
        -- Insert anden budget line item (custom type)
        INSERT INTO public.project_budget_line_items_2026_01_22_00_00 (
            project_budget_line_id,
            source_type,
            title,
            qty,
            unit,
            baseline_cost_breakdown_json,
            baseline_cost_total_per_unit
        ) VALUES (
            test_budget_line_id,
            'custom',
            'Test Custom Item',
            1,
            'stk',
            test_cost_breakdown_2,
            2100.00
        ) RETURNING id INTO test_item_id_2;
        
        RAISE NOTICE 'Test budget line items oprettet. IDs: %, %', test_item_id_1, test_item_id_2;
        
        -- Test select med join til budget line og budget
        PERFORM 
            bli.title as item_title,
            bli.source_type,
            bli.qty,
            bli.baseline_cost_total_per_unit,
            bl.title as line_title,
            b.title as budget_title
        FROM public.project_budget_line_items_2026_01_22_00_00 bli
        JOIN public.project_budget_lines_2026_01_22_00_00 bl ON bli.project_budget_line_id = bl.id
        JOIN public.project_budgets_2026_01_22_00_00 b ON bl.project_budget_id = b.id
        WHERE bli.id IN (test_item_id_1, test_item_id_2);
        
        RAISE NOTICE 'Test budget line items kan læses korrekt med joins';
        
        -- Test at JSON breakdown kan læses og aggregeres
        PERFORM 
            SUM((baseline_cost_breakdown_json->>'materials')::numeric) as total_materials,
            SUM(baseline_cost_total_per_unit * qty) as total_cost
        FROM public.project_budget_line_items_2026_01_22_00_00 
        WHERE project_budget_line_id = test_budget_line_id;
        
        RAISE NOTICE 'JSON breakdown kan læses og aggregeres korrekt';
        
        -- Test CASCADE delete - slet budget (skal slette alt)
        DELETE FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        -- Verificer at alt er slettet
        IF NOT EXISTS (SELECT 1 FROM public.project_budget_line_items_2026_01_22_00_00 WHERE id IN (test_item_id_1, test_item_id_2)) THEN
            RAISE NOTICE 'CASCADE delete virker korrekt - alle items slettet';
        ELSE
            RAISE NOTICE 'FEJL: CASCADE delete virkede ikke korrekt';
        END IF;
        
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
WHERE tablename = 'project_budget_line_items_2026_01_22_00_00'
ORDER BY indexname;

-- Verificer constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.project_budget_line_items_2026_01_22_00_00'::regclass;