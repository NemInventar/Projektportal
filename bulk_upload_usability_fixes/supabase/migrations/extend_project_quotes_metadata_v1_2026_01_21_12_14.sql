-- Udvid project_quotes_2026_01_16_23_00 med metadatafelter (V1)

-- Plan & arbejdskø felter
ALTER TABLE public.project_quotes_2026_01_16_23_00 
ADD COLUMN next_delivery_date date,
ADD COLUMN delivery_note text,
ADD COLUMN next_action text;

-- Ansvar & prioritet felter
ALTER TABLE public.project_quotes_2026_01_16_23_00 
ADD COLUMN owner_user_id uuid,
ADD COLUMN priority integer NOT NULL DEFAULT 2;

-- Send / version / lås felter
ALTER TABLE public.project_quotes_2026_01_16_23_00 
ADD COLUMN sent_at timestamptz,
ADD COLUMN version_no integer NOT NULL DEFAULT 1,
ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
ADD COLUMN locked_at timestamptz;

-- Tilføj CHECK constraints
ALTER TABLE public.project_quotes_2026_01_16_23_00 
ADD CONSTRAINT project_quotes_priority_check 
CHECK (priority >= 1 AND priority <= 3);

ALTER TABLE public.project_quotes_2026_01_16_23_00 
ADD CONSTRAINT project_quotes_version_no_check 
CHECK (version_no >= 1);

-- Kommentarer til felterne for dokumentation
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.next_delivery_date IS 'Næste leveringsdato for tilbuddet';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.delivery_note IS 'Noter om levering';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.next_action IS 'Næste handling der skal tages';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.owner_user_id IS 'UUID for ansvarlig bruger (ingen FK i V1)';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.priority IS 'Prioritet: 1=Høj, 2=Normal, 3=Lav';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.sent_at IS 'Tidspunkt for hvornår tilbuddet blev sendt';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.version_no IS 'Versionsnummer for tilbuddet';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.is_locked IS 'Om tilbuddet er låst for redigering';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.locked_at IS 'Tidspunkt for hvornår tilbuddet blev låst';