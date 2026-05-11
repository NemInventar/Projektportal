/**
 * ProjectMaterialsPickerDialog — multi-select af projekt-materialer til brug
 * i RFQCreate step 2 ("Tilføj fra projekt-materialer").
 *
 * Bruger `useProjectMaterials` fra ProjectMaterialsContext (provider er allerede
 * mount'et i App.tsx). Returnerer udvalgte materialer som DraftLine-kompatible
 * objekter — consumer står selv for at merge'e dem ind i wizardens linje-state.
 *
 * Felter der kopieres ind på linjen:
 *   - project_material_id (til senere link tilbage til master-materialet)
 *   - name
 *   - qty  (default 1 — ProjectMaterial har ikke projekt-mængde)
 *   - unit
 */
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';

export interface PickedProjectMaterial {
  project_material_id: string;
  name: string;
  qty: number;
  unit: string;
}

export interface ProjectMaterialsPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Allerede tilføjede project_material_ids — vises men kan ikke vælges igen. */
  alreadyPickedIds?: string[];
  onConfirm: (picked: PickedProjectMaterial[]) => void;
  title?: string;
}

export const ProjectMaterialsPickerDialog: React.FC<ProjectMaterialsPickerDialogProps> = ({
  open,
  onOpenChange,
  alreadyPickedIds = [],
  onConfirm,
  title = 'Vælg fra projekt-materialer',
}) => {
  const { projectMaterials, loading } = useProjectMaterials();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projectMaterials
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.name} ${m.category ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }, [projectMaterials, search]);

  const toggle = (id: string) => {
    if (alreadyPickedIds.includes(id)) return;
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirm = () => {
    const picked: PickedProjectMaterial[] = projectMaterials
      .filter((m) => selected[m.id] && !alreadyPickedIds.includes(m.id))
      .map((m) => ({
        project_material_id: m.id,
        name: m.name,
        qty: 1,
        unit: m.unit || 'stk',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg i navn eller kategori..."
            className="pl-9"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto border rounded">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Indlæser materialer...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {projectMaterials.length === 0
                ? 'Ingen projekt-materialer fundet på dette projekt.'
                : 'Ingen materialer matcher søgningen.'}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((m) => {
                const isAlready = alreadyPickedIds.includes(m.id);
                const isChecked = isAlready || !!selected[m.id];
                return (
                  <li
                    key={m.id}
                    className={`flex items-center gap-3 p-3 ${
                      isAlready ? 'bg-muted/40 opacity-60' : 'hover:bg-muted/30 cursor-pointer'
                    }`}
                    onClick={() => toggle(m.id)}
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={isAlready}
                      onCheckedChange={() => toggle(m.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                        {m.category && <span>{m.category}</span>}
                        <span>Enhed: {m.unit}</span>
                        {isAlready && (
                          <span className="text-amber-700">Allerede tilføjet</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
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

export default ProjectMaterialsPickerDialog;
