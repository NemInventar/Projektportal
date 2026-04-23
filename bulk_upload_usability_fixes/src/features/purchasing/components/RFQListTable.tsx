/**
 * RFQListTable — tabel brugt af PurchasingOverview.
 *
 * Kolonner:
 *   - Titel
 *   - #Linjer
 *   - #Leverandører svaret / total
 *   - Deadline (rød hvis passeret, gul hvis <3 dage)
 *   - Status
 *   - Oprettet af (ikon: human / claude)
 *   - Handlinger (åbn)
 *
 * Props holder pre-beregnede tælletal så vi ikke nested-fetcher i denne komponent.
 */
import React from 'react';
import { Bot, Calendar, ExternalLink, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Rfq, RfqStatus } from '../types';

const STATUS_LABEL: Record<RfqStatus, string> = {
  draft: 'Kladde',
  sent: 'Sendt',
  partially_received: 'Delvist modtaget',
  closed: 'Lukket',
  awarded: 'Tildelt',
  cancelled: 'Annulleret',
};

const STATUS_COLOR: Record<RfqStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  partially_received: 'bg-amber-100 text-amber-800 border-amber-200',
  closed: 'bg-gray-200 text-gray-700 border-gray-300',
  awarded: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

/** Tæl-oplysninger pr. RFQ — præ-beregnet af pagen. */
export interface RfqCounts {
  lineCount: number;
  supplierTotal: number;
  supplierResponded: number;
}

export interface RFQListTableProps {
  rfqs: Rfq[];
  /** Map rfq.id → pre-beregnede tal. Mangler = 0/0/0. */
  counts: Record<string, RfqCounts>;
  onOpen: (rfq: Rfq) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('da-DK');
  } catch {
    return iso;
  }
}

/** Returnerer className til deadline-celle baseret på antal dage tilbage. */
function deadlineClass(iso: string | null): string {
  if (!iso) return 'text-muted-foreground';
  const now = Date.now();
  const d = new Date(iso).getTime();
  if (isNaN(d)) return 'text-muted-foreground';
  const diffDays = Math.floor((d - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'text-red-600 font-medium';
  if (diffDays < 3) return 'text-amber-600 font-medium';
  return '';
}

export const RFQListTable: React.FC<RFQListTableProps> = ({
  rfqs,
  counts,
  onOpen,
}) => {
  if (rfqs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border rounded bg-white">
        Ingen prisforespørgsler matcher filtrene.
      </div>
    );
  }

  return (
    <div className="rounded border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Titel</TableHead>
            <TableHead className="w-20 text-right">Linjer</TableHead>
            <TableHead className="w-32 text-right">Svar</TableHead>
            <TableHead className="w-32">Frist</TableHead>
            <TableHead className="w-36">Status</TableHead>
            <TableHead className="w-24">Oprettet af</TableHead>
            <TableHead className="w-24 text-right">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rfqs.map((rfq) => {
            const c = counts[rfq.id] ?? {
              lineCount: 0,
              supplierTotal: 0,
              supplierResponded: 0,
            };
            return (
              <TableRow
                key={rfq.id}
                onClick={() => onOpen(rfq)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="font-medium">
                  {rfq.title}
                  {rfq.description && (
                    <div className="text-xs text-muted-foreground truncate max-w-md">
                      {rfq.description}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">{c.lineCount}</TableCell>
                <TableCell className="text-right">
                  {c.supplierResponded}/{c.supplierTotal}
                </TableCell>
                <TableCell>
                  <div className={`flex items-center gap-1 text-sm ${deadlineClass(rfq.deadline)}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    {fmtDate(rfq.deadline)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${STATUS_COLOR[rfq.status]}`}>
                    {STATUS_LABEL[rfq.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rfq.created_by === 'claude_auto' ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title="Auto-oprettet af Claude"
                    >
                      <Bot className="h-3.5 w-3.5" /> Claude
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title="Manuelt oprettet"
                    >
                      <User className="h-3.5 w-3.5" /> Manuel
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(rfq);
                    }}
                    className="gap-1 h-7 text-xs"
                  >
                    <ExternalLink className="h-3 w-3" /> Åbn
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default RFQListTable;
