-- First, update any invalid phase values to valid ones
-- Update any phases that are not in the allowed list
UPDATE public.projects_2026_01_15_06_45 
SET phase = 'Arkiv' 
WHERE phase NOT IN ('Tilbud', 'Produktion', 'Garanti', 'Tabt', 'Arkiv');

-- Drop the existing constraint
ALTER TABLE public.projects_2026_01_15_06_45 
DROP CONSTRAINT IF EXISTS projects_2026_01_15_06_45_phase_check;

-- Add new constraint with all valid phases including 'Tabt'
ALTER TABLE public.projects_2026_01_15_06_45 
ADD CONSTRAINT projects_2026_01_15_06_45_phase_check 
CHECK (phase IN ('Tilbud', 'Produktion', 'Garanti', 'Tabt', 'Arkiv'));