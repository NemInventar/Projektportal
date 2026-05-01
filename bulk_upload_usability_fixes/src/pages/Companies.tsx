import React, { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { useCompanies, Company, CompanyInput } from '@/contexts/CompaniesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// TODO (V2): Overvej at merge companies_2026_04_27 og crm_contacts (leads)
// til ét unified system. I V1 holdes de adskilte for at undgå migration af leads-data.

const emptyForm: CompanyInput = {
  name: '',
  cvr: '',
  addressLine1: '',
  addressLine2: '',
  addressZip: '',
  addressCity: '',
  defaultContactName: '',
  defaultContactEmail: '',
  defaultContactPhone: '',
  isCustomer: true,
  isSupplier: false,
  isPartner: false,
  notes: '',
};

const formatCompanyAddress = (c: Company): string => {
  const cityZip = [c.addressZip, c.addressCity].filter(Boolean).join(' ');
  return [c.addressLine1, cityZip].filter(Boolean).join(', ');
};

const Companies: React.FC = () => {
  const { companies, loading, addCompany, updateCompany, removeCompany, countQuotesUsing } = useCompanies();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'supplier' | 'partner'>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = companies;
    if (roleFilter !== 'all') {
      list = list.filter(c =>
        roleFilter === 'customer' ? c.isCustomer :
        roleFilter === 'supplier' ? c.isSupplier :
        c.isPartner,
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.cvr || '').toLowerCase().includes(q) ||
        (c.addressCity || '').toLowerCase().includes(q) ||
        (c.defaultContactName || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [companies, search, roleFilter]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      cvr: c.cvr ?? '',
      addressLine1: c.addressLine1 ?? '',
      addressLine2: c.addressLine2 ?? '',
      addressZip: c.addressZip ?? '',
      addressCity: c.addressCity ?? '',
      defaultContactName: c.defaultContactName ?? '',
      defaultContactEmail: c.defaultContactEmail ?? '',
      defaultContactPhone: c.defaultContactPhone ?? '',
      isCustomer: c.isCustomer,
      isSupplier: c.isSupplier,
      isPartner: c.isPartner,
      notes: c.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Fejl', description: 'Firmanavn er påkrævet', variant: 'destructive' });
      return;
    }
    if (!form.isCustomer && !form.isSupplier && !form.isPartner) {
      toast({ title: 'Fejl', description: 'Vælg mindst én rolle', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload: CompanyInput = {
        ...form,
        name: form.name.trim(),
        cvr: form.cvr?.trim() || undefined,
        addressLine1: form.addressLine1?.trim() || undefined,
        addressLine2: form.addressLine2?.trim() || undefined,
        addressZip: form.addressZip?.trim() || undefined,
        addressCity: form.addressCity?.trim() || undefined,
        defaultContactName: form.defaultContactName?.trim() || undefined,
        defaultContactEmail: form.defaultContactEmail?.trim() || undefined,
        defaultContactPhone: form.defaultContactPhone?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      if (editingId) {
        await updateCompany(editingId, payload);
        toast({ title: 'Firma opdateret', description: payload.name });
      } else {
        await addCompany(payload);
        toast({ title: 'Firma oprettet', description: payload.name });
      }
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke gemme firma', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openDelete = async (c: Company) => {
    setDeleteTarget(c);
    setDeleteUsageCount(null);
    try {
      const count = await countQuotesUsing(c.id);
      setDeleteUsageCount(count);
    } catch {
      setDeleteUsageCount(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if ((deleteUsageCount ?? 0) > 0) return;
    try {
      setDeleting(true);
      await removeCompany(deleteTarget.id);
      toast({ title: 'Firma slettet', description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke slette firma', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Building2 className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Firmaer</h1>
            </div>
            <p className="text-muted-foreground">Kunder, leverandører og samarbejdspartnere — bruges på tilbud og PDF.</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nyt firma
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <CardTitle className="text-lg">{filtered.length} firmaer</CardTitle>
              <div className="flex flex-1 md:flex-initial gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg navn, CVR, by, kontakt"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1">
                  {(['all', 'customer', 'supplier', 'partner'] as const).map(r => (
                    <Button
                      key={r}
                      size="sm"
                      variant={roleFilter === r ? 'default' : 'outline'}
                      onClick={() => setRoleFilter(r)}
                    >
                      {r === 'all' ? 'Alle' : r === 'customer' ? 'Kunder' : r === 'supplier' ? 'Leverandører' : 'Partnere'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Indlæser…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {companies.length === 0 ? 'Ingen firmaer endnu — opret det første via knappen ovenfor.' : 'Ingen match.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>CVR</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Kontaktperson</TableHead>
                    <TableHead>Roller</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(c)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.cvr || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatCompanyAddress(c) || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {c.defaultContactName || '—'}
                        {c.defaultContactEmail && (
                          <div className="text-xs text-muted-foreground">{c.defaultContactEmail}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {c.isCustomer && <Badge variant="secondary">Kunde</Badge>}
                          {c.isSupplier && <Badge variant="secondary">Leverandør</Badge>}
                          {c.isPartner && <Badge variant="secondary">Partner</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="h-8 w-8 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDelete(c)} className="h-8 w-8 p-0 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Opret/rediger dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Rediger firma' : 'Nyt firma'}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Ændringer slår igennem på tilbuds-PDF (firmanavn, CVR, adresse hentes live).'
                  : 'Tilføj kunde, leverandør eller samarbejdspartner.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="co_name">Firmanavn *</Label>
                <Input id="co_name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co_cvr">CVR</Label>
                <Input id="co_cvr" value={form.cvr || ''} onChange={(e) => setForm(p => ({ ...p, cvr: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Roller *</Label>
                <div className="flex gap-3 pt-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={form.isCustomer} onCheckedChange={(v) => setForm(p => ({ ...p, isCustomer: !!v }))} />
                    Kunde
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={form.isSupplier} onCheckedChange={(v) => setForm(p => ({ ...p, isSupplier: !!v }))} />
                    Leverandør
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={form.isPartner} onCheckedChange={(v) => setForm(p => ({ ...p, isPartner: !!v }))} />
                    Partner
                  </label>
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="co_addr1">Adresse</Label>
                <Input id="co_addr1" value={form.addressLine1 || ''} onChange={(e) => setForm(p => ({ ...p, addressLine1: e.target.value }))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="co_addr2">Adresse linje 2</Label>
                <Input id="co_addr2" value={form.addressLine2 || ''} onChange={(e) => setForm(p => ({ ...p, addressLine2: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co_zip">Postnr.</Label>
                <Input id="co_zip" value={form.addressZip || ''} onChange={(e) => setForm(p => ({ ...p, addressZip: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co_city">By</Label>
                <Input id="co_city" value={form.addressCity || ''} onChange={(e) => setForm(p => ({ ...p, addressCity: e.target.value }))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="co_contact">Kontaktperson</Label>
                <Input id="co_contact" value={form.defaultContactName || ''} onChange={(e) => setForm(p => ({ ...p, defaultContactName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co_email">Email</Label>
                <Input id="co_email" type="email" value={form.defaultContactEmail || ''} onChange={(e) => setForm(p => ({ ...p, defaultContactEmail: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co_phone">Telefon</Label>
                <Input id="co_phone" value={form.defaultContactPhone || ''} onChange={(e) => setForm(p => ({ ...p, defaultContactPhone: e.target.value }))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="co_notes">Noter</Label>
                <Textarea id="co_notes" rows={2} value={form.notes || ''} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annullér</Button>
              <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
                {saving ? 'Gemmer…' : editingId ? 'Gem ændringer' : 'Opret'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Slet-bekræftelse */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Slet firma</DialogTitle>
              <DialogDescription>
                {deleteTarget && (
                  deleteUsageCount === null
                    ? `Tjekker om "${deleteTarget.name}" bruges på tilbud…`
                    : deleteUsageCount > 0
                      ? `"${deleteTarget.name}" er linket til ${deleteUsageCount} tilbud og kan ikke slettes. Fjern referencen fra tilbuddene først.`
                      : `Er du sikker på at du vil slette "${deleteTarget.name}"? Handlingen kan ikke fortrydes.`
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {(deleteUsageCount ?? 0) > 0 ? 'Luk' : 'Annullér'}
              </Button>
              {(deleteUsageCount ?? 0) === 0 && deleteUsageCount !== null && (
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Sletter…' : 'Slet'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Companies;
