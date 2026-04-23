/**
 * Storage API — PDF/attachment-upload til Supabase Storage.
 *
 * Bucket: `rfq-attachments-2026-04-23` (bindestreger — Supabase tillader ikke
 * underscore i bucket-id).
 *
 * Filnavn-mønster: `{quoteId}/{originalFilename}` så uploads fra samme quote
 * ligger sammen og ikke kolliderer med andre quotes.
 */

import { supabase } from '@/integrations/supabase/client';
import { RFQ_ATTACHMENTS_BUCKET } from '../types';

export interface UploadResult {
  /** Public eller signed URL til filen (brug `getSignedUrl` for læse-adgang). */
  url: string;
  /** Originalt filnavn fra brugerens disk (gemmes i Quote.pdf_filename). */
  filename: string;
  /** Path i bucket — ofte det vi gemmer i DB frem for URL for at kunne re-signe. */
  path: string;
}

/**
 * Sanitér et filnavn: fjern slashes og backslashes, bevar resten.
 * Supabase accepterer unicode, men path-separatorer skal ryddes af.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/]/g, '_');
}

/**
 * Upload en PDF/billede til bucket'en. Bruger `upsert: true` så re-parse
 * af samme mail overskriver filen frem for at fejle.
 *
 * Returnerer `url` via getPublicUrl — bucket'en er dog privat, så
 * til læsning skal `getSignedUrl(path)` bruges i UI'et. `path` er derfor
 * den værdi der bør gemmes som `pdf_url` i DB (eller man gemmer URL'en
 * direkte; plan'en bruger `pdf_url` som text så begge virker).
 */
export async function uploadQuotePdf(
  quoteId: string,
  file: File,
): Promise<UploadResult> {
  const filename = sanitizeFilename(file.name);
  const path = `${quoteId}/${filename}`;

  const { error } = await supabase.storage
    .from(RFQ_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });

  if (error) throw error;

  // Public URL virker kun hvis bucket er public. Vi returnerer den alligevel
  // som "identifikator" — UI'en bør signe via getSignedUrl før download.
  const { data: publicData } = supabase.storage
    .from(RFQ_ATTACHMENTS_BUCKET)
    .getPublicUrl(path);

  return {
    url: publicData.publicUrl,
    filename: file.name,
    path,
  };
}

/**
 * Generér en tidsbegrænset signed URL til download/preview af en fil.
 * `path` er `{quoteId}/{filename}` som returneret af `uploadQuotePdf`.
 * Default: 1 time.
 */
export async function getSignedUrl(
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RFQ_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Kunne ikke generere signed URL');
  return data.signedUrl;
}
