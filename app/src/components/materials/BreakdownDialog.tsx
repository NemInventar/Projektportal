import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { useProjectMaterials, BreakdownChild, ProjectMaterial } from '@/contexts/ProjectMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  material: ProjectMaterial | null;
  onClose: () => void;
}

interface ChildRow extends BreakdownChild {
  id: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export default function BreakdownDialog({ open, material, onClose }: Props) {
  const { breakdownGenericMaterial } = useProjectMaterials();
  const { suppliers: standardSuppliers } = useStandardSuppliers();
  const { toast } = useToast();

  const [rows, setRows] = useState<ChildRow[]>([
    { id: uid(), name: '', category: material?.category ?? '', unit: material?.unit ?? 'stk' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  if (!material) return null;

  const update = (id: string, patch: Partial<BreakdownChild>) => {
    setRows(rows.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const addRow = () => {
    setRows([...rows, { id: uid(), name: '', category: material.category, unit: material.unit }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const canSubmit = rows.length > 0 && rows.every(r => r.name.trim().length > 0 && r.unit.trim().length > 0);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const children: BreakdownChild[] = rows.map(r => ({
        name: r.name.trim(),
        category: r.category.trim() || 'Generel',
        unit: r.unit.trim(),
        supplierId: r.supplierId,
        standardMaterialId: r.standardMaterialId,
        notes: r.notes,
      }));

      await breakdownGenericMaterial(material!.id, children);

      toast({
        title: 'Brudt op',
        description: `${children.length} konkrete materialer oprettet. Husk at godkende dem før bestilling.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err.message ?? 'Ukendt fejl', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !submitting && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bryd op: {material.name}</DialogTitle>
          <DialogDescription>
            {material.notes && <span>"{material.notes}" · </span>}
            Den generiske post beholdes som audit-trail med replaced_at. Skjules som default på materialesiden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {rows.map(row => (
            <div key={row.id} className="grid grid-cols-[1fr_140px_100px_160px_40px] gap-2 items-end border rounded p-2">
              <div>
                <Label className="text-xs">Navn</Label>
                <Input value={row.name} onChange={e => update(row.id, { name: e.target.value })} placeholder="Fx Hængsel 165° BLUM" />
              </div>
              <div>
                <Label className="text-xs">Kategori</Label>
                <Input value={row.category} onChange={e => update(row.id, { category: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Enhed</Label>
                <Input value={row.unit} onChange={e => update(row.id, { unit: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Leverandør</Label>
                <Select value={row.supplierId ?? '__none__'} onValueChange={v => update(row.id, { supplierId: v === '__none__' ? undefined : v })}>
                  <SelectTrigger><SelectValue placeholder="(valgfri)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(ingen)</SelectItem>
                    {standardSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={rows.length === 1 || submitting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRow} disabled={submitting}>
          <Plus className="h-4 w-4 mr-1" /> Tilføj række
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annullér</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Bryder op…' : 'Bryd op'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
