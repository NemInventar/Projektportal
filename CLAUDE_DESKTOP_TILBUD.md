# Claude Desktop — guide til at udfylde tilbud i Nem Inventar ERP

Dette dokument er en reference for Claude Desktop (eller anden assistent med Supabase MCP-adgang) der skal udfylde eller opdatere tilbuds-felter direkte i databasen — typisk på Joachims anmodning.

---

## Setup

- **Supabase project ID:** `guhbrpektblabndqttgp`
- **Læs altid via:** `v_quotes_resolved` (har resolved_*-felter med fallback til Settings)
- **Skriv altid mod:** den underliggende tabel (`project_quotes_2026_01_16_23_00`, `project_quote_lines_2026_01_16_23_00`, eller `company_settings_2026_05_03`)
- **Sprog på alt user-facing tekst:** dansk

## Sådan finder du et bestemt tilbud

```sql
-- Find tilbud ved quote_number + projekt
SELECT q.id, q.quote_number, q.title, p.name AS project_name
FROM project_quotes_2026_01_16_23_00 q
JOIN projects_2026_01_15_06_45 p ON p.id = q.project_id
WHERE p.name ILIKE '%mørkhøj%' AND q.quote_number = 'T02';
```

Brug det returnerede `id` i alle efterfølgende UPDATEs.

---

## Vigtige adfærdsregler

### Lås-state (`is_locked`)
- `is_locked = true` → tilbuddet er read-only. **Skriv ikke til et låst tilbud uden eksplicit instruktion.**
- Status `'sent'` triggerer auto-lock via DB-trigger.
- Lås op først hvis du skal redigere et låst tilbud:
  ```sql
  UPDATE project_quotes_2026_01_16_23_00 SET is_locked = false WHERE id = '<uuid>';
  ```

### Live mod Settings (NULL = brug company_settings.default_*)
Disse felter på et tilbud er nullable og falder tilbage til defaults i Settings hvis ikke sat:
- `payment_terms` → fallback: `default_payment_terms`
- `delivery_period` → fallback: `default_delivery_period`
- `reservations` → fallback: `default_reservations`
- `recipient_profile` → fallback: `default_recipient_profile`
- `payment_terms_template` → fallback: `default_payment_terms_template` → fallback hardcoded `'50_50_levering'`

**Vigtigt:** Hvis brugeren beder om at ændre standardteksten for *alle* tilbud, opdater i `company_settings_2026_05_03`. Hvis kun ét tilbud, opdater på selve quote-rækken (override).

For at "nulstille til standard" på et tilbud → sæt feltet til NULL (det trækker så fra Settings igen).

### Snapshot ved låsning
Når `is_locked` skifter false→true, snapshotter en DB-trigger NULL-felter fra Settings ind i quote-rækken. Det betyder: efter låsning er felterne ikke længere live — de er frosne kopier.

### `special_reservations` er user-only
Kolonnen røres aldrig automatisk af systemet. Ren brugerdata. Kombineres med `reservations` (eller default) i view'et som `resolved_reservations`.

---

## Tabel: `project_quotes_2026_01_16_23_00`

### Identitet og status
| Kolonne | Type | Hvor i UI | Effekt |
|---|---|---|---|
| `id` | uuid | — | Primary key |
| `project_id` | uuid FK | (auto fra projektet) | Hvilket projekt tilbuddet hører til |
| `quote_number` | text | "Tilbudsnr." | Vises på PDF (fx "T02") |
| `title` | text | Heading + PDF-titel | Tilbuddets titel |
| `status` | text | Status-dropdown i Tilbudsdetaljer | `draft` / `sent` / `accepted` / `rejected` / `archived`. Skift til `'sent'` udløser auto-lock |
| `is_locked` | bool | Lås-banner + knap | Read-only når `true` |
| `locked_at` | timestamptz | Lås-banner | Sættes automatisk af trigger |
| `sent_at` | timestamptz | "Sendt dato"-felt | Sættes automatisk når status='sent' |
| `quote_date` | date | "Tilbudsdato" (Vilkår-fane) | Vises på PDF som "Dato:". NULL = brug `created_at` |
| `valid_until` | date | "Gyldig til" (Vilkår-fane) | Vises på PDF som "Gyldigt til:" |

### Kunde + modtager (FK + text fallback)
| Kolonne | Type | Hvor i UI | Effekt |
|---|---|---|---|
| `company_id` | uuid FK → companies | "Firma" (Detaljer-fane) | Bestemmer kunde på PDF |
| `recipient_contact_id` | uuid FK → crm_contacts | "Modtager-kontakt" | Bestemmer "Att."-linje på PDF |
| `customer_contact_name` | text | "Eller skriv ad-hoc att.-tekst" | Override hvis ingen FK |
| `recipient_profile` | text | "Modtager-profil" | Styrer tone på AI-genererede levende beskrivelser. Værdier: `architect` / `contractor` / `enduser` / `mixed` |
| `recipient_notes` | text | "Noter om modtager" | Intern note brugt af AI-prompts |

### Tilbudsgiver (FK + text fallback)
| Kolonne | Type | Hvor i UI | Effekt |
|---|---|---|---|
| `created_by_employee_id` | uuid FK → employees | "Hurtigvalg medarbejder" | Bestemmer afsender-info på PDF (live join) |
| `created_by_name` / `_email` / `_phone` | text | (auto-fyldes fra dropdown) | Fallback / snapshot |

### Tilbuds-PDF tekster (live mod Settings)
| Kolonne | Type | Hvor i UI | Effekt |
|---|---|---|---|
| `intro_text` | text | "Tilbudsindledning" (Tilbuds-PDF-fane) | Vises øverst på PDF som intro. NULL = standardtekst |
| `notes` | text | "Bemærkninger" (Tilbuds-PDF-fane) | Renderes som "Bemærkninger"-sektion på PDF |
| `payment_terms` | text | "Betalingsbetingelser" | Fakturafrist (fx "Netto 14 dage"). Live mod Settings |
| `delivery_period` | text | "Leveringstid" | Live mod Settings |
| `delivery_note` | text | "Leveringsnoter" (Metadata-card) | Vises på PDF i Vilkår |
| `reservations` | text | "Standardforbehold" | Live mod Settings |
| `special_reservations` | text | "Projektspecifikke forbehold" | Brugerens, røres aldrig |
| `payment_terms_template` | text | "Betalingsplan"-dropdown | Værdier: `'50_50_levering'`, `'40_60'`, `'30_70'`, `'20_80'`, `'per_levering'`, `'custom'`. Live mod Settings |

### Bilags-PDF
| Kolonne | Type | Hvor i UI | Effekt |
|---|---|---|---|
| `appendix_intro_text` | text | "Bilag-indledning" (Bilags-PDF-fane) | Vises på cover af bilags-PDF. NULL = standardtekst |

---

## Tabel: `project_quote_lines_2026_01_16_23_00`

Linjer (poster) på et tilbud. Hver linje rendres på PDF som en række.

| Kolonne | Type | Hvor i UI | Effekt |
|---|---|---|---|
| `title` | text | "Titel" i linje-edit-dialog | Linjens titel — vises i tabel + bilag-cover |
| `description` | text | "Linje-tekst (tilbuds-PDF)" i linje-edit-dialog | Kort kontekst — vises under titel i *tilbuds-PDF*. Bruges IKKE i bilag |
| `technical_spec` | text | "Teknisk spec (bilags-PDF)" | Tal-tunge specs (mål, materialer, certificeringer) — vises i højre kolonne på *bilags-PDF*. Linjeskift bevares |
| `living_description` | text | (genereres via AI-knap) | Narrativ — vises i venstre kolonne på bilags-PDF som "Beskrivelse" |
| `quantity` | numeric | "Antal" | Antal enheder |
| `unit` | text | "Enhed" | Fx 'stk', 'palle', 'time' |
| `include_in_appendix` | bool | Eye/EyeOff-toggle pr. linje | Default `true`. False = linjen kommer ikke med i bilags-PDF |
| `archived` | bool | "Arkivér"-knap | True = linjen vises ikke længere i tilbuddet |
| `display_order` | int | Drag-and-drop | Sorterer linjer på PDF |

**Tre tekstfelter pr. linje med distinkte formål:**
- `description` → kort kontekst i tilbuds-PDF (under titel). Hold den kort.
- `technical_spec` → tal-tungt spec-blok i bilags-PDF højre kolonne. Bullet-stil med dimensioner, materialer, finish, certificering, det inkluderede.
- `living_description` → narrativ tekst i bilags-PDF venstre kolonne. Sansebåren, ingen tal. Genereres via AI-knap, kan redigeres af brugeren.

---

## Tabel: `company_settings_2026_05_03` (singleton)

Én row med firma-defaults. Ændringer her påvirker alle ulåste tilbud uden override øjeblikkeligt.

| Kolonne | Effekt |
|---|---|
| `company_name` / `cvr` / `address_*` / `phone` / `email` | Vises som afsender på PDF |
| `bank_*` | Bank-info (vises på PDF / faktura senere) |
| `default_payment_terms` | Default fakturafrist |
| `default_delivery_period` | Default leveringstid |
| `default_reservations` | Default standardforbehold |
| `default_validity_days` | Bruges ved oprettelse til at sætte `valid_until` |
| `default_recipient_profile` | Default modtager-profil |
| `default_payment_terms_template` | Default Betalingsplan-template |

---

## Almindelige opgaver

### 1. Skift en tekst på ét tilbud
```sql
UPDATE project_quotes_2026_01_16_23_00
SET intro_text = 'Den nye intro-tekst...'
WHERE id = '<uuid>';
```

### 2. Skift et tilbuds afsender (medarbejder)
```sql
UPDATE project_quotes_2026_01_16_23_00
SET created_by_employee_id = (SELECT id FROM employees WHERE email = 'js@neminventar.dk')
WHERE id = '<uuid>';
```
Tekst-fallback (`created_by_name/email/phone`) opdateres automatisk når brugeren næste gang åbner tilbuddet i UI'et — eller du kan skrive dem manuelt for sikkerheds skyld.

### 3. Skift firma-default for alle tilbud
```sql
UPDATE company_settings_2026_05_03
SET default_payment_terms = 'Netto 30 dage fra fakturadato';
```
Alle ulåste tilbud uden override skifter øjeblikkeligt. Låste tilbud beholder deres snapshot.

### 4. Reset et felt til "live mod Settings"
```sql
UPDATE project_quotes_2026_01_16_23_00
SET payment_terms = NULL
WHERE id = '<uuid>';
```

### 5. Skjul en linje fra bilag (fx Transport)
```sql
UPDATE project_quote_lines_2026_01_16_23_00
SET include_in_appendix = false
WHERE project_quote_id = '<quote_uuid>'
  AND title ILIKE '%transport%';
```

### 6. Lås et tilbud op for at redigere
```sql
UPDATE project_quotes_2026_01_16_23_00
SET is_locked = false
WHERE id = '<uuid>';
```
Tekstfelter forbliver som de er (snapshot bevaret). Brug "Reset til standard" pr. felt hvis du vil have et felt tilbage til live.

### 7. Læs et tilbud med alle resolved-felter
```sql
SELECT * FROM v_quotes_resolved WHERE id = '<uuid>';
```
Returnerer både råfelter (`payment_terms`) og resolved-felter (`resolved_payment_terms`) plus joins til company / contact / employee.

---

## Hvad du IKKE må gøre

- **Skriv aldrig direkte til `v_quotes_resolved`** — det er et view, kun til SELECT
- **Skriv aldrig til `full_name` på `employees`** — den er GENERATED ALWAYS (computed fra first_name + last_name)
- **Slet aldrig et tilbud** uden eksplicit instruktion. Brug i stedet `status='archived'` eller `archived=true` på linjer
- **Ændr aldrig `created_at`** medmindre brugeren beder om det specifikt. Brug `quote_date` til at overstyre datoen på PDF
- **Mass-mutér aldrig** uden at vise en `SELECT COUNT(*) WHERE ...` først så brugeren kan godkende omfanget

---

## Hvis du er i tvivl

Spørg brugeren før du skriver. Det er bedre at spørge "Skal jeg ændre intro_text på det specifikke tilbud, eller er det default_quote_intro for alle nye tilbud du mener?" end at gætte forkert.

UI'et viser kolonne-navne i parentes efter hver label (fx `Tilbudsindledning (intro_text)`), så brugeren kan referere til specifikke felter når han beder dig om at ændre noget.
