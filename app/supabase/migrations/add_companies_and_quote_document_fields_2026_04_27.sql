-- Tilføjer companies-tabel + felter på project_quotes til tilbuds-PDF
-- (betalingsvilkår, leveringstid, forbehold, tilbudsgiver, kunde-FK + kontakt-snapshot)
--
-- Designvalg:
--   * companies har role-flags (is_customer/is_supplier/is_partner) så samme firma
--     kan have flere roller uden duplikering.
--   * Kontaktperson på tilbud er snapshot (kan afvige fra company default).
--   * Tilbudsgiver er snapshot på tilbud (ingen users-tabel i V1).
--   * delivery_period og reservations er dedikerede kundevendte felter,
--     bevidst adskilt fra eksisterende interne notes/delivery_note.

-- 1) Companies-tabel
CREATE TABLE IF NOT EXISTS companies_2026_04_27 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cvr text,
  address_line1 text,
  address_line2 text,
  address_zip text,
  address_city text,
  default_contact_name text,
  default_contact_email text,
  default_contact_phone text,
  is_customer boolean NOT NULL DEFAULT false,
  is_supplier boolean NOT NULL DEFAULT false,
  is_partner boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE companies_2026_04_27 IS 'Firmaer (kunder, leverandører, samarbejdspartnere). Role-flags styrer hvilke ruller firmaet har.';
COMMENT ON COLUMN companies_2026_04_27.is_customer IS 'Firmaet kan modtage tilbud (kunde)';
COMMENT ON COLUMN companies_2026_04_27.is_supplier IS 'Firmaet leverer produkter/services (leverandør) - ikke samkørt med standard_suppliers i V1';
COMMENT ON COLUMN companies_2026_04_27.is_partner IS 'Samarbejdspartner (fx arkitekt, rådgiver)';

CREATE INDEX IF NOT EXISTS idx_companies_2026_04_27_is_customer ON companies_2026_04_27(is_customer) WHERE is_customer = true;
CREATE INDEX IF NOT EXISTS idx_companies_2026_04_27_name ON companies_2026_04_27(name);

ALTER TABLE companies_2026_04_27 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage companies"
  ON companies_2026_04_27
  FOR ALL
  USING (auth.role() = 'authenticated');

-- 2) Project quotes: FK til company + snapshot-felter til PDF
ALTER TABLE public.project_quotes_2026_01_16_23_00
  ADD COLUMN company_id uuid REFERENCES companies_2026_04_27(id),
  ADD COLUMN customer_contact_name text,
  ADD COLUMN payment_terms text DEFAULT 'Netto 14 dage fra fakturadato',
  ADD COLUMN delivery_period text,
  ADD COLUMN reservations text,
  ADD COLUMN created_by_name text,
  ADD COLUMN created_by_email text,
  ADD COLUMN created_by_phone text;

COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.company_id IS 'FK til kunden (companies_2026_04_27). Live lookup af firmanavn/CVR/adresse i PDF.';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.customer_contact_name IS 'Att./kontaktperson - snapshot på tilbud, kan afvige fra company default_contact_name';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.payment_terms IS 'Betalingsbetingelser vist i tilbuds-PDF (default: Netto 14 dage fra fakturadato)';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.delivery_period IS 'Kundevendt leveringstid/udførelsesperiode (fri tekst, fx "Uge 32-34, 2026"). Bevidst adskilt fra delivery_note som er intern.';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.reservations IS 'Kundevendte forbehold (fri tekst). Bevidst adskilt fra notes som kan være intern.';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.created_by_name IS 'Tilbudsgivers navn (snapshot, vises i PDF)';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.created_by_email IS 'Tilbudsgivers email (snapshot, vises i PDF)';
COMMENT ON COLUMN public.project_quotes_2026_01_16_23_00.created_by_phone IS 'Tilbudsgivers telefon (snapshot, vises i PDF)';

CREATE INDEX IF NOT EXISTS idx_project_quotes_company_id ON public.project_quotes_2026_01_16_23_00(company_id);
