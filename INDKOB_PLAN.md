# Indkøbsoverblik – V1 Plan (multi-item RFQ + Claude-automation)

_Udarbejdet 2026-04-23. Implementer 1:1 som beskrevet._

> **Bemærk ved start af implementering:** Supabase MCP var nede da planen blev skrevet; schema er læst fra migrationsfiler i repoet. Før migration køres: verificér med `execute_sql` at disse suffixes stadig er aktive: `projects_2026_01_15_06_45`, `standard_suppliers_2026_01_15_06_45`, `project_materials_2026_01_15_06_45`. Hvis `_2026_01_22_00_00`-varianter er aktive i stedet, udskift FK-targets nedenfor. De eksisterende flade tabeller er: `project_price_requests_2026_01_25_19_16` (1 række) og `project_price_quotes_2026_01_25_19_16` (2 rækker).

---

## 0. Navngivnings-konvention

Alle nye tabeller og buckets bruger suffix: **`_2026_04_23_10_00`**.

Nye entiteter:
- `project_rfqs_2026_04_23_10_00`
- `project_rfq_lines_2026_04_23_10_00`
- `project_rfq_suppliers_2026_04_23_10_00`
- `project_quotes_2026_04_23_10_00`
- `project_quote_lines_2026_04_23_10_00`
- Storage bucket: `rfq-attachments-2026-04-23` (bindestreger – buckets må ikke have underscore)

---

## 1. Datamodel – overblik

```
projects_2026_01_15_06_45
  └─ project_rfqs_2026_04_23_10_00              (1 RFQ = 1 prisforespørgsel med flere varer)
       ├─ project_rfq_lines_2026_04_23_10_00         (n varelinjer vi efterspørger)
       ├─ project_rfq_suppliers_2026_04_23_10_00     (m leverandører vi spørger)
       └─ project_quotes_2026_04_23_10_00            (0-m svar, én pr. (rfq, supplier))
            └─ project_quote_lines_2026_04_23_10_00  (priser pr. rfq_line fra den supplier)
```

**Kardinalitet:**
- RFQ : RFQ_Line = 1:n
- RFQ : RFQ_Supplier = 1:n
- RFQ : Quote = 1:n (én per (rfq_id, supplier_id) – unique)
- Quote : Quote_Line ≤ RFQ_Line (partial fill tilladt)
- RFQ_Line : Quote_Line via `rfq_line_id` (1:0..n på tværs af quotes)

---

## 2. Komplet migration-SQL

### 2.1 Migration fil: `create_rfq_tables_2026_04_23_10_00.sql`

```sql
-- =====================================================================
-- NemInventar ERP – Multi-item RFQ system with automation hooks
-- 2026-04-23 10:00
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) project_rfqs – én "prisforespørgsel" (pakken af varer til 1+ leverandører)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_rfqs_2026_04_23_10_00 (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id               uuid NOT NULL
                              REFERENCES public.projects_2026_01_15_06_45(id)
                              ON DELETE CASCADE,
    title                    text NOT NULL,
    description              text,
    status                   text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','sent','partially_received','closed','awarded','cancelled')),
    deadline                 date,
    first_delivery_date      date,
    last_delivery_date       date,
    payment_terms            text,
    budget_hint_total        numeric(14,2),
    currency                 text NOT NULL DEFAULT 'DKK',
    notes                    text,
    created_by               text NOT NULL DEFAULT 'human'
                              CHECK (created_by IN ('human','claude_auto')),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfqs_project_id_2026_04_23_10_00
    ON public.project_rfqs_2026_04_23_10_00(project_id);
CREATE INDEX idx_rfqs_status_2026_04_23_10_00
    ON public.project_rfqs_2026_04_23_10_00(status);

-- ---------------------------------------------------------------------
-- 2) project_rfq_lines – varelinjer vi efterspørger
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_rfq_lines_2026_04_23_10_00 (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id                   uuid NOT NULL
                              REFERENCES public.project_rfqs_2026_04_23_10_00(id)
                              ON DELETE CASCADE,
    line_no                  integer NOT NULL,
    project_material_id      uuid
                              REFERENCES public.project_materials_2026_01_15_06_45(id)
                              ON DELETE SET NULL,
    name                     text NOT NULL,
    description              text,
    qty                      numeric(14,3) NOT NULL,
    unit                     text NOT NULL,
    spec                     text,
    budget_hint_total        numeric(14,2),
    notes                    text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (rfq_id, line_no)
);

CREATE INDEX idx_rfq_lines_rfq_id_2026_04_23_10_00
    ON public.project_rfq_lines_2026_04_23_10_00(rfq_id);
CREATE INDEX idx_rfq_lines_project_material_2026_04_23_10_00
    ON public.project_rfq_lines_2026_04_23_10_00(project_material_id);

-- ---------------------------------------------------------------------
-- 3) project_rfq_suppliers – leverandører vi har spurgt
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_rfq_suppliers_2026_04_23_10_00 (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id                   uuid NOT NULL
                              REFERENCES public.project_rfqs_2026_04_23_10_00(id)
                              ON DELETE CASCADE,
    supplier_id              uuid NOT NULL
                              REFERENCES public.standard_suppliers_2026_01_15_06_45(id)
                              ON DELETE RESTRICT,
    invite_status            text NOT NULL DEFAULT 'invited'
                              CHECK (invite_status IN ('invited','reminded','declined','no_response','responded')),
    invited_at               timestamptz,
    reminded_at              timestamptz,
    contact_email            text,
    contact_person           text,
    notes                    text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX idx_rfq_suppliers_rfq_id_2026_04_23_10_00
    ON public.project_rfq_suppliers_2026_04_23_10_00(rfq_id);
CREATE INDEX idx_rfq_suppliers_supplier_id_2026_04_23_10_00
    ON public.project_rfq_suppliers_2026_04_23_10_00(supplier_id);

-- ---------------------------------------------------------------------
-- 4) project_quotes – ét svar fra én leverandør på én RFQ
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_quotes_2026_04_23_10_00 (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id                   uuid NOT NULL
                              REFERENCES public.project_rfqs_2026_04_23_10_00(id)
                              ON DELETE CASCADE,
    supplier_id              uuid NOT NULL
                              REFERENCES public.standard_suppliers_2026_01_15_06_45(id)
                              ON DELETE RESTRICT,
    status                   text NOT NULL DEFAULT 'received'
                              CHECK (status IN ('received','declined','expired','selected','lost')),
    received_at              date,
    valid_until              date,
    currency                 text NOT NULL DEFAULT 'DKK',
    lead_time_days           integer,
    payment_terms            text,
    delivery_terms           text,
    total_price              numeric(14,2),
    notes                    text,

    -- Automation-hook 1: source-tracking (idempotens)
    source_email_id          text UNIQUE,
    source_email_received_at timestamptz,
    raw_source_text          text,

    -- Automation-hook 2: review-flag
    needs_review             boolean NOT NULL DEFAULT false,
    created_by               text NOT NULL DEFAULT 'human'
                              CHECK (created_by IN ('human','claude_auto')),
    reviewed_by              text,
    reviewed_at              timestamptz,

    -- Automation-hook 3: attachment
    pdf_url                  text,
    pdf_filename             text,

    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX idx_quotes_rfq_id_2026_04_23_10_00
    ON public.project_quotes_2026_04_23_10_00(rfq_id);
CREATE INDEX idx_quotes_supplier_id_2026_04_23_10_00
    ON public.project_quotes_2026_04_23_10_00(supplier_id);
CREATE INDEX idx_quotes_status_2026_04_23_10_00
    ON public.project_quotes_2026_04_23_10_00(status);
CREATE INDEX idx_quotes_needs_review_2026_04_23_10_00
    ON public.project_quotes_2026_04_23_10_00(needs_review) WHERE needs_review = true;

-- ---------------------------------------------------------------------
-- 5) project_quote_lines – pris pr. rfq_line fra en given supplier
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_quote_lines_2026_04_23_10_00 (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id                 uuid NOT NULL
                              REFERENCES public.project_quotes_2026_04_23_10_00(id)
                              ON DELETE CASCADE,
    rfq_line_id              uuid NOT NULL
                              REFERENCES public.project_rfq_lines_2026_04_23_10_00(id)
                              ON DELETE CASCADE,

    -- Total-mode: total er primær, unit_price afledes
    total_price              numeric(14,2),
    quoted_qty               numeric(14,3),
    unit                     text,
    unit_price               numeric(14,4)
                              GENERATED ALWAYS AS (
                                  CASE
                                      WHEN quoted_qty IS NULL OR quoted_qty = 0 THEN NULL
                                      WHEN total_price IS NULL THEN NULL
                                      ELSE total_price / quoted_qty
                                  END
                              ) STORED,

    lead_time_days           integer,
    min_qty                  numeric(14,3),
    alternative_offered      boolean NOT NULL DEFAULT false,
    alternative_note         text,
    declined                 boolean NOT NULL DEFAULT false,
    notes                    text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (quote_id, rfq_line_id)
);

CREATE INDEX idx_quote_lines_quote_id_2026_04_23_10_00
    ON public.project_quote_lines_2026_04_23_10_00(quote_id);
CREATE INDEX idx_quote_lines_rfq_line_id_2026_04_23_10_00
    ON public.project_quote_lines_2026_04_23_10_00(rfq_line_id);

-- ---------------------------------------------------------------------
-- 6) Triggers for updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'project_rfqs_2026_04_23_10_00',
    'project_rfq_lines_2026_04_23_10_00',
    'project_rfq_suppliers_2026_04_23_10_00',
    'project_quotes_2026_04_23_10_00',
    'project_quote_lines_2026_04_23_10_00'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7) RLS – samme mønster som eksisterende tabeller
-- ---------------------------------------------------------------------
ALTER TABLE public.project_rfqs_2026_04_23_10_00          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rfq_lines_2026_04_23_10_00     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rfq_suppliers_2026_04_23_10_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_quotes_2026_04_23_10_00        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_quote_lines_2026_04_23_10_00   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_rfqs" ON public.project_rfqs_2026_04_23_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_rfq_lines" ON public.project_rfq_lines_2026_04_23_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_rfq_suppliers" ON public.project_rfq_suppliers_2026_04_23_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_quotes" ON public.project_quotes_2026_04_23_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_quote_lines" ON public.project_quote_lines_2026_04_23_10_00
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- service_role har implicit bypass på RLS, så ingen ekstra policy nødvendig.

COMMIT;
```

### 2.2 Storage bucket (UI eller SQL)

```sql
-- Kør i Supabase SQL editor som service_role
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rfq-attachments-2026-04-23',
  'rfq-attachments-2026-04-23',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf','image/png','image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies på storage.objects for bucket
CREATE POLICY "auth_read_rfq_pdf"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rfq-attachments-2026-04-23' AND auth.role() = 'authenticated');

CREATE POLICY "auth_write_rfq_pdf"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rfq-attachments-2026-04-23' AND auth.role() = 'authenticated');

CREATE POLICY "auth_update_rfq_pdf"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'rfq-attachments-2026-04-23' AND auth.role() = 'authenticated');
```

Bucket-navnet er bindestreg-separeret, da Supabase ikke tillader underscore i bucket-id.

### 2.3 Backfill – flyt 1+2 eksisterende rækker

Legacy-tabellerne er flade (1 line per request). Hver gammel request bliver 1 RFQ + 1 RFQ_line; hver gammel quote bliver 1 Quote + 1 Quote_line:

```sql
BEGIN;

-- 1) Migrér prisforespørgsler → RFQ + RFQ_line
INSERT INTO public.project_rfqs_2026_04_23_10_00
    (id, project_id, title, description, status, first_delivery_date, last_delivery_date,
     payment_terms, budget_hint_total, notes, created_by, created_at, updated_at)
SELECT
    r.id,
    r.project_id,
    r.title,
    r.description,
    CASE r.status
        WHEN 'open' THEN 'sent'
        WHEN 'closed' THEN 'closed'
        WHEN 'awarded' THEN 'awarded'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'draft'
    END,
    r.first_delivery_date,
    r.last_delivery_date,
    r.payment_terms,
    r.budget_hint,
    NULL,
    'human',
    r.created_at,
    r.updated_at
FROM public.project_price_requests_2026_01_25_19_16 r;

INSERT INTO public.project_rfq_lines_2026_04_23_10_00
    (rfq_id, line_no, project_material_id, name, description, qty, unit, budget_hint_total,
     created_at, updated_at)
SELECT
    r.id,
    1,
    r.project_material_id,
    r.title,
    r.description,
    COALESCE(r.qty, 1),
    COALESCE(r.unit, 'stk'),
    r.budget_hint,
    r.created_at,
    r.updated_at
FROM public.project_price_requests_2026_01_25_19_16 r;

-- 2) Migrér quotes → project_quotes + project_quote_lines
-- Vi opretter implicit rfq_supplier-rækker for hver unique (rfq, supplier) der findes i quotes
INSERT INTO public.project_rfq_suppliers_2026_04_23_10_00
    (rfq_id, supplier_id, invite_status, invited_at, created_at, updated_at)
SELECT DISTINCT
    q.project_price_request_id,
    q.supplier_id,
    'responded',
    q.created_at,
    q.created_at,
    q.updated_at
FROM public.project_price_quotes_2026_01_25_19_16 q
ON CONFLICT (rfq_id, supplier_id) DO NOTHING;

INSERT INTO public.project_quotes_2026_04_23_10_00
    (id, rfq_id, supplier_id, status, received_at, valid_until, currency,
     lead_time_days, notes, total_price, created_by, created_at, updated_at)
SELECT
    q.id,
    q.project_price_request_id,
    q.supplier_id,
    CASE q.status
        WHEN 'offered' THEN 'received'
        WHEN 'declined' THEN 'declined'
        WHEN 'expired' THEN 'expired'
        WHEN 'selected' THEN 'selected'
        ELSE 'received'
    END,
    q.received_at,
    q.valid_until,
    COALESCE(q.currency, 'DKK'),
    q.lead_time_days,
    q.notes,
    q.unit_price * COALESCE(q.min_qty, (SELECT qty FROM public.project_price_requests_2026_01_25_19_16 WHERE id = q.project_price_request_id), 1),
    'human',
    q.created_at,
    q.updated_at
FROM public.project_price_quotes_2026_01_25_19_16 q;

INSERT INTO public.project_quote_lines_2026_04_23_10_00
    (quote_id, rfq_line_id, total_price, quoted_qty, unit, lead_time_days, min_qty, notes,
     created_at, updated_at)
SELECT
    q.id,
    (SELECT l.id
     FROM public.project_rfq_lines_2026_04_23_10_00 l
     WHERE l.rfq_id = q.project_price_request_id AND l.line_no = 1),
    q.unit_price * COALESCE(q.min_qty, (SELECT qty FROM public.project_price_requests_2026_01_25_19_16 WHERE id = q.project_price_request_id), 1),
    COALESCE(q.min_qty, (SELECT qty FROM public.project_price_requests_2026_01_25_19_16 WHERE id = q.project_price_request_id), 1),
    COALESCE(q.unit, (SELECT unit FROM public.project_price_requests_2026_01_25_19_16 WHERE id = q.project_price_request_id)),
    q.lead_time_days,
    q.min_qty,
    q.notes,
    q.created_at,
    q.updated_at
FROM public.project_price_quotes_2026_01_25_19_16 q;

COMMIT;
```

**Verifikations-query før rename:**
```sql
SELECT
  (SELECT count(*) FROM public.project_price_requests_2026_01_25_19_16) AS old_req,
  (SELECT count(*) FROM public.project_rfqs_2026_04_23_10_00) AS new_rfq,
  (SELECT count(*) FROM public.project_price_quotes_2026_01_25_19_16) AS old_q,
  (SELECT count(*) FROM public.project_quotes_2026_04_23_10_00) AS new_q;
-- Forventet: 1,1,2,2
```

### 2.4 Rename legacy → _legacy (sikker drop-erstatning)

```sql
BEGIN;
ALTER TABLE public.project_price_requests_2026_01_25_19_16
    RENAME TO project_price_requests_2026_01_25_19_16_legacy;
ALTER TABLE public.project_price_quotes_2026_01_25_19_16
    RENAME TO project_price_quotes_2026_01_25_19_16_legacy;
COMMIT;
```

Kør først `DROP` efter minimum 2 ugers stabil drift af nye tabeller.

---

## 3. Kolonnebeskrivelser

### 3.1 `project_rfqs_2026_04_23_10_00`

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid NOT NULL, FK CASCADE | Projekt RFQ'en tilhører. Slettes projektet, slettes RFQ'en. |
| `title` | text NOT NULL | Fx "Plader + beslag til R2.15". Vises i liste. |
| `description` | text | Fri tekst, kontekst til leverandører. |
| `status` | text CHECK | `draft` (oprettet, ikke sendt), `sent` (sendt til leverandører, ingen svar), `partially_received` (nogle svar modtaget), `closed` (ingen flere svar forventes), `awarded` (ordre tildelt), `cancelled`. |
| `deadline` | date | Frist for svar fra leverandører. |
| `first_delivery_date` / `last_delivery_date` | date | Ønsket leveringsvindue. |
| `payment_terms` | text | Fx "30 dage netto". |
| `budget_hint_total` | numeric(14,2) | Vores interne forventning — ikke delt med leverandører. |
| `currency` | text DEFAULT 'DKK' | RFQ-niveau default for alle quotes. |
| `notes` | text | Internt. |
| `created_by` | text CHECK | `human` eller `claude_auto`. |
| `created_at` / `updated_at` | timestamptz | Auto. |

### 3.2 `project_rfq_lines_2026_04_23_10_00`

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid PK | |
| `rfq_id` | uuid NOT NULL, FK CASCADE | |
| `line_no` | integer NOT NULL | Sortering + menneskelæsbar reference. Unique med `rfq_id`. |
| `project_material_id` | uuid, FK SET NULL | Valgfri kobling til projektmateriale. Slettes materialet, bevares linjen som "tom reference". |
| `name` | text NOT NULL | Snapshot fra materialet eller frit tekst. |
| `description` | text | |
| `qty` | numeric(14,3) NOT NULL | Mængde vi efterspørger. |
| `unit` | text NOT NULL | Fx `stk`, `m2`, `m`. |
| `spec` | text | Evt. teknisk spec / dimension. |
| `budget_hint_total` | numeric(14,2) | Internt budgetestimat for linjen. |

### 3.3 `project_rfq_suppliers_2026_04_23_10_00`

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid PK | |
| `rfq_id` | uuid NOT NULL, FK CASCADE | |
| `supplier_id` | uuid NOT NULL, FK RESTRICT | Blokér sletning af supplier der er spurgt. |
| `invite_status` | text CHECK | `invited`, `reminded`, `declined`, `no_response`, `responded`. |
| `invited_at` / `reminded_at` | timestamptz | |
| `contact_email` / `contact_person` | text | Snapshot så historik ikke ændres hvis supplier-kontakten skifter. |
| UNIQUE `(rfq_id, supplier_id)` | | Samme supplier kan ikke være inviteret to gange. |

### 3.4 `project_quotes_2026_04_23_10_00`

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid PK | |
| `rfq_id` | uuid NOT NULL, FK CASCADE | |
| `supplier_id` | uuid NOT NULL, FK RESTRICT | Blokér sletning af supplier med quote. |
| `status` | text CHECK | `received` (svar kom ind), `declined` (sagde nej), `expired` (valid_until passeret), `selected` (vi valgte denne), `lost` (tabt mod andet valg). |
| `received_at` | date | Hvornår leverandørens svar kom. |
| `valid_until` | date | Hvornår prisen udløber. |
| `currency` | text DEFAULT 'DKK' | |
| `lead_time_days` | integer | Aggregeret — kan overrides pr. linje. |
| `payment_terms` / `delivery_terms` | text | |
| `total_price` | numeric(14,2) | Snapshot-total fra leverandør (sum af linjer hvis set manuelt). Primær total i total-mode. |
| `notes` | text | |
| **Automation 1 – source-tracking** | | |
| `source_email_id` | text UNIQUE | Message-ID eller lignende. Garanterer idempotens: samme mail = samme quote. |
| `source_email_received_at` | timestamptz | Mail-modtagelsestidspunkt. |
| `raw_source_text` | text | Rå mail-body (for debug og re-parsing). |
| **Automation 2 – review-flag** | | |
| `needs_review` | boolean DEFAULT false | `true` for alt Claude har udfyldt indtil godkendt. |
| `created_by` | text CHECK | `human` eller `claude_auto`. |
| `reviewed_by` | text | Fx `js@neminventar.dk` |
| `reviewed_at` | timestamptz | |
| **Automation 3 – attachment** | | |
| `pdf_url` | text | Fuld URL til Supabase Storage. |
| `pdf_filename` | text | Originalt filnavn. |
| UNIQUE `(rfq_id, supplier_id)` | | Kun én aktiv quote pr. (rfq, supplier). Re-parse overskriver via upsert. |

### 3.5 `project_quote_lines_2026_04_23_10_00`

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid PK | |
| `quote_id` | uuid NOT NULL, FK CASCADE | |
| `rfq_line_id` | uuid NOT NULL, FK CASCADE | Peger på den RFQ-linje prisen gælder. |
| `total_price` | numeric(14,2) | **Primær** i total-mode. Snapshot fra leverandør. |
| `quoted_qty` | numeric(14,3) | Mængde leverandøren faktisk priser (kan afvige fra RFQ-linjens qty). |
| `unit` | text | Leverandørens enhed (snapshot). |
| `unit_price` | numeric(14,4) GENERATED | `total_price / quoted_qty` — auto-afledt, ikke manuelt. |
| `lead_time_days` | integer | Line-specific lead time. |
| `min_qty` | numeric(14,3) | Minimum ordre-størrelse. |
| `alternative_offered` | boolean | Leverandør har tilbudt alternativt produkt. |
| `alternative_note` | text | Beskrivelse af alternativet. |
| `declined` | boolean | Leverandør kan ikke levere denne linje (partial quote). |
| `notes` | text | |
| UNIQUE `(quote_id, rfq_line_id)` | | Én pris pr. linje pr. quote. |

### 3.6 FK cascade-argumenter

| FK | Adfærd | Argument |
|---|---|---|
| rfq → project | CASCADE | Projekt væk = al indkøbsdata for projektet væk. |
| rfq_line → rfq | CASCADE | Linjer findes ikke uden RFQ. |
| rfq_line → project_material | SET NULL | Materialer kan genbruges; slettes materialet må RFQ-historik bevares. |
| rfq_supplier → rfq | CASCADE | |
| rfq_supplier → supplier | RESTRICT | Man må ikke slette supplier der er spurgt — bevar revisionsspor. Erstattes af `status='Arkiveret'` på supplier. |
| quote → rfq | CASCADE | |
| quote → supplier | RESTRICT | Samme argument. |
| quote_line → quote | CASCADE | |
| quote_line → rfq_line | CASCADE | Hvis RFQ-linje slettes, giver kvote-linje til den ikke mening. |

---

## 4. Workflows (detaljeret)

### W1 – Opret RFQ manuelt

1. Bruger åbner projekt → "Indkøb" → "Ny prisforespørgsel".
2. Dialog step 1 (Header): titel, beskrivelse, deadline, leveringsvindue, betalingsvilkår.
   → INSERT 1 række i `project_rfqs`, status=`draft`, `created_by='human'`.
3. Dialog step 2 (Linjer): tabel, tilføj rækker fra 3 kilder:
   - Fra projekt-materialer (multi-select, kopier name/unit/qty).
   - Fra tidligere RFQ på projektet (kopier linjer).
   - Manuelt (tom række).
   → BATCH INSERT i `project_rfq_lines`, `line_no` = 1..n.
4. Dialog step 3 (Leverandører): multi-select fra `standard_suppliers` med status='Aktiv'. Snapshot `contact_email` + `contact_person` fra supplier. Tilføj evt. ad-hoc kontaktpersoner pr. supplier.
   → BATCH INSERT i `project_rfq_suppliers`, `invite_status='invited'`, `invited_at=now()`.
5. Gem → RFQ status sættes til `sent`.
6. Valgfrit: Send e-mail via Outlook MCP (V2).

**Done when:** RFQ vises på `/purchasing` oversigten med n linjer og m leverandører; alle rækker har FK-integritet.

### W2 – Registrér svar manuelt

1. Bruger klikker RFQ på oversigten → detalje-side.
2. I tabellen "Leverandører" klikker bruger "Registrér svar" på en supplier der har `invite_status in ('invited','reminded')`.
3. Dialog: "Svar fra [supplier_name]":
   - Top: received_at, valid_until, currency, payment_terms, delivery_terms, total_price (hvis kendt), notes.
   - Tabel: én række pr. RFQ-linje, kolonner: qty ønsket (read-only), qty prissat, unit, **total_price (primær)**, unit_price (afledt, read-only), declined (checkbox), alternative (checkbox + note), notes.
   - PDF upload (valgfrit) → Storage bucket → `pdf_url`.
4. Gem:
   - UPSERT 1 række i `project_quotes` (PK `(rfq_id, supplier_id)`), `created_by='human'`, `needs_review=false`.
   - For hver udfyldt linje: UPSERT i `project_quote_lines` med `total_price`. Tomme linjer får ikke quote_line (= "ikke prissat").
   - Opdatér `project_rfq_suppliers.invite_status = 'responded'`.
   - Hvis mindst én supplier har `status='received'`: opdatér RFQ status til `partially_received` (ellers lad stå).

**Done when:** Quote + quote_lines gemt, supplier markeret som `responded`, unit_price er beregnet korrekt (total/qty).

### W3 – Claude auto-parse fra mail

Claude Desktop kører via Outlook MCP + Supabase MCP. Step-for-step i den rækkefølge:

1. **Outlook MCP – find nye mails:**
   `outlook_email_search` med filter: modtaget siden sidste kørsel + afsender i kendt liste (standard_suppliers.email) + attachments=any.
2. **For hver mail:**
   a. Læs `message.id`, `from.email`, `receivedDateTime`, `body.content`, attachments.
   b. **Idempotens-tjek:** `SELECT id FROM project_quotes_... WHERE source_email_id = :msg_id;` → hvis findes, skip.
3. **Match supplier:** `SELECT id FROM standard_suppliers_... WHERE lower(email) = lower(:from_email)` → hvis ingen, log og skip (manuel oprettelse kræves).
4. **Match RFQ:** Claude prompter LLM med mail-body + liste af åbne RFQs for supplierens projekt-tilknytning (join over `project_rfq_suppliers`). Returnér best match `rfq_id` eller `null`.
   - Hvis ingen match: opret `project_quote` med `rfq_id=null`? Nej — schema kræver NOT NULL. I stedet: spring og flag via log + opret en "needs assignment"-entry i en (V2) `unmatched_quotes`-tabel. **V1:** skip og log.
5. **Parse linjer:** LLM udtrækker array af `{rfq_line_match, total_price, qty, unit, lead_time_days, declined}`. Matching mod RFQ-linjer sker via `name`-similarity.
6. **Upload PDF (hvis attachment):** Supabase Storage upload → `pdf_url`.
7. **INSERT project_quote** (service_role key):
   ```sql
   INSERT INTO project_quotes_2026_04_23_10_00
     (rfq_id, supplier_id, status, received_at, source_email_id, source_email_received_at,
      raw_source_text, needs_review, created_by, pdf_url, pdf_filename)
   VALUES (:rfq, :supp, 'received', :received, :msg_id, :received_ts,
           :body, true, 'claude_auto', :pdf_url, :pdf_name)
   ON CONFLICT (source_email_id) DO NOTHING
   RETURNING id;
   ```
8. **INSERT project_quote_lines** for hver matched linje (kun for linjer LLM'en er sikker på; usikre markeres som tom).
9. **Post-hook:** Sæt `project_rfq_suppliers.invite_status = 'responded'`.
10. **Partial match (3 af 5 linjer):** De 2 ikke-matchede RFQ-linjer forbliver uden quote_line på den quote. UI'en viser "Manglende pris" for de 2 linjer. Reviewer kan manuelt tilføje.
11. **Ingen RFQ-match:** Log i `raw_source_text` + ekstern Claude-log. Reviewer kan senere manuelt oprette quote med linket.

**Done when:** Samme mail to gange = ingen dublet; `needs_review=true` på auto-oprettet quote; reviewer kan se raw body.

### W4 – Tildel leverandør(er) — inkl. split-ordre

1. På RFQ-detalje: fane "Sammenlign".
2. Matrix-view: rækker = RFQ-linjer, kolonner = quotes (én pr. supplier). Celle = `total_price` + lead_time. Farvekode laveste pris pr. linje.
3. Bruger klikker "Tildel" pr. linje:
   - Radiobutton på quote_line → markerer den valgte som "vinder" (nyt felt i UI, ikke DB).
   - Split er default tilladt: forskellige linjer kan tildeles forskellige suppliers.
4. Når alle linjer er tildelt (eller bruger trykker "Færdig"):
   - For hver vindende quote: `UPDATE project_quotes SET status = 'selected' WHERE id = :id`.
   - For resterende quotes på samme RFQ: `UPDATE project_quotes SET status = 'lost'`.
   - `UPDATE project_rfqs SET status = 'awarded'`.
5. **V2 (ikke V1):** Auto-generér `purchase_orders_2026_01_15_06_45` pr. vindende supplier med de relevante linjer. I V1 gør brugeren dette manuelt.

**Done when:** Én RFQ kan have 2+ quotes med status `selected` (split); taberne er `lost`; RFQ er `awarded`.

### W5 – Luk RFQ

Tre stier:

- **Normal afslutning:** Alle suppliers har svaret ELLER deadline passeret → RFQ status → `closed` (hvis ingen tildeling) eller `awarded` (hvis tildelt). Tabte quotes: `lost`.
- **Cancel:** Bruger trykker "Annullér" → bekræftelse → RFQ → `cancelled`, alle quotes uberørte (historik). Suppliers der ikke har svaret: `invite_status='no_response'`.
- **Re-open:** Kun fra `closed` → `sent`. Fra `awarded` eller `cancelled` er det låst (opret ny RFQ).

Status-flow:
```
draft → sent → partially_received → (closed | awarded | cancelled)
       ↘ cancelled
```

---

## 5. UI/Komponentplan

### 5.1 Routes (React Router, hash routing)

```
#/purchasing                      → PurchasingOverview (NY)
#/purchasing/rfq/new              → RFQCreate (NY — step-dialog inline eller egen side)
#/purchasing/rfq/:rfqId           → RFQDetail (NY)
#/purchasing/rfq/:rfqId/compare   → RFQCompare (NY)
#/purchasing/review               → QuoteReviewQueue (NY — kun quotes med needs_review=true)
```

Erstatter delvist `/price-requests` og `/price-requests/:id` (læg redirect fra gamle ruter til nye).

### 5.2 Komponenttræ i `src/features/purchasing/`

```
src/features/purchasing/
├── index.ts                          -- public exports
├── PurchasingContext.tsx             -- NY provider (8. provider), CRUD + realtime
├── hooks/
│   ├── useRfqs.ts                    -- list, filter, søg
│   ├── useRfq.ts                     -- én RFQ m. linjer + suppliers + quotes
│   └── useQuoteReview.ts             -- needs_review queue
├── pages/
│   ├── PurchasingOverview.tsx        -- liste over alle RFQs, filtre
│   ├── RFQCreate.tsx                 -- step-1-2-3 wizard
│   ├── RFQDetail.tsx                 -- header + faner: Linjer | Leverandører | Sammenlign | Historik
│   ├── RFQCompare.tsx                -- matrix-sammenligning + tildel
│   └── QuoteReviewQueue.tsx          -- liste + inline-godkend
├── components/
│   ├── RFQListTable.tsx
│   ├── RFQHeaderCard.tsx
│   ├── RFQLinesTable.tsx             -- editable in RFQCreate, read-only i Detail
│   ├── RFQSuppliersTable.tsx
│   ├── QuoteInputDialog.tsx          -- W2: manuelt svar
│   ├── QuoteComparisonMatrix.tsx     -- W4
│   ├── QuoteReviewCard.tsx           -- W3: godkend auto-parse
│   ├── AttachmentUploader.tsx        -- Supabase Storage PDF
│   └── SupplierPickerDialog.tsx      -- multi-select fra standard_suppliers
└── lib/
    ├── rfqApi.ts                     -- Supabase calls
    ├── quoteApi.ts
    ├── storageApi.ts                 -- PDF upload/download signed URL
    └── statusTransitions.ts          -- validering af status-flow
```

### 5.3 Side-layouts (tekstbeskrivelser)

**PurchasingOverview.tsx**
- Topbar: projekt-selector (fra ProjectContext), knap "Ny prisforespørgsel", filter-chips (status, deadline passeret, needs_review-badge m. count).
- Hovedtabel: kolonner = Titel, #Linjer, #Leverandører svaret / total, Deadline, Status, Oprettet af (ikon: human / claude), Handlinger.
- Højrepanel (kollapsbart): "Kræver gennemsyn" — liste af quotes med `needs_review=true` på tværs af RFQs.

**RFQDetail.tsx**
- Header-card: titel, projekt, status-badge, deadline, oprettet-af, knapper [Redigér | Annullér | Luk].
- Fane 1 "Linjer": `RFQLinesTable` read-only; status per linje (ikke prissat / pris fra n/m leverandører / tildelt til).
- Fane 2 "Leverandører": `RFQSuppliersTable` — tilføj flere, send påmindelse, status-badges, "Registrér svar"-knap → `QuoteInputDialog`.
- Fane 3 "Sammenlign": link til `/purchasing/rfq/:id/compare`.
- Fane 4 "Historik": audit log (V2 — i V1 bare `created_at`/`updated_at`).

**RFQCompare.tsx**
- Matrix: rækker = rfq_lines, kolonner = quotes. Celle = total_price + lead_time. Laveste pris pr. række er grøn. Radio-button pr. celle for tildeling.
- Nederst: "Tildelings-sammendrag": forventet total cost, fordeling pr. supplier, knap "Bekræft tildeling".

**QuoteReviewQueue.tsx**
- Kort pr. quote: supplier, RFQ-titel, raw_source_text preview, PDF-preview hvis tilknyttet, editable felter, knap [Godkend] [Afvis].

### 5.4 Dialog-specifikationer

**`QuoteInputDialog`**
- Props: `rfqId`, `supplierId`, `mode: 'manual' | 'review'`, `initialData?: Quote`.
- Felter: received_at, valid_until, currency, payment_terms, delivery_terms, total_price, notes, pdf-uploader.
- Linje-tabel (readonly rfq-linje + editable: qty, unit, total_price, declined, alternative, notes).
- Validering (Zod): total_price >= 0, qty > 0 hvis ikke declined.
- Submit: upsert quote + batch-upsert quote_lines. I `review`-mode: sæt `needs_review=false`, `reviewed_by=email`, `reviewed_at=now`.

**`RFQCreateWizard`**
- 3 steps (ikke URL-separerede, bare lokal state).
- Kan ikke gå til step 2 uden titel. Kan ikke gemme uden ≥1 linje og ≥1 leverandør.

**`SupplierPickerDialog`**
- Multi-select fra `standard_suppliers` filtreret `status='Aktiv'`.
- Søg på navn.
- Snapshot-felter: ved valg kopieres `email`, `contact_person` ind som editable defaults.

### 5.5 PurchasingContext (8. provider)

Mount placeres som innerste provider i `App.tsx`, efter `ProjectProductsProvider`:

```tsx
<ProjectContext>
  <StandardSuppliersProvider>
    <StandardMaterialsProvider>
      <ProjectMaterialsProvider>
        <PurchaseOrdersProvider>
          <TransportProvider>
            <ProjectProductsProvider>
              <PurchasingProvider>   {/* NY */}
                <App />
              </PurchasingProvider>
            </ProjectProductsProvider>
          </TransportProvider>
        </PurchaseOrdersProvider>
      </ProjectMaterialsProvider>
    </StandardMaterialsProvider>
  </StandardSuppliersProvider>
</ProjectContext>
```

State:
- `rfqs: Rfq[]` (loaded når activeProject ændres)
- `activeRfq: RfqWithRelations | null`
- `reviewQueue: Quote[]` (alle med needs_review=true på aktuelt projekt)
- CRUD: `createRfq`, `updateRfq`, `addRfqLine`, `removeRfqLine`, `inviteSupplier`, `submitQuote`, `assignWinners`, `closeRfq`.
- Realtime subscription på alle 5 tabeller filtreret `project_id=activeProject.id`.

---

## 6. Automation-integration (Claude Desktop)

### 6.1 Arkitektur

```
Claude Desktop
  ├─ Outlook MCP    → læs indbakke
  └─ Supabase MCP   → upsert quotes/quote_lines + Storage upload
```

Claude Desktop kører med en **prompt** (kan automatiseres via `loop`-skill eller cron i Desktop). Service_role key i Supabase MCP → bypass RLS.

### 6.2 Prompt-eksempel til Claude Desktop

```
Du er indkøbs-assistent for NemInventar. Kør denne rutine nu:

1. Hent alle mails i min Outlook-indbakke modtaget de sidste 24 timer
   fra afsendere der findes i standard_suppliers_2026_01_15_06_45.email.
2. For hver mail:
   a. Tjek om source_email_id = <message.id> allerede findes i
      project_quotes_2026_04_23_10_00. Hvis ja: spring over.
   b. Identificér afsenderens supplier_id.
   c. List alle åbne RFQs (status in ('sent','partially_received')) for
      projekter hvor denne supplier er inviteret (join via rfq_suppliers).
   d. Analysér mail-indhold + PDF-attachments og vælg den RFQ mailen
      besvarer. Hvis tvivl → skip og rapportér i slutsummary.
   e. Udtræk pris pr. linje. Match mod rfq_lines via navn-similarity.
   f. Upload evt. PDF til storage bucket rfq-attachments-2026-04-23
      og få signed URL.
   g. INSERT project_quotes med needs_review=true, created_by='claude_auto',
      source_email_id=<msg.id>. Brug ON CONFLICT (source_email_id) DO NOTHING.
   h. INSERT project_quote_lines for hver matched rfq_line. total_price
      er primær; unit_price beregnes automatisk af DB.
   i. UPDATE project_rfq_suppliers SET invite_status='responded'.
3. Giv summary: X mails scannet, Y quotes oprettet, Z skippet (årsag).
```

### 6.3 Idempotens

- `project_quotes.source_email_id UNIQUE` — `ON CONFLICT DO NOTHING` garanterer ingen dubletter.
- Re-kørsel er sikker selv hvis Claude Desktop køres hver 15. minut.
- Genparse samme mail: kræver manuel `DELETE` af quote (eller `needs_review`-reset flow — V2).

### 6.4 Partial match (3 varer i mail, 5 linjer i RFQ)

- De 3 matchede linjer får quote_line-rækker.
- De 2 ikke-matchede har intet quote_line = vises i UI som "Ikke prissat af denne leverandør".
- Reviewer kan manuelt tilføje et `declined=true` quote_line hvis det er korrekt.

### 6.5 Ingen RFQ-match

- V1: skip mailen, log beslutningen i slutsummary. Ingen DB-ændring.
- V2: opret en "unmatched_quotes"-indboks hvor mennesket tilknytter.

### 6.6 Review UI

- `/purchasing/review` viser alle quotes med `needs_review=true` på tværs af RFQs på aktivt projekt.
- Hver card: supplier, RFQ-titel, raw_source_text, PDF-thumbnail, quote_lines editable.
- Handlinger:
  - **Godkend**: `UPDATE ... SET needs_review=false, reviewed_by=<user.email>, reviewed_at=now()`.
  - **Afvis**: `DELETE` quote + lines (cascade).
  - **Rediger og godkend**: åbn `QuoteInputDialog` i `mode='review'`.
- Badge på sidebar: `SELECT count(*) FROM project_quotes WHERE needs_review` pr. projekt.

---

## 7. Prioritering – V1 / V2 / V3

### V1 – skal med i første release

- [ ] Migration-SQL kørt (5 tabeller + indexes + RLS + triggers)
- [ ] Storage bucket + policies oprettet
- [ ] Backfill af 1+2 eksisterende rækker
- [ ] Rename legacy-tabeller til `_legacy`
- [ ] `PurchasingContext` provider wired i `App.tsx`
- [ ] Routes registreret (`/purchasing`, `/purchasing/rfq/:id`, `/purchasing/rfq/new`, `/purchasing/rfq/:id/compare`, `/purchasing/review`)
- [ ] `PurchasingOverview` – RFQ-liste med filtre
- [ ] `RFQCreateWizard` – 3 steps (header, linjer fra project_materials, leverandører)
- [ ] `RFQDetail` med faner Linjer + Leverandører
- [ ] `QuoteInputDialog` – manuelt svar W2
- [ ] `RFQCompare` + `assignWinners` – W4 med split-support
- [ ] Luk/cancel RFQ – W5
- [ ] `source_email_id UNIQUE` + `needs_review` + `pdf_url` kolonner (infrastruktur for automation)
- [ ] `QuoteReviewQueue` side — kan være tom i starten
- [ ] Danske labels gennemgående

### V2 – efter V1 er i drift

- [ ] Claude Desktop auto-parse prompt testet mod rigtige leverandør-mails
- [ ] Auto-generer `purchase_orders` fra tildelte quotes
- [ ] Send RFQ-mail via Outlook MCP (udgående)
- [ ] `unmatched_quotes`-tabel til ikke-matchede auto-parses
- [ ] Påmindelser til suppliers (invite_status='reminded')
- [ ] Audit-log tabel + fane "Historik"
- [ ] Snapshot-mekanisme: når quote_line bruges i et tilbud, frys prisen

### V3 – nice-to-have

- [ ] RFQ-templates pr. kategori
- [ ] Supplier-performance dashboard (svartid, hit-rate)
- [ ] CSV-eksport af sammenligning
- [ ] Bulk-invite fra tidligere RFQs
- [ ] Deadline-notifikationer

---

## 8. Åbne spørgsmål — beslut før implementering

1. **Suffix-verifikation:** Når Supabase MCP er oppe igen — er `_2026_01_15_06_45` stadig aktivt for `projects`, `standard_suppliers`, `project_materials`? (Migrationsfilerne refererer inkonsistent til `_2026_01_22_00_00` for price-tabellerne.)
2. **RLS-skærpelse:** Vi genbruger det eksisterende løse mønster (`auth.role()='authenticated'`). Skal RFQ/quotes strammes til `project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())` allerede i V1? Eller vente til resten af systemet strammes samlet?
3. **Project-material kobling på RFQ-linje:** Skal det være tvungent at en linje knyttes til et `project_material`? (Argument for: kobler indkøb til kalkulation. Argument imod: man kan have RFQ'er på ting der endnu ikke er i materialekataloget.) → Forslag: valgfri i V1.
4. **Currency pr. linje vs. quote:** I dag er currency kun på quote-niveau. Hvad hvis en leverandør priser linje 1 i DKK og linje 2 i EUR? → V1: én currency pr. quote. Afvis multi-currency.
5. **Total-mode på RFQ-siden:** Skal `project_rfq_lines` også have `total_price_hint` i stedet for `qty + unit_price_hint`? → Allerede valgt: `qty` + `budget_hint_total` (total-mode kompatibel).
6. **PDF-parse i V1?** Skal Claude også læse PDF-attachments, eller kun mail-body? → Forslag V1: kun body; PDF gemmes men parses ikke automatisk.
7. **Hvem må godkende auto-quotes?** V1: alle authenticated. V2: separat `procurement_admin` rolle.
8. **Outlook vs. Gmail MCP:** Joachim har begge. Hvilken er "kanon" for supplier-kommunikation? (Outlook-tabellen i CLAUDE.md tyder på Outlook.)
9. **Realtime-subscription:** Skal `PurchasingContext` bruge Supabase realtime (som andre providers) eller polle? → Forslag: realtime.
10. **Legacy-drop dato:** Hvornår droppes `_legacy`-tabellerne endeligt? Forslag: 2026-05-15 hvis ingen rollback-behov.

---

**Klar til implementering.** Før første migrationskørsel: verificér åbent spørgsmål #1 via `execute_sql` på tabel-suffixes.
