-- Insert test data for price requests API testing
DO $$
DECLARE
    test_project_id uuid := gen_random_uuid();
    test_request_id uuid;
    test_supplier_id_1 uuid := gen_random_uuid();
    test_supplier_id_2 uuid := gen_random_uuid();
BEGIN
    -- Insert test price request
    INSERT INTO public.project_price_requests_2026_01_25_19_16 (
        project_id,
        title,
        description,
        qty,
        unit,
        budget_hint,
        deadline,
        status
    ) VALUES (
        test_project_id,
        'Test Skohylder Prisindhentning',
        'Prisindhentning for skohylder til projekt',
        50,
        'stk',
        40000.00,
        CURRENT_DATE + INTERVAL '14 days',
        'open'
    ) RETURNING id INTO test_request_id;
    
    -- Insert test quotes for this request
    INSERT INTO public.project_price_quotes_2026_01_25_19_16 (
        project_price_request_id,
        supplier_id,
        status,
        unit_price,
        currency,
        unit,
        min_qty,
        lead_time_days,
        valid_until,
        notes,
        received_at
    ) VALUES 
    (
        test_request_id,
        test_supplier_id_1,
        'offered',
        850.00,
        'DKK',
        'stk',
        10,
        21,
        CURRENT_DATE + INTERVAL '30 days',
        'Inkluderer montering og levering',
        CURRENT_DATE
    ),
    (
        test_request_id,
        test_supplier_id_2,
        'offered',
        795.00,
        'DKK',
        'stk',
        25,
        14,
        CURRENT_DATE + INTERVAL '21 days',
        'Bedste pris ved større mængder',
        CURRENT_DATE - INTERVAL '1 day'
    );
    
    RAISE NOTICE 'Test data created - Project ID: %, Request ID: %', test_project_id, test_request_id;
    RAISE NOTICE 'Use project_id % to test the API endpoints', test_project_id;
END $$;