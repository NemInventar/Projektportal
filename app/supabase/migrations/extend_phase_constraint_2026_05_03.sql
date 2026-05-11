-- Udvider phase-constraint med flere stadier til projekt-pipeline.
-- Eksisterende: Tilbud, Produktion, Garanti, Tabt, Arkiv
-- Tilføjer: 'Afventer opstart', 'Sendt', 'Kontrakt og planlægning', 'Fravalgt'

ALTER TABLE public.projects_2026_01_15_06_45
DROP CONSTRAINT IF EXISTS projects_2026_01_15_06_45_phase_check;

ALTER TABLE public.projects_2026_01_15_06_45
ADD CONSTRAINT projects_2026_01_15_06_45_phase_check
CHECK (phase IN (
  'Afventer opstart',
  'Tilbud',
  'Sendt',
  'Kontrakt og planlægning',
  'Produktion',
  'Garanti',
  'Tabt',
  'Fravalgt',
  'Arkiv'
));
