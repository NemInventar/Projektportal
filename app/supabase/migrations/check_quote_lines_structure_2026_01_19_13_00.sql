-- Tjek struktur af project_quote_lines tabellen
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'project_quote_lines_2026_01_16_23_00'
ORDER BY ordinal_position;