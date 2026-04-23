/**
 * SupplierPickerDialog — multi-select af leverandører fra `standard_suppliers`.
 *
 * Filtrerer altid til `status='Aktiv'`. Søgefelt matcher på navn + email +
 * kontaktperson (case-insensitive).
 *
 * Valgte leverandører returneres som en liste af `PickedSupplier`:
 *   - supplier_id
 *   - contact_email  (snapshot fra supplier.email — editable før kaldet)
 *   - contact_person (snapshot fra supplier.contactPerson — editable)
 *
 * Bruger `useStandardSuppliers` som er mount'et højere oppe i provider-kæden
 * (jf. App.tsx). Det gør dialogen FK-uafhængig af dens opkalder.
 */
import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

export interface PickedSupplier {
  supplier_id: string;
  contact_email: string | null;
  contact_person: string | null;
}

export interface SupplierPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Allerede valgte supplier-ids (vises som valgt men kan ikke fravælges). */
  alreadyPickedIds?: string[];
  /** Returneres kun nye valg. Alarede valgte filtreres fra. */
  onConfirm: (picked: PickedSupplier[]) => void;
  title?: string;
}

export const SupplierPickerDialog: React.FC<SupplierPickerDialogProps> = ({
  open,
  onOpenChange,
  alreadyPickedIds = [],
  onConfirm,
  title = 'Vælg leverandører',
}) => {
  const { suppliers, loading } = useStandardSuppliers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers
      .filter((s) => s.status === 'Aktiv')
      .filter((s) => {
        if (!q) return true;
        const hay = `${s.name} ${s.email ?? ''} ${s.contactPerson ?? ''}`
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }, [suppliers, search]);

  const toggle = (id: string) => {
    if (alreadyPickedIds.includes(id)) return;
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirm = () => {
    const picked: PickedSupplier[] = suppliers
      .filter((s) => selected[s.id] && !alreadyPickedIds.includes(s.id))
      .map((s) => ({
        supplier_id: s.id,
        contact_email: s.email ?? null,
        contact_person: s.contactPerson ?? null,
      }));
    onConfirm(picked);
    setSelected({});
    setSearch('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelected({});
    setSearch('');
    onOpenChange(false);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleCancel())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg på navn, email eller kontaktperson..."
            className="pl-9"
          />
        </div>

        <div className="max-h-96 overflow-y-auto border rounded">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Indlæser leverandører...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Ingen leverandører matcher søgningen.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((s) => {
                const already = alreadyPickedIds.includes(s.id);
                const isChecked = already || !!selected[s.id];
                return (
                  <li
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`flex items-center gap-3 px-3 py-2 ${
                      already
                        ? 'bg-muted/40 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox checked={isChecked} disabled={already} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {s.name}
                        {already && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            (allerede inviteret)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[s.contactPerson, s.email].filter(Boolean).join(' · ') || 'Ingen kontakt'}
                      </div>
                    </div>
                    {isChecked && !already && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <div className="flex-1 text-sm text-muted-foreground self-center">
            {selectedCount > 0 ? `${selectedCount} valgt` : ''}
          </div>
          <Button variant="outline" onClick={handleCancel}>
            Annullér
          </Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            Tilføj {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierPickerDialog;
