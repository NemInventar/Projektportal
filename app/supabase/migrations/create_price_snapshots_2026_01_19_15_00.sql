-- Opret prissnapshots for materialer med kendte priser
DO $$
DECLARE
  material_record RECORD;
  beslagsmanden_id UUID;
  paged_id UUID;
  rubio_id UUID;
  spradling_id UUID;
BEGIN
  -- Hent leverandør ID'er
  SELECT id INTO beslagsmanden_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslagsmanden';
  SELECT id INTO paged_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'PAGED Plywood';
  SELECT id INTO rubio_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'Rubio Monocoat DK';
  SELECT id INTO spradling_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'SPRADLING';

  -- Materialer med priser og leverandører
  -- Beslagsmanden materialer
  FOR material_record IN 
    SELECT id FROM standard_materials_2026_01_15_06_45 
    WHERE name IN (
      'Gevindskrue M6 (DIN 7991) undersænket',
      'Häfele Aximat 300 SM hængsel',
      'Indslagsmøtrik forzinket stål',
      'Monteringsbøsning til iskruning',
      'Samleskrue M6 2-delt 30mm',
      'Skærmskive ISO 7093 varmgalv.',
      'Stillefod drejelig med plastfod',
      'Stillefod M12 til sokkel 200 kg'
    )
  LOOP
    -- Indsæt prissnapshot baseret på materialenavnet
    CASE 
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Gevindskrue M6 (DIN 7991) undersænket') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 0.65, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Häfele Aximat 300 SM hængsel') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 44.00, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Indslagsmøtrik forzinket stål') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 0.80, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Monteringsbøsning til iskruning') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 0.90, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Samleskrue M6 2-delt 30mm') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 3.00, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Skærmskive ISO 7093 varmgalv.') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 0.30, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Stillefod drejelig med plastfod') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 6.50, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Stillefod M12 til sokkel 200 kg') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, beslagsmanden_id, 46.00, 'DKK', CURRENT_DATE, NOW(), NOW());
    END CASE;
  END LOOP;

  -- PAGED Plywood materialer
  FOR material_record IN 
    SELECT id FROM standard_materials_2026_01_15_06_45 
    WHERE name IN (
      'Krydsfiner 21mm (PAGED)',
      'Krydsfiner 35mm (PAGED)',
      'Krydsfiner 6.5mm (PAGED)',
      'Krydsfiner 9mm (PAGED)'
    )
  LOOP
    CASE 
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Krydsfiner 21mm (PAGED)') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, paged_id, 182.85, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Krydsfiner 35mm (PAGED)') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, paged_id, 305.02, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Krydsfiner 6.5mm (PAGED)') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, paged_id, 86.08, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Krydsfiner 9mm (PAGED)') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, paged_id, 144.00, 'DKK', CURRENT_DATE, NOW(), NOW());
    END CASE;
  END LOOP;

  -- Rubio Monocoat materialer
  FOR material_record IN 
    SELECT id FROM standard_materials_2026_01_15_06_45 
    WHERE name IN (
      'Oil Plus 2C Universal indendørs',
      'PreColour'
    )
  LOOP
    CASE 
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'Oil Plus 2C Universal indendørs') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, rubio_id, 12.95, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'PreColour') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, rubio_id, 19.42, 'DKK', CURRENT_DATE, NOW(), NOW());
    END CASE;
  END LOOP;

  -- SPRADLING materialer
  FOR material_record IN 
    SELECT id FROM standard_materials_2026_01_15_06_45 
    WHERE name IN (
      'SILVERTEX E-Sense Sapphire E122-3007 blå',
      'SILVERTEX E-Sense Rubin E122-6004 rødbrun'
    )
  LOOP
    CASE 
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'SILVERTEX E-Sense Sapphire E122-3007 blå') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, spradling_id, 109.00, 'DKK', CURRENT_DATE, NOW(), NOW());
      
      WHEN EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE id = material_record.id AND name = 'SILVERTEX E-Sense Rubin E122-6004 rødbrun') THEN
        INSERT INTO standard_material_price_snapshots_2026_01_15_06_45 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
        VALUES (material_record.id, spradling_id, 109.00, 'DKK', CURRENT_DATE, NOW(), NOW());
    END CASE;
  END LOOP;

END $$;