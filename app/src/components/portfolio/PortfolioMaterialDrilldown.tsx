import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioMaterial, PortfolioMaterialProject, usePortfolioMaterials } from '@/contexts/PortfolioMaterialsContext';

interface Props {
  material: PortfolioMaterial | null;
  onClose: () => void;
  onClickBulkOrder: (material: PortfolioMaterial, projects: PortfolioMaterialProject[]) => void;
}

interface ActivePO {
  id: string;
  project_id: string;
  supplier_id: string;
  status: string;
  expected_delivery_date: string | null;
  ordered_qty: number;
  unit: string;
}

export default function PortfolioMaterialDrilldown({ material, onClose, onClickBulkOrder }: Props) {
  const { getProjectsForMaterial } = usePortfolioMaterials();
  const [projects, setProjects] = useState<PortfolioMaterialProject[]>([]);
  const [activePOs, setActivePOs] = useState<ActivePO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!material) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const projs = await getProjectsForMaterial(material.standardMaterialId);
      const projectMaterialIds = projs.map(p => p.projectMaterialId);

      let pos: ActivePO[] = [];
      if (projectMaterialIds.length > 0) {
        const { data } = await supabase
          .from('purchase_order_lines_2026_01_15_06_45')
          .select('id, purchase_order_id, ordered_qty, unit, status, expected_delivery_date, supplier_id, purchase_orders_2026_01_15_06_45(id, project_id)')
          .in('project_material_id', projectMaterialIds)
          .neq('status', 'cancelled')
          .neq('status', 'delivered');
        if (data) {
          pos = data.map((r: any) => ({
            id: r.purchase_order_id,
            project_id: r.purchase_orders_2026_01_15_06_45?.project_id ?? '',
            supplier_id: r.supplier_id,
            status: r.status,
            expected_delivery_date: r.expected_delivery_date,
            ordered_qty: Number(r.ordered_qty),
            unit: r.unit,
          }));
        }
      }

      if (!cancelled) {
        setProjects(projs);
        setActivePOs(pos);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [material, getProjectsForMaterial]);

  if (!material) return null;

  return (
    <Sheet open={!!material} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{material.materialName}</SheetTitle>
          <SheetDescription>
            Total: {material.qtyTotal} {material.unit} ·
            Bestilt: {material.qtyOrdered} ·
            Mangler: {material.qtyMissing}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Fordeling pr. projekt
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Indlæser…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead className="text-right">Mængde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(p => (
                    <TableRow key={p.projectMaterialId}>
                      <TableCell className="font-medium">{p.projectName}</TableCell>
                      <TableCell>
                        <Badge variant={p.demandClass === 'secure' ? 'default' : 'outline'}>
                          {p.demandClass === 'secure' ? 'Sikker' : 'Tentativ'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{p.qty} {material.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Aktive ordrer (PO, status ≠ delivered & ≠ cancelled)
            </h3>
            {activePOs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen aktive ordrer</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead className="text-right">Mængde</TableHead>
                    <TableHead>Forventet</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePOs.map(po => (
                    <TableRow key={po.id + po.expected_delivery_date}>
                      <TableCell className="font-mono text-xs">{po.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-right">{po.ordered_qty} {po.unit}</TableCell>
                      <TableCell>{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('da-DK') : '—'}</TableCell>
                      <TableCell><Badge variant="outline">{po.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => onClickBulkOrder(material, projects)}
              disabled={material.qtyMissing === 0 || loading || projects.length === 0}
            >
              Bestil resterende {material.qtyMissing} {material.unit}
            </Button>
            <Button variant="outline" disabled>
              Start RFQ (V1.1)
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
