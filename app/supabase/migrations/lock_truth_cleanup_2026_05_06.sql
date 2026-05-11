-- DB-cleanup til "is_locked = sandhed for redigerbarhed".
--
-- Beslutninger:
--   1. Drop default på payment_terms — så NULL = "live mod company_settings" virker for nye rækker.
--   2. Behold auto-lock på status='sent' (handle_quote_status_change). Brugeren kan låse op manuelt
--      hvis hun skal lave ændringer efter afsendelse.
--   3. special_reservations er user-only — aldrig touched af systemet. View'et kombinerer
--      standardforbehold + special ved rendering, uanset lock-state. Triggeren folder
--      IKKE special ind i reservations længere → ingen double-append-bug, ingen nulstilling.
--   4. Snapshot-logikken i freeze-trigger forenkles: snapshot kun de tre standard-tekstfelter.
--
-- Effekt på eksisterende data:
--   - Rækker med 'Netto 14 dage fra fakturadato' i payment_terms beholder værdien (override).
--     For at få live: tryk "Reset til standard" i UI (sætter feltet til NULL).
--   - Ingen ændringer på låste rækker.

------------------------------------------------------------------
-- 1. Drop default på payment_terms
------------------------------------------------------------------
ALTER TABLE public.project_quotes_2026_01_16_23_00
  ALTER COLUMN payment_terms DROP DEFAULT;

------------------------------------------------------------------
-- 2. Forenkl freeze-trigger:
--    - Snapshot kun standard-tekstfelter (payment_terms, delivery_period, reservations)
--    - Rør IKKE special_reservations (den er user-only)
--    - Sæt locked_at ved lock, ryd locked_at ved unlock
--
-- Trigger udvides til BEFORE UPDATE (ikke kun OF is_locked) så unlock-pathen altid fyrer.
------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_freeze_quote_on_lock
  ON public.project_quotes_2026_01_16_23_00;

CREATE OR REPLACE FUNCTION public.freeze_quote_texts_on_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  cs RECORD;
BEGIN
  -- Lock: false/NULL → true. Snapshot live tekstfelter til override-kolonner.
  IF (OLD.is_locked = false OR OLD.is_locked IS NULL) AND NEW.is_locked = true THEN
    SELECT * INTO cs FROM public.company_settings_2026_05_03 LIMIT 1;

    IF NEW.payment_terms IS NULL THEN
      NEW.payment_terms := cs.default_payment_terms;
    END IF;

    IF NEW.delivery_period IS NULL THEN
      NEW.delivery_period := cs.default_delivery_period;
    END IF;

    IF NEW.reservations IS NULL THEN
      NEW.reservations := cs.default_reservations;
    END IF;

    -- special_reservations røres ikke — den er brugerens og forbliver i sin egen kolonne.

    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := now();
    END IF;
  END IF;

  -- Unlock: true → false. Ryd locked_at. Tekstfelter forbliver som de er.
  IF OLD.is_locked = true AND NEW.is_locked = false THEN
    NEW.locked_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_freeze_quote_on_lock
  BEFORE UPDATE ON public.project_quotes_2026_01_16_23_00
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_quote_texts_on_lock();

COMMENT ON FUNCTION public.freeze_quote_texts_on_lock()
IS 'Snapshotter standard tekstfelter (payment_terms, delivery_period, reservations) ved låsning. Rør ikke special_reservations. Rydder locked_at ved oplåsning.';

------------------------------------------------------------------
-- 3. Opdatér v_quotes_resolved:
--    resolved_reservations kombinerer altid standard + special, uanset lock-state.
--    Standard = override (q.reservations) hvis sat, ellers default (cs.default_reservations).
--    Special tilføjes med "\n\n" hvis sat.
------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_quotes_resolved AS
SELECT
  q.id,
  q.project_id,
  q.quote_number,
  q.title,
  q.status,
  q.valid_until,
  q.notes,
  q.created_at,
  q.updated_at,
  q.next_delivery_date,
  q.delivery_note,
  q.next_action,
  q.owner_user_id,
  q.priority,
  q.sent_at,
  q.version_no,
  q.is_locked,
  q.locked_at,
  q.cached_sell_total,
  q.include_in_project_total,
  q.company_id,
  q.customer_contact_name,
  q.payment_terms,
  q.delivery_period,
  q.reservations,
  q.created_by_name,
  q.created_by_email,
  q.created_by_phone,
  q.legacy_quote_number,
  q.recipient_profile,
  q.recipient_notes,
  q.special_reservations,

  COALESCE(q.payment_terms, cs.default_payment_terms) AS resolved_payment_terms,
  COALESCE(q.delivery_period, cs.default_delivery_period) AS resolved_delivery_period,

  -- Standard-del + special (hvis sat). Altid samme regel — uanset lock.
  CASE
    WHEN q.special_reservations IS NOT NULL AND q.special_reservations <> '' THEN
      COALESCE(q.reservations, cs.default_reservations, '') || E'\n\n' || q.special_reservations
    ELSE
      COALESCE(q.reservations, cs.default_reservations)
  END AS resolved_reservations,

  COALESCE(q.recipient_profile, cs.default_recipient_profile) AS resolved_recipient_profile,

  (q.payment_terms IS NULL AND q.delivery_period IS NULL AND q.reservations IS NULL) AS uses_company_defaults

FROM public.project_quotes_2026_01_16_23_00 q
CROSS JOIN LATERAL (
  SELECT * FROM public.company_settings_2026_05_03 LIMIT 1
) cs;
