/**
 * SendRFQDialog — send en prisforespørgsel via brugerens eget Outlook.
 *
 * Flow:
 *   1) Bruger downloader PDF (manuelt vedhæft i Outlook bagefter)
 *   2) Bruger redigerer emne + body-template
 *   3) Bruger klikker "Åbn i Outlook" pr. leverandør (eller "Åbn alle")
 *      → åbner `mailto:`-link. Vedhæftning skal ske manuelt.
 *   4) Bruger klikker "Marker alle som sendt" når de er sendt
 *      → opdaterer invite_status = 'invited' + invited_at = now()
 *      → opdaterer RFQ-status 'draft' → 'sent'.
 *
 * Ingen SMTP. Ingen automatisk vedhæftning. Holder det simpelt.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, ExternalLink, FileSpreadsheet, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

import { RFQPdf } from './RFQPdf';
import {
  updateRfqStatus as apiUpdateRfqStatus,
  updateSupplierInvite as apiUpdateSupplierInvite,
} from '../lib/rfqApi';
import { generateRfqExcel } from '../lib/rfqExcel';
import type { RfqSupplier, RfqWithRelations } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'snarest muligt';
  try {
    return new Date(iso).toLocaleDateString('da-DK');
  } catch {
    return String(iso);
  }
}

function slugify(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    .toLowerCase();
}

function buildDefaultSubject(rfqTitle: string, projectName: string): string {
  return `Prisforespørgsel: ${rfqTitle} – ${projectName}`;
}

function buildDefaultBody(
  rfq: RfqWithRelations,
  projectName: string,
  projectNumber: string | undefined,
): string {
  const projRef = projectNumber ? `${projectName} (${projectNumber})` : projectName;
  return [
    'Hej [navn],',
    '',
    `Hermed prisforespørgsel vedr. ${projRef}.`,
    '',
    'Specifikation er vedhæftet som Excel — udfyld venligst dine priser direkte i arket og returnér filen.',
    '(Vedhæftning er også som PDF hvis Excel ikke passer jer.)',
    '',
    `Svar senest ${fmtDate(rfq.deadline)}.`,
    'Inkluder venligst:',
    '- Pris pr. vare (totalpris eller enhedspris)',
    '- Leveringstid',
    '- Mindstemængde hvis relevant',
    '- Gyldighedsperiode',
    '',
    'Spørgsmål kan stilles direkte til mig.',
    '',
    'Venlig hilsen',
    'Joachim Skovbogaard',
    'NemInventar ApS',
    'js@neminventar.dk',
  ].join('\n');
}

function personalizeBody(body: string, name: string | null | undefined): string {
  const replacement = (name && name.trim().length > 0 ? name : '').trim();
  return body.replace(/\[navn\]/g, replacement || 'der');
}

function buildMailtoUrl(
  email: string,
  subject: string,
  body: string,
): string {
  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);
  // URLSearchParams encoder + som space — mailto forventer %20.
  const qs = params.toString().replace(/\+/g, '%20');
  return `mailto:${encodeURIComponent(email)}?${qs}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface SendRFQDialogProps {
  rfq: RfqWithRelations;
  projectName: string;
  projectNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkedSent: () => void;
}

// Leverandører-rækker med lokal editerbar email
interface RowState {
  rfqSupplierId: string;
  supplierId: string;
  supplierName: string;
  contactPerson: string | null;
  email: string;
  inviteStatus: RfqSupplier['invite_status'];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SendRFQDialog: React.FC<SendRFQDialogProps> = ({
  rfq,
  projectName,
  projectNumber,
  open,
  onOpenChange,
  onMarkedSent,
}) => {
  const { toast } = useToast();
  const { suppliers: standardSuppliers } = useStandardSuppliers();

  const supplierNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of standardSuppliers) m[s.id] = s.name;
    return m;
  }, [standardSuppliers]);

  const supplierEmailMap = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const s of standardSuppliers) m[s.id] = s.email;
    return m;
  }, [standardSuppliers]);

  const [subject, setSubject] = useState<string>(
    buildDefaultSubject(rfq.title, projectName),
  );
  const [body, setBody] = useState<string>(
    buildDefaultBody(rfq, projectName, projectNumber),
  );
  const [rows, setRows] = useState<RowState[]>([]);
  const [marking, setMarking] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadingExcel, setDownloadingExcel] = useState<boolean>(false);

  // Reset state når dialog åbnes med ny RFQ.
  useEffect(() => {
    if (!open) return;
    setSubject(buildDefaultSubject(rfq.title, projectName));
    setBody(buildDefaultBody(rfq, projectName, projectNumber));
    setRows(
      rfq.suppliers.map((rs) => ({
        rfqSupplierId: rs.id,
        supplierId: rs.supplier_id,
        supplierName: supplierNameMap[rs.supplier_id] ?? 'Ukendt leverandør',
        contactPerson: rs.contact_person,
        email:
          rs.contact_email ??
          supplierEmailMap[rs.supplier_id] ??
          '',
        inviteStatus: rs.invite_status,
      })),
    );
  }, [open, rfq, projectName, projectNumber, supplierNameMap, supplierEmailMap]);

  const updateRowEmail = (rfqSupplierId: string, email: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rfqSupplierId === rfqSupplierId ? { ...r, email } : r,
      ),
    );
  };

  // ------------------------------------------------------------------
  // Excel download (primær)
  // ------------------------------------------------------------------
  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const blob = await generateRfqExcel({
        rfq,
        projectName,
        projectNumber,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = rfq.title.replace(/[^a-z0-9]/gi, '_');
      a.href = url;
      a.download = `Prisforespørgsel_${safeTitle}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Excel downloadet',
        description: 'Husk at vedhæfte den i Outlook inden du sender.',
      });
    } catch (err) {
      toast({
        title: 'Kunne ikke generere Excel',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setDownloadingExcel(false);
    }
  };

  // ------------------------------------------------------------------
  // PDF download (sekundær / fallback)
  // ------------------------------------------------------------------
  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(
        <RFQPdf
          rfq={rfq}
          projectName={projectName}
          projectNumber={projectNumber}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prisforesp-${slugify(projectName)}-${slugify(rfq.title)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'PDF downloadet',
        description: 'Husk at vedhæfte den i Outlook inden du sender.',
      });
    } catch (err) {
      toast({
        title: 'Kunne ikke generere PDF',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  // ------------------------------------------------------------------
  // Åbn i Outlook (mailto)
  // ------------------------------------------------------------------
  const openMailto = (row: RowState) => {
    if (!row.email) {
      toast({
        title: 'Mangler email',
        description: `Ingen email på ${row.supplierName}.`,
        variant: 'destructive',
      });
      return;
    }
    const recipientName = row.contactPerson || row.supplierName;
    const personalBody = personalizeBody(body, recipientName);
    const url = buildMailtoUrl(row.email, subject, personalBody);
    window.open(url, '_blank');
  };

  const handleOpenAll = () => {
    const valid = rows.filter((r) => r.email.trim().length > 0);
    if (valid.length === 0) {
      toast({
        title: 'Ingen gyldige emails',
        description: 'Udfyld email på mindst én leverandør.',
        variant: 'destructive',
      });
      return;
    }
    valid.forEach((row, idx) => {
      // Delay mellem hver for at undgå pop-up blocker.
      window.setTimeout(() => openMailto(row), idx * 200);
    });
  };

  // ------------------------------------------------------------------
  // Marker alle som sendt
  // ------------------------------------------------------------------
  const handleMarkAllSent = async () => {
    setMarking(true);
    try {
      const now = new Date().toISOString();
      // Opdatér alle leverandører hvor status er 'invited' er fint — vi
      // sætter invite_status og invited_at. 'declined'/'responded' lader vi være.
      const toMark = rows.filter(
        (r) =>
          r.inviteStatus !== 'declined' &&
          r.inviteStatus !== 'responded',
      );

      for (const row of toMark) {
        await apiUpdateSupplierInvite(row.rfqSupplierId, {
          invite_status: 'invited',
          invited_at: now,
          contact_email: row.email || null,
        });
      }

      // Opdatér også RFQ-status hvis den stadig er draft.
      if (rfq.status === 'draft') {
        try {
          await apiUpdateRfqStatus(rfq.id, 'sent');
        } catch (err) {
          // Non-fatal — log men blokér ikke success-toasten.
          console.warn('[SendRFQDialog] kunne ikke opdatere RFQ til sent:', err);
        }
      }

      toast({
        title: 'Markeret som sendt',
        description: `${toMark.length} leverandør${toMark.length === 1 ? '' : 'er'} markeret som inviteret.`,
      });
      onMarkedSent();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Kunne ikke markere som sendt',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        variant: 'destructive',
      });
    } finally {
      setMarking(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send prisforespørgsel: {rfq.title}</DialogTitle>
          <DialogDescription>
            Download PDF, redigér emne og besked, og åbn en mail i Outlook pr.
            leverandør.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Excel (primær) + PDF (sekundær) */}
          <div className="border rounded p-3 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">Excel-skabelon (anbefalet)</div>
                <div className="text-xs text-muted-foreground">
                  Struktureret ark leverandøren udfylder direkte. Vedhæft
                  manuelt i hver Outlook-mail.
                </div>
              </div>
              <Button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {downloadingExcel ? 'Genererer...' : 'Hent Excel-skabelon'}
              </Button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm">
                <div className="font-medium text-muted-foreground">
                  PDF-specifikation (fallback)
                </div>
                <div className="text-xs text-muted-foreground">
                  Hvis Excel ikke passer leverandøren.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Genererer...' : 'Download PDF'}
              </Button>
            </div>
          </div>

          {/* Emne */}
          <div className="space-y-1.5">
            <Label htmlFor="rfq-subject">Emne</Label>
            <Input
              id="rfq-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="rfq-body">Besked-skabelon</Label>
            <Textarea
              id="rfq-body"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              <code>[navn]</code> erstattes automatisk med leverandørens
              kontaktperson.
            </p>
          </div>

          {/* Leverandør-liste */}
          <div className="space-y-2">
            <Label>Leverandører ({rows.length})</Label>
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Leverandør</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-40 text-right">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-6 text-sm"
                      >
                        Ingen leverandører tilføjet endnu.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.rfqSupplierId}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{row.supplierName}</div>
                          {row.contactPerson && (
                            <div className="text-xs text-muted-foreground">
                              {row.contactPerson}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={row.email}
                            placeholder="kontakt@leverandoer.dk"
                            onChange={(e) =>
                              updateRowEmail(row.rfqSupplierId, e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => openMailto(row)}
                            disabled={!row.email}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Åbn i Outlook
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Advarsel */}
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
            <strong>Bemærk:</strong> Excel/PDF skal vedhæftes manuelt i
            Outlook — mailto understøtter ikke vedhæftning.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Luk
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenAll}
            disabled={rows.length === 0}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Åbn alle i Outlook
          </Button>
          <Button
            onClick={handleMarkAllSent}
            disabled={rows.length === 0 || marking}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {marking ? 'Markerer...' : 'Marker alle som sendt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendRFQDialog;
