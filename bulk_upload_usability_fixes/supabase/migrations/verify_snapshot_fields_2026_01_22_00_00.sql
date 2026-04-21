-- Verificer at snapshot-felter allerede eksisterer

-- Tjek snapshot felter
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_budget_line_items_2026_01_22_00_00'
AND column_name IN ('product_snapshot_updated_at', 'snapshot_cost_breakdown_json', 'snapshot_cost_total_per_unit')
ORDER BY column_name;

-- Tjek om der er index på project_product_id
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'project_budget_line_items_2026_01_22_00_00'
AND indexdef LIKE '%project_product_id%';