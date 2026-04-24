import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createActivity } from '../lib/activitiesApi';
import { ACTIVITY_TYPE, ACTIVITY_TYPE_LABEL, OWNER_EMAILS, OWNER_NAME, type ActivityType } from '../constants';
import { QUICK_TIMES } from '../lib/focus';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  defaultOwner?: string;
  onCreated?: () => void;
}

export const LeadActivityDialog: React.FC<Props> = ({ open, onOpenChange, dealId, defaultOwner, onCreated }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>(ACTIVITY_TYPE.CALL);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [owner, setOwner] = useState<string>(defaultOwner ?? 'js@neminventar.dk');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setActivityType(ACTIVITY_TYPE.CALL);
    setDescription('');
    setDueDate('');
    setDueTime('');
    setOwner(defaultOwner ?? 'js@neminventar.dk');
  };

  const applyQuickTime = (fn: () => { due_date: string; due_time: string }) => {
    const { due_date, due_time } = fn();
    setDueDate(due_date);
    setDueTime(due_time.slice(0, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Titel er påkrævet', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createActivity({
        deal_id: dealId,
        activity_type: activityType,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        due_time: dueTime ? `${dueTime}:00` : null,
        assigned_to: owner,
      });
      toast({ title: 'Aktivitet oprettet' });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ny aktivitet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ACTIVITY_TYPE).map((t) => (
                    <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ejer</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_EMAILS.map((e) => (
                    <SelectItem key={e} value={e}>{OWNER_NAME[e] ?? e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="activity-title">Titel *</Label>
            <Input
              id="activity-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fx Ring til Maria om tegninger"
            />
          </div>

          <div>
            <Label>Hurtig-tid</Label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_TIMES.map((qt) => (
                <Button
                  key={qt.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickTime(qt.fn)}
                >
                  {qt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="due-date">Dato</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="due-time">Tid</Label>
              <Input
                id="due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="activity-desc">Beskrivelse</Label>
            <Textarea
              id="activity-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Opretter…' : 'Opret aktivitet'}
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
