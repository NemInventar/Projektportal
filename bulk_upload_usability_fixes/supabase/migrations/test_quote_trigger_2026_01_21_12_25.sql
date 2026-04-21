-- Test trigger funktionalitet for auto-håndtering af sendt tilbud

-- Verificer at trigger og funktion er oprettet
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_quote_status_change_2026_01_21_12_25';

-- Verificer at trigger funktionen eksisterer
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'handle_quote_status_change_2026_01_21_12_25';

-- Test scenarie 1: Opret et test tilbud (hvis der ikke allerede er nogen)
-- Vi tester kun hvis der ikke er eksisterende tilbud
DO $$
DECLARE
    test_project_id uuid;
    test_quote_id uuid;
BEGIN
    -- Find første projekt ID
    SELECT id INTO test_project_id FROM public.projects_2026_01_15_06_45 LIMIT 1;
    
    IF test_project_id IS NOT NULL THEN
        -- Indsæt test tilbud hvis det ikke allerede eksisterer
        INSERT INTO public.project_quotes_2026_01_16_23_00 (
            project_id, title, status, notes, valid_until
        ) VALUES (
            test_project_id, 
            'Test Tilbud for Trigger', 
            'draft', 
            'Test tilbud til trigger test',
            CURRENT_DATE + INTERVAL '30 days'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Test tilbud oprettet eller eksisterer allerede';
    END IF;
END $$;