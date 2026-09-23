-- Fravalg af en fase på et niveau (fx ingen materialebestilling på Mørkhøj) — Milot 2026-09-23.
-- Rækken bevares med removed=true, så standard-seeding ikke genopretter fasen. Kan gendannes i UI.
-- Anvendt via Supabase MCP 2026-09-23.
ALTER TABLE tidsplan_faser ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;
