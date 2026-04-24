import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { convertDealToProject } from '../lib/convertApi';
import type { Deal } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  userEmail: string;
  onConverted: (projectId: string) => void;
}

export const ConvertLeadDialog: React.FC<Props> = ({ open, onOpenChange, deal, userEmail, onConverted }) => {
  const { toast } = useToast();
  const [projectNumber, setProjectNumber] = useState('');
  const [projectName, setProjectName] = useState(deal.title);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setProjectName(deal.title);
      setProjectNumber('');
    }
  }, [open, deal.title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectNumber.trim()) {
      toast({ title: 'Projektnummer er påkrævet', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { projectId, projectNumber: num } = await convertDealToProject({
        deal_id: deal.id,
        project_number: projectNumber.trim(),
        project_name: projectName.trim() || undefined,
        user_email: userEmail,
      });
      toast({ title: `Konverteret til ${num}` });
      onOpenChange(false);
      onConverted(projectId);
    } catch (err: any) {
      const msg = err?.message ?? 'Kunne ikke konvertere';
      toast({
        title: 'Fejl',
        description: msg.includes('unique') || msg.includes('duplicate')
          ? 'Projektnummer er allerede i brug'
          : msg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Konvertér til projekt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="project-number">Projektnummer *</Label>
            <Input
              id="project-number"
              autoFocus
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="Fx P2026-020"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Skal være unikt på tværs af projekter.
            </p>
          </div>
          <div>
            <Label htmlFor="project-name">Projektnavn</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Default = lead-titel"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Lead'et bevares med reference til det nye projekt. Notater og aktiviteter flyttes ikke — de bliver ved leaden som revisionsspor.
          </p>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Konverterer…' : 'Konvertér'}
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
