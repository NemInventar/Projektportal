/**
 * RFQHeaderCard — topcard på RFQDetail-siden.
 *
 * Viser titel, projekt-navn, status-badge, deadline, oprettet-af.
 * Action-knapper: [Redigér | Annullér | Luk].
 *
 * "Redigér" og "Annullér"/"Luk" er callbacks fra pagen.
 * Komponenten er derfor "dumb" — ingen state selv.
 */
import React from 'react';
import { Calendar, Bot, User, XCircle, Lock, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('da-DK');
  } catch {
    return iso;
  }
}

export interface RFQHeaderCardProps {
  rfq: Rfq;
  projectName?: string;
  onEdit?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const RFQHeaderCard: React.FC<RFQHeaderCardProps> = ({
  rfq,
  projectName,
  onEdit,
  onCancel,
  onClose,
}) => {
  const canEdit = rfq.status === 'draft' || rfq.status === 'sent' || rfq.status === 'partially_received';
  const canCancel = canEdit || rfq.status === 'closed';
  const canClose = rfq.status === 'sent' || rfq.status === 'partially_received';

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            {projectName && <span className="truncate">{projectName}</span>}
            <span>·</span>
            <span>
              {rfq.created_by === 'claude_auto' ? (
                <span className="inline-flex items-center gap-1">
                  <Bot className="h-3 w-3" /> Auto-oprettet
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> Manuelt oprettet
                </span>
              )}
            </span>
            <span>·</span>
            <span>{fmtDate(rfq.created_at)}</span>
          </div>
          <h1 className="text-2xl font-bold truncate">{rfq.title}</h1>
          {rfq.description && (
            <p className="text-sm text-muted-foreground mt-1">{rfq.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge className={`text-sm ${STATUS_COLOR[rfq.status]}`}>
            {STATUS_LABEL[rfq.status]}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Frist: {fmtDate(rfq.deadline)}
          </div>
        </div>
      </div>

      {(onEdit || onCancel || onClose) && (
        <div className="flex gap-2 pt-2 border-t">
          {onEdit && canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
              <Edit className="h-3.5 w-3.5" /> Redigér
            </Button>
          )}
          {onClose && canClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
              <Lock className="h-3.5 w-3.5" /> Luk
            </Button>
          )}
          {onCancel && canCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-2 text-red-600 hover:text-red-700">
              <XCircle className="h-3.5 w-3.5" /> Annullér
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

export default RFQHeaderCard;
