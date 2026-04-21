-- Insert test transport rates for standard materials
INSERT INTO public.material_transport_rates_2026_01_15_06_45 (standard_material_id, route_type, from_location, to_location, cost_model, unit_cost, currency, valid_from, note) VALUES
-- Transport for Krydsfiner Birk 18mm
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'to_kosovo', 'København, Danmark', 'Pristina, Kosovo', 'per_unit', 25.00, 'DKK', '2024-01-01', 'Standard transport til Kosovo pr. m²'),
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'from_kosovo_to_dk', 'Pristina, Kosovo', 'København, Danmark', 'per_unit', 30.00, 'DKK', '2024-01-01', 'Retur transport fra Kosovo pr. m²'),

-- Transport for Hængsler Blum 110°
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'to_kosovo', 'København, Danmark', 'Pristina, Kosovo', 'per_unit', 2.50, 'DKK', '2024-01-01', 'Standard transport til Kosovo pr. stk'),
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'from_kosovo_to_dk', 'Pristina, Kosovo', 'København, Danmark', 'per_shipment', 500.00, 'DKK', '2024-01-01', 'Samlet forsendelse fra Kosovo'),

-- Transport for Laminat Hvid Matt
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Laminat Hvid Matt' LIMIT 1), 'to_kosovo', 'København, Danmark', 'Pristina, Kosovo', 'per_unit', 15.00, 'DKK', '2024-01-01', 'Standard transport til Kosovo pr. m²'),
((SELECT id FROM public.standard_materials_2026_01_15_06_45 WHERE name = 'Laminat Hvid Matt' LIMIT 1), 'other', 'Aalborg, Danmark', 'Pristina, Kosovo', 'per_unit', 18.00, 'DKK', '2024-01-01', 'Alternativ rute fra Aalborg');

-- Insert corresponding project material transport (copied from standard)
INSERT INTO public.project_material_transport_2026_01_15_06_45 (project_material_id, route_type, from_location, to_location, expected_cost_model, expected_unit_cost, currency, expected_note) VALUES
-- Transport for project material Krydsfiner Birk 18mm
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'to_kosovo', 'København, Danmark', 'Pristina, Kosovo', 'per_unit', 25.00, 'DKK', 'Kopieret fra standard materiale'),
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner Birk 18mm' LIMIT 1), 'from_kosovo_to_dk', 'Pristina, Kosovo', 'København, Danmark', 'per_unit', 30.00, 'DKK', 'Kopieret fra standard materiale'),

-- Transport for project material Hængsler Blum 110°
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'to_kosovo', 'København, Danmark', 'Pristina, Kosovo', 'per_unit', 2.50, 'DKK', 'Kopieret fra standard materiale'),
((SELECT id FROM public.project_materials_2026_01_15_06_45 WHERE name = 'Hængsler Blum 110°' LIMIT 1), 'from_kosovo_to_dk', 'Pristina, Kosovo', 'København, Danmark', 'per_shipment', 500.00, 'DKK', 'Projekt-specifik justering: samlet forsendelse');