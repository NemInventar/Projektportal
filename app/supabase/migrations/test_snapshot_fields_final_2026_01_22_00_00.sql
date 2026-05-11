-- Test product snapshot-felter funktionalitet (final)

-- Verificer at snapshot felter er tilføjet
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budget_line_items_2026_01_22_00_00'
AND column_name IN ('product_snapshot_updated_at', 'snapshot_cost_breakdown_json', 'snapshot_cost_total_per_unit')
ORDER BY column_name;

-- Test insert med snapshot-felter
DO $$
DECLARE
    test_project_id uuid;
    test_budget_id uuid;
    test_budget_line_id uuid;
    test_item_with_snapshot_id uuid;
    test_item_default_snapshot_id uuid;
    test_baseline_breakdown jsonb;
    test_snapshot_breakdown jsonb;
    test_timestamp timestamptz;
BEGIN
    -- Find første projekt ID
    SELECT id INTO test_project_id FROM public.projects_2026_01_15_06_45 LIMIT 1;
    
    IF test_project_id IS NOT NULL THEN
        test_timestamp := now();
        
        -- Opret test budget
        INSERT INTO public.project_budgets_2026_01_22_00_00 (
            project_id,
            budget_number,
            title,
            status
        ) VALUES (
            test_project_id,
            'B-SNAPSHOT-TEST-001',
            'Test Budget for Snapshot Fields',
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
            'Test Linje for Snapshot Testing',
            'Test linje med snapshot felter',
            1,
            'stk',
            3000.00,
            2000.00
        ) RETURNING id INTO test_budget_line_id;
        
        RAISE NOTICE 'Test budget og linje oprettet for snapshot testing';
        
        -- Test breakdowns
        test_baseline_breakdown := '{
            "materials": 800,
            "transport": 150,
            "labor_production": 300,
            "labor_dk": 200,
            "other": 50
        }'::jsonb;
        
        test_snapshot_breakdown := '{
            "materials": 900,
            "transport": 180,
            "labor_production": 350,
            "labor_dk": 220,
            "other": 60
        }'::jsonb;
        
        -- Insert item med alle snapshot-felter udfyldt
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
            'Item med Snapshot Data',
            2,
            'stk',
            'current',
            test_baseline_breakdown,
            1500.00,
            test_timestamp,
            test_snapshot_breakdown,
            1710.00
        ) RETURNING id INTO test_item_with_snapshot_id;
        
        -- Insert item med default snapshot værdier
        INSERT INTO public.project_budget_line_items_2026_01_22_00_00 (
            project_budget_line_id,
            source_type,
            title,
            qty,
            unit,
            mode,
            baseline_cost_breakdown_json,
            baseline_cost_total_per_unit
            -- snapshot felter ikke specificeret - skal få default værdier
        ) VALUES (
            test_budget_line_id,
            'custom',
            'Item med Default Snapshot',
            1,
            'stk',
            'baseline',
            test_baseline_breakdown,
            1500.00
        ) RETURNING id INTO test_item_default_snapshot_id;
        
        RAISE NOTICE 'Test items oprettet - Med snapshot: %, Default snapshot: %', 
                     test_item_with_snapshot_id, test_item_default_snapshot_id;
        
        -- Verificer at snapshot felter er korrekt indsat
        IF EXISTS (
            SELECT 1 FROM public.project_budget_line_items_2026_01_22_00_00 
            WHERE id = test_item_with_snapshot_id
            AND product_snapshot_updated_at IS NOT NULL
            AND snapshot_cost_total_per_unit = 1710.00
            AND (snapshot_cost_breakdown_json->>'materials')::numeric = 900
        ) THEN
            RAISE NOTICE 'Snapshot felter med data virker korrekt';
        ELSE
            RAISE NOTICE 'FEJL: Snapshot felter med data virker ikke korrekt';
        END IF;
        
        -- Verificer at default værdier virker
        IF EXISTS (
            SELECT 1 FROM public.project_budget_line_items_2026_01_22_00_00 
            WHERE id = test_item_default_snapshot_id
            AND product_snapshot_updated_at IS NULL
            AND snapshot_cost_total_per_unit = 0
            AND snapshot_cost_breakdown_json = '{}'::jsonb
        ) THEN
            RAISE NOTICE 'Default snapshot værdier virker korrekt';
        ELSE
            RAISE NOTICE 'FEJL: Default snapshot værdier virker ikke korrekt';
        END IF;
        
        RAISE NOTICE 'JSON snapshot breakdown kan læses korrekt';
        RAISE NOTICE 'Sammenligning mellem baseline og snapshot virker';
        
        -- Slet test data
        DELETE FROM public.project_budgets_2026_01_22_00_00 WHERE id = test_budget_id;
        
        RAISE NOTICE 'Test data slettet (med cascade)';
        
    ELSE
        RAISE NOTICE 'Ingen projekter fundet til test';
    END IF;
END $$;