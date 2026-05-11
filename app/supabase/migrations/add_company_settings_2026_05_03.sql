-- Single-row tabel til firma-indstillinger og standard-værdier på tilbud.
-- Auto-prefilles på nye tilbud (snapshot-princip — gamle tilbud påvirkes ikke).

CREATE TABLE IF NOT EXISTS public.company_settings_2026_05_03 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Firma-info (overruler hardkodet COMPANY_INFO config)
  company_name text,
  cvr text,
  address_line1 text,
  address_line2 text,
  address_zip text,
  address_city text,
  phone text,
  email text,

  -- Bank
  bank_name text,
  bank_reg_no text,
  bank_account_no text,
  bank_iban text,
  bank_bic text,

  -- Tilbuds-defaults (kopieres ind på nye tilbud ved oprettelse)
  default_payment_terms text,
  default_delivery_period text,
  default_reservations text,
  default_validity_days integer DEFAULT 30,
  default_recipient_profile text DEFAULT 'mixed',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_settings_2026_05_03 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage company settings"
  ON public.company_settings_2026_05_03
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed: Joachim's faktiske firma-info + standard-tekster fra Daginstitution Vinge
INSERT INTO public.company_settings_2026_05_03 (
  company_name, cvr,
  address_line1, address_line2, address_zip, address_city,
  phone, email,
  bank_name, bank_reg_no, bank_account_no, bank_iban, bank_bic,
  default_payment_terms,
  default_delivery_period,
  default_reservations,
  default_validity_days,
  default_recipient_profile
) VALUES (
  'Nem Inventar ApS', '45085473',
  'C/O Caspian Office Club A/S', 'Svanevej 22', '2400', 'København NV',
  '+45 20 54 14 88', 'js@neminventar.dk',
  'Merkur Andelskasse', '8401', '0005478559', 'DK7384010005478559', 'MEKUDK21',
  'Netto 14 dage fra fakturadato',
  E'8–10 uger fra godkendte produktionstegninger. Vi tager forbehold for forlænget leveringstid på ikke-lagerførte materialer og specialfarver.\n\nLevering gives gratis mod at Nem Inventar ApS må anvende projektet som reference på vores hjemmeside med billeder, samt modtage en kort skriftlig udtalelse og feedback fra kunden efter aflevering.',
  'Priserne forudsætter ordremodtagelse på samtlige poster i tilbuddet — bestilles dele separat, forbeholder vi os ret til at revidere prisen. Tilbuddet er i øvrigt afgivet på baggrund af modtagne oplysninger og projektmateriale. Evt. ændringer i antal, mål eller specifikationer kan påvirke prisen.',
  30,
  'mixed'
);
