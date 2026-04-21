-- Opret prissnapshots for materialer med kendte priser
DO $$
DECLARE
  beslagsmanden_id UUID;
  paged_id UUID;
  rubio_id UUID;
  spradling_id UUID;
  material_id UUID;
BEGIN
  -- Hent leverandør ID'er
  SELECT id INTO beslagsmanden_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslagsmanden';
  SELECT id INTO paged_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'PAGED Plywood';
  SELECT id INTO rubio_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'Rubio Monocoat DK';
  SELECT id INTO spradling_id FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'SPRADLING';

  -- Beslagsmanden materialer
  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Gevindskrue M6 (DIN 7991) undersænket';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 0.65, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Häfele Aximat 300 SM hængsel';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 44.00, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Indslagsmøtrik forzinket stål';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 0.80, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Monteringsbøsning til iskruning';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 0.90, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Samleskrue M6 2-delt 30mm';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 3.00, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Skærmskive ISO 7093 varmgalv.';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 0.30, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Stillefod drejelig med plastfod';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 6.50, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Stillefod M12 til sokkel 200 kg';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, beslagsmanden_id, 46.00, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  -- PAGED Plywood materialer
  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 21mm (PAGED)';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, paged_id, 182.85, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 35mm (PAGED)';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, paged_id, 305.02, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 6.5mm (PAGED)';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, paged_id, 86.08, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 9mm (PAGED)';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, paged_id, 144.00, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  -- Rubio Monocoat materialer
  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'Oil Plus 2C Universal indendørs';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, rubio_id, 12.95, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'PreColour';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, rubio_id, 19.42, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  -- SPRADLING materialer
  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'SILVERTEX E-Sense Sapphire E122-3007 blå';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, spradling_id, 109.00, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

  SELECT id INTO material_id FROM standard_materials_2026_01_15_06_45 WHERE name = 'SILVERTEX E-Sense Rubin E122-6004 rødbrun';
  IF material_id IS NOT NULL THEN
    INSERT INTO standard_material_price_snapshots_2026_01_19_15_00 (material_id, supplier_id, price, currency, price_date, created_at, updated_at)
    VALUES (material_id, spradling_id, 109.00, 'DKK', CURRENT_DATE, NOW(), NOW());
  END IF;

END $$;