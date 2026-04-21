-- Opret manglende leverandører
INSERT INTO standard_suppliers_2026_01_15_06_45 (name, email, phone, address, notes, created_at, updated_at)
VALUES 
  ('PAGED Plywood', '', '', '', 'Leverandør af krydsfiner produkter', NOW(), NOW()),
  ('Rubio Monocoat DK', '', '', '', 'Leverandør af træolier og overfladebehandling', NOW(), NOW()),
  ('SPRADLING', '', '', '', 'Leverandør af kunstlæder og tekstiler', NOW(), NOW()),
  ('Beslagsgrossisten.dk', '', '', '', 'Online leverandør af beslag og skruer', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;