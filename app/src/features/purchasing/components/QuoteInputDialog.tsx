/**
 * QuoteInputDialog — W2: manuelt svar fra leverandør.
 *
 * Props:
 *   - rfqId
 *   - supplierId
 *   - mode: 'manual' | 'review'
 *   - initialData?: Quote — bruges til både "redigér eksisterende manuel svar"
 *     og til "review auto-genereret svar" (mode='review').
 *
 * Top-felter:
 *   received_at, valid_until, currency, payment_terms, delivery_terms,
 *   total_price, notes, PDF-upload.
 *
 * Linje-tabel:
 *   pr. rfq-linje: qty ønsket (RO), qty prissat, unit, total_price (primær),
 *   unit_price (afledt, RO), declined (checkbox), alternative (checkbox + note),
 *   notes.
 *
 * I review-mode sætter submit: needs_review=false, reviewed_by=email,
 * reviewed_at=now() via approveQuote-kald efter upsert.
 *
 * Valideringskriterier (jf. plan §5.4):
 *   - total_price (hvis sat): >= 0
 *   - qty > 0 hvis linje ikke er declined og har total_price
 *   - mindst én linje skal have enten total_price eller declined=true, ellers
 *     svarer leverandøren reelt intet.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { usePurchasing } from '../PurchasingContext';
import { AttachmentUploader } from './AttachmentUploader';
import type {
  Quote,
  QuoteLine,
  RfqLine,
  UpsertQuoteLineInput,
} from '../types';

// ---------------------------------------------------------------------------
// Lokal linje-draft state
// ---------------------------------------------------------------------------
interface LineDraft {
  rfq_line_id: string;
  quoted_qty: string;
  unit: string;
  total_price: string;
  declined: boolean;
  alternative_offered: boolean;
  alternative_note: string;
  notes: string;
}

// Helper: fra eksisterende QuoteLine + RfqLine til LineDraft.
function initLineDraft(
  rfqLine: RfqLine,
  existing?: QuoteLine,
): LineDraft {
  return {
    rfq_line_id: rfqLine.id,
    quoted_qty:
      existing?.quoted_qty != null
        ? String(existing.quoted_qty)
        : String(rfqLine.qty ?? ''),
    unit: existing?.unit ?? rfqLine.unit,
    total_price:
      existing?.total_price != null ? String(existing.total_price) : '',
    declined: existing?.declined ?? false,
    alternative_offered: existing?.alternative_offered ?? false,
    alternative_note: existing?.alternative_note ?? '',
    notes: existing?.notes ?? '',
  };
}

function toNumberOrNull(s: string): number | null {
  if (s === '' || s == null) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  // Input type="date" forventer YYYY-MM-DD
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export interface QuoteInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfqId: string;
  supplierId: string;
  supplierName?: string;
  /** RFQ-linjer så vi kan vise ønsket qty/unit pr. linje. */
  rfqLines: RfqLine[];
  mode: 'manual' | 'review';
  initialData?: Quote & { lines?: QuoteLine[] };
  /** Kaldes efter succesfuld submit (dialogen lukker selv). */
  onSubmitted?: () => void;
}

export const QuoteInputDialog: React.FC<QuoteInputDialogProps> = ({
  open,
  onOpenChange,
  rfqId,
  supplierId,
  supplierName,
  rfqLines,
  mode,
  initialData,
  onSubmitted,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { upsertQuote, upsertQuoteLines, approveQuote } = usePurchasing();

  const [saving, setSaving] = useState(false);

  // Top-felter
  const [receivedAt, setReceivedAt] = useState<string>(
    fmtDate(initialData?.received_at ?? null) ||
      new Date().toISOString().slice(0, 10),
  );
  const [validUntil, setValidUntil] = useState<string>(
    fmtDate(initialData?.valid_until ?? null),
  );
  const [currency, setCurrency] = useState<string>(initialData?.currency ?? 'DKK');
  const [paymentTerms, setPaymentTerms] = useState<string>(
    initialData?.payment_terms ?? '',
  );
  const [deliveryTerms, setDeliveryTerms] = useState<string>(
    initialData?.delivery_terms ?? '',
  );
  const [totalPrice, setTotalPrice] = useState<string>(
    initialData?.total_price != null ? String(initialData.total_price) : '',
  );
  const [notes, setNotes] = useState<string>(initialData?.notes ?? '');

  // Attachment
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialData?.pdf_url ?? null);
  const [pdfFilename, setPdfFilename] = useState<string | null>(
    initialData?.pdf_filename ?? null,
  );

  // Linje-drafts
  const [lines, setLines] = useState<LineDraft[]>(() => {
    const existingById: Record<string, QuoteLine> = {};
    for (const l of initialData?.lines ?? []) {
      existingById[l.rfq_line_id] = l;
    }
    return rfqLines.map((r) => initLineDraft(r, existingById[r.id]));
  });

  // Hvis dialogen åbnes igen med nye props, re-initialisér state.
  useEffect(() => {
    if (!open) return;
    setReceivedAt(
      fmtDate(initialData?.received_at ?? null) ||
        new Date().toISOString().slice(0, 10),
    );
    setValidUntil(fmtDate(initialData?.valid_until ?? null));
    setCurrency(initialData?.currency ?? 'DKK');
    setPaymentTerms(initialData?.payment_terms ?? '');
    setDeliveryTerms(initialData?.delivery_terms ?? '');
    setTotalPrice(
      initialData?.total_price != null ? String(initialData.total_price) : '',
    );
    setNotes(initialData?.notes ?? '');
    setPdfUrl(initialData?.pdf_url ?? null);
    setPdfFilename(initialData?.pdf_filename ?? null);
    const existingById: Record<string, QuoteLine> = {};
    for (const l of initialData?.lines ?? []) {
      existingById[l.rfq_line_id] = l;
    }
    setLines(rfqLines.map((r) => initLineDraft(r, existingById[r.id])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rfqId, supplierId]);

  // RFQ-linje lookup
  const rfqLineById = useMemo(() => {
    const m: Record<string, RfqLine> = {};
    for (const l of rfqLines) m[l.id] = l;
    return m;
  }, [rfqLines]);

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // --- Valideringssum til bundlinjen ---
  const linesSumTotal = useMemo(() => {
    return lines.reduce((acc, l) => {
      const t = toNumberOrNull(l.total_price);
      if (t != null && !l.declined) return acc + t;
      return acc;
    }, 0);
  }, [lines]);

  const validate = (): string | null => {
    const t = toNumberOrNull(totalPrice);
    if (t != null && t < 0) return 'Total pris kan ikke være negativ.';

    let anyFilled = false;
    for (const l of lines) {
      const lt = toNumberOrNull(l.total_price);
      const lq = toNumberOrNull(l.quoted_qty);
      if (l.declined) {
        anyFilled = true;
        continue;
      }
      if (lt != null) {
        anyFilled = true;
        if (lt < 0) return 'Total pris pr. linje kan ikke være negativ.';
        if (lq == null || lq <= 0) {
          return `Antal prissat skal være > 0 for ${rfqLineById[l.rfq_line_id]?.name ?? 'linje'}.`;
        }
      }
    }
    if (!anyFilled) {
      return 'Udfyld mindst én linje (pris eller markér som "Kan ikke leveres").';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Kunne ikke gemme', description: err, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // 1) Upsert hoved-quote
      const quote = await upsertQuote({
        rfq_id: rfqId,
        supplier_id: supplierId,
        status: 'received',
        received_at: receivedAt || null,
        valid_until: validUntil || null,
        currency,
        payment_terms: paymentTerms || null,
        delivery_terms: deliveryTerms || null,
        total_price: toNumberOrNull(totalPrice),
        notes: notes || null,
        pdf_url: pdfUrl,
        pdf_filename: pdfFilename,
        // I manual-mode: needs_review=false (default). I review-mode beholder
        // vi den som true indtil approveQuote kaldes herunder.
        needs_review: mode === 'review',
      });

      // 2) Upsert kun linjer der faktisk har data (pris eller declined).
      const linePayload: UpsertQuoteLineInput[] = lines
        .filter((l) => {
          const t = toNumberOrNull(l.total_price);
          return l.declined || t != null;
        })
        .map((l) => ({
          rfq_line_id: l.rfq_line_id,
          total_price: l.declined ? null : toNumberOrNull(l.total_price),
          quoted_qty: l.declined ? null : toNumberOrNull(l.quoted_qty),
          unit: l.unit || null,
          declined: l.declined,
          alternative_offered: l.alternative_offered,
          alternative_note: l.alternative_note || null,
          notes: l.notes || null,
        }));

      if (linePayload.length > 0) {
        await upsertQuoteLines(quote.id, linePayload);
      }

      // 3) I review-mode: godkend quote'en
      if (mode === 'review') {
        const reviewer = user?.email ?? 'ukendt';
        await approveQuote(quote.id, reviewer);
      }

      toast({
        title: mode === 'review' ? 'Svar godkendt' : 'Svar registreret',
        description: supplierName ? `Leverandør: ${supplierName}` : undefined,
      });

      onSubmitted?.();
      onOpenChange(false);
    } catch (err) {
      console.error('[QuoteInputDialog] submit fejlede:', err);
      toast({
        title: 'Der opstod en fejl',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'review' ? 'Gennemse svar' : 'Registrér svar'}
            {supplierName && ` — ${supplierName}`}
          </DialogTitle>
        </DialogHeader>

        {/* Raw source text preview (review-mode) */}
        {mode === 'review' && initialData?.raw_source_text && (
          <div className="rounded bg-muted/30 p-3 text-xs max-h-40 overflow-y-auto border">
            <div className="font-semibold text-muted-foreground mb-1">
              Original mail-tekst:
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px]">
              {initialData.raw_source_text}
            </pre>
          </div>
        )}

        {/* Top-felter */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Modtaget</Label>
            <Input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Gyldig til</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Valuta</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DKK">DKK</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="SEK">SEK</SelectItem>
                <SelectItem value="NOK">NOK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Total pris (kr.)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              placeholder="Fx 12.500"
            />
          </div>
          <div>
            <Label className="text-xs">Betalingsvilkår</Label>
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="fx 30 dage netto"
            />
          </div>
          <div>
            <Label className="text-xs">Leveringsvilkår</Label>
            <Input
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              placeholder="fx EXW, DAP..."
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">PDF / bilag</Label>
            <AttachmentUploader
              quoteId={initialData?.id ?? `${rfqId}-${supplierId}`}
              initialUrl={pdfUrl}
              initialFilename={pdfFilename}
              onUploaded={(r) => {
                setPdfUrl(r.url);
                setPdfFilename(r.filename);
              }}
              onCleared={() => {
                setPdfUrl(null);
                setPdfFilename(null);
              }}
            />
          </div>
        </div>

        {/* Linje-tabel */}
        <div className="border rounded overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Linje</TableHead>
                <TableHead className="w-20 text-right">Ønsket</TableHead>
                <TableHead className="w-20 text-right">Prissat antal</TableHead>
                <TableHead className="w-20">Enhed</TableHead>
                <TableHead className="w-28 text-right">Total pris</TableHead>
                <TableHead className="w-28 text-right">Enhedspris</TableHead>
                <TableHead className="w-16 text-center">Nej</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => {
                const rfqLine = rfqLineById[l.rfq_line_id];
                const qty = toNumberOrNull(l.quoted_qty);
                const total = toNumberOrNull(l.total_price);
                const unit =
                  qty != null && qty > 0 && total != null ? total / qty : null;
                return (
                  <TableRow key={l.rfq_line_id}>
                    <TableCell className="font-medium align-top">
                      <div>{rfqLine?.name ?? '—'}</div>
                      {rfqLine?.spec && (
                        <div className="text-xs text-muted-foreground">
                          {rfqLine.spec}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground align-top">
                      {rfqLine?.qty ?? '—'} {rfqLine?.unit}
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        disabled={l.declined}
                        value={l.quoted_qty}
                        onChange={(e) => updateLine(idx, { quoted_qty: e.target.value })}
                        className="text-right h-8"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        disabled={l.declined}
                        value={l.unit}
                        onChange={(e) => updateLine(idx, { unit: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={l.declined}
                        value={l.total_price}
                        onChange={(e) =>
                          updateLine(idx, { total_price: e.target.value })
                        }
                        className="text-right h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground align-top">
                      {unit != null
                        ? new Intl.NumberFormat('da-DK', {
                            maximumFractionDigits: 4,
                          }).format(unit)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center align-top">
                      <Checkbox
                        checked={l.declined}
                        onCheckedChange={(c) =>
                          updateLine(idx, { declined: !!c })
                        }
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={l.alternative_offered}
                            onCheckedChange={(c) =>
                              updateLine(idx, { alternative_offered: !!c })
                            }
                          />
                          <span className="text-xs">Alternativ</span>
                        </div>
                        {l.alternative_offered && (
                          <Input
                            value={l.alternative_note}
                            onChange={(e) =>
                              updateLine(idx, { alternative_note: e.target.value })
                            }
                            placeholder="Beskrivelse af alternativ"
                            className="h-7 text-xs"
                          />
                        )}
                        <Input
                          value={l.notes}
                          onChange={(e) => updateLine(idx, { notes: e.target.value })}
                          placeholder="Note"
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground">
          Sum af linjer:{' '}
          <span className="font-medium text-foreground">
            {new Intl.NumberFormat('da-DK', {
              maximumFractionDigits: 2,
            }).format(linesSumTotal)}{' '}
            {currency}
          </span>
          {toNumberOrNull(totalPrice) != null &&
            Math.abs(linesSumTotal - (toNumberOrNull(totalPrice) ?? 0)) > 0.01 && (
              <span className="ml-2 text-amber-600">
                (afviger fra total pris)
              </span>
            )}
        </div>

        {/* Internt noter */}
        <div>
          <Label className="text-xs">Interne noter</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Interne noter om svaret..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annullér
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {mode === 'review' ? 'Godkend svar' : 'Gem svar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteInputDialog;
