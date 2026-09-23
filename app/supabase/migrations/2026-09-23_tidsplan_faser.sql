-- Tidsplan (Gantt) i ERP'et — fanen /tidsplan.
-- Milots bestilling 2026-09-23: én tabel med fem faste faser pr. niveau
-- (Projekt → Tilbud → Produkt/tilbudslinje). Datoer redigeres i ERP'et.
--
-- Niveau udledes af hvilke FK'er der er sat:
--   project_id alene            = Projekt-laget
--   + quote_id                  = Tilbuds-laget (kun accepterede tilbud vises)
--   + quote_id + quote_line_id  = Produkt-laget (tilbudslinjer på tilbuddet)
--
-- Projektet forsvinder fra Gantt'en når phase sættes til 'Garanti' (filtreres i UI,
-- rækkerne her bliver stående — historik).

CREATE TABLE IF NOT EXISTS tidsplan_faser (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects_2026_01_15_06_45(id) ON DELETE CASCADE,
  quote_id       uuid REFERENCES project_quotes_2026_01_16_23_00(id) ON DELETE CASCADE,
  quote_line_id  uuid REFERENCES project_quote_lines_2026_01_16_23_00(id) ON DELETE CASCADE,
  fase           text NOT NULL CHECK (fase IN ('refinement','materialebestilling','produktion','transport','installation')),
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  status         text NOT NULL DEFAULT 'planlagt' CHECK (status IN ('planlagt','igang','faerdig')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text,
  CONSTRAINT tidsplan_faser_dates_chk CHECK (end_date >= start_date),
  -- En linje hører altid til et tilbud
  CONSTRAINT tidsplan_faser_line_needs_quote_chk CHECK (quote_line_id IS NULL OR quote_id IS NOT NULL)
);

-- Én række pr. fase pr. niveau. NULL'er er ikke lige i UNIQUE, så vi bruger COALESCE-indeks.
CREATE UNIQUE INDEX IF NOT EXISTS tidsplan_faser_niveau_fase_uidx
  ON tidsplan_faser (
    project_id,
    COALESCE(quote_id,      '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(quote_line_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fase
  );

CREATE INDEX IF NOT EXISTS tidsplan_faser_project_idx ON tidsplan_faser (project_id);

-- updated_at vedligeholdes af DB
CREATE OR REPLACE FUNCTION tidsplan_faser_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tidsplan_faser_touch ON tidsplan_faser;
CREATE TRIGGER trg_tidsplan_faser_touch
  BEFORE UPDATE ON tidsplan_faser
  FOR EACH ROW EXECUTE FUNCTION tidsplan_faser_touch();

-- RLS: samme mønster som project_quotes_* (require_auth)
ALTER TABLE tidsplan_faser ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS require_auth ON tidsplan_faser;
CREATE POLICY require_auth ON tidsplan_faser
  FOR ALL TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE tidsplan_faser IS
  'Gantt-faser (refinement, materialebestilling, produktion, transport, installation) pr. projekt / accepteret tilbud / tilbudslinje. Vises på /tidsplan i ERP''et. Kanon: domænet Tidsplan i canon_register.';
