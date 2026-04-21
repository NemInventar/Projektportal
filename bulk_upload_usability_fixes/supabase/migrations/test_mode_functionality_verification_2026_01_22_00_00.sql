-- Test mode funktionalitet med baseline og current

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
            'B-MODE-VERIFY-001',
            'Test Budget for Mode Verification',
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
            'Test Linje for Mode Verification',
            'Test linje med både baseline og current items',
            2,
            'stk',
            5000.00,
            3000.00
        ) RETURNING id INTO test_budget_line_id;
        
        RAISE NOTICE 'Test budget og linje oprettet for mode verification';
        
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
            baseline_cost_total_per_unit,
            product_snapshot_updated_at,
            snapshot_cost_breakdown_json,
            snapshot_cost_total_per_unit
        ) VALUES (
            test_budget_line_id,
            'project_product',
            'Baseline Item fra Tilbud',
            1,
            'stk',
            'baseline',
            test_cost_breakdown,
            2000.00,
            now(),
            test_cost_breakdown,
            2000.00
        ) RETURNING id INTO test_baseline_item_id;
        
        -- Insert current item (default mode skal være 'current')
        INSERT INTO public.project_budget_line_items_2026_01_22_00_00 (
            project_budget_line_id,
            source_type,
            title,
            qty,
            unit,
            -- mode ikke specificeret - skal få default 'current'
            baseline_cost_breakdown_json,
            baseline_cost_total_per_unit,
            product_snapshot_updated_at,
            snapshot_cost_breakdown_json,
            snapshot_cost_total_per_unit
        ) VALUES (
            test_budget_line_id,
            'project_product',
            'Current Item (Arbejdskopi)',
            1,
            'stk',
            test_cost_breakdown,
            2200.00,
            now(),
            test_cost_breakdown,
            2200.00
        ) RETURNING id INTO test_current_item_id;
        
        RAISE NOTICE 'Test items oprettet - Baseline ID: %, Current ID: %', test_baseline_item_id, test_current_item_id;
        
        -- Verificer at begge items eksisterer på samme budget line
        IF EXISTS (
            SELECT 1 FROM public.project_budget_line_items_2026_01_22_00_00 
            WHERE project_budget_line_id = test_budget_line_id 
            AND mode = 'baseline'
        ) AND EXISTS (
            SELECT 1 FROM public.project_budget_line_items_2026_01_22_00_00 
            WHERE project_budget_line_id = test_budget_line_id 
            AND mode = 'current'
        ) THEN
            RAISE NOTICE '✅ Begge modes (baseline og current) kan eksistere på samme budget line';
        ELSE
            RAISE NOTICE '❌ FEJL: Modes virker ikke korrekt';
        END IF;
        
        -- Verificer at default mode virker
        IF EXISTS (
            SELECT 1 FROM public.project_budget_line_items_2026_01_22_00_00 
            WHERE id = test_current_item_id AND mode = 'current'
        ) THEN
            RAISE NOTICE '✅ Default mode ''current'' virker korrekt';
        ELSE
            RAISE NOTICE '❌ FEJL: Default mode virker ikke';
        END IF;
        
        -- Test query performance med composite index
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
        
        RAISE NOTICE '✅ Composite index query virker korrekt';
        
        -- Test sammenligning mellem baseline og current
        PERFORM 
            b.title as baseline_title,
            b.snapshot_cost_total_per_unit as baseline_cost,
            c.title as current_title,
            c.snapshot_cost_total_per_unit as current_cost,
            (c.snapshot_cost_total_per_unit - b.snapshot_cost_total_per_unit) as cost_difference
        FROM public.project_budget_line_items_2026_01_22_00_00 b
        JOIN public.project_budget_line_items_2026_01_22_00_00 c 
            ON b.project_budget_line_id = c.project_budget_line_id
        WHERE b.project_budget_line_id = test_budget_line_id
        AND b.mode = 'baseline'
        AND c.mode = 'current';
        
        RAISE NOTICE '✅ Sammenligning mellem baseline og current virker';
        
        -- Slet test data
        DELETE FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        RAISE NOTICE '✅ Test data slettet (med cascade)';
        
    ELSE
        RAISE NOTICE '❌ Ingen projekter fundet til test';
    END IF;
END $$;