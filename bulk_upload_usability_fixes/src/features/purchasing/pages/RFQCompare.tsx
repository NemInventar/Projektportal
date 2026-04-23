/**
 * RFQCompare — W4 sammenlignings- og tildelings-side.
 *
 * Route: #/purchasing/rfq/:rfqId/compare
 *
 * Viser QuoteComparisonMatrix og håndterer tildeling af vinder(e).
 *
 * Split tildeling er tilladt: forskellige linjer kan tildeles forskellige
 * suppliers. Når brugeren trykker "Bekræft tildeling", samler vi
 * unique quote_ids fra selection-mappen og kalder `assignWinners`.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

import { useRfq } from '../hooks/useRfq';
import { usePurchasing } from '../PurchasingContext';
import QuoteComparisonMatrix, {
  type SelectionMap,
} from '../components/QuoteComparisonMatrix';

export const RFQCompare: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { suppliers } = useStandardSuppliers();
  const { assignWinners } = usePurchasing();
  const { rfq, loading, error, refresh } = useRfq(rfqId);

  const [selection, setSelection] = useState<SelectionMap>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const supplierNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) m[s.id] = s.name;
    return m;
  }, [suppliers]);

  const winningQuoteIds = useMemo(() => {
    const set = new Set<string>();
    for (const qId of Object.values(selection)) {
      if (qId) set.add(qId);
    }
    return Array.from(set);
  }, [selection]);

  // Sum af tildelt totalpris pr. vindende quote
  const summaryByQuote = useMemo(() => {
    if (!rfq) return [];
    return winningQuoteIds.map((qId) => {
      const quote = rfq.quotes.find((q) => q.id === qId);
      if (!quote) return null;
      // Sum kun de linjer hvor denne quote blev valgt
      const assignedLineIds = Object.entries(selection)
        .filter(([, selQ]) => selQ === qId)
        .map(([lineId]) => lineId);
      let sum = 0;
      for (const lineId of assignedLineIds) {
        const ql = quote.lines.find((l) => l.rfq_line_id === lineId);
        if (ql && !ql.declined && ql.total_price != null) sum += ql.total_price;
      }
      return {
        quoteId: qId,
        supplierId: quote.supplier_id,
        supplierName: supplierNames[quote.supplier_id] ?? 'Leverandør',
        currency: quote.currency,
        lineCount: assignedLineIds.length,
        sum,
      };
    });
  }, [rfq, winningQuoteIds, selection, supplierNames]);

  const totalSum = summaryByQuote
    .filter(Boolean)
    .reduce((acc, s) => acc + (s?.sum ?? 0), 0);

  const allLinesCovered =
    rfq != null && rfq.lines.every((l) => selection[l.id] != null);

  const handleConfirm = async () => {
    if (!rfq) return;
    if (winningQuoteIds.length === 0) {
      toast({
        title: 'Ingen valg',
        description: 'Vælg mindst én leverandør pr. linje.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await assignWinners(rfq.id, winningQuoteIds);
      toast({
        title: 'Tildeling bekræftet',
        description: `${winningQuoteIds.length} leverandør(er) valgt.`,
      });
      setConfirmOpen(false);
      await refresh();
      navigate(`/purchasing/rfq/${rfq.id}`);
    } catch (err) {
      console.error('[RFQCompare] assignWinners fejlede:', err);
      toast({
        title: 'Kunne ikke bekræfte',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!rfqId) {
    return (
      <Layout>
        <div className="p-6 text-center py-16 text-muted-foreground">
          Ukendt prisforespørgsel-id.
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-center py-16 text-muted-foreground">
          Indlæser sammenligning...
        </div>
      </Layout>
    );
  }

  if (error || !rfq) {
    return (
      <Layout>
        <div className="p-6 text-center py-16">
          <p className="text-muted-foreground mb-4">
            Kunne ikke indlæse prisforespørgsel.
          </p>
          <Button variant="outline" onClick={() => navigate('/purchasing')}>
            Tilbage
          </Button>
        </div>
      </Layout>
    );
  }

  const alreadyAwarded = rfq.status === 'awarded';

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/purchasing/rfq/${rfq.id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbage til detalje
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sammenlign svar</h1>
            <p className="text-sm text-muted-foreground">{rfq.title}</p>
          </div>
        </div>

        {alreadyAwarded && (
          <Card className="p-4 bg-green-50 border-green-200 text-sm text-green-800">
            Prisforespørgslen er allerede tildelt. Du kan se tildelingen men
            ikke ændre den.
          </Card>
        )}

        <QuoteComparisonMatrix
          rfqLines={rfq.lines}
          quotes={rfq.quotes}
          supplierNames={supplierNames}
          selection={selection}
          onSelect={(lineId, quoteId) =>
            setSelection((prev) => ({ ...prev, [lineId]: quoteId }))
          }
          editable={!alreadyAwarded}
        />

        {/* Summary panel */}
        {!alreadyAwarded && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Tildelings-sammendrag</h3>
              <div className="text-sm text-muted-foreground">
                {allLinesCovered
                  ? 'Alle linjer er dækket'
                  : `${Object.values(selection).filter(Boolean).length}/${rfq.lines.length} linjer valgt`}
              </div>
            </div>

            {summaryByQuote.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ingen valg endnu. Klik på "Vælg" i en celle pr. linje.
              </p>
            ) : (
              <ul className="divide-y border rounded">
                {summaryByQuote.map((s) => {
                  if (!s) return null;
                  return (
                    <li
                      key={s.quoteId}
                      className="flex justify-between items-center p-3 text-sm"
                    >
                      <span className="font-medium">{s.supplierName}</span>
                      <span className="text-muted-foreground">
                        {s.lineCount} linjer
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('da-DK', {
                          maximumFractionDigits: 2,
                        }).format(s.sum)}{' '}
                        {s.currency}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Forventet total
              </span>
              <span className="text-lg font-bold">
                {new Intl.NumberFormat('da-DK', {
                  maximumFractionDigits: 2,
                }).format(totalSum)}{' '}
                {rfq.currency}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={winningQuoteIds.length === 0 || saving}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Bekræft tildeling
              </Button>
            </div>
          </Card>
        )}

        {/* Confirm dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bekræft tildeling</DialogTitle>
            </DialogHeader>
            <div className="py-2 text-sm space-y-2">
              <p>
                Du er ved at tildele {winningQuoteIds.length} leverandør
                {winningQuoteIds.length > 1 ? 'er' : ''} som vinder
                {winningQuoteIds.length > 1 ? 'e' : ''}.
              </p>
              <p className="text-muted-foreground">
                Andre svar på denne prisforespørgsel markeres som "tabt" og
                RFQ'en sættes til status "tildelt". Det kan ikke fortrydes.
              </p>
              {!allLinesCovered && (
                <p className="text-amber-700 font-medium">
                  Advarsel: Ikke alle linjer er valgt.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Fortryd
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                Ja, bekræft tildeling
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default RFQCompare;
