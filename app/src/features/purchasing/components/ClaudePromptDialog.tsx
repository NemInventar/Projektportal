/**
 * ClaudePromptDialog — genererer en færdig prompt til Claude Desktop
 * (Procurement-projektet) der driver SEND-workflowet.
 *
 * Bruger: klik "Hent Claude prompt" på RFQDetail → dialog åbner med prompten
 * i en readonly textarea. Kopiér til udklipsholder og paste i Claude Desktop.
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RfqWithRelations } from '../types';

interface Props {
  rfq: RfqWithRelations;
  projectName: string;
  projectNumber?: string;
  supplierNames: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(date?: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('da-DK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildPrompt({
  rfq,
  projectName,
  projectNumber,
  supplierNames,
}: {
  rfq: RfqWithRelations;
  projectName: string;
  projectNumber?: string;
  supplierNames: Record<string, string>;
}): string {
  const lines = [...rfq.lines]
    .sort((a, b) => a.line_no - b.line_no)
    .map(
      (l) =>
        `| ${l.line_no} | ${l.name} | ${l.spec ?? ''} | ${l.qty} | ${l.unit} |`,
    )
    .join('\n');

  const suppliers = rfq.suppliers
    .map((s) => {
      const name = supplierNames[s.supplier_id] ?? 'Ukendt leverandør';
      const email = s.contact_email ?? '(kontakt-email mangler)';
      const person = s.contact_person ? ` (${s.contact_person})` : '';
      return `- ${name}${person} · ${email} · invite_status=${s.invite_status}`;
    })
    .join('\n');

  return `Kør WORKFLOW: SEND på RFQ id \`${rfq.id}\`.

**RFQ:** ${rfq.title}
**Projekt:** ${projectName}${projectNumber ? ` (${projectNumber})` : ''}
**Deadline:** ${formatDate(rfq.deadline)}
**Leveringsvindue:** ${formatDate(rfq.first_delivery_date)} → ${formatDate(rfq.last_delivery_date)}
**Betalingsvilkår:** ${rfq.payment_terms ?? '—'}
**Status:** ${rfq.status}

**Leverandører (${rfq.suppliers.length}):**
${suppliers || '(ingen)'}

**Linjer (${rfq.lines.length}):**
| # | Vare | Specifikation | Antal | Enhed |
|---|------|---------------|-------|-------|
${lines || '(ingen)'}

Generér mail-body pr. leverandør (markdown). Excel-skabelon er foretrukken over PDF. Efter min bekræftelse: marker leverandørerne som inviteret og opdatér RFQ-status fra draft til sent.`;
}

export const ClaudePromptDialog: React.FC<Props> = ({
  rfq,
  projectName,
  projectNumber,
  supplierNames,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const prompt = buildPrompt({ rfq, projectName, projectNumber, supplierNames });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({
        title: 'Kopieret',
        description: 'Paste i Claude Desktop → Procurement-projektet',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Kunne ikke kopiere automatisk',
        description: 'Marker teksten manuelt og brug Ctrl+C',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Claude Desktop prompt</DialogTitle>
          <DialogDescription>
            Kopiér og paste i Claude Desktop → Procurement-projektet. Claude
            genererer mail-body pr. leverandør og opdaterer DB efter din
            bekræftelse.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={prompt}
          readOnly
          rows={18}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Luk
          </Button>
          <Button onClick={handleCopy} className="gap-2">
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Kopieret' : 'Kopiér til udklipsholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClaudePromptDialog;
