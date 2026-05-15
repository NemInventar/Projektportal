import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { PortfolioMaterial } from '@/contexts/PortfolioMaterialsContext';

interface Props {
  materials: PortfolioMaterial[];
}

type GroupKey = 'missing' | 'in_progress';

function classifyMaterial(m: PortfolioMaterial): GroupKey {
  if (m.qtyMissing > 0) return 'missing';
  return 'in_progress';
}

const groupLabels: Record<GroupKey, string> = {
  missing: 'MANGLER AT BESTILLE',
  in_progress: 'KLAR / I PROCES',
};

const groupOpenDefault: Record<GroupKey, boolean> = {
  missing: true,
  in_progress: false,
};

export default function PortfolioTable({ materials }: Props) {
  const groups = useMemo(() => {
    const m = new Map<GroupKey, PortfolioMaterial[]>();
    m.set('missing', []);
    m.set('in_progress', []);
    for (const mat of materials) {
      m.get(classifyMaterial(mat))!.push(mat);
    }
    return m;
  }, [materials]);

  return (
    <div className="space-y-4">
      {(['missing', 'in_progress'] as GroupKey[]).map(g => (
        <GroupCard
          key={g}
          label={groupLabels[g]}
          materials={groups.get(g) ?? []}
          defaultOpen={groupOpenDefault[g]}
        />
      ))}
    </div>
  );
}

function GroupCard({ label, materials, defaultOpen }: {
  label: string; materials: PortfolioMaterial[]; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted/30">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold text-sm tracking-wide">{label}</span>
            <Badge variant="outline" className="ml-2">{materials.length}</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            {materials.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Ingen materialer i denne gruppe</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Materiale</TableHead>
                    <TableHead>Enhed</TableHead>
                    <TableHead className="text-right">Sikre</TableHead>
                    <TableHead className="text-right">Tent.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Bestilt</TableHead>
                    <TableHead className="text-right">Mangler</TableHead>
                    <TableHead>Næste lev.</TableHead>
                    <TableHead>Lead time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map(m => (
                    <TableRow key={m.standardMaterialId} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {m.materialName}
                        {m.category && <Badge variant="secondary" className="ml-2 text-xs">{m.category}</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.unit}</TableCell>
                      <TableCell className="text-right text-blue-700">{m.qtySecure || '—'}</TableCell>
                      <TableCell className="text-right text-muted-foreground italic">{m.qtyTentative || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{m.qtyTotal}</TableCell>
                      <TableCell className={`text-right ${m.qtyOrdered >= m.qtySecure && m.qtyOrdered > 0 ? 'text-green-700' : ''}`}>
                        {m.qtyOrdered || '—'}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${m.qtyMissing > 0 ? 'text-red-600' : ''}`}>
                        {m.qtyMissing > 0 && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {m.qtyMissing || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.nextDeliveryDate ? new Date(m.nextDeliveryDate).toLocaleDateString('da-DK') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.leadTimeDays != null ? `${m.leadTimeDays} dage` : 'Ukendt'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
