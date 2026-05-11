-- Auto-håndtering af sendt tilbud (trigger)
-- Opretter trigger funktion og trigger for project_quotes_2026_01_16_23_00

-- Trigger funktion for auto-håndtering af sendt tilbud
CREATE OR REPLACE FUNCTION handle_quote_status_change_2026_01_21_12_25()
RETURNS TRIGGER AS $$
BEGIN
    -- Når status ændres til 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        -- Udfyld sent_at hvis den er NULL
        IF NEW.sent_at IS NULL THEN
            NEW.sent_at = NOW();
        END IF;
        
        -- Sæt is_locked = true
        NEW.is_locked = true;
        
        -- Udfyld locked_at hvis den er NULL
        IF NEW.locked_at IS NULL THEN
            NEW.locked_at = NOW();
        END IF;
    END IF;
    
    -- Ekstra logik: Hvis is_locked manuelt sættes fra true → false, så ryd locked_at
    IF OLD.is_locked = true AND NEW.is_locked = false THEN
        NEW.locked_at = NULL;
    END IF;
    
    -- Hvis is_locked sættes til true og locked_at er NULL, sæt locked_at
    IF NEW.is_locked = true AND NEW.locked_at IS NULL AND (OLD.is_locked IS NULL OR OLD.is_locked = false) THEN
        NEW.locked_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Opret BEFORE UPDATE trigger
DROP TRIGGER IF EXISTS trigger_quote_status_change_2026_01_21_12_25 ON public.project_quotes_2026_01_16_23_00;

CREATE TRIGGER trigger_quote_status_change_2026_01_21_12_25
    BEFORE UPDATE ON public.project_quotes_2026_01_16_23_00
    FOR EACH ROW
    EXECUTE FUNCTION handle_quote_status_change_2026_01_21_12_25();

-- Kommentar til trigger funktion
COMMENT ON FUNCTION handle_quote_status_change_2026_01_21_12_25() 
IS 'Auto-håndterer sendt tilbud: udfylder sent_at og låser tilbud når status = sent, håndterer manuel oplåsning';