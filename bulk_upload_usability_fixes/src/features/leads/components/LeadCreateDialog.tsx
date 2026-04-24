import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createDeal } from '../lib/dealsApi';
import { OWNER_EMAILS, OWNER_NAME } from '../constants';
import { OrganizationPickerDialog } from './OrganizationPickerDialog';
import type { Contact } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (dealId: string) => void;
  defaultOwner?: string;
}

export const LeadCreateDialog: React.FC<Props> = ({ open, onOpenChange, onCreated, defaultOwner }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState<Contact | null>(null);
  const [primaryContact, setPrimaryContact] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [expectedClose, setExpectedClose] = useState('');
  const [sourceChannel, setSourceChannel] = useState('');
  const [owner, setOwner] = useState<string>(defaultOwner ?? 'js@neminventar.dk');
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setOrg(null);
    setPrimaryContact('');
    setPrimaryContactPhone('');
    setExpectedClose('');
    setSourceChannel('');
    setOwner(defaultOwner ?? 'js@neminventar.dk');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Titel er påkrævet', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const deal = await createDeal({
        title: title.trim(),
        contact_id: org?.id ?? null,
        primary_contact: primaryContact.trim() || null,
        primary_contact_phone: primaryContactPhone.trim() || null,
        expected_close_date: expectedClose || null,
        source_channel: sourceChannel.trim() || null,
        assigned_to: owner,
      });
      toast({ title: 'Lead oprettet' });
      reset();
      onOpenChange(false);
      onCreated(deal.id);
    } catch (err: any) {
      toast({
        title: 'Fejl',
        description: err?.message ?? 'Kunne ikke oprette lead',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ny lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fx Daginstitution Vinge – inventar"
              />
            </div>

            <div>
              <Label>Organisation</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setOrgPickerOpen(true)}
              >
                <Building className="h-4 w-4" />
                {org ? org.name : 'Vælg organisation…'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contact">Kontaktperson</Label>
                <Input
                  id="contact"
                  value={primaryContact}
                  onChange={(e) => setPrimaryContact(e.target.value)}
                  placeholder="Fornavn Efternavn"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={primaryContactPhone}
                  onChange={(e) => setPrimaryContactPhone(e.target.value)}
                  placeholder="+45 …"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="expected">Forventet luk</Label>
                <Input
                  id="expected"
                  type="date"
                  value={expectedClose}
                  onChange={(e) => setExpectedClose(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="source">Kilde</Label>
                <Input
                  id="source"
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value)}
                  placeholder="Byggefakta, reference…"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="owner">Ejer</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger id="owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_EMAILS.map((email) => (
                    <SelectItem key={email} value={email}>
                      {OWNER_NAME[email] ?? email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Opretter…' : 'Opret lead'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annullér
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <OrganizationPickerDialog
        open={orgPickerOpen}
        onOpenChange={setOrgPickerOpen}
        onSelect={(o) => setOrg(o)}
      />
    </>
  );
};
