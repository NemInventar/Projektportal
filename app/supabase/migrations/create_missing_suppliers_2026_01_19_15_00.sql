-- Opret manglende leverandører
INSERT INTO standard_suppliers_2026_01_15_06_45 (name, contact_info, notes, created_at, updated_at)
VALUES 
  ('PAGED Plywood', '{"email": "", "phone": "", "address": ""}', 'Leverandør af krydsfiner produkter', NOW(), NOW()),
  ('Rubio Monocoat DK', '{"email": "", "phone": "", "address": ""}', 'Leverandør af træolier og overfladebehandling', NOW(), NOW()),
  ('SPRADLING', '{"email": "", "phone": "", "address": ""}', 'Leverandør af kunstlæder og tekstiler', NOW(), NOW()),
  ('Beslagsgrossisten.dk', '{"email": "", "phone": "", "address": ""}', 'Online leverandør af beslag og skruer', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;