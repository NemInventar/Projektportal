-- Tilføj archived kolonne til project_quote_lines_2026_01_16_23_00 hvis den ikke eksisterer
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_quote_lines_2026_01_16_23_00' 
        AND column_name = 'archived'
    ) THEN
        ALTER TABLE project_quote_lines_2026_01_16_23_00 
        ADD COLUMN archived BOOLEAN DEFAULT FALSE;
        
        -- Opdater eksisterende rækker til at have archived = false
        UPDATE project_quote_lines_2026_01_16_23_00 
        SET archived = FALSE 
        WHERE archived IS NULL;
        
        -- Tilføj index for bedre performance
        CREATE INDEX IF NOT EXISTS idx_project_quote_lines_archived 
        ON project_quote_lines_2026_01_16_23_00(archived);
        
        RAISE NOTICE 'Added archived column to project_quote_lines_2026_01_16_23_00';
    ELSE
        RAISE NOTICE 'Column archived already exists in project_quote_lines_2026_01_16_23_00';
    END IF;
END $$;