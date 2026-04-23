/**
 * RFQDetail — detalje-side for én prisforespørgsel.
 *
 * Route: #/purchasing/rfq/:rfqId
 *
 * Layout:
 *   - RFQHeaderCard (titel, status, knapper)
 *   - Tabs:
 *       1) Linjer       — read-only RFQLinesTable
 *       2) Leverandører — RFQSuppliersTable + "Tilføj leverandører"
 *       3) Sammenlign   — link til /purchasing/rfq/:id/compare
 *       4) Historik     — V1: `created_at`/`updated_at`
 *
 * "Registrér svar" på en supplier åbner QuoteInputDialog i manual-mode.
 * Hvis der allerede er en quote for samme (rfq, supplier), åbnes i review-mode
 * hvis needs_review=true; ellers i manual-mode med initialData.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BarChart2, UserPlus } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

import { useRfq } from '../hooks/useRfq';
import { usePurchasing } from '../PurchasingContext';
import RFQHeaderCard from '../components/RFQHeaderCard';
import RFQLinesTable from '../components/RFQLinesTable';
import RFQSuppliersTable from '../components/RFQSuppliersTable';
import QuoteInputDialog from '../components/QuoteInputDialog';
import SupplierPickerDialog, {
  type PickedSupplier,
} from '../components/SupplierPickerDialog';

export const RFQDetail: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { suppliers } = useStandardSuppliers();

  const { rfq, loading, error, refresh } = useRfq(rfqId);
  const { updateRfqStatus, inviteSupplier, removeSupplierInvite } =
    usePurchasing();

  const [activeTab, setActiveTab] = useState<string>('lines');
  const [registerFor, setRegisterFor] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const supplierNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) m[s.id] = s.name;
    return m;
  }, [suppliers]);

  // Map supplier_id -> Quote (hvis nogen)
  const quotesBySupplier = useMemo(() => {
    const m: Record<string, typeof rfq.quotes[number] | undefined> = {};
    if (!rfq) return m;
    for (const q of rfq.quotes) {
      m[q.supplier_id] = q;
    }
    return m;
  }, [rfq]);

  // Find quote for supplier vi er ved at registrere svar for
  const registerQuote = useMemo(() => {
    if (!registerFor || !rfq) return undefined;
    return rfq.quotes.find((q) => q.supplier_id === registerFor);
  }, [registerFor, rfq]);

  const handleAddSuppliers = async (picked: PickedSupplier[]) => {
    if (!rfq) return;
    for (const p of picked) {
      await inviteSupplier(
        rfq.id,
        p.supplier_id,
        p.contact_email,
        p.contact_person,
      );
    }
    toast({
      title: 'Leverandører tilføjet',
      description: `${picked.length} nye leverandører er inviteret.`,
    });
    await refresh();
  };

  const handleRemoveInvite = async (rfqSupplierId: string) => {
    try {
      await removeSupplierInvite(rfqSupplierId);
      await refresh();
      toast({ title: 'Leverandør fjernet' });
    } catch (err) {
      toast({
        title: 'Kunne ikke fjerne',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    }
  };

  const handleRemind = () => {
    toast({
      title: 'Påmindelse',
      description:
        'Automatisk påmindelse er ikke implementeret i V1. Send manuelt fra Outlook.',
    });
  };

  const handleCancel = async () => {
    if (!rfq) return;
    try {
      await updateRfqStatus(rfq.id, 'cancelled');
      toast({ title: 'Prisforespørgsel annulleret' });
      setCancelConfirmOpen(false);
      await refresh();
    } catch (err) {
      toast({
        title: 'Kunne ikke annullere',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    }
  };

  const handleClose = async () => {
    if (!rfq) return;
    try {
      await updateRfqStatus(rfq.id, 'closed');
      toast({ title: 'Prisforespørgsel lukket' });
      setCloseConfirmOpen(false);
      await refresh();
    } catch (err) {
      toast({
        title: 'Kunne ikke lukke',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    }
  };

  // --- Render ---
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
          Indlæser prisforespørgsel...
        </div>
      </Layout>
    );
  }

  if (error || !rfq) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/purchasing')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbage til overblik
          </Button>
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-semibold">
                  Kunne ikke indlæse prisforespørgsel
                </div>
                <div className="text-sm">
                  {error?.message ?? 'Ukendt fejl'}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const alreadyInvitedIds = rfq.suppliers.map((s) => s.supplier_id);

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Back link */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/purchasing')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Tilbage til overblik
        </Button>

        {/* Header card */}
        <RFQHeaderCard
          rfq={rfq}
          projectName={activeProject?.name}
          onEdit={() => {
            toast({
              title: 'Redigering',
              description: 'Header-redigering kommer i V2. Brug Annullér + ny RFQ.',
            });
          }}
          onCancel={() => setCancelConfirmOpen(true)}
          onClose={() => setCloseConfirmOpen(true)}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="lines">Linjer ({rfq.lines.length})</TabsTrigger>
            <TabsTrigger value="suppliers">
              Leverandører ({rfq.suppliers.length})
            </TabsTrigger>
            <TabsTrigger value="compare">Sammenlign</TabsTrigger>
            <TabsTrigger value="history">Historik</TabsTrigger>
          </TabsList>

          {/* Linjer */}
          <TabsContent value="lines" className="space-y-3 pt-4">
            <RFQLinesTable
              mode="view"
              lines={rfq.lines}
              quotes={rfq.quotes}
              suppliers={rfq.suppliers}
              supplierNames={supplierNames}
            />
          </TabsContent>

          {/* Leverandører */}
          <TabsContent value="suppliers" className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" /> Tilføj leverandører
              </Button>
            </div>
            <RFQSuppliersTable
              suppliers={rfq.suppliers}
              supplierNames={supplierNames}
              quotesBySupplier={quotesBySupplier}
              onRegisterQuote={(supplierId) => setRegisterFor(supplierId)}
              onRemind={handleRemind}
              onRemove={handleRemoveInvite}
              readOnly={rfq.status === 'cancelled' || rfq.status === 'awarded'}
            />
            <SupplierPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              alreadyPickedIds={alreadyInvitedIds}
              onConfirm={handleAddSuppliers}
            />
          </TabsContent>

          {/* Sammenlign */}
          <TabsContent value="compare" className="pt-4">
            <Card className="p-6 text-center space-y-3">
              <BarChart2 className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <div className="font-semibold">Sammenlign svar</div>
                <p className="text-sm text-muted-foreground">
                  Åbn sammenlignings-matrixen i fuld bredde.
                </p>
              </div>
              <Button
                onClick={() => navigate(`/purchasing/rfq/${rfq.id}/compare`)}
                disabled={rfq.quotes.length === 0}
              >
                Åbn sammenligning ({rfq.quotes.length} svar)
              </Button>
            </Card>
          </TabsContent>

          {/* Historik (V1: simpel) */}
          <TabsContent value="history" className="pt-4">
            <Card className="p-5 space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Oprettet:</span>{' '}
                {new Date(rfq.created_at).toLocaleString('da-DK')}
              </div>
              <div>
                <span className="text-muted-foreground">Sidst opdateret:</span>{' '}
                {new Date(rfq.updated_at).toLocaleString('da-DK')}
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Detaljeret revisions-log kommer i V2.
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Register quote dialog */}
        {registerFor && (
          <QuoteInputDialog
            open={true}
            onOpenChange={(o) => {
              if (!o) setRegisterFor(null);
            }}
            rfqId={rfq.id}
            supplierId={registerFor}
            supplierName={supplierNames[registerFor]}
            rfqLines={rfq.lines}
            mode={registerQuote?.needs_review ? 'review' : 'manual'}
            initialData={registerQuote}
            onSubmitted={() => {
              setRegisterFor(null);
              void refresh();
            }}
          />
        )}

        {/* Cancel RFQ confirm */}
        <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Annullér prisforespørgsel?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Alle svar bevares, men RFQ'en markeres som annulleret og kan ikke
              genåbnes.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelConfirmOpen(false)}
              >
                Fortryd
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                Ja, annullér
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close RFQ confirm */}
        <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Luk prisforespørgsel?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              RFQ'en lukkes — ingen flere svar forventes. Den kan senere
              genåbnes hvis nødvendigt.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCloseConfirmOpen(false)}
              >
                Fortryd
              </Button>
              <Button onClick={handleClose}>Ja, luk</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default RFQDetail;
