import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { markDealLost } from '../lib/dealsApi';

const REASONS = [
  'Pris for høj',
  'Tid ikke passende',
  'Gik til konkurrent',
  'Kunde droppede projekt',
  'Kunde tog selv opgaven',
  'Andet',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onLost: () => void;
}

export const MarkLeadLostDialog: React.FC<Props> = ({ open, onOpenChange, dealId, onLost }) => {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('Pris for høj');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fullReason = detail.trim().length > 0 ? `${reason} — ${detail.trim()}` : reason;
    try {
      await markDealLost(dealId, fullReason);
      toast({ title: 'Markeret som tabt' });
      setReason('Pris for høj');
      setDetail('');
      onOpenChange(false);
      onLost();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Markér som tabt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Årsag</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="lost-detail">Uddybning</Label>
            <Textarea
              id="lost-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Valgfrit — fx konkurrent-navn eller pris-niveau"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} variant="destructive" className="flex-1">
              {saving ? 'Gemmer…' : 'Markér som tabt'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annullér
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
