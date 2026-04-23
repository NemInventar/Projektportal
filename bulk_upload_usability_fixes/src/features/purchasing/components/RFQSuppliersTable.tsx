/**
 * RFQSuppliersTable — tabel over inviterede leverandører på en RFQ.
 *
 * Kolonner:
 *   - Navn
 *   - Kontakt (email + person)
 *   - Status (invite_status)
 *   - Inviteret
 *   - Handlinger: [Registrér svar] [Send påmindelse] [Fjern]
 *
 * Props:
 *   - suppliers: rfq_supplier-rækker
 *   - supplierNames: id → navn
 *   - quotesBySupplier: supplier_id → quote (hvis de allerede har svaret)
 *   - onRegisterQuote(supplierId): åbner QuoteInputDialog fra parent
 *   - onRemind(rfqSupplierId): send påmindelse (V2 — knap er synlig men vi
 *     toaster at det ikke er implementeret)
 *   - onRemove(rfqSupplierId): fjern invitation (kun tilladt når ingen quote findes)
 */
import React from 'react';
import { Bell, CheckCircle2, Mail, Trash2 } from 'lucide-react';
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
import type { InviteStatus, Quote, RfqSupplier } from '../types';

const STATUS_LABEL: Record<InviteStatus, string> = {
  invited: 'Inviteret',
  reminded: 'Påmindet',
  declined: 'Sagt nej',
  no_response: 'Intet svar',
  responded: 'Har svaret',
};

const STATUS_COLOR: Record<InviteStatus, string> = {
  invited: 'bg-blue-100 text-blue-800 border-blue-200',
  reminded: 'bg-amber-100 text-amber-800 border-amber-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  no_response: 'bg-gray-100 text-gray-800 border-gray-200',
  responded: 'bg-green-100 text-green-800 border-green-200',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('da-DK');
  } catch {
    return iso;
  }
}

export interface RFQSuppliersTableProps {
  suppliers: RfqSupplier[];
  supplierNames: Record<string, string>;
  quotesBySupplier: Record<string, Quote | undefined>;
  onRegisterQuote: (supplierId: string) => void;
  onRemind?: (rfqSupplierId: string) => void;
  onRemove?: (rfqSupplierId: string) => void;
  /** Hvis true, skjul alle handlings-knapper (fx når RFQ er awarded/cancelled). */
  readOnly?: boolean;
}

export const RFQSuppliersTable: React.FC<RFQSuppliersTableProps> = ({
  suppliers,
  supplierNames,
  quotesBySupplier,
  onRegisterQuote,
  onRemind,
  onRemove,
  readOnly = false,
}) => {
  if (suppliers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border rounded">
        Ingen leverandører er inviteret endnu.
      </div>
    );
  }

  return (
    <div className="rounded border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Leverandør</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead className="w-36">Status</TableHead>
            <TableHead className="w-28">Inviteret</TableHead>
            <TableHead className="w-64 text-right">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((rs) => {
            const quote = quotesBySupplier[rs.supplier_id];
            const hasQuote = !!quote;
            const canRemind = !readOnly &&
              (rs.invite_status === 'invited' || rs.invite_status === 'reminded');
            const canRemove = !readOnly && !hasQuote;

            return (
              <TableRow key={rs.id}>
                <TableCell className="font-medium">
                  {supplierNames[rs.supplier_id] ?? 'Ukendt leverandør'}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col">
                    {rs.contact_person && <span>{rs.contact_person}</span>}
                    {rs.contact_email && (
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {rs.contact_email}
                      </span>
                    )}
                    {!rs.contact_person && !rs.contact_email && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${STATUS_COLOR[rs.invite_status]}`}>
                    {STATUS_LABEL[rs.invite_status]}
                  </Badge>
                  {hasQuote && quote?.needs_review && (
                    <Badge className="ml-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
                      Kræver gennemsyn
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(rs.invited_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant={hasQuote ? 'outline' : 'default'}
                        onClick={() => onRegisterQuote(rs.supplier_id)}
                        className="gap-1 h-7 text-xs"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {hasQuote ? 'Redigér svar' : 'Registrér svar'}
                      </Button>
                    )}
                    {canRemind && onRemind && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemind(rs.id)}
                        title="Send påmindelse"
                        className="h-7 w-7 p-0"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canRemove && onRemove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(rs.id)}
                        title="Fjern invitation"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default RFQSuppliersTable;
