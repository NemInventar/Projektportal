-- Insert test products for the first project
INSERT INTO public.project_products_2026_01_15_12_49 (project_id, name, product_type, unit, quantity, description, notes, status) VALUES
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), 'Køkkenlåger', 'furniture', 'stk', 12, 'Hvide køkkenlåger i moderne design', 'Skal matches med eksisterende stil', 'active'),
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), 'Skuffefronter', 'furniture', 'stk', 8, 'Matchende skuffefronter til køkkenlåger', 'Samme finish som låger', 'active'),
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), 'Bordplade', 'furniture', 'stk', 1, 'Laminat bordplade 3m x 0.6m', 'Hvid mat finish', 'active');

-- Insert test material lines for the first product (Køkkenlåger)
INSERT INTO public.project_product_material_lines_2026_01_15_12_49 (
    project_product_id, 
    project_material_id, 
    line_title, 
    line_description, 
    calc_enabled, 
    calc_length_m, 
    calc_width_m, 
    calc_count, 
    base_qty, 
    waste_pct, 
    qty, 
    unit, 
    unit_cost_override, 
    note, 
    sort_order
) VALUES
-- Krydsfiner til låger
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 (SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 
 'Krydsfiner - låger', 
 'Til køkkenlåger og rammer', 
 true, 
 0.6, 
 0.4, 
 12, 
 2.88, 
 5, 
 3.024, 
 'm²', 
 NULL, 
 'Standard spild 5%', 
 1),
-- Hængsler til låger
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 (SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 
 'Hængsler', 
 'To hængsler pr. låge', 
 false, 
 NULL, 
 NULL, 
 NULL, 
 24, 
 0, 
 24, 
 'stk', 
 NULL, 
 'Ingen spild på hængsler', 
 2);

-- Insert test labor lines
INSERT INTO public.project_product_labor_lines_2026_01_15_12_49 (
    project_product_id, 
    labor_type, 
    title, 
    qty, 
    unit, 
    unit_cost, 
    note, 
    sort_order
) VALUES
-- Produktion af køkkenlåger
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 'production', 
 'Fremstilling af låger', 
 16, 
 'timer', 
 350.00, 
 'Skæring, samling og finish', 
 1),
-- Montage i Danmark
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 'dk_installation', 
 'Montage på køkken', 
 4, 
 'timer', 
 450.00, 
 'Opsætning og justering', 
 2);

-- Insert test transport lines
INSERT INTO public.project_product_transport_lines_2026_01_15_12_49 (
    project_product_id, 
    title, 
    qty, 
    unit, 
    unit_cost, 
    note, 
    sort_order
) VALUES
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 'Transport samlet produkt → DK', 
 1, 
 'shipment', 
 800.00, 
 'Fragil emballage påkrævet', 
 1);

-- Insert test other cost lines
INSERT INTO public.project_product_other_cost_lines_2026_01_15_12_49 (
    project_product_id, 
    title, 
    qty, 
    unit, 
    unit_cost, 
    note, 
    sort_order
) VALUES
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 'Emballage og beskyttelse', 
 1, 
 'sæt', 
 200.00, 
 'Specialemballage til transport', 
 1),
((SELECT id FROM public.project_products_2026_01_15_12_49 WHERE name = 'Køkkenlåger' LIMIT 1), 
 'Kvalitetskontrol', 
 1, 
 'inspektion', 
 150.00, 
 'Slutkontrol før forsendelse', 
 2);