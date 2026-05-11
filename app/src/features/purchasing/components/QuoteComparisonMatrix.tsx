/**
 * QuoteComparisonMatrix — W4 sammenlignings-matrix.
 *
 * Rækker = rfq_lines. Kolonner = quotes (én pr. supplier).
 * Celle = total_price + lead_time. Laveste pris pr. række highlightes grønt.
 *
 * Radio-button pr. celle (row-scoped) for at vælge vinder pr. linje.
 * Split tilladt: hver linje kan vælge sin egen vinder.
 *
 * Returværdi: map `rfq_line_id -> quote_id | null`. Consumer (pagen)
 * samler op og bygger det endelige sæt winning quote_ids som sendes til
 * `assignWinners`.
 */
import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { QuoteWithLines, RfqLine } from '../types';

export type SelectionMap = Record<string, string | null>;

export interface QuoteComparisonMatrixProps {
  rfqLines: RfqLine[];
  quotes: QuoteWithLines[];
  supplierNames: Record<string, string>;
  selection: SelectionMap;
  onSelect: (rfqLineId: string, quoteId: string | null) => void;
  /** Hvis true, vis radio-knapper og tillad ændringer. Default: true. */
  editable?: boolean;
}

function fmtMoney(n: number | null | undefined, currency = 'DKK'): string {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

export const QuoteComparisonMatrix: React.FC<QuoteComparisonMatrixProps> = ({
  rfqLines,
  quotes,
  supplierNames,
  selection,
  onSelect,
  editable = true,
}) => {
  // For hver linje: find laveste pris (blandt ikke-declined, ikke-null totaler).
  const lowestByLine = useMemo(() => {
    const m: Record<string, number> = {};
    for (const line of rfqLines) {
      let best: number | null = null;
      for (const q of quotes) {
        const ql = q.lines.find((l) => l.rfq_line_id === line.id);
        if (!ql || ql.declined || ql.total_price == null) continue;
        if (best == null || ql.total_price < best) best = ql.total_price;
      }
      if (best != null) m[line.id] = best;
    }
    return m;
  }, [rfqLines, quotes]);

  if (quotes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border rounded">
        Der er endnu ingen svar at sammenligne.
      </div>
    );
  }

  if (rfqLines.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border rounded">
        Der er ingen linjer på prisforespørgslen.
      </div>
    );
  }

  return (
    <div className="rounded border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="min-w-[220px]">Linje</TableHead>
            {quotes.map((q) => (
              <TableHead key={q.id} className="min-w-[180px]">
                <div className="font-semibold">
                  {supplierNames[q.supplier_id] ?? 'Leverandør'}
                </div>
                <div className="text-xs font-normal text-muted-foreground">
                  {q.currency}
                  {q.lead_time_days != null && ` · ${q.lead_time_days} dage`}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rfqLines.map((line) => {
            const lowest = lowestByLine[line.id];
            return (
              <TableRow key={line.id}>
                <TableCell className="font-medium align-top">
                  <div>
                    <span className="text-muted-foreground text-xs mr-2">
                      #{line.line_no}
                    </span>
                    {line.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {line.qty} {line.unit}
                  </div>
                </TableCell>
                {quotes.map((q) => {
                  const ql = q.lines.find((l) => l.rfq_line_id === line.id);
                  const priced = ql && !ql.declined && ql.total_price != null;
                  const isLowest = priced && ql!.total_price === lowest;
                  const selected = selection[line.id] === q.id;
                  return (
                    <TableCell
                      key={q.id}
                      className={`align-top text-sm ${
                        isLowest ? 'bg-green-50' : ''
                      }`}
                    >
                      {ql && ql.declined ? (
                        <span className="text-xs text-red-600">
                          Kan ikke levere
                        </span>
                      ) : priced ? (
                        <div className="space-y-1">
                          <div
                            className={`font-medium ${
                              isLowest ? 'text-green-700' : ''
                            }`}
                          >
                            {fmtMoney(ql!.total_price, q.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {ql!.quoted_qty ?? '—'} {ql!.unit ?? ''}
                            {ql!.lead_time_days != null &&
                              ` · ${ql!.lead_time_days} dage`}
                          </div>
                          {ql!.alternative_offered && (
                            <div className="text-xs text-amber-600">
                              Alternativ: {ql!.alternative_note ?? '(se note)'}
                            </div>
                          )}
                          {editable && (
                            <label className="inline-flex items-center gap-1 text-xs cursor-pointer mt-1">
                              <input
                                type="radio"
                                name={`line-${line.id}`}
                                checked={selected}
                                onChange={() => onSelect(line.id, q.id)}
                              />
                              Vælg
                            </label>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Ikke prissat
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          {editable && (
            <TableRow>
              <TableCell className="text-xs text-muted-foreground">
                Intet valg pr. linje
              </TableCell>
              {quotes.map((q) => (
                <TableCell key={q.id} />
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default QuoteComparisonMatrix;
