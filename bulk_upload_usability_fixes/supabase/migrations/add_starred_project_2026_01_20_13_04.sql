-- Add is_starred column to projects table
ALTER TABLE public.projects_2026_01_15_06_45 
ADD COLUMN is_starred boolean NOT NULL DEFAULT false;

-- Create unique partial index to ensure only one project can be starred at a time
CREATE UNIQUE INDEX idx_projects_unique_starred_2026_01_20_13_04 
ON public.projects_2026_01_15_06_45 (is_starred) 
WHERE is_starred = true;

-- Add comment to explain the constraint
COMMENT ON INDEX idx_projects_unique_starred_2026_01_20_13_04 IS 'Ensures only one project can be starred (is_starred=true) at a time';