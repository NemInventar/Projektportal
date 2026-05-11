/**
 * QuoteReviewCard — card i Quote Review Queue.
 *
 * Én card pr. quote med needs_review=true. Viser:
 *   - supplier
 *   - RFQ-titel
 *   - raw_source_text preview
 *   - PDF-link hvis pdf_url
 *   - knapper: [Godkend] [Rediger og godkend] [Afvis]
 *
 * Tunge interaktioner (f.eks. åbn QuoteInputDialog i review-mode) lægges
 * i pagen, fordi vi har brug for RFQ-linjer fra RFQ-detaljen — derfor
 * eksponerer denne komponent bare callbacks.
 */
import React from 'react';
import { Bot, CheckCircle2, ExternalLink, FileText, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getSignedUrl } from '../lib/storageApi';
import type { Quote } from '../types';

export interface QuoteReviewCardProps {
  quote: Quote;
  supplierName: string;
  rfqTitle: string;
  onApprove: () => void;
  onEditAndApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('da-DK');
  } catch {
    return iso;
  }
}

export const QuoteReviewCard: React.FC<QuoteReviewCardProps> = ({
  quote,
  supplierName,
  rfqTitle,
  onApprove,
  onEditAndApprove,
  onReject,
  busy = false,
}) => {
  const openPdf = async () => {
    if (!quote.pdf_url) return;
    try {
      if (quote.pdf_url.startsWith('http')) {
        window.open(quote.pdf_url, '_blank', 'noopener');
        return;
      }
      const signed = await getSignedUrl(quote.pdf_url);
      window.open(signed, '_blank', 'noopener');
    } catch (err) {
      console.error('[QuoteReviewCard] pdf open fejlede:', err);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
              Kræver gennemsyn
            </Badge>
            {quote.created_by === 'claude_auto' && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs gap-1">
                <Bot className="h-3 w-3" /> Auto-parset
              </Badge>
            )}
          </div>
          <div className="font-semibold">{supplierName}</div>
          <div className="text-sm text-muted-foreground truncate">
            RFQ: {rfqTitle}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Modtaget: {fmtDate(quote.received_at)} · Total:{' '}
            {quote.total_price != null
              ? `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(quote.total_price)} ${quote.currency}`
              : 'ikke sat'}
          </div>
        </div>

        {quote.pdf_url && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPdf}
            className="gap-2 shrink-0"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>

      {quote.raw_source_text && (
        <div className="rounded bg-muted/30 p-3 text-xs max-h-32 overflow-y-auto border">
          <pre className="whitespace-pre-wrap font-mono text-[11px]">
            {quote.raw_source_text}
          </pre>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button size="sm" onClick={onApprove} disabled={busy} className="gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> Godkend
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onEditAndApprove}
          disabled={busy}
        >
          Rediger og godkend
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={busy}
          className="text-red-600 hover:text-red-700 gap-1"
        >
          <XCircle className="h-3.5 w-3.5" /> Afvis
        </Button>
      </div>
    </Card>
  );
};

export default QuoteReviewCard;
