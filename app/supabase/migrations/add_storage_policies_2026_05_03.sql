-- RLS-policies for storage-buckets der bruges af tilbuds-billeder.
-- Authenticated users må læse/uploade/slette objects i de tre buckets.
--
-- Buckets antages at være oprettet og public allerede.
-- Hvis de IKKE er oprettet, kør først:
--   INSERT INTO storage.buckets (id, name, public) VALUES
--     ('quote-renders', 'quote-renders', true),
--     ('quote-custom-images', 'quote-custom-images', true),
--     ('quote-render-refs', 'quote-render-refs', true);

-- ─── quote-custom-images (manuel upload fra GUI) ────────────────────────────
DROP POLICY IF EXISTS "auth_read_quote_custom_images" ON storage.objects;
CREATE POLICY "auth_read_quote_custom_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-custom-images');

DROP POLICY IF EXISTS "auth_insert_quote_custom_images" ON storage.objects;
CREATE POLICY "auth_insert_quote_custom_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-custom-images');

DROP POLICY IF EXISTS "auth_update_quote_custom_images" ON storage.objects;
CREATE POLICY "auth_update_quote_custom_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-custom-images');

DROP POLICY IF EXISTS "auth_delete_quote_custom_images" ON storage.objects;
CREATE POLICY "auth_delete_quote_custom_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quote-custom-images');

-- ─── quote-renders (AI-genererede, læses af GUI, skrives af edge function) ──
DROP POLICY IF EXISTS "auth_read_quote_renders" ON storage.objects;
CREATE POLICY "auth_read_quote_renders"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-renders');

-- ─── quote-render-refs (referencebilleder uploadet fra GUI) ─────────────────
DROP POLICY IF EXISTS "auth_read_quote_render_refs" ON storage.objects;
CREATE POLICY "auth_read_quote_render_refs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-render-refs');

DROP POLICY IF EXISTS "auth_insert_quote_render_refs" ON storage.objects;
CREATE POLICY "auth_insert_quote_render_refs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-render-refs');

DROP POLICY IF EXISTS "auth_update_quote_render_refs" ON storage.objects;
CREATE POLICY "auth_update_quote_render_refs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-render-refs');

DROP POLICY IF EXISTS "auth_delete_quote_render_refs" ON storage.objects;
CREATE POLICY "auth_delete_quote_render_refs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quote-render-refs');
