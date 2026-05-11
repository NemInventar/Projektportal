import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Search, Building, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { listOrganizations, createContact, updateContact } from '../lib/contactsApi';
import { CONTACT_TYPE } from '../constants';
import type { Contact } from '../types';

// TODO (V2): Overvej at merge crm_contacts (leads) og companies_2026_04_27
// til ét unified system. I V1 holdes de adskilte for at undgå migration af leads-data.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (org: Contact) => void;
  /** Hvis sat: dialogen åbner direkte i edit-mode for denne organisation. */
  initialEditOrg?: Contact | null;
  /** Default mode: 'pick' viser listen, 'edit' åbner direkte i edit-mode (kræver initialEditOrg) */
  defaultMode?: 'pick' | 'edit';
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
};

const emptyForm: FormState = { name: '', email: '', phone: '', address: '', city: '', zip: '' };

const formFromOrg = (org: Contact): FormState => ({
  name: org.name ?? '',
  email: org.email ?? '',
  phone: org.phone ?? '',
  address: org.address ?? '',
  city: org.city ?? '',
  zip: org.zip ?? '',
});

export const OrganizationPickerDialog: React.FC<Props> = ({ open, onOpenChange, onSelect, initialEditOrg, defaultMode = 'pick' }) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [mode, setMode] = useState<'pick' | 'create' | 'edit'>('pick');
  const [editingOrg, setEditingOrg] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Når dialogen åbner i edit-mode med en initialEditOrg
  useEffect(() => {
    if (open && defaultMode === 'edit' && initialEditOrg) {
      setEditingOrg(initialEditOrg);
      setForm(formFromOrg(initialEditOrg));
      setMode('edit');
    } else if (open && defaultMode === 'pick') {
      setMode('pick');
    }
  }, [open, defaultMode, initialEditOrg]);

  // Search-loader
  useEffect(() => {
    if (!open || mode !== 'pick') return;
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
  }, [open, search, mode]);

  const resetAndClose = () => {
    setForm(emptyForm);
    setEditingOrg(null);
    setMode('pick');
    setSearch('');
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Navn er påkrævet', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const org = await createContact({
        name: form.name.trim(),
        contact_type: CONTACT_TYPE.COMPANY,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        zip: form.zip.trim() || null,
      });
      onSelect(org);
      resetAndClose();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke oprette', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingOrg) return;
    if (!form.name.trim()) {
      toast({ title: 'Navn er påkrævet', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const updated = await updateContact(editingOrg.id, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        zip: form.zip.trim() || null,
      });
      toast({ title: 'Organisation opdateret', description: updated.name });
      // Hvis dialogen blev åbnet via edit-mode (fra LeadDetail), vælg den opdaterede org så parenten får friske data
      if (defaultMode === 'edit') {
        onSelect(updated);
      }
      resetAndClose();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke opdatere', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (org: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOrg(org);
    setForm(formFromOrg(org));
    setMode('edit');
  };

  const renderForm = (submitLabel: string, onSubmit: () => void) => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="org-name">Virksomhedsnavn *</Label>
        <Input id="org-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Fx Ason ApS" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="org-email">Email</Label>
          <Input id="org-email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="kontakt@firma.dk" />
        </div>
        <div>
          <Label htmlFor="org-phone">Telefon</Label>
          <Input id="org-phone" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+45 12 34 56 78" />
        </div>
      </div>
      <div>
        <Label htmlFor="org-addr">Adresse</Label>
        <Input id="org-addr" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="org-zip">Postnr.</Label>
          <Input id="org-zip" value={form.zip} onChange={(e) => setForm(p => ({ ...p, zip: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="org-city">By</Label>
          <Input id="org-city" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={onSubmit} className="flex-1" disabled={saving || !form.name.trim()}>
          {saving ? 'Gemmer…' : submitLabel}
        </Button>
        <Button variant="outline" onClick={() => { setMode('pick'); setForm(emptyForm); setEditingOrg(null); }} disabled={saving}>
          Annullér
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Opret ny organisation' : mode === 'edit' ? 'Rediger organisation' : 'Vælg organisation'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'create' && renderForm('Opret og vælg', handleCreate)}
        {mode === 'edit' && renderForm('Gem ændringer', handleUpdate)}

        {mode === 'pick' && (
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
                  <div
                    key={org.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted border-b last:border-b-0 cursor-pointer"
                    onClick={() => { onSelect(org); resetAndClose(); }}
                  >
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{org.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[org.city, org.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={(e) => startEdit(org, e)}
                      title="Rediger organisation"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Button variant="outline" onClick={() => { setForm(emptyForm); setMode('create'); }} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Opret ny virksomhed
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
