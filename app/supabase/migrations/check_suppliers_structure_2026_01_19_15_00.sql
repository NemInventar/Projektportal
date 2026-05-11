-- Tjek struktur af standard_suppliers tabellen
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'standard_suppliers_2026_01_15_06_45'
ORDER BY ordinal_position;