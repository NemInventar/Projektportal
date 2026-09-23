-- Målsætninger (milepæle) i Gantt'en på /tidsplan — Milot 2026-09-23.
-- Pr. projekt / accepteret tilbud / tilbudslinje, med måldato og afkrydsning (done).
-- Anvendt via Supabase MCP 2026-09-23.

CREATE TABLE IF NOT EXISTS tidsplan_maal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects_2026_01_15_06_45(id) ON DELETE CASCADE,
  quote_id       uuid REFERENCES project_quotes_2026_01_16_23_00(id) ON DELETE CASCADE,
  quote_line_id  uuid REFERENCES project_quote_lines_2026_01_16_23_00(id) ON DELETE CASCADE,
  title          text NOT NULL CHECK (length(trim(title)) > 0),
  target_date    date NOT NULL,
  done           boolean NOT NULL DEFAULT false,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     text,
  updated_by     text,
  CONSTRAINT tidsplan_maal_line_needs_quote_chk CHECK (quote_line_id IS NULL OR quote_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS tidsplan_maal_project_idx ON tidsplan_maal (project_id);

DROP TRIGGER IF EXISTS trg_tidsplan_maal_touch ON tidsplan_maal;
CREATE TRIGGER trg_tidsplan_maal_touch BEFORE UPDATE ON tidsplan_maal
  FOR EACH ROW EXECUTE FUNCTION tidsplan_faser_touch();

ALTER TABLE tidsplan_maal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS require_auth ON tidsplan_maal;
CREATE POLICY require_auth ON tidsplan_maal FOR ALL TO public
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
