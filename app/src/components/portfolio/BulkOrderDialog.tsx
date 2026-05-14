import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { usePortfolioMaterials, PortfolioMaterial, PortfolioMaterialProject } from '@/contexts/PortfolioMaterialsContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  material: PortfolioMaterial | null;
  projects: PortfolioMaterialProject[];
  onClose: () => void;
}

interface RowState {
  projectMaterialId: string;
  projectId: string;
  projectName: string;
  demandClass: 'secure' | 'tentative';
  needed: number;
  selected: boolean;
  qty: number;
  unitPrice?: number;
  approvalOverrideReason?: string;
}

function generateUuid(): string {
  // @ts-ignore
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function BulkOrderDialog({ open, material, projects, onClose }: Props) {
  const { suppliers: standardSuppliers } = useStandardSuppliers();
  const { projectMaterials, isFullyApproved } = useProjectMaterials();
  const { refresh: refreshPortfolio } = usePortfolioMaterials();
  const { toast } = useToast();

  const [supplierId, setSupplierId] = useState<string>('');
  const [globalPrice, setGlobalPrice] = useState<string>('');
  const [usePriceForAll, setUsePriceForAll] = useState(true);
  const [expectedDelivery, setExpectedDelivery] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<RowState[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!material) return;
    setSupplierId(material.primarySupplierId ?? '');
    setRows(projects.map(p => {
      const ordered = 0;
      const needed = Math.max(p.qty - ordered, 0);
      return {
        projectMaterialId: p.projectMaterialId,
        projectId: p.projectId,
        projectName: p.projectName,
        demandClass: p.demandClass,
        needed,
        selected: needed > 0,
        qty: needed,
      };
    }));
    setGlobalPrice('');
    setUsePriceForAll(true);
    setExpectedDelivery('');
    setNotes('');
  }, [material, projects]);

  if (!material) return null;

  const selectedRows = rows.filter(r => r.selected);
  const totalQty = selectedRows.reduce((sum, r) => sum + (r.qty || 0), 0);
  const numericPrice = parseFloat(globalPrice);
  const estimatedPrice = (Number.isFinite(numericPrice) && usePriceForAll)
    ? numericPrice * totalQty
    : selectedRows.reduce((sum, r) => sum + ((r.unitPrice ?? 0) * (r.qty || 0)), 0);

  const hasTentative = selectedRows.some(r => r.demandClass === 'tentative');
  const notApprovedRows = selectedRows.filter(r => !isFullyApproved(r.projectMaterialId));
  const hasOverrideNeeds = notApprovedRows.length > 0;

  const selectedProjectMaterials = selectedRows
    .map(r => projectMaterials.find(pm => pm.id === r.projectMaterialId))
    .filter(Boolean);
  const distinctUnits = new Set(selectedProjectMaterials.map(pm => pm!.unit));
  const hasUnitMismatch = distinctUnits.size > 1
    || (distinctUnits.size === 1 && !distinctUnits.has(material.unit));

  const canSubmit = !!supplierId
    && selectedRows.length > 0
    && selectedRows.every(r => r.qty > 0)
    && !hasUnitMismatch
    && (!hasOverrideNeeds || notApprovedRows.every(r => (r.approvalOverrideReason ?? '').trim().length > 0));

  async function handleSubmit() {
    if (!material || !canSubmit) return;
    setSubmitting(true);
    const bulkGroupId = generateUuid();
    const today = new Date().toISOString().split('T')[0];

    try {
      for (const row of selectedRows) {
        const { data: po, error: poErr } = await supabase
          .from('purchase_orders_2026_01_15_06_45')
          .insert({
            project_id: row.projectId,
            supplier_id: supplierId,
            status: 'sent',
            order_date: today,
            expected_delivery_date: expectedDelivery || null,
            notes: notes || null,
            bulk_order_group_id: bulkGroupId,
          })
          .select('id')
          .single();
        if (poErr) throw poErr;

        const pmRow = projectMaterials.find(pm => pm.id === row.projectMaterialId);
        const unit = pmRow?.unit ?? material.unit;
        const rowPrice = usePriceForAll
          ? (Number.isFinite(numericPrice) ? numericPrice : null)
          : (row.unitPrice ?? null);

        const needsOverride = !isFullyApproved(row.projectMaterialId);

        const { error: lineErr } = await supabase
          .from('purchase_order_lines_2026_01_15_06_45')
          .insert({
            purchase_order_id: po.id,
            project_material_id: row.projectMaterialId,
            supplier_id: supplierId,
            ordered_qty: row.qty,
            unit,
            unit_price: rowPrice,
            currency: 'DKK',
            expected_delivery_date: expectedDelivery || null,
            status: 'ordered',
            approval_override: needsOverride,
            approval_override_reason: needsOverride ? (row.approvalOverrideReason ?? null) : null,
            approval_override_by: needsOverride ? 'current_user' : null,
            approval_override_at: needsOverride ? new Date().toISOString() : null,
          });
        if (lineErr) throw lineErr;
      }

      toast({
        title: 'Bestilling oprettet',
        description: `${selectedRows.length} PO'er oprettet og grupperet.`,
      });

      await refreshPortfolio();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Fejl ved oprettelse',
        description: err.message ?? 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bestil {material.materialName}</DialogTitle>
          <DialogDescription>
            {material.qtyMissing} {material.unit} mangler at blive bestilt på tværs af projekter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="supplier">Leverandør</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier"><SelectValue placeholder="Vælg leverandør" /></SelectTrigger>
              <SelectContent>
                {standardSuppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {material.primarySupplierId && supplierId === material.primarySupplierId && (
              <p className="text-xs text-muted-foreground mt-1">Foreslået fra primær leverandør</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Pris pr. {material.unit} (DKK)</Label>
              <Input id="price" type="number" step="0.01" value={globalPrice} onChange={e => setGlobalPrice(e.target.value)} placeholder="(valgfri)" />
              <div className="flex items-center gap-2 mt-2">
                <Switch id="use-for-all" checked={usePriceForAll} onCheckedChange={setUsePriceForAll} />
                <Label htmlFor="use-for-all" className="text-xs cursor-pointer">Brug for alle linjer (når OFF: individuel pris pr. projekt-linje)</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="delivery">Forventet levering</Label>
              <Input id="delivery" type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Noter</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block">Fordeling pr. projekt</Label>
            <div className="space-y-2">
              {rows.map((row, idx) => {
                const needsOverride = row.selected && !isFullyApproved(row.projectMaterialId);
                return (
                  <div key={row.projectMaterialId} className="space-y-1 border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={v => {
                          const next = [...rows];
                          next[idx] = { ...row, selected: !!v };
                          setRows(next);
                        }}
                      />
                      <span className="flex-1 text-sm font-medium">{row.projectName}</span>
                      {row.demandClass === 'tentative' && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> tent.
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">Mangler {row.needed}</span>
                      <Input
                        type="number"
                        value={row.qty}
                        onChange={e => {
                          const next = [...rows];
                          next[idx] = { ...row, qty: parseFloat(e.target.value) || 0 };
                          setRows(next);
                        }}
                        className="w-24 h-8"
                      />
                      <span className="text-xs">{material.unit}</span>
                    </div>
                    {!usePriceForAll && row.selected && (
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`Pris pr. ${material.unit}`}
                        value={row.unitPrice ?? ''}
                        onChange={e => {
                          const next = [...rows];
                          next[idx] = { ...row, unitPrice: parseFloat(e.target.value) || undefined };
                          setRows(next);
                        }}
                        className="h-8"
                      />
                    )}
                    {needsOverride && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                        <p className="text-xs text-amber-800 mb-1">
                          ⚠ Materialet er ikke fully_approved på dette projekt. Skriv en grund:
                        </p>
                        <Textarea
                          value={row.approvalOverrideReason ?? ''}
                          onChange={e => {
                            const next = [...rows];
                            next[idx] = { ...row, approvalOverrideReason: e.target.value };
                            setRows(next);
                          }}
                          placeholder="Fx 'Hastebestilling, godkendelse afventer DGNB-svar'"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span>Total bestilling:</span>
              <span className="font-semibold">{totalQty} {material.unit}</span>
            </div>
            {estimatedPrice > 0 && (
              <div className="flex justify-between text-sm">
                <span>Estimeret pris:</span>
                <span className="font-semibold">{estimatedPrice.toLocaleString('da-DK')} DKK</span>
              </div>
            )}
            {hasTentative && (
              <p className="text-xs text-amber-700 mt-2">
                ⚠ Mindst ét projekt er tentativt (Tilbud/Sendt) — du bestiller før vi har vundet
              </p>
            )}
            {hasUnitMismatch && (
              <p className="text-xs text-red-700 mt-2">
                ⛔ Enheder matcher ikke mellem projekterne. Ret data på materialerne først (alle skal have enhed "{material.unit}").
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Opretter…' : `Opret ${selectedRows.length} PO'er`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
