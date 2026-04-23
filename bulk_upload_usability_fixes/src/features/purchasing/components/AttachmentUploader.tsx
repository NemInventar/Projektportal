/**
 * AttachmentUploader — PDF-upload til Supabase Storage.
 *
 * Bruger `storageApi.uploadQuotePdf`. Viser filnavn + download-link når
 * filen er uploadet. Max 50 MB (matcher bucket-limit).
 *
 * Accept: application/pdf, image/png, image/jpeg (matcher bucket-policy).
 *
 * Props:
 *   - quoteId: hvilken quote skal filen hænge på (bruges som path-prefix).
 *              Hvis quote endnu ikke er oprettet, kan en midlertidig id bruges.
 *   - initialUrl / initialFilename: vis eksisterende fil.
 *   - onUploaded({url, filename, path}): callback når upload er lykkedes.
 *   - onCleared(): callback når brugeren fjerner filen.
 */
import React, { useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getSignedUrl,
  uploadQuotePdf,
  type UploadResult,
} from '../lib/storageApi';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ACCEPTED = 'application/pdf,image/png,image/jpeg';

export interface AttachmentUploaderProps {
  quoteId: string;
  /** Nuværende pdf_url (kan være full URL eller path). */
  initialUrl?: string | null;
  initialFilename?: string | null;
  /** Kaldes når en ny fil er uploadet. */
  onUploaded: (result: UploadResult) => void;
  /** Kaldes hvis brugeren fjerner filen (vi nulstiller bare UI-state — DB ryddes af consumer). */
  onCleared?: () => void;
  disabled?: boolean;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  quoteId,
  initialUrl,
  initialFilename,
  onUploaded,
  onCleared,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [filename, setFilename] = useState<string | null>(
    initialFilename ?? null,
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast({
        title: 'Fil er for stor',
        description: 'Maks. 50 MB pr. fil.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const result = await uploadQuotePdf(quoteId, file);
      setUrl(result.url);
      setFilename(result.filename);
      onUploaded(result);
      toast({ title: 'Fil uploadet', description: result.filename });
    } catch (err) {
      console.error('[AttachmentUploader] upload fejlede:', err);
      toast({
        title: 'Upload fejlede',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleOpen = async () => {
    if (!url) return;
    // Hvis url allerede er en fuld http(s)-URL, brug den direkte; ellers
    // antages den at være en path i bucket'en — generer en signed URL.
    try {
      if (url.startsWith('http')) {
        window.open(url, '_blank', 'noopener');
        return;
      }
      const signed = await getSignedUrl(url);
      window.open(signed, '_blank', 'noopener');
    } catch (err) {
      console.error('[AttachmentUploader] signed URL fejlede:', err);
      toast({
        title: 'Kunne ikke åbne fil',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    }
  };

  const handleClear = () => {
    setUrl(null);
    setFilename(null);
    if (onCleared) onCleared();
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleFile}
        className="hidden"
      />

      {url && filename ? (
        <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <button
            type="button"
            onClick={handleOpen}
            className="text-sm underline text-left truncate flex-1 hover:text-primary"
          >
            {filename}
          </button>
          {!disabled && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClear}
              title="Fjern fil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Uploader...' : 'Upload PDF'}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        PDF, PNG eller JPEG · Maks. 50 MB
      </p>
    </div>
  );
};

export default AttachmentUploader;
