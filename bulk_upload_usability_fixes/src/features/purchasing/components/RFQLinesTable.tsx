/**
 * RFQLinesTable — viser/redigerer RFQ-linjer.
 *
 * Props:
 *   - mode: 'edit' (RFQCreate-wizard, lokalt state) | 'view' (detail-siden, read-only).
 *
 * I `edit`-mode er linjer `DraftLine[]` (ingen id fra DB endnu). Consumer holder
 * state og får alle mutationer som callbacks.
 *
 * I `view`-mode er linjer `RfqLine[]` fra DB. Vi viser en status-kolonne:
 *   - "Ikke prissat" hvis ingen quote_line findes
 *   - "Pris fra n/m leverandører" hvis minimum én quote_line findes
 *   - "Tildelt: <supplier>" hvis en selected quote_line findes
 */
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type {
  QuoteWithLines,
  RfqLine,
  RfqSupplier,
} from '../types';

// ---------------------------------------------------------------------------
// Draft-typen der bruges under oprettelse (før DB-id findes).
// ---------------------------------------------------------------------------
export interface DraftLine {
  /** Lokal id for React key — tilfældig uuid genereres af consumer. */
  localId: string;
  /** Valgfri reference til projekt-materiale. */
  project_material_id?: string | null;
  name: string;
  description?: string | null;
  qty: number;
  unit: string;
  spec?: string | null;
  budget_hint_total?: number | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Edit-mode props
// ---------------------------------------------------------------------------
interface EditProps {
  mode: 'edit';
  lines: DraftLine[];
  onChange: (next: DraftLine[]) => void;
  onAddEmpty?: () => void;
}

// ---------------------------------------------------------------------------
// View-mode props (read-only)
// ---------------------------------------------------------------------------
interface ViewProps {
  mode: 'view';
  lines: RfqLine[];
  /** Alle quotes på RFQ'en — bruges til at vise status pr. linje. */
  quotes: QuoteWithLines[];
  /** Bruges til at slå supplier-snapshots op til "Tildelt til" visning. */
  suppliers?: RfqSupplier[];
  /** Map over supplier_id → navn fra StandardSuppliersContext eller lignende. */
  supplierNames?: Record<string, string>;
}

export type RFQLinesTableProps = EditProps | ViewProps;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function fmtQty(n: number | null | undefined): string {
  if (n == null) return '';
  return new Intl.NumberFormat('da-DK', {
    maximumFractionDigits: 3,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const RFQLinesTable: React.FC<RFQLinesTableProps> = (props) => {
  if (props.mode === 'edit') {
    return <EditTable {...props} />;
  }
  return <ViewTable {...props} />;
};

// ---------------------------------------------------------------------------
// Edit-mode (wizard step 2)
// ---------------------------------------------------------------------------
const EditTable: React.FC<EditProps> = ({ lines, onChange, onAddEmpty }) => {
  const update = (idx: number, patch: Partial<DraftLine>) => {
    const next = lines.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => {
    onChange(lines.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="rounded border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Navn *</TableHead>
              <TableHead className="w-24 text-right">Antal *</TableHead>
              <TableHead className="w-20">Enhed *</TableHead>
              <TableHead>Spec / Noter</TableHead>
              <TableHead className="w-28 text-right">Budget (kr.)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">
                  Ingen linjer tilføjet endnu.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line, idx) => (
                <TableRow key={line.localId}>
                  <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                  <TableCell>
                    <Input
                      value={line.name}
                      onChange={(e) => update(idx, { name: e.target.value })}
                      placeholder="Produktnavn"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={line.qty === 0 ? '' : line.qty}
                      onChange={(e) =>
                        update(idx, {
                          qty: e.target.value === '' ? 0 : parseFloat(e.target.value),
                        })
                      }
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.unit}
                      onChange={(e) => update(idx, { unit: e.target.value })}
                      placeholder="stk"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.spec ?? ''}
                      onChange={(e) => update(idx, { spec: e.target.value || null })}
                      placeholder="fx dimension, farve..."
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.budget_hint_total ?? ''}
                      onChange={(e) =>
                        update(idx, {
                          budget_hint_total: e.target.value === '' ? null : parseFloat(e.target.value),
                        })
                      }
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(idx)}
                      className="h-7 w-7 p-0"
                      title="Fjern linje"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onAddEmpty && (
        <Button type="button" variant="outline" size="sm" onClick={onAddEmpty} className="gap-2">
          <Plus className="h-4 w-4" /> Tilføj tom linje
        </Button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// View-mode (detail-siden)
// ---------------------------------------------------------------------------
const ViewTable: React.FC<ViewProps> = ({ lines, quotes, supplierNames }) => {
  if (lines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border rounded">
        Ingen linjer på denne prisforespørgsel.
      </div>
    );
  }

  // Tæl hvor mange quotes der har en pris pr. rfq_line.
  const quoteCount = quotes.length;
  const lineStatus = (lineId: string) => {
    const priced: { supplierId: string; selected: boolean }[] = [];
    for (const q of quotes) {
      const ql = q.lines.find((l) => l.rfq_line_id === lineId);
      if (ql && ql.total_price != null && !ql.declined) {
        priced.push({ supplierId: q.supplier_id, selected: q.status === 'selected' });
      }
    }
    const winner = priced.find((p) => p.selected);
    return { priced, winner };
  };

  return (
    <div className="rounded border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Navn</TableHead>
            <TableHead className="w-24 text-right">Antal</TableHead>
            <TableHead className="w-20">Enhed</TableHead>
            <TableHead>Spec</TableHead>
            <TableHead className="w-28 text-right">Budget</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const { priced, winner } = lineStatus(line.id);
            const pricedCount = priced.length;
            return (
              <TableRow key={line.id}>
                <TableCell className="text-muted-foreground text-sm">{line.line_no}</TableCell>
                <TableCell className="font-medium">
                  {line.name}
                  {line.description && (
                    <div className="text-xs text-muted-foreground">{line.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">{fmtQty(line.qty)}</TableCell>
                <TableCell>{line.unit}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {line.spec ?? '—'}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {line.budget_hint_total != null
                    ? `${fmtQty(line.budget_hint_total)} kr.`
                    : '—'}
                </TableCell>
                <TableCell>
                  {winner ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Tildelt: {supplierNames?.[winner.supplierId] ?? 'leverandør'}
                    </Badge>
                  ) : pricedCount === 0 ? (
                    <span className="text-xs text-muted-foreground">Ikke prissat</span>
                  ) : (
                    <span className="text-xs">
                      Pris fra {pricedCount}/{quoteCount} leverandører
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default RFQLinesTable;
