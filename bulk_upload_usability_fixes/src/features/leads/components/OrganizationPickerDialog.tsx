import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Search, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { listOrganizations, createContact } from '../lib/contactsApi';
import { CONTACT_TYPE } from '../constants';
import type { Contact } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (org: Contact) => void;
}

export const OrganizationPickerDialog: React.FC<Props> = ({ open, onOpenChange, onSelect }) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listOrganizations(search);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, search]);

  const resetCreateForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setCreatingNew(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'Navn er påkrævet', variant: 'destructive' });
      return;
    }
    try {
      const org = await createContact({
        name: newName.trim(),
        contact_type: CONTACT_TYPE.COMPANY,
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
      });
      onSelect(org);
      resetCreateForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke oprette', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetCreateForm(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Vælg organisation</DialogTitle>
        </DialogHeader>

        {creatingNew ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-org-name">Virksomhedsnavn *</Label>
              <Input id="new-org-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Fx Ason ApS" />
            </div>
            <div>
              <Label htmlFor="new-org-email">Email</Label>
              <Input id="new-org-email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="kontakt@firma.dk" />
            </div>
            <div>
              <Label htmlFor="new-org-phone">Telefon</Label>
              <Input id="new-org-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+45 12 34 56 78" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} className="flex-1">Opret og vælg</Button>
              <Button variant="outline" onClick={resetCreateForm}>Annullér</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Søg virksomhed…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-80 overflow-y-auto border rounded">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Søger…</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Ingen match</div>
              ) : (
                results.map((org) => (
                  <button
                    key={org.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0 flex items-center gap-2"
                    onClick={() => { onSelect(org); onOpenChange(false); }}
                  >
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{org.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[org.city, org.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Button variant="outline" onClick={() => setCreatingNew(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Opret ny virksomhed
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
