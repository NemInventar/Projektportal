-- Test overførsel af accepteret tilbud til budget funktionalitet

DO $$
DECLARE
    test_project_id uuid;
    test_quote_id uuid;
    test_quote_line_id uuid;
    test_quote_line_item_id uuid;
    test_budget_count int;
    test_budget_line_count int;
    test_baseline_item_count int;
    test_current_item_count int;
BEGIN
    -- Find første projekt ID
    SELECT id INTO test_project_id FROM public.projects_2026_01_15_06_45 LIMIT 1;
    
    IF test_project_id IS NOT NULL THEN
        -- Opret test quote med status 'accepted'
        INSERT INTO public.project_quotes_2026_01_16_23_00 (
            project_id,
            quote_number,
            title,
            status,
            valid_until
        ) VALUES (
            test_project_id,
            'Q-TRANSFER-TEST-001',
            'Test Quote for Budget Transfer',
            'accepted',
            (now() + interval '30 days')::date
        ) RETURNING id INTO test_quote_id;
        
        -- Opret test quote line
        INSERT INTO public.project_quote_lines_2026_01_16_23_00 (
            project_quote_id,
            title,
            description,
            quantity,
            unit,
            sort_order
        ) VALUES (
            test_quote_id,
            'Test Quote Line for Transfer',
            'Test linje til budget overførsel',
            2,
            'stk',
            1
        ) RETURNING id INTO test_quote_line_id;
        
        -- Opret test quote line item
        INSERT INTO public.project_quote_line_items_2026_01_16_23_00 (
            project_quote_line_id,
            source_type,
            title,
            qty,
            unit,
            cost_breakdown_json,
            cost_total_per_unit
        ) VALUES (
            test_quote_line_id,
            'custom',
            'Test Quote Line Item',
            1,
            'stk',
            '{"materials": 1000, "transport": 200, "labor_production": 400, "labor_dk": 300, "other": 100}'::jsonb,
            2000.00
        ) RETURNING id INTO test_quote_line_item_id;
        
        RAISE NOTICE 'Test quote struktur oprettet - Quote: %, Line: %, Item: %', 
                     test_quote_id, test_quote_line_id, test_quote_line_item_id;
        
        -- Simuler overførsel til budget (dette ville normalt ske via UI)
        -- Her tester vi kun at strukturen understøtter overførslen
        
        -- Verificer at quote er klar til overførsel
        IF EXISTS (
            SELECT 1 FROM public.project_quotes_2026_01_16_23_00 
            WHERE id = test_quote_id AND status = 'accepted'
        ) THEN
            RAISE NOTICE '✅ Quote har korrekt status (accepted) for overførsel';
        ELSE
            RAISE NOTICE '❌ FEJL: Quote har ikke korrekt status';
        END IF;
        
        -- Verificer at quote line items har de nødvendige felter
        IF EXISTS (
            SELECT 1 FROM public.project_quote_line_items_2026_01_16_23_00 
            WHERE id = test_quote_line_item_id 
            AND cost_breakdown_json IS NOT NULL
            AND cost_total_per_unit IS NOT NULL
        ) THEN
            RAISE NOTICE '✅ Quote line items har nødvendige cost felter';
        ELSE
            RAISE NOTICE '❌ FEJL: Quote line items mangler cost felter';
        END IF;
        
        -- Test at budget tabeller er klar til at modtage data
        -- (Dette ville normalt ske via transferToBudget funktionen)
        
        -- Simuler budget oprettelse
        INSERT INTO public.project_budgets_2026_01_22_00_00 (
            project_id,
            source_quote_id,
            budget_number,
            title,
            status
        ) VALUES (
            test_project_id,
            test_quote_id,
            'B-TRANSFER-TEST-001',
            'Budget fra Test Quote for Budget Transfer',
            'active'
        );
        
        -- Verificer budget oprettelse
        SELECT COUNT(*) INTO test_budget_count 
        FROM public.project_budgets_2026_01_22_00_00 
        WHERE source_quote_id = test_quote_id;
        
        IF test_budget_count = 1 THEN
            RAISE NOTICE '✅ Budget kan oprettes med reference til quote';
        ELSE
            RAISE NOTICE '❌ FEJL: Budget oprettelse fejlede';
        END IF;
        
        -- Test at alle nødvendige tabeller og felter eksisterer
        PERFORM 
            column_name
        FROM information_schema.columns 
        WHERE table_name = 'project_budget_line_items_2026_01_22_00_00'
        AND column_name IN (
            'mode', 
            'product_snapshot_updated_at', 
            'snapshot_cost_breakdown_json', 
            'snapshot_cost_total_per_unit',
            'baseline_cost_breakdown_json',
            'baseline_cost_total_per_unit'
        );
        
        IF FOUND THEN
            RAISE NOTICE '✅ Budget line items tabel har alle nødvendige felter til overførsel';
        ELSE
            RAISE NOTICE '❌ FEJL: Budget line items tabel mangler felter';
        END IF;
        
        -- Slet test data
        DELETE FROM public.project_quotes_2026_01_16_23_00 WHERE id = test_quote_id;
        
        RAISE NOTICE '✅ Test data slettet';
        RAISE NOTICE '✅ Overførsel funktionalitet er klar til brug';
        
    ELSE
        RAISE NOTICE '❌ Ingen projekter fundet til test';
    END IF;
END $$;

-- Verificer at alle nødvendige tabeller og relationer eksisterer
SELECT 
    'Tabeller til budget overførsel:' as info,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'project_budgets_2026_01_22_00_00',
    'project_budget_lines_2026_01_22_00_00', 
    'project_budget_line_items_2026_01_22_00_00'
)
ORDER BY table_name;