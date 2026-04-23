/**
 * QuoteReviewQueue — siden til gennemsyn af auto-parsede quotes.
 *
 * Route: #/purchasing/review
 *
 * Viser alle quotes med needs_review=true for aktivt projekt. Hver quote
 * vises som et QuoteReviewCard med knapper: [Godkend] [Rediger og godkend]
 * [Afvis].
 *
 * "Rediger og godkend" åbner QuoteInputDialog i review-mode. For det skal
 * vi kende RFQ-linjerne — vi loader RFQ'en on-demand når brugeren klikker.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

import { useQuoteReview } from '../hooks/useQuoteReview';
import QuoteReviewCard from '../components/QuoteReviewCard';
import QuoteInputDialog from '../components/QuoteInputDialog';
import { getRfqWithRelations } from '../lib/rfqApi';
import type { Quote, QuoteLine, RfqLine } from '../types';

interface EditingState {
  quote: Quote & { lines: QuoteLine[] };
  rfqTitle: string;
  rfqLines: RfqLine[];
}

export const QuoteReviewQueue: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { user } = useAuth();
  const { suppliers } = useStandardSuppliers();
  const { queue, count, approve, reject, refresh } = useQuoteReview();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rfqTitles, setRfqTitles] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const supplierNames: Record<string, string> = {};
  for (const s of suppliers) supplierNames[s.id] = s.name;

  // Load RFQ-titler for alle quotes så vi kan vise dem på cards.
  useEffect(() => {
    const loadTitles = async () => {
      const missing = queue.filter((q) => !rfqTitles[q.rfq_id]);
      if (missing.length === 0) return;
      const map: Record<string, string> = { ...rfqTitles };
      for (const q of missing) {
        try {
          const full = await getRfqWithRelations(q.rfq_id);
          map[q.rfq_id] = full.title;
        } catch (err) {
          console.error('[QuoteReviewQueue] load title fejlede:', err);
          map[q.rfq_id] = '(ukendt)';
        }
      }
      setRfqTitles(map);
    };
    void loadTitles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const handleApprove = async (quote: Quote) => {
    setBusyId(quote.id);
    try {
      const reviewer = user?.email ?? 'ukendt';
      await approve(quote.id, reviewer);
      toast({ title: 'Svar godkendt' });
    } catch (err) {
      toast({
        title: 'Kunne ikke godkende',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (quote: Quote) => {
    if (!window.confirm('Afvis og slet dette svar permanent?')) return;
    setBusyId(quote.id);
    try {
      await reject(quote.id);
      toast({ title: 'Svar afvist og slettet' });
    } catch (err) {
      toast({
        title: 'Kunne ikke afvise',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleEdit = async (quote: Quote) => {
    setLoadingEdit(true);
    try {
      const full = await getRfqWithRelations(quote.rfq_id);
      const quoteWithLines = full.quotes.find((q) => q.id === quote.id);
      if (!quoteWithLines) {
        toast({
          title: 'Kunne ikke finde svaret',
          description: 'Svaret findes ikke længere på RFQ\'en.',
          variant: 'destructive',
        });
        return;
      }
      setEditing({
        quote: quoteWithLines,
        rfqTitle: full.title,
        rfqLines: full.lines,
      });
    } catch (err) {
      toast({
        title: 'Kunne ikke åbne svar',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setLoadingEdit(false);
    }
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6 text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Vælg et projekt</h2>
          <p className="text-muted-foreground">
            Du skal vælge et projekt for at se review-køen.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/purchasing')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbage til overblik
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Kræver gennemsyn</h1>
            <p className="text-sm text-muted-foreground">
              {count} svar afventer godkendelse på projektet
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            Opdater
          </Button>
        </div>

        {queue.length === 0 ? (
          <Card className="p-10 text-center space-y-2">
            <div className="text-lg font-semibold">Ingen svar afventer</div>
            <p className="text-sm text-muted-foreground">
              Auto-parsede svar vises her når Claude har registreret dem.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {queue.map((quote) => (
              <QuoteReviewCard
                key={quote.id}
                quote={quote}
                supplierName={supplierNames[quote.supplier_id] ?? 'Leverandør'}
                rfqTitle={rfqTitles[quote.rfq_id] ?? 'Indlæser...'}
                onApprove={() => void handleApprove(quote)}
                onEditAndApprove={() => void handleEdit(quote)}
                onReject={() => void handleReject(quote)}
                busy={busyId === quote.id || loadingEdit}
              />
            ))}
          </div>
        )}

        {loadingEdit && (
          <div className="fixed bottom-6 right-6 bg-white border rounded shadow px-3 py-2 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Indlæser svar...
          </div>
        )}

        {editing && (
          <QuoteInputDialog
            open={true}
            onOpenChange={(o) => {
              if (!o) setEditing(null);
            }}
            rfqId={editing.quote.rfq_id}
            supplierId={editing.quote.supplier_id}
            supplierName={supplierNames[editing.quote.supplier_id]}
            rfqLines={editing.rfqLines}
            mode="review"
            initialData={editing.quote}
            onSubmitted={() => {
              setEditing(null);
              void refresh();
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default QuoteReviewQueue;
