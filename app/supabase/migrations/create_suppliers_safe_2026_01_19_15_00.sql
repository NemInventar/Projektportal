-- Opret manglende leverandører (kun hvis de ikke allerede eksisterer)
DO $$
BEGIN
  -- PAGED Plywood
  IF NOT EXISTS (SELECT 1 FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'PAGED Plywood') THEN
    INSERT INTO standard_suppliers_2026_01_15_06_45 (name, email, phone, address, notes, created_at, updated_at)
    VALUES ('PAGED Plywood', '', '', '', 'Leverandør af krydsfiner produkter', NOW(), NOW());
  END IF;
  
  -- Rubio Monocoat DK
  IF NOT EXISTS (SELECT 1 FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'Rubio Monocoat DK') THEN
    INSERT INTO standard_suppliers_2026_01_15_06_45 (name, email, phone, address, notes, created_at, updated_at)
    VALUES ('Rubio Monocoat DK', '', '', '', 'Leverandør af træolier og overfladebehandling', NOW(), NOW());
  END IF;
  
  -- SPRADLING
  IF NOT EXISTS (SELECT 1 FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'SPRADLING') THEN
    INSERT INTO standard_suppliers_2026_01_15_06_45 (name, email, phone, address, notes, created_at, updated_at)
    VALUES ('SPRADLING', '', '', '', 'Leverandør af kunstlæder og tekstiler', NOW(), NOW());
  END IF;
  
  -- Beslagsgrossisten.dk
  IF NOT EXISTS (SELECT 1 FROM standard_suppliers_2026_01_15_06_45 WHERE name = 'Beslagsgrossisten.dk') THEN
    INSERT INTO standard_suppliers_2026_01_15_06_45 (name, email, phone, address, notes, created_at, updated_at)
    VALUES ('Beslagsgrossisten.dk', '', '', '', 'Online leverandør af beslag og skruer', NOW(), NOW());
  END IF;
END $$;