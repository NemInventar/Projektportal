# Leads / CRM-modul – V1 Plan (Pipedrive-afløser i ERP'en)

_Udarbejdet 2026-04-23. Revideret 2026-04-23 for at bygge oven på eksisterende `crm_*`-tabeller._

> **Vigtigt ved start af implementering:** Der findes allerede tre CRM-tabeller med rigtige data:
> - `crm_contacts_2026_04_12` (8 rækker) – unified contacts for både virksomheder (`contact_type='company'`) og personer (`contact_type='person'`).
> - `crm_deals_2026_04_12` (5 rækker) – leads/deals med Byggefakta-felter, Pipedrive-sync, AI-context.
> - `crm_activities_2026_04_12` (0 rækker) – aktiviteter, med `due_date`+`due_time` som separate felter.
>
> **Denne plan opretter IKKE parallelle `leads_…` / `organizations_…` / `contacts_…`-tabeller.** Den bygger oven på de eksisterende via `ALTER TABLE`, og tilføjer kun tre nye hjælpe-tabeller (noter, labels, label-junction).
>
> Projekt-tabellen er fortsat `projects_2026_01_15_06_45`. Nye hjælpe-tabeller bruger suffix **`_2026_04_24_10_00`**.

Denne plan afløser Pipedrive's "Leads Inbox" for Milot (Kosovo). Fokus: cold-call workflow, notater, aktiviteter, og konvertering lead→projekt uden datatab.

---

## 0. Navngivnings-konvention og eksisterende tabeller

### 0.1 Eksisterende tabeller (BEVAR – indeholder rigtige data)
- `crm_contacts_2026_04_12` – unified personer + virksomheder
- `crm_deals_2026_04_12` – leads/deals
- `crm_activities_2026_04_12` – aktiviteter
- `projects_2026_01_15_06_45` – projekter

### 0.2 Nye tabeller (suffix `_2026_04_24_10_00`)
- `crm_deal_notes_2026_04_24_10_00` – noter pr. deal (tidslinje)
- `crm_labels_2026_04_24_10_00` – labels med farve
- `crm_deal_labels_2026_04_24_10_00` – junction deal ↔ label
- Storage bucket: `lead-attachments-2026-04-24`

### 0.3 Field-mapping — Pipedrive-sprog → eksisterende DB-felter

Planens tekst bruger Pipedrive-/UI-sprog. I kode og SQL bruges de eksisterende kolonne-navne. Denne tabel er bindeleddet.

| Plan-/UI-term              | Tabel                         | Faktisk kolonne               | Noter |
|----------------------------|-------------------------------|-------------------------------|-------|
| Lead                       | `crm_deals_2026_04_12`        | (hele rækken)                 | "Deal" og "Lead" er samme ting her |
| Organisation               | `crm_contacts_2026_04_12`     | række med `contact_type='company'` | Filtrér altid på `contact_type` |
| Kontaktperson              | `crm_contacts_2026_04_12`     | række med `contact_type='person'`  | |
| status (open/qualified/…)  | `crm_deals_2026_04_12`        | `pipeline_stage`              | Tilladte værdier: `'lead'`, `'qualified'`, `'converted'`, `'lost'`, `'archived'` |
| owner                      | `crm_deals_2026_04_12`        | `assigned_to`                 | Skift fra navne til emails: `'js@neminventar.dk'`, `'milot@neminventar.dk'`, `'foss@neminventar.dk'` |
| value                      | `crm_deals_2026_04_12`        | `value_dkk`                   | |
| expected_close_date        | `crm_deals_2026_04_12`        | `expected_close_date`         | Allerede eksisterende |
| kommune                    | `crm_deals_2026_04_12`        | `municipality`                | |
| region                     | `crm_deals_2026_04_12`        | `region`                      | |
| stadie                     | `crm_deals_2026_04_12`        | `stage`                       | NB: forveksles nemt med `pipeline_stage` – `stage` er byggefase (Projektering/Udbud), `pipeline_stage` er salgs-status |
| entrepriseform             | `crm_deals_2026_04_12`        | `contract_form`               | |
| source                     | `crm_deals_2026_04_12`        | fra `crm_contacts.source` eller nyt felt `source_channel` (se §2.1) | |
| tags                       | `crm_deals_2026_04_12`        | `tags text[]`                 | Beholdes – labels-systemet lever side om side |
| last_activity_at           | `crm_deals_2026_04_12`        | `last_activity_at`            | Allerede eksisterende |
| subject (aktivitet)        | `crm_activities_2026_04_12`   | `title`                       | |
| completed                  | `crm_activities_2026_04_12`   | `done`                        | |
| completed_at               | `crm_activities_2026_04_12`   | `done_at`                     | |
| due_at                     | `crm_activities_2026_04_12`   | kombineret `due_date + due_time` | Se §2.1 for computed kolonne |
| created_by (aktivitet)     | `crm_activities_2026_04_12`   | `logged_via`                  | Værdier: `'manual'`, `'claude_auto'`, `'import'`, `'email_sync'` |
| owner_email (aktivitet)    | `crm_activities_2026_04_12`   | `assigned_to`                 | |
| organization (på deal)     | `crm_deals_2026_04_12`        | `contact_id` → `crm_contacts` hvor `contact_type='company'` | Én primær org pr. deal |
| kontaktperson (på deal)    | `crm_deals_2026_04_12`        | `primary_contact` (tekst) + `primary_contact_phone` | V1: behold tekstfelter. V2: introducér `primary_contact_id uuid` FK til `crm_contacts`. |
| project-link               | `crm_deals_2026_04_12`        | `project_id` (allerede der) + nyt `converted_project_id` (se §2.1) | `project_id` er allerede FK – bruges under konvertering |

---

## 1. Datamodel – overblik

```
crm_contacts_2026_04_12                       (unified: contact_type = 'company' | 'person')
  ├─ crm_deals_2026_04_12                     (leads/deals; contact_id → org)
  │    ├─ crm_activities_2026_04_12           (aktiviteter; deal_id FK)
  │    ├─ crm_deal_notes_2026_04_24_10_00     (NY – fri-tekst tidslinje)
  │    └─ crm_deal_labels_2026_04_24_10_00    (NY – junction → labels)
  │
  └─ (personer kan også være primær kontakt på deal via tekst-felt primary_contact)

crm_labels_2026_04_24_10_00                   (NY – genanvendelige tags m. farve)

crm_deals.converted_project_id ──────→ projects_2026_01_15_06_45
```

**Kardinalitet:**
- Organization : Person = 1:n (via `crm_contacts` – personer får `company`-felt eller V2 FK).
- Deal : Organization = n:1 (via `crm_deals.contact_id`).
- Deal : primær person = n:1 (V1: via `primary_contact` tekstfelt; V2: FK-kolonne).
- Deal : Activity = 1:n.
- Deal : Note = 1:n.
- Deal : Label = n:m (via junction).
- Deal : Project = 1:0..1 (`converted_project_id` UNIQUE).

---

## 2. Migration-SQL

### 2.1 ALTER TABLE — tilføj manglende kolonner på eksisterende tabeller

Fil: `alter_crm_for_leads_2026_04_24_10_00.sql`

```sql
-- =====================================================================
-- NemInventar ERP – Leads-modul: udvid eksisterende crm_*-tabeller
-- 2026-04-24 10:00
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) crm_deals_2026_04_12 – tilføj manglende kolonner
-- ---------------------------------------------------------------------

-- Domænespecifikt: dato for hvornår tegninger er lovet (milepæl)
ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS tegninger_aftalt_date date;

-- Konverterings-link til rigtigt projekt (adskilt fra `project_id` som bruges løbende)
ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS converted_project_id uuid UNIQUE
        REFERENCES public.projects_2026_01_15_06_45(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS converted_at timestamptz;

ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS converted_by text;

-- Hvem/hvad oprettede deal'et (human vs. automation vs. import)
ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'human'
        CHECK (created_by IN ('human','claude_auto','import'));

-- Source-kanal (fri tekst, fx 'Byggefakta RSS', 'Reference Anders')
ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS source_channel text;

-- Eksternt projektnummer (Byggefakta-id mv. – bemærk der findes allerede byggefakta_id)
ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS project_number_ext text;

-- Leveringsadresse (ofte forskellig fra deal-adressen)
ALTER TABLE public.crm_deals_2026_04_12
    ADD COLUMN IF NOT EXISTS delivery_address text;

-- Konstrain pipeline_stage til de salgs-statusser vi bruger
-- NB: eksisterende data har DEFAULT 'lead'; hvis rækker har andre værdier skal de normaliseres først.
-- Kør først: SELECT DISTINCT pipeline_stage FROM crm_deals_2026_04_12;
ALTER TABLE public.crm_deals_2026_04_12
    DROP CONSTRAINT IF EXISTS crm_deals_pipeline_stage_check;
ALTER TABLE public.crm_deals_2026_04_12
    ADD CONSTRAINT crm_deals_pipeline_stage_check
    CHECK (pipeline_stage IN ('lead','qualified','converted','lost','archived'));

-- Indexer for nye filter-mønstre
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline_stage_2026_04_24_10_00
    ON public.crm_deals_2026_04_12(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_assigned_to_2026_04_24_10_00
    ON public.crm_deals_2026_04_12(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_deals_tegninger_2026_04_24_10_00
    ON public.crm_deals_2026_04_12(tegninger_aftalt_date)
    WHERE tegninger_aftalt_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_deals_converted_2026_04_24_10_00
    ON public.crm_deals_2026_04_12(converted_project_id)
    WHERE converted_project_id IS NOT NULL;

-- Normaliser assigned_to til emails (engangs-migration)
UPDATE public.crm_deals_2026_04_12 SET assigned_to = 'js@neminventar.dk'      WHERE lower(assigned_to) IN ('joachim','js');
UPDATE public.crm_deals_2026_04_12 SET assigned_to = 'milot@neminventar.dk'   WHERE lower(assigned_to) IN ('milot');
UPDATE public.crm_deals_2026_04_12 SET assigned_to = 'foss@neminventar.dk'    WHERE lower(assigned_to) IN ('foss','christian','christian foss');

-- ---------------------------------------------------------------------
-- 2) crm_activities_2026_04_12 – tilføj manglende kolonner
-- ---------------------------------------------------------------------

-- Resultat af udført aktivitet (fx "fik ikke fat", "aftalte møde")
ALTER TABLE public.crm_activities_2026_04_12
    ADD COLUMN IF NOT EXISTS completed_outcome text;

-- Computed kolonne: kombinér due_date + due_time til én timestamptz
-- Bemærk: GENERATED STORED kræver IMMUTABLE – vi bruger derfor en plain kolonne + trigger,
-- ELLER en VIEW (se §5.1). V1-valg: view. Hvis du foretrækker kolonne, brug trigger-mønster.
-- (Hvis du vil have kolonnen alligevel, kan du lave den ikke-generated og vedligeholde i kode.)

-- Normaliser logged_via-værdier
UPDATE public.crm_activities_2026_04_12 SET logged_via = 'manual'
    WHERE logged_via IS NULL OR logged_via = '';

-- Tillad kun kendte værdier fremover
ALTER TABLE public.crm_activities_2026_04_12
    DROP CONSTRAINT IF EXISTS crm_activities_logged_via_check;
ALTER TABLE public.crm_activities_2026_04_12
    ADD CONSTRAINT crm_activities_logged_via_check
    CHECK (logged_via IN ('manual','claude_auto','import','email_sync'));

-- Indexer for focus-query (åbne aktiviteter sorteret på due_date/due_time)
CREATE INDEX IF NOT EXISTS idx_crm_activities_open_due_2026_04_24_10_00
    ON public.crm_activities_2026_04_12(due_date, due_time)
    WHERE done = false;
CREATE INDEX IF NOT EXISTS idx_crm_activities_assigned_open_2026_04_24_10_00
    ON public.crm_activities_2026_04_12(assigned_to, due_date)
    WHERE done = false;

-- Normaliser assigned_to til emails (engangs)
UPDATE public.crm_activities_2026_04_12 SET assigned_to = 'js@neminventar.dk'    WHERE lower(assigned_to) IN ('joachim','js');
UPDATE public.crm_activities_2026_04_12 SET assigned_to = 'milot@neminventar.dk' WHERE lower(assigned_to) IN ('milot');
UPDATE public.crm_activities_2026_04_12 SET assigned_to = 'foss@neminventar.dk'  WHERE lower(assigned_to) IN ('foss');

-- ---------------------------------------------------------------------
-- 3) crm_contacts_2026_04_12 – sikre index på contact_type for split-lookups
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crm_contacts_type_2026_04_24_10_00
    ON public.crm_contacts_2026_04_12(contact_type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_name_lower_2026_04_24_10_00
    ON public.crm_contacts_2026_04_12(lower(name));

COMMIT;
```

### 2.2 CREATE TABLE — kun tre nye hjælpe-tabeller

Fil: `create_deal_notes_labels_2026_04_24_10_00.sql`

```sql
BEGIN;

-- ---------------------------------------------------------------------
-- crm_deal_notes – fri-tekst tidslinje pr. deal (ingen ækvivalent i dag)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_deal_notes_2026_04_24_10_00 (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id       uuid NOT NULL
                    REFERENCES public.crm_deals_2026_04_12(id) ON DELETE CASCADE,
    body          text NOT NULL,
    pinned        boolean NOT NULL DEFAULT false,
    author_email  text NOT NULL DEFAULT 'js@neminventar.dk',
    created_by    text NOT NULL DEFAULT 'human'
                    CHECK (created_by IN ('human','claude_auto')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_notes_deal_created_2026_04_24_10_00
    ON public.crm_deal_notes_2026_04_24_10_00(deal_id, created_at DESC);
CREATE INDEX idx_deal_notes_pinned_2026_04_24_10_00
    ON public.crm_deal_notes_2026_04_24_10_00(deal_id) WHERE pinned = true;

-- ---------------------------------------------------------------------
-- crm_labels – genanvendelige labels med farve
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_labels_2026_04_24_10_00 (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    color       text NOT NULL DEFAULT '#6b7280'
                    CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- crm_deal_labels – junction deal ↔ label
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_deal_labels_2026_04_24_10_00 (
    deal_id   uuid NOT NULL
                REFERENCES public.crm_deals_2026_04_12(id) ON DELETE CASCADE,
    label_id  uuid NOT NULL
                REFERENCES public.crm_labels_2026_04_24_10_00(id) ON DELETE CASCADE,
    PRIMARY KEY (deal_id, label_id)
);

CREATE INDEX idx_deal_labels_label_2026_04_24_10_00
    ON public.crm_deal_labels_2026_04_24_10_00(label_id);

-- ---------------------------------------------------------------------
-- updated_at-trigger for notes
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_deal_notes_updated_at
    BEFORE UPDATE ON public.crm_deal_notes_2026_04_24_10_00
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS – samme mønster som eksisterende tabeller
-- ---------------------------------------------------------------------
ALTER TABLE public.crm_deal_notes_2026_04_24_10_00   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_labels_2026_04_24_10_00       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_labels_2026_04_24_10_00  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_crm_deal_notes" ON public.crm_deal_notes_2026_04_24_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_crm_labels" ON public.crm_labels_2026_04_24_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_crm_deal_labels" ON public.crm_deal_labels_2026_04_24_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMIT;
```

### 2.3 Storage bucket

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-attachments-2026-04-24',
  'lead-attachments-2026-04-24',
  false,
  52428800,
  ARRAY['application/pdf','image/png','image/jpeg','text/csv','application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_read_lead_files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lead-attachments-2026-04-24' AND auth.role() = 'authenticated');

CREATE POLICY "auth_write_lead_files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lead-attachments-2026-04-24' AND auth.role() = 'authenticated');

CREATE POLICY "auth_update_lead_files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lead-attachments-2026-04-24' AND auth.role() = 'authenticated');
```

### 2.4 Seed – initial labels

```sql
BEGIN;

INSERT INTO public.crm_labels_2026_04_24_10_00 (name, color) VALUES
  ('Hot',        '#ef4444'),
  ('Varm',       '#f59e0b'),
  ('Kold',       '#3b82f6'),
  ('Udbud',      '#8b5cf6'),
  ('Reference',  '#10b981'),
  ('Offentlig',  '#6366f1')
ON CONFLICT (name) DO NOTHING;

COMMIT;
```

`assigned_to` (owner) er fri tekst i DB. Efter migration fra §2.1 bruges email-værdier: `js@neminventar.dk`, `milot@neminventar.dk`, `foss@neminventar.dk`. Valideres kun i UI (dropdown).

---

## 3. Konvertering og integration med `projects_2026_01_15_06_45`

### 3.1 Valg: **separat deals-tabel med FK til projects** (ikke "projects-med-is_lead-flag")

Vi har allerede adskillelsen: `crm_deals_2026_04_12` er leads, `projects_2026_01_15_06_45` er projekter. Argumentet står:

- Projekter kræver `project_number UNIQUE NOT NULL`. Leads har ofte intet projektnummer endnu.
- Projekt-tabellen har 20+ kolonner målrettet tilbud/produktion. Irrelevant støj i lead-fasen.
- Leads har egen livscyklus (`pipeline_stage`) der ikke passer ind i `phase`-enum.
- Pipedrive-import med 100+ rækker skal kunne oprette deals uden at tilfredsstille `project_number UNIQUE`.
- Når et lead er kvalificeret, oprettes et rigtigt projekt og linket bevares via `converted_project_id`.

### 3.2 Konvertering — lead → projekt (W3)

Når bruger trykker "Konvertér til projekt":

```sql
BEGIN;

-- 1) Opret projekt med snapshot fra deal
WITH src AS (
    SELECT d.*,
           org.name  AS org_name,
           org.email AS org_email,
           org.phone AS org_phone
    FROM public.crm_deals_2026_04_12 d
    LEFT JOIN public.crm_contacts_2026_04_12 org
           ON org.id = d.contact_id AND org.contact_type = 'company'
    WHERE d.id = :deal_id
)
INSERT INTO public.projects_2026_01_15_06_45 (
    name, customer, project_number, phase,
    description,
    client, contractor,
    customer_contact, customer_email, customer_phone,
    delivery_address, source
)
SELECT
    s.title,
    COALESCE(s.org_name, 'Ukendt kunde'),
    :new_project_number,               -- kræves fra bruger (UNIQUE)
    'Tilbud',
    COALESCE(s.full_description, s.short_description, s.description),
    s.org_name,                        -- bygherre (V1: samme som customer; V2: splitte via org_type)
    s.main_contractor,
    s.primary_contact,
    s.org_email,
    COALESCE(s.primary_contact_phone, s.org_phone),
    COALESCE(s.delivery_address, s.address),
    s.source_channel
FROM src s
RETURNING id;

-- 2) Opdatér deal med reference
UPDATE public.crm_deals_2026_04_12
SET pipeline_stage       = 'converted',
    converted_project_id = :new_project_id,
    converted_at         = now(),
    converted_by         = :user_email,
    won_at               = now(),
    updated_at           = now()
WHERE id = :deal_id;

COMMIT;
```

### 3.3 Må projekter starte uden lead?

**Ja.** `converted_project_id` er nullable og UNIQUE. Eksisterende projekter og direkte-oprettede projekter er uberørte.

### 3.4 Skal eksisterende kolonner på `projects` udgå?

**Nej.** V1 lader projekt-skemaet være uændret. Vi **kopierer** snapshot ved konvertering – i linje med total-mode/snapshot-filosofien fra CLAUDE.md.

### 3.5 Datatab-beskyttelse

- Konverterings-SQL i én transaktion.
- Deal'et slettes **aldrig** – markeres `pipeline_stage='converted'` + bevares som revisionsspor. Notes/activities forbliver intakt.
- `converted_project_id UNIQUE` forhindrer dobbelt-konvertering.
- `ON DELETE SET NULL`: hvis projektet slettes bliver deal'et "hjemløs" men overlever; `pipeline_stage` forbliver `converted`.

---

## 4. UI-sider & Routes

### 4.1 Routes (React Router, hash routing)

```
#/leads                           → LeadsInbox (NY)
#/leads/new                       → LeadCreateDialog (modal-only, uden egen route)
#/leads/:dealId                   → LeadDetail (NY)
#/leads/import                    → LeadsImport (NY)              V2
#/contacts                        → ContactsList (V2)
#/contacts/:contactId             → ContactDetail (V2)
#/organizations                   → OrganizationsList (V2 — view af crm_contacts WHERE contact_type='company')
```

URL-param hedder `:dealId` så det matcher DB. Sidebar: nyt menupunkt "Leads" over "Projekter". Badge med antal overdue aktiviteter for mine deals.

### 4.2 Komponenttræ i `src/features/leads/`

Følger mønster fra `src/features/purchasing/`:

```
src/features/leads/
├── index.ts
├── LeadsContext.tsx
├── types.ts                          -- TS-typer + tabel-konstanter
├── constants.ts                      -- TABLE-navne, CONTACT_TYPE, OWNER_EMAILS, PIPELINE_STAGES
├── hooks/
│   ├── useLeads.ts                   -- liste (crm_deals), filter, søg
│   ├── useLead.ts                    -- én deal m. activities + notes + org + labels
│   ├── useLeadFocus.ts               -- "næste forfalden aktivitet"
│   └── useLabels.ts                  -- crm_labels CRUD
├── pages/
│   ├── LeadsInbox.tsx
│   ├── LeadDetail.tsx
│   └── LeadsImport.tsx               -- V2
├── components/
│   ├── LeadsTable.tsx
│   ├── LeadFiltersBar.tsx
│   ├── LeadDetailHeader.tsx
│   ├── LeadPersonCard.tsx
│   ├── LeadOrganizationCard.tsx
│   ├── LeadFocusCard.tsx
│   ├── LeadTimeline.tsx
│   ├── LeadNoteItem.tsx
│   ├── LeadActivityItem.tsx
│   ├── LeadNoteInput.tsx
│   ├── LeadActivityDialog.tsx
│   ├── OrganizationPickerDialog.tsx  -- søg i crm_contacts WHERE contact_type='company'
│   ├── ContactPickerDialog.tsx       -- søg i crm_contacts WHERE contact_type='person'
│   ├── LabelPickerPopover.tsx
│   ├── ConvertLeadDialog.tsx         -- W3
│   └── MarkLeadLostDialog.tsx        -- W4
└── lib/
    ├── dealsApi.ts                   -- CRUD på crm_deals_2026_04_12
    ├── activitiesApi.ts              -- CRUD på crm_activities_2026_04_12
    ├── notesApi.ts                   -- CRUD på crm_deal_notes_2026_04_24_10_00
    ├── contactsApi.ts                -- CRUD på crm_contacts_2026_04_12 (split på contact_type)
    ├── labelsApi.ts                  -- CRUD på crm_labels + junction
    ├── convertApi.ts                 -- deal → projekt (én transaktion)
    └── focus.ts                      -- afled focus fra åbne activities
```

#### Eksempel: `constants.ts`

```ts
export const TABLE = {
  DEALS:        'crm_deals_2026_04_12',
  CONTACTS:     'crm_contacts_2026_04_12',
  ACTIVITIES:   'crm_activities_2026_04_12',
  DEAL_NOTES:   'crm_deal_notes_2026_04_24_10_00',
  LABELS:       'crm_labels_2026_04_24_10_00',
  DEAL_LABELS:  'crm_deal_labels_2026_04_24_10_00',
  PROJECTS:     'projects_2026_01_15_06_45',
} as const;

export const CONTACT_TYPE = {
  COMPANY: 'company',
  PERSON:  'person',
} as const;

export const PIPELINE_STAGE = {
  LEAD:      'lead',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  LOST:      'lost',
  ARCHIVED:  'archived',
} as const;

export const OWNER_EMAILS = [
  'js@neminventar.dk',
  'milot@neminventar.dk',
  'foss@neminventar.dk',
] as const;
```

#### Eksempel: `dealsApi.ts` — liste-forespørgsel

```ts
// Henter deals med joined org + labels + åbne activities-count
const { data } = await supabase
  .from(TABLE.DEALS)
  .select(`
    id, title, pipeline_stage, assigned_to, value_dkk, currency,
    expected_close_date, tegninger_aftalt_date, municipality, region,
    stage, contract_form, source_channel, last_activity_at, created_at,
    archived, converted_project_id,
    organization:contact_id (id, name, city, contact_type),
    labels:crm_deal_labels_2026_04_24_10_00 (
      label:crm_labels_2026_04_24_10_00 (id, name, color)
    )
  `)
  .eq('archived', false)
  .order('created_at', { ascending: false });
```

### 4.3 Side-layouts

**LeadsInbox.tsx (`/leads`)**

Topbar: titel "Leads inbox" + count; knapper "Ny lead" / "Importér CSV" (V2) / "Columns" (V2).

Filter-bar:
- Søgefelt (matcher `title` + joined org `name` + `primary_contact`).
- Chip: Status (`pipeline_stage`) — multi-select (`open/qualified/converted/lost/archived` hvor "open" = `lead`).
- Chip: Owner (`assigned_to`) — mig / alle / specifik email.
- Chip: Label (AND-logik via junction).
- Chip: "Kun med forfaldne aktiviteter".
- Chip: "Uden aktivitet".

Hovedtabel:
| Checkbox | Organisation | Titel | Kontaktperson | Tegninger aftalt | Næste aktivitet | Oprettet | Aktiviteter | Labels |

- Default-sortering: `created_at DESC`.
- "Næste aktivitet" afledes fra view i §5.1.
- Labels-celle: farve-chips (max 3, "+N" hvis flere).
- Bulk-actions bar: Skift status, Tilføj label, Skift owner, Arkivér (`archived=true`).

Pagination: 50/page, server-side.

**LeadDetail.tsx (`/leads/:dealId`)**

Tre-kolonne layout:

**Venstre (Details):**
- `LeadDetailHeader` — titel (`title`), breadcrumb, labels, status-badge (`pipeline_stage`).
- Inline-editable felter:
  - Value (`value_dkk` + `currency`)
  - Expected close (`expected_close_date`)
  - Owner (`assigned_to` – dropdown fra `OWNER_EMAILS`)
  - Source (`source` / `source_channel`)
  - Tegninger aftalt (`tegninger_aftalt_date`)
  - Kommune (`municipality`), Region (`region`)
  - Entrepriseform (`contract_form`), Stadie (`stage`)
  - Projektnummer ekstern (`project_number_ext`), Byggefakta (`byggefakta_id` / `byggefakta_url` — read-only hvis importeret)
- `LeadPersonCard` — `primary_contact` + `primary_contact_phone` (V1: tekst; V2: FK-picker).
- `LeadOrganizationCard` — joined fra `crm_contacts` via `contact_id` med `contact_type='company'`.

**Midter (Focus + Timeline):**
- `LeadFocusCard` — næste åbne activity (via `useLeadFocus`). OVERDUE-badge hvis `due_date < today` eller `(due_date = today AND due_time < now_time)`.
- Quick-time picker: "Om 1 t" / "Om 3 t" / "I morgen" / "Næste uge" / "Andet…". Skriver til `due_date` + `due_time`.
- "Markér som udført" → mini-dialog → `done=true`, `done_at=now()`, `completed_outcome=…`.
- "Ny aktivitet" → `LeadActivityDialog`.
- Tabs: Noter | Aktivitet | Alle | Filer.
- Pin-sektion: pinned notes fra `crm_deal_notes`.
- `LeadTimeline` — merged:
  - Noter (fra `crm_deal_notes`, `created_at DESC`).
  - Activities (fra `crm_activities`, både åbne og completede).
  - Item viser: forfatter-initialer (udledt fra email), timestamp, body, actions.

**Højre (Handlinger):**
- "Konvertér til projekt" (grøn) — kun hvis `pipeline_stage IN ('lead','qualified')` og `converted_project_id IS NULL`.
- "Markér som tabt" → `MarkLeadLostDialog`.
- "Arkivér" → `archived=true`.
- Filer (bucket `lead-attachments-2026-04-24`).

**LeadsImport.tsx (`/leads/import`) — V2**

Wizard: Upload CSV → map kolonner → duplikat-regler → preview → commit.

### 4.4 Dialog-specifikationer

**`LeadActivityDialog`**
- Felter: `activity_type` (call/meeting/task/email/deadline/other), `title` (= subject), `description`, contact (ref mod `crm_contacts` person), `due_date`+`due_time`, `assigned_to` (owner).
- INSERT/UPDATE `crm_activities_2026_04_12`.

**`ConvertLeadDialog` (W3)**
- Inputs: `project_number` (UNIQUE), `project_name` (default = `title`), `phase` (default = `Tilbud`), checkbox "Flyt pin'ede noter som projekt-description".
- Submit: transaktion fra §3.2. Redirect til `/projects/:newId`.

**`MarkLeadLostDialog` (W4)**
- Felter: `lost_reason` (dropdown + fri-tekst).
- Submit: UPDATE `pipeline_stage='lost'`, `lost_at=now()`, `lost_reason=...`. Auto-opret note i `crm_deal_notes`.

**`OrganizationPickerDialog` / `ContactPickerDialog`**
- Søg i `crm_contacts` med `contact_type` filter.
- "Opret ny" inline → INSERT i `crm_contacts` med rigtig `contact_type`.

---

## 5. "Focus"-systemet

### 5.1 Afledning

Pr. deal: den åbne activity med laveste (`due_date`, `due_time`).

SQL-view:
```sql
CREATE OR REPLACE VIEW public.v_crm_deal_focus_2026_04_24_10_00 AS
SELECT DISTINCT ON (a.deal_id)
    a.deal_id,
    a.id            AS focus_activity_id,
    a.due_date,
    a.due_time,
    (a.due_date + COALESCE(a.due_time, '09:00'::time))::timestamptz AS due_at,
    a.activity_type,
    a.title         AS subject,
    a.done,
    a.assigned_to,
    (a.due_date < CURRENT_DATE
     OR (a.due_date = CURRENT_DATE AND COALESCE(a.due_time,'23:59'::time) < CURRENT_TIME)
    ) AS is_overdue
FROM public.crm_activities_2026_04_12 a
WHERE a.done = false AND a.deal_id IS NOT NULL
ORDER BY a.deal_id, a.due_date ASC NULLS LAST, a.due_time ASC NULLS LAST;
```

Deals uden åbne activities → ingen row → UI viser "No activity".

### 5.2 OVERDUE-visning

- Rødt badge i `LeadFocusCard` + tabel-kolonne.
- Filter-chip "Kun forfaldne" bruger `is_overdue` fra view.
- Sidebar-badge: `SELECT count(*) FROM v_crm_deal_focus_2026_04_24_10_00 WHERE is_overdue AND assigned_to = :me`.

### 5.3 Quick-time picker

Skriver til `due_date` + `due_time`:
- "Om 1 t" → date = today, time = now + 1h
- "Om 3 t" → date = today, time = now + 3h
- "I morgen" → date = tomorrow, time = 09:00
- "Næste uge" → date = next monday, time = 09:00
- "Andet…" → picker

### 5.4 Notifikation (V2)
E-mail/push digest kl. 08:00. V1 = visuel badge.

---

## 6. Timeline / History

### 6.1 Merge-strategi

`LeadTimeline` henter parallelt:
- Alle `crm_deal_notes` for deal (`created_at DESC`).
- Alle `crm_activities` for deal (både done og åbne).

Merge klient-side til sorteret liste med discriminator `type: 'note' | 'activity_planned' | 'activity_completed'`.

Status-events: V1 implicit via `created_at`/`converted_at`/`lost_at`/`last_activity_at`. V2: `crm_deal_status_events` audit-tabel hvis behov vokser.

### 6.2 Pin-funktion

- `crm_deal_notes.pinned BOOLEAN`.
- Pinned notes: dedikeret top-sektion + forbliver i kronologisk flow.
- Klik pin: UPDATE.

### 6.3 Forfatter

`author_email` er fri tekst – V1 dropdown (`OWNER_EMAILS`). Vises som initialer i timeline-items.

### 6.4 Email-integration (V2)

Udskudt. `crm_activities` har allerede email-felter (`email_message_id`, `email_thread_id`, etc.) – klar til V2 Outlook MCP sync.

---

## 7. Labels/Tags

### 7.1 Valg: **dedikeret tabel + junction** (supplerer eksisterende `tags text[]`)

`crm_deals` har allerede `tags text[]`. Det bevares til simpelt import/eksport, men **ny label-UI bruger `crm_labels` + `crm_deal_labels`** pga.:
- Delt liste på tværs af deals (Pipedrive-style).
- Farver pr. label.
- Rename af label rammer ikke n rækker.
- Effektivt index på junction.

Ved CSV-import mappes Pipedrive-labels ind i `crm_labels` (INSERT ON CONFLICT DO NOTHING) + link via junction. `tags`-array fyldes parallelt for bagkompatibilitet.

### 7.2 V1-scope
- Labels kun på deals.
- UI: `LabelPickerPopover` i LeadDetail + bulk-action i LeadsInbox.
- Label-CRUD: initial seed fra §2.4. Simpel settings-side i V1.5.

### 7.3 V2
- `crm_contact_labels`-junction for org/person-labels.

---

## 8. Custom fields

### 8.1 Valg: hardcode de vigtige + brug `crm_deals` rige skema

`crm_deals_2026_04_12` har allerede mange strukturerede felter (`municipality`, `region`, `stage`, `contract_form`, `area_m2`, `construction_start/end`, `budget_dkk`, `relevance`, `timing`, `next_step`). Plus nye felter fra §2.1.

| Felt | Kolonne | Grund |
|---|---|---|
| Tegninger aftalt | `tegninger_aftalt_date` (NY) | Milepæl — skal indekseres/filteres |
| Projektnummer ekstern | `project_number_ext` (NY) | Søges ofte |
| Entrepriseform | `contract_form` | Filter |
| Kommune | `municipality` | Filter |
| Region | `region` | Filter |
| Stadie | `stage` | Filter/rapport |

### 8.2 Hvorfor ikke ren JSONB?
- Filter/sort på JSONB-nøgler koster mere end kolonne-index.
- Stærkere TS-typer med kolonner.

### 8.3 Hvorfor ikke ren hardcode?
- Nye felter kræver migration. For "nice-to-have" kan JSONB tilføjes senere uden at bryde V1.

---

## 9. Bulk-import fra Pipedrive

### 9.1 V1: Manuel CSV-export → Claude Desktop eller SQL-editor

Der findes allerede `pipedrive_deal_id` / `pipedrive_person_id` / `pipedrive_org_id` / `pipedrive_activity_id` + `pipedrive_synced_at` på tabellerne – importeren **skal** udfylde disse for idempotens.

**Import-rækkefølge:**
1. Organizations.csv → `crm_contacts` med `contact_type='company'`.
2. Persons.csv → `crm_contacts` med `contact_type='person'`, `company` udfyldes med org-navn (V1: tekst – V2 introducér `organization_id` FK).
3. Leads/Deals.csv → `crm_deals`. Match `contact_id` på org-rækken i `crm_contacts`.
4. Notes.csv → `crm_deal_notes`.
5. Activities.csv → `crm_activities`.
6. Labels → `crm_labels` + `crm_deal_labels`.

**Duplikat-håndtering:**
- Org: UPSERT på `pipedrive_org_id`. Fallback: `lower(name)` + `cvr`.
- Person: UPSERT på `pipedrive_person_id`.
- Deal: UPSERT på `pipedrive_deal_id`. Ved match → skip eller merge ifølge CLI-flag.
- Activity: UPSERT på `pipedrive_activity_id`.

### 9.2 Pipedrive API (V2)
Engangs-CSV dækker V1. API kun hvis løbende sync-behov.

### 9.3 Mapping Pipedrive-felt → DB

| Pipedrive | Tabel | Kolonne |
|---|---|---|
| Organization name | `crm_contacts` (company) | `name` |
| Organization CVR | `crm_contacts` | `company` eller `name` + custom |
| Person name | `crm_contacts` (person) | `name` |
| Person email (Work) | `crm_contacts` | `email` |
| Person phone (Work) | `crm_contacts` | `phone` |
| Person org | `crm_contacts` | `company` (tekst – V2 FK) |
| Deal title | `crm_deals` | `title` |
| Tegninger aftalt | `crm_deals` | `tegninger_aftalt_date` |
| Value | `crm_deals` | `value_dkk` |
| Currency | `crm_deals` | `currency` |
| Expected close date | `crm_deals` | `expected_close_date` |
| Owner | `crm_deals` | `assigned_to` (mappet Pipedrive-navn → email) |
| Source name | `crm_deals` | `source_channel` (eller separat `source` hvis struktureret) |
| Status | `crm_deals` | `pipeline_stage` (open→`lead`, won→`converted`, lost→`lost`) |
| Note-historik | `crm_deal_notes` | `body`, `created_at` |
| Activity-historik | `crm_activities` | én row pr.; `done=true` for historiske |
| Label-navne | `crm_labels` + `crm_deal_labels` | |
| Supplerende adresse | `crm_deals` | `delivery_address` |
| Projektnummer | `crm_deals` | `project_number_ext` |
| Entrepriseform | `crm_deals` | `contract_form` |
| Kommune | `crm_deals` | `municipality` |
| Region | `crm_deals` | `region` |
| Stadie | `crm_deals` | `stage` |
| Pipedrive ID | respektive tabel | `pipedrive_*_id` |

---

## 10. Claude Desktop automation (`LEADS_SKILL.md`)

### 10.1 Arkitektur
```
Claude Desktop
  ├─ Outlook MCP        → læs/send mails (V2)
  ├─ Google Calendar MCP → opfølgnings-events (valgfri)
  └─ Supabase MCP       → opret/opdatér deals, activities, notes
```

### 10.2 Workflows Claude automatiserer

**A1 – Log kald (Milot dikterer):**
> "Log kald til Søren Østergaard A/S: receptionen Leah omstillede til Maria (inventar), inventar er låst. Sæt ny opfølgning i morgen kl. 10."

Claude:
1. Find deal via joined org-navn:
   ```sql
   SELECT d.id FROM crm_deals_2026_04_12 d
   JOIN crm_contacts_2026_04_12 c ON c.id = d.contact_id AND c.contact_type='company'
   WHERE c.name ILIKE '%søren østergaard%';
   ```
   Hvis flere: spørg Milot.
2. INSERT `crm_deal_notes_2026_04_24_10_00` m. `body`, `author_email='milot@neminventar.dk'`, `created_by='claude_auto'`.
3. Markér eventuel åben focus-activity som `done=true`, `done_at=now()`, `completed_outcome=...`.
4. INSERT `crm_activities_2026_04_12` type=`call`, `title='Opfølgning'`, `due_date`+`due_time` = parsed tid, `assigned_to='milot@neminventar.dk'`, `logged_via='claude_auto'`.

**A2 – Daglig status kl. 08:00:**
```sql
SELECT d.title,
       org.name AS organization,
       a.title  AS subject,
       a.due_date, a.due_time
FROM crm_deals_2026_04_12 d
JOIN crm_contacts_2026_04_12 org
     ON org.id = d.contact_id AND org.contact_type = 'company'
JOIN crm_activities_2026_04_12 a
     ON a.deal_id = d.id
WHERE a.done = false
  AND a.due_date <= CURRENT_DATE
  AND a.assigned_to = 'milot@neminventar.dk'
ORDER BY a.due_date ASC, a.due_time ASC;
```

**A3 – Bulk-CSV-import:** se §9.3.

**A4 – Byggefakta-udtræk:**
> "Her er 5 nye udbud fra Byggefakta: [paste]. Opret leads."

Claude opretter én deal pr. udbud med `source_channel='Byggefakta'`, `byggefakta_id`, `byggefakta_url`, `byggefakta_imported_at=now()`, `pipeline_stage='lead'`, `assigned_to='milot@neminventar.dk'`, `created_by='claude_auto'`.

**A5 – Email-parse (V2):** via `crm_activities` email-felter.

### 10.3 LEADS_SKILL.md – skitse

```
# LEADS_SKILL — Claude Desktop

## Skill-mål
Hjælp Milot (og Joachim) med at arbejde i NemInventar-leads uden at åbne portalen.

## Værktøjer
- Supabase MCP (service_role)
- Outlook MCP (V2)

## Tabel-konstanter
- Deals/leads: crm_deals_2026_04_12
- Contacts (unified): crm_contacts_2026_04_12
- Activities: crm_activities_2026_04_12
- Notes: crm_deal_notes_2026_04_24_10_00
- Labels: crm_labels_2026_04_24_10_00 + crm_deal_labels_2026_04_24_10_00
- Projekter: projects_2026_01_15_06_45

## Field-mapping (vigtigt!)
- "status" = crm_deals.pipeline_stage ('lead'/'qualified'/'converted'/'lost'/'archived')
- "owner" = crm_deals.assigned_to (email)
- "completed" = crm_activities.done
- "subject" = crm_activities.title
- "organisation" = crm_contacts WHERE contact_type='company', via crm_deals.contact_id
- "kontaktperson" = crm_contacts WHERE contact_type='person'
- "kommune" = crm_deals.municipality

## Default owner for Milot
'milot@neminventar.dk'

## Rutiner
- A1: log-kald
- A2: morning-digest
- A3: bulk-import
- A4: Byggefakta-udbud
- A5: email-parse (V2)

## Tone
- Dansk. Kort. Bekræft kun det kritiske før INSERT.
- Ved tvivl om match: spørg, INSERT aldrig blindt.

## Audit
- Alt Claude opretter: crm_deals.created_by='claude_auto', crm_activities.logged_via='claude_auto', crm_deal_notes.created_by='claude_auto'.
- Ved tvivl: opret som note, ikke som activity.
```

### 10.4 Stemme-transkription (V3)
Milot optager voice-notes → Whisper → A1.

---

## 11. Workflows (detaljeret)

### W1 – Opret lead manuelt

1. Bruger klikker "Ny lead" i `/leads`.
2. Modal-dialog:
   - Titel (kræves) → `crm_deals.title`.
   - Organisation (picker i `crm_contacts` WHERE `contact_type='company'`; "Opret ny" inline).
   - Kontaktperson (V1: fri-tekst `primary_contact` + `primary_contact_phone`; V2: picker i `crm_contacts` WHERE `contact_type='person'`).
   - Expected close date.
   - Source channel (dropdown).
   - Owner (dropdown default = current user).
3. INSERT `crm_deals_2026_04_12` med `pipeline_stage='lead'`, `created_by='human'`, `contact_id` = valgt org.
4. Redirect til `/leads/:dealId`.

**Done when:** Deal findes, vises i inbox, har org-link og owner.

### W2 – Log opkald

**W2a – Fra `LeadDetail` manuelt:**
1. "Tilføj note" → `LeadNoteInput`.
2. INSERT `crm_deal_notes_2026_04_24_10_00`.
3. Optionel "Planlæg opfølgning" → `LeadActivityDialog`.

**W2b – Fra `LeadFocusCard`:**
1. "Udført" på focus.
2. Mini-dialog: outcome.
3. UPDATE `crm_activities`: `done=true`, `done_at=now()`, `completed_outcome=...`.
4. Auto-INSERT `crm_deal_notes` m. body "[CALL] {outcome}".
5. Prompt: "Planlæg ny opfølgning?" → quick-time picker.

**W2c – Via Claude (A1):** se §10.2.

**Done when:** Note persisteret, evt. ny åben activity oprettet, focus opdateret.

### W3 – Konvertér lead → projekt

1. `LeadDetail` → "Konvertér til projekt".
2. `ConvertLeadDialog` pre-fyldt fra deal.
3. Bruger indtaster unikt `project_number`.
4. Submit → transaktion fra §3.2.
5. Success: `pipeline_stage='converted'`, `converted_project_id` sat, auto-note "Konverteret til projekt P2026-XYZ", redirect til `/projects/:newId`.

**Done when:** Nyt projekt findes, deal har `converted_project_id`, timeline bevaret.

### W4 – Markér lead som tabt
1. `MarkLeadLostDialog` → årsag.
2. UPDATE `pipeline_stage='lost'`, `lost_at=now()`, `lost_reason=...`.
3. Auto-note.
4. Gen-åbn → `pipeline_stage='lead'`, `lost_reason=NULL`, `lost_at=NULL`.

### W5 – Bulk-import
V1: Claude Desktop A3. V2: `/leads/import` wizard.

### W6 – Bulk-action i inbox
Multi-select → "Skift status" / "Tilføj label" / "Skift owner" / "Arkivér" (`archived=true`) → BATCH UPDATE.

---

## 12. Prioritering – V1 / V2 / V3

### V1
- [ ] Migration §2.1 kørt (ALTER TABLE + indexes på eksisterende crm_*-tabeller)
- [ ] Migration §2.2 kørt (3 nye tabeller + RLS + triggers)
- [ ] View `v_crm_deal_focus_2026_04_24_10_00` oprettet
- [ ] Storage bucket + policies
- [ ] Seed labels §2.4
- [ ] Normaliser `assigned_to` → emails (engangs-UPDATE)
- [ ] `LeadsContext` provider wired i `App.tsx`
- [ ] Routes `/leads`, `/leads/:dealId`
- [ ] `LeadsInbox` — tabel m. filter/sortering/søg/bulk
- [ ] `LeadDetail` — tre-kolonne
- [ ] `LeadFocusCard` m. quick-time picker + "Udført"
- [ ] `LeadTimeline` m. merged notes + activities, pin
- [ ] `LeadNoteInput`, `LeadActivityDialog`
- [ ] `OrganizationPickerDialog`, `ContactPickerDialog` (filtrerer `contact_type`)
- [ ] `LabelPickerPopover` + junction CRUD
- [ ] `ConvertLeadDialog` + transaktion deal→projekt
- [ ] `MarkLeadLostDialog`
- [ ] Sidebar-link "Leads" + overdue-badge
- [ ] Danske labels gennemgående
- [ ] Claude A1 + A2 promter testet

### V2
- [ ] `/leads/import` CSV-wizard UI
- [ ] `/contacts`, `/organizations` oversigtssider (split på `contact_type`)
- [ ] `primary_contact_id` FK-kolonne på `crm_deals` (erstatter tekst-feltet)
- [ ] `organization_id` FK på `crm_contacts` (person → company) — gør `company` tekst-feltet redundant
- [ ] Junction `crm_contact_labels` for person/org-labels
- [ ] Email-integration via `crm_activities.email_*`-felter
- [ ] Daglig digest kl. 08
- [ ] `crm_deal_status_events` audit-tabel
- [ ] Byggefakta-RSS parser (A4)
- [ ] Statistik: source, win-rate, cycle time
- [ ] Realtime subscriptions

### V3
- [ ] Pipedrive API to-vejs sync
- [ ] Whisper-transkription
- [ ] ML-score pr. lead
- [ ] CTI-integration
- [ ] `projects.organization_id` FK-refaktor

---

## 13. Åbne spørgsmål — beslut før implementering

1. **Users-tabel eller ej?** V1: fri-tekst emails i `assigned_to` / `author_email`. `app_users_…` først når behov opstår. **Forslag V1:** email-strings.
2. **`contact_id` på activity — påkrævet?** `crm_activities.contact_id` er allerede nullable. **Forslag:** nullable, default til deal'ets primær-person hvis introduceret i V2.
3. **Flere kontakter pr. lead?** V1: `primary_contact` tekst. V2: FK + `crm_deal_contacts`-junction for n:m. V1: ekstra kontakter som notater.
4. **Pipedrive-sync retning?** Engangs-CSV via A3; Milot stopper Pipedrive ved go-live. `pipedrive_*_id`-kolonnerne bevares for idempotens.
5. **Labels på tværs af entiteter?** V1: kun deals. V2: `crm_contact_labels`-junction.
6. **Primary contact som FK?** **Forslag V2:** tilføj `primary_contact_id uuid REFERENCES crm_contacts(id)`. V1: behold tekst så import ikke brydes.
7. **RLS-stramning?** V1: alle authenticated ser alt. V2: per-owner filtre.
8. **Focus: view eller klient-afledning?** **Valgt:** DB-view (`v_crm_deal_focus_…`) for sort/filter-effektivitet.
9. **Dublet-håndtering ved import?** Primært på `pipedrive_*_id`. Fallback: `lower(trim(name))` + email.
10. **Auto-note ved activity-completion?** §W2b: ja — **afklar med Milot**, default aktiveret.
11. **Sletning af contacts?** `crm_deals.contact_id` har pt. ingen cascade — check constraint, og brug `archived=true`/`status='Arkiveret'` i UI i stedet for DELETE.
12. **Claude-genererede noter — author?** `author_email='milot@neminventar.dk'` + `created_by='claude_auto'` (Milot er afsender, Claude skribent).
13. **`tags` vs. `crm_labels` dobbeltspor?** ✅ **Besluttet:** Ignorer `tags`-kolonnen i UI — skriv aldrig til den. Ingen af de 5 eksisterende deals har tags (kolonnen er tom). Brug udelukkende `crm_labels`/`crm_deal_labels`-systemet. Kolonnen slettes ikke (unødvendig migration), men den er usynlig i koden.
14. **`pipeline_stage`-normalisering:** ✅ **Besluttet:** Ingen normalisering nødvendig. Live-data viser at alle 5 eksisterende deals har `pipeline_stage = 'lead'`, som er en gyldig værdi i CHECK-constraint (`lead/qualified/converted/lost/archived`). Kør ALTER TABLE direkte uden forbehandling.

---

**Klar til implementering.** Før første migrationskørsel: afklar spørgsmål 1, 7 og 10 med Joachim/Milot.
