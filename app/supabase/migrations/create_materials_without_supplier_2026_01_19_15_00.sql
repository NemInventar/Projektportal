-- Opret standard materialer
DO $$
BEGIN
  -- Beslag & Skruer materialer
  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Gevindskrue M6 (DIN 7991) undersænket') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Gevindskrue M6 (DIN 7991) undersænket', 'Beslag & Skruer', 'stk', 'Undersænket unbrakoskrue iht. DIN 7991', 0.65, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Häfele Aximat 300 SM hængsel') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Häfele Aximat 300 SM hængsel', 'Beslag & Skruer', 'stk', 'Påskruningshængsel – udenpåliggende', 44.00, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Indslagsmøtrik forzinket stål') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Indslagsmøtrik forzinket stål', 'Beslag & Skruer', 'stk', 'Indslagsmøtrik til islåning i møbler – forzinket stål', 0.80, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Monteringsbøsning til iskruning') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Monteringsbøsning til iskruning', 'Beslag & Skruer', 'stk', 'Monteringsbøsning til skrueforbindelse', 0.90, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Samleskrue M6 2-delt 30mm') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Samleskrue M6 2-delt 30mm', 'Beslag & Skruer', 'stk', '2-delt samleskrue M6 – 30 mm hus', 3.00, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Skærmskive ISO 7093 varmgalv.') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Skærmskive ISO 7093 varmgalv.', 'Beslag & Skruer', 'stk', 'Skærmskive M6/M8/M10/M12 – varmgalvaniseret', 0.30, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Stillefod drejelig med plastfod') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Stillefod drejelig med plastfod', 'Beslag & Skruer', 'stk', 'Justerbar stillefod med drejelig tallerkenfod', 6.50, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Stillefod M12 til sokkel 200 kg') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Stillefod M12 til sokkel 200 kg', 'Beslag & Skruer', 'stk', 'Justerbar stillefod M12 – bæreevne op til 200 kg', 46.00, 'DKK', NOW(), NOW());
  END IF;

  -- Pladematerialer
  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 21mm (PAGED)') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Krydsfiner 21mm (PAGED)', 'Plademateriale', 'm²', 'Krydsfiner 21 mm fra PAGED Plywood', 182.85, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 35mm (PAGED)') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Krydsfiner 35mm (PAGED)', 'Plademateriale', 'm²', 'Krydsfiner 35 mm fra PAGED Plywood', 305.02, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 6.5mm (PAGED)') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Krydsfiner 6.5mm (PAGED)', 'Plademateriale', 'm²', 'Krydsfiner 6.5 mm fra PAGED Plywood', 86.08, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Krydsfiner 9mm (PAGED)') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Krydsfiner 9mm (PAGED)', 'Plademateriale', 'm²', 'Krydsfiner 9 mm fra PAGED Plywood', 144.00, 'DKK', NOW(), NOW());
  END IF;

  -- Overfladebehandling
  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'Oil Plus 2C Universal indendørs') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('Oil Plus 2C Universal indendørs', 'Overfladebehandling', 'm²', 'Træolie inkl. accelerator – dækker ca. 40 m² pr. 5 L', 12.95, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'PreColour') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('PreColour', 'Overfladebehandling', 'm²', 'Vandbaseret bejdse – ca. 12 m² pr. liter', 19.42, 'DKK', NOW(), NOW());
  END IF;

  -- Tekstiler
  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'SILVERTEX E-Sense Sapphire E122-3007 blå') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('SILVERTEX E-Sense Sapphire E122-3007 blå', 'Tekstil', 'm', 'Kunstlæder – bredde 137 cm, rulle ca. 30 m', 109.00, 'DKK', NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM standard_materials_2026_01_15_06_45 WHERE name = 'SILVERTEX E-Sense Rubin E122-6004 rødbrun') THEN
    INSERT INTO standard_materials_2026_01_15_06_45 (name, category, unit, description, unit_price, currency, created_at, updated_at)
    VALUES ('SILVERTEX E-Sense Rubin E122-6004 rødbrun', 'Tekstil', 'm', 'Kunstlæder – bredde 137 cm, rulle ca. 30 m', 109.00, 'DKK', NOW(), NOW());
  END IF;

END $$;