-- Insert test projects
INSERT INTO public.projects_2026_01_15_06_45 (name, customer, project_number, phase) VALUES
('Køkkenrenovering Villa Skovvej', 'Familie Hansen', 'P2024-001', 'Produktion'),
('Kontorindretning TechCorp', 'TechCorp A/S', 'P2024-002', 'Tilbud'),
('Badeværelse Penthouse', 'Lux Living ApS', 'P2024-003', 'Afsluttet');

-- Insert test suppliers
INSERT INTO public.standard_suppliers_2026_01_15_06_45 (name, cvr, contact_person, email, phone, address, postal_code, city, country, notes, status) VALUES
('Træ & Plader A/S', '12345678', 'Lars Nielsen', 'lars@traeplader.dk', '+45 12 34 56 78', 'Industrivej 10', '2600', 'Glostrup', 'Danmark', 'Specialiseret i krydsfiner og MDF plader', 'Aktiv'),
('Beslag Kompagniet', '87654321', 'Maria Andersen', 'maria@beslag.dk', '+45 87 65 43 21', 'Håndværkervej 5', '2650', 'Hvidovre', 'Danmark', 'Leverandør af skruer, beslag og småjern', 'Aktiv'),
('Nordisk Overflade', '11223344', 'Peter Sørensen', 'peter@overflade.dk', '+45 11 22 33 44', 'Lakgade 15', '2000', 'Frederiksberg', 'Danmark', 'Specialiseret i køkkenmaterialer og fliser', 'Aktiv');

-- Insert test materials
INSERT INTO public.standard_materials_2026_01_15_06_45 (name, description, category, unit, primary_supplier_id, supplier_product_code, material_type, certifications) VALUES
('Krydsfiner Birk 18mm', 'Højkvalitets krydsfiner i birk, 18mm tykkelse', 'Plademateriale', 'm²', (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Træ & Plader A/S' LIMIT 1), 'KF-BIRK-18', 'Plade', ARRAY['FSC', 'PEFC']),
('Hængsler Blum 110°', 'Blum hængsler med 110° åbning', 'Beslag & Skruer', 'stk', (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslag Kompagniet' LIMIT 1), 'BLUM-110', 'Beslag', ARRAY[]::text[]),
('Laminat Hvid Matt', 'Hvid mat laminat til køkkenlåger', 'Overfladebehandling', 'm²', (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Nordisk Overflade' LIMIT 1), 'LAM-HVID-M', 'Overflade', ARRAY['EU Ecolabel']);

-- Insert test prices
INSERT INTO public.material_prices_2026_01_15_06_45 (material_id, supplier_id, unit_price, currency, valid_from) VALUES
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Træ & Plader A/S' LIMIT 1), 450.00, 'DKK', '2024-01-01'),
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslag Kompagniet' LIMIT 1), 25.50, 'DKK', '2024-01-01'),
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Laminat Hvid Matt' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Nordisk Overflade' LIMIT 1), 320.00, 'DKK', '2024-01-01');

-- Insert test project materials
INSERT INTO public.project_materials_2026_01_15_06_45 (project_id, standard_material_id, name, description, category, unit, supplier_id, supplier_product_code, unit_price, currency, price_status) VALUES
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), (SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'Krydsfiner Birk 18mm', 'Til køkkenlåger og skuffer', 'Plademateriale', 'm²', (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Træ & Plader A/S' LIMIT 1), 'KF-BIRK-18', 450.00, 'DKK', 'confirmed'),
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), (SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'Hængsler Blum 110°', 'Til køkkenlåger', 'Beslag & Skruer', 'stk', (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslag Kompagniet' LIMIT 1), 'BLUM-110', 25.50, 'DKK', 'confirmed');

-- Insert test approvals
INSERT INTO public.project_material_approvals_2026_01_15_06_45 (project_material_id, type, status, approved_by, approved_at, notes) VALUES
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'production', 'approved', 'Lars Hansen', NOW(), 'Godkendt til produktion'),
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'sustainability', 'approved', 'Maria Sørensen', NOW(), 'FSC certificeret - godkendt'),
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'production', 'approved', 'Lars Hansen', NOW(), 'Godkendt til produktion'),
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'sustainability', 'not_approved', NULL, NULL, 'Afventer bæredygtighedsvurdering');

-- Insert test purchase orders
INSERT INTO public.purchase_orders_2026_01_15_06_45 (project_id, supplier_id, status, order_date, notes) VALUES
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Træ & Plader A/S' LIMIT 1), 'sent', '2024-01-15', 'Første delbestilling til køkkenprojekt'),
((SELECT id FROM public.projects_2026_01_15_06_45 WHERE project_number = 'P2024-001' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslag Kompagniet' LIMIT 1), 'draft', NULL, 'Kladde til beslag bestilling');

-- Insert test purchase order lines
INSERT INTO public.purchase_order_lines_2026_01_15_06_45 (purchase_order_id, project_material_id, supplier_id, supplier_product_code, ordered_qty, unit, unit_price, currency, expected_delivery_date, status, notes, approval_override, approval_override_reason, approval_override_by, approval_override_at) VALUES
((SELECT id FROM public.purchase_orders_2026_01_15_06_45 WHERE status = 'sent' LIMIT 1), (SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Træ & Plader A/S' LIMIT 1), 'KF-BIRK-18', 15.5, 'm²', 450.00, 'DKK', '2024-01-25', 'ordered', 'Første delbestilling', FALSE, NULL, NULL, NULL),
((SELECT id FROM public.purchase_orders_2026_01_15_06_45 WHERE status = 'draft' LIMIT 1), (SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), (SELECT id FROM public.standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslag Kompagniet' LIMIT 1), 'BLUM-110', 24, 'stk', 25.50, 'DKK', '2024-01-30', 'ordered', 'Test bestilling med override', TRUE, 'Test af approval override funktionalitet', 'test_user', NOW());