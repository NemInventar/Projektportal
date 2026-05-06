import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, Building2, X } from 'lucide-react';
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
  country: 'Danmark',
  defaultContactName: '',
  defaultContactEmail: '',
  defaultContactPhone: '',
  isCustomer: true,
  isSupplier: false,
  isPartner: false,
  isStandard: false,
  status: 'Aktiv',
  website: '',
  tags: [],
  notes: '',
};

const formatCompanyAddress = (c: Company): string => {
  const cityZip = [c.addressZip, c.addressCity].filter(Boolean).join(' ');
  return [c.addressLine1, cityZip].filter(Boolean).join(', ');
};

interface CompanyRefs {
  contacts: Array<{ id: string; name: string }>;
  quotes: Array<{ id: string; quote_number: string; title: string }>;
  projects: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; title: string }>;
}

const emptyRefs: CompanyRefs = { contacts: [], quotes: [], projects: [], deals: [] };

const Companies: React.FC = () => {
  const { companies, loading, addCompany, updateCompany, removeCompany } = useCompanies();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'supplier' | 'partner'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Saml alle distincte tags fra companies — vises som filter-chips ovenover tabellen.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    companies.forEach(c => (c.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [companies]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteRefs, setDeleteRefs] = useState<CompanyRefs | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Linkede entiteter for det firma der er åbent i edit-dialog
  const [editingRefs, setEditingRefs] = useState<CompanyRefs>(emptyRefs);
  const [refsLoading, setRefsLoading] = useState(false);

  const fetchCompanyRefs = async (companyId: string): Promise<CompanyRefs> => {
    const [contacts, quotes, projects, deals] = await Promise.all([
      supabase.from('crm_contacts_2026_04_12').select('id, name').eq('company_id', companyId).order('name'),
      supabase.from('project_quotes_2026_01_16_23_00').select('id, quote_number, title').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('projects_2026_01_15_06_45').select('id, name').eq('customer_company_id', companyId).order('name'),
      supabase.from('crm_deals_2026_04_12').select('id, title').eq('company_id', companyId).order('updated_at', { ascending: false }),
    ]);
    return {
      contacts: (contacts.data ?? []) as any,
      quotes: (quotes.data ?? []) as any,
      projects: (projects.data ?? []) as any,
      deals: (deals.data ?? []) as any,
    };
  };

  // Hent linkede entiteter når dialog åbnes for et eksisterende firma
  useEffect(() => {
    if (!dialogOpen || !editingId) {
      setEditingRefs(emptyRefs);
      return;
    }
    setRefsLoading(true);
    fetchCompanyRefs(editingId)
      .then(setEditingRefs)
      .catch((err) => console.error('Could not load company references:', err))
      .finally(() => setRefsLoading(false));
  }, [dialogOpen, editingId]);

  const filtered = useMemo(() => {
    let list = companies;
    if (roleFilter !== 'all') {
      list = list.filter(c =>
        roleFilter === 'customer' ? c.isCustomer :
        roleFilter === 'supplier' ? c.isSupplier :
        c.isPartner,
      );
    }
    if (tagFilter) {
      list = list.filter(c => (c.tags || []).includes(tagFilter));
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
  }, [companies, search, roleFilter, tagFilter]);

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
      country: c.country ?? 'Danmark',
      defaultContactName: c.defaultContactName ?? '',
      defaultContactEmail: c.defaultContactEmail ?? '',
      defaultContactPhone: c.defaultContactPhone ?? '',
      isCustomer: c.isCustomer,
      isSupplier: c.isSupplier,
      isPartner: c.isPartner,
      isStandard: c.isStandard ?? false,
      status: c.status ?? 'Aktiv',
      website: c.website ?? '',
      tags: c.tags ?? [],
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
        country: form.country?.trim() || undefined,
        defaultContactName: form.defaultContactName?.trim() || undefined,
        defaultContactEmail: form.defaultContactEmail?.trim() || undefined,
        defaultContactPhone: form.defaultContactPhone?.trim() || undefined,
        website: form.website?.trim() || undefined,
        tags: form.tags && form.tags.length > 0 ? form.tags : undefined,
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
    setDeleteRefs(null);
    try {
      const refs = await fetchCompanyRefs(c.id);
      setDeleteRefs(refs);
    } catch {
      setDeleteRefs(null);
    }
  };

  const totalRefs = (r: CompanyRefs | null) =>
    r ? r.contacts.length + r.quotes.length + r.projects.length + r.deals.length : 0;

  const handleDelete = async () => {
    if (!deleteTarget || !deleteRefs) return;
    if (totalRefs(deleteRefs) > 0) return;
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
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3">
                <span className="text-xs text-muted-foreground mr-1">Tags:</span>
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={tagFilter === tag ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setTagFilter(prev => (prev === tag ? null : tag))}
                  >
                    {tag}
                  </Badge>
                ))}
                {tagFilter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setTagFilter(null)}
                  >
                    <X className="h-3 w-3 mr-1" /> Ryd
                  </Button>
                )}
              </div>
            )}
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
                          {c.status === 'Arkiveret' && <Badge variant="outline" className="text-muted-foreground">Arkiveret</Badge>}
                          {(c.tags || []).map(t => (
                            <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
                          ))}
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
                <div className="flex gap-3 pt-2 flex-wrap">
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
              <div className="space-y-1">
                <Label htmlFor="co_status">Status</Label>
                <Select
                  value={form.status ?? 'Aktiv'}
                  onValueChange={(v) => setForm(p => ({ ...p, status: v }))}
                >
                  <SelectTrigger id="co_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktiv">Aktiv</SelectItem>
                    <SelectItem value="Arkiveret">Arkiveret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="co_country">Land</Label>
                <Input
                  id="co_country"
                  value={form.country || ''}
                  onChange={(e) => setForm(p => ({ ...p, country: e.target.value }))}
                  placeholder="Danmark"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="co_website">Hjemmeside</Label>
                <Input
                  id="co_website"
                  type="url"
                  value={form.website || ''}
                  onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(form.tags ?? []).map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, tags: (p.tags ?? []).filter(x => x !== t) }))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Skriv tag og tryk Enter (fx hovedentreprenør, arkitekt, bygherre)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = (e.currentTarget.value || '').trim().toLowerCase();
                      if (!v) return;
                      setForm(p => {
                        const existing = p.tags ?? [];
                        if (existing.includes(v)) return p;
                        return { ...p, tags: [...existing, v] };
                      });
                      e.currentTarget.value = '';
                    }
                  }}
                />
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="text-xs text-muted-foreground">Eksisterende:</span>
                    {allTags
                      .filter(t => !(form.tags ?? []).includes(t))
                      .slice(0, 12)
                      .map(t => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="cursor-pointer text-xs font-normal hover:bg-muted"
                          onClick={() => setForm(p => ({ ...p, tags: [...(p.tags ?? []), t] }))}
                        >
                          + {t}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={form.isStandard ?? false}
                    onCheckedChange={(v) => setForm(p => ({ ...p, isStandard: !!v }))}
                  />
                  Standard-firma (vises i quick-pickers og lister)
                </label>
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
              {editingId && (
                <div className="md:col-span-2 border-t pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Linkede entiteter</h4>
                    {refsLoading && <span className="text-xs text-muted-foreground">Indlæser…</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {/* Kontakter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Kontakter ({editingRefs.contacts.length})</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={() => navigate(`/kontakter?company=${editingId}&new=1`)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Opret kontakt
                        </Button>
                      </div>
                      {editingRefs.contacts.slice(0, 3).map(c => (
                        <div key={c.id} className="text-xs">
                          <button
                            type="button"
                            onClick={() => navigate(`/kontakter?company=${editingId}`)}
                            className="text-left hover:underline"
                          >
                            {c.name}
                          </button>
                        </div>
                      ))}
                      {editingRefs.contacts.length > 3 && (
                        <div className="text-xs text-muted-foreground">+ {editingRefs.contacts.length - 3} flere</div>
                      )}
                      {editingRefs.contacts.length === 0 && !refsLoading && (
                        <div className="text-xs text-muted-foreground italic">Ingen kontakter endnu</div>
                      )}
                    </div>

                    {/* Tilbud */}
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground">Tilbud ({editingRefs.quotes.length})</span>
                      {editingRefs.quotes.slice(0, 3).map(q => (
                        <div key={q.id} className="text-xs truncate">
                          <span className="font-mono">{q.quote_number}</span> · {q.title}
                        </div>
                      ))}
                      {editingRefs.quotes.length > 3 && (
                        <div className="text-xs text-muted-foreground">+ {editingRefs.quotes.length - 3} flere</div>
                      )}
                      {editingRefs.quotes.length === 0 && !refsLoading && (
                        <div className="text-xs text-muted-foreground italic">Ingen tilbud</div>
                      )}
                    </div>

                    {/* Projekter */}
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground">Projekter ({editingRefs.projects.length})</span>
                      {editingRefs.projects.slice(0, 3).map(p => (
                        <div key={p.id} className="text-xs truncate">{p.name}</div>
                      ))}
                      {editingRefs.projects.length > 3 && (
                        <div className="text-xs text-muted-foreground">+ {editingRefs.projects.length - 3} flere</div>
                      )}
                      {editingRefs.projects.length === 0 && !refsLoading && (
                        <div className="text-xs text-muted-foreground italic">Ingen projekter</div>
                      )}
                    </div>

                    {/* Deals */}
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground">Deals ({editingRefs.deals.length})</span>
                      {editingRefs.deals.slice(0, 3).map(d => (
                        <div key={d.id} className="text-xs truncate">{d.title}</div>
                      ))}
                      {editingRefs.deals.length > 3 && (
                        <div className="text-xs text-muted-foreground">+ {editingRefs.deals.length - 3} flere</div>
                      )}
                      {editingRefs.deals.length === 0 && !refsLoading && (
                        <div className="text-xs text-muted-foreground italic">Ingen deals</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {editingId && (() => {
                const editing = companies.find(c => c.id === editingId);
                if (!editing?.legacySupplierId) return null;
                return (
                  <div className="md:col-span-2 text-xs text-muted-foreground border-t pt-2">
                    Migreret fra <code className="text-xs bg-muted px-1 py-0.5 rounded">standard_suppliers.id = {editing.legacySupplierId}</code>
                  </div>
                );
              })()}
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
                  deleteRefs === null
                    ? `Tjekker referencer for "${deleteTarget.name}"…`
                    : totalRefs(deleteRefs) > 0
                      ? `"${deleteTarget.name}" er linket til andre data og kan ikke slettes. Fjern eller flyt referencerne først:`
                      : `Er du sikker på at du vil slette "${deleteTarget.name}"? Handlingen kan ikke fortrydes.`
                )}
              </DialogDescription>
            </DialogHeader>
            {deleteRefs && totalRefs(deleteRefs) > 0 && (
              <div className="text-sm space-y-1 bg-muted/50 rounded p-3">
                {deleteRefs.contacts.length > 0 && <div>· {deleteRefs.contacts.length} kontakt{deleteRefs.contacts.length > 1 ? 'er' : ''}</div>}
                {deleteRefs.quotes.length > 0 && <div>· {deleteRefs.quotes.length} tilbud</div>}
                {deleteRefs.projects.length > 0 && <div>· {deleteRefs.projects.length} projekt{deleteRefs.projects.length > 1 ? 'er' : ''}</div>}
                {deleteRefs.deals.length > 0 && <div>· {deleteRefs.deals.length} deal{deleteRefs.deals.length > 1 ? 's' : ''}</div>}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {deleteRefs && totalRefs(deleteRefs) > 0 ? 'Luk' : 'Annullér'}
              </Button>
              {deleteRefs && totalRefs(deleteRefs) === 0 && (
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
