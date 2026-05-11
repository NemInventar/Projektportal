-- Verificer at trigger og funktion er oprettet korrekt

-- Tjek trigger
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_quote_status_change_2026_01_21_12_25'
AND event_object_table = 'project_quotes_2026_01_16_23_00';

-- Tjek trigger funktion
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_quote_status_change_2026_01_21_12_25';

-- Tjek eksisterende tilbud for at teste trigger på
SELECT 
    id,
    title,
    status,
    sent_at,
    is_locked,
    locked_at,
    version_no
FROM public.project_quotes_2026_01_16_23_00 
LIMIT 3;