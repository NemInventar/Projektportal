-- Test CASCADE DELETE functionality
-- Insert a test price request
INSERT INTO public.project_price_requests_2026_01_25_19_16 (
    project_id, 
    title, 
    description, 
    qty, 
    unit, 
    status
) VALUES (
    gen_random_uuid(), 
    'Test Price Request', 
    'Test description for cascade delete', 
    10, 
    'stk', 
    'open'
) RETURNING id;

-- Get the inserted request ID for testing
DO $$
DECLARE
    test_request_id uuid;
    test_supplier_id uuid := gen_random_uuid();
BEGIN
    -- Get the test request ID
    SELECT id INTO test_request_id 
    FROM public.project_price_requests_2026_01_25_19_16 
    WHERE title = 'Test Price Request' 
    LIMIT 1;
    
    -- Insert test quotes for this request
    INSERT INTO public.project_price_quotes_2026_01_25_19_16 (
        project_price_request_id,
        supplier_id,
        status,
        unit_price,
        currency,
        unit
    ) VALUES 
    (test_request_id, test_supplier_id, 'offered', 100.50, 'DKK', 'stk'),
    (test_request_id, gen_random_uuid(), 'offered', 95.00, 'DKK', 'stk');
    
    -- Verify quotes were inserted
    RAISE NOTICE 'Inserted % quotes for request %', 
        (SELECT COUNT(*) FROM public.project_price_quotes_2026_01_25_19_16 WHERE project_price_request_id = test_request_id),
        test_request_id;
    
    -- Delete the request (should cascade delete quotes)
    DELETE FROM public.project_price_requests_2026_01_25_19_16 WHERE id = test_request_id;
    
    -- Verify quotes were deleted
    RAISE NOTICE 'Remaining quotes after cascade delete: %', 
        (SELECT COUNT(*) FROM public.project_price_quotes_2026_01_25_19_16 WHERE project_price_request_id = test_request_id);
END $$;