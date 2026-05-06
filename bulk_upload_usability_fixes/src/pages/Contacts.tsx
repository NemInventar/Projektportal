import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { useSearchParams } from 'react-router-dom';
import { useCompanies, Company } from '@/contexts/CompaniesContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, Pencil, Trash2, Contact as ContactIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TABLE = 'crm_contacts_2026_04_12';

interface ContactRow {
  id: string;
  name: string;
  companyId: string | null;
  companyText?: string | null;       // legacy company text-felt
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  contactType?: string | null;
  tags?: string[];
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  notes?: string | null;
  source?: string | null;
  contextSummary?: string | null;
  relationshipStage?: string | null;
  pipedrivePersonId?: number | null;
  pipedriveSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const rowToContact = (r: any): ContactRow => ({
  id: r.id,
  name: r.name,
  companyId: r.company_id ?? null,
  companyText: r.company ?? null,
  email: r.email ?? null,
  phone: r.phone ?? null,
  role: r.role ?? null,
  contactType: r.contact_type ?? null,
  tags: Array.isArray(r.tags) ? r.tags : [],
  address: r.address ?? null,
  city: r.city ?? null,
  zip: r.zip ?? null,
  country: r.country ?? null,
  notes: r.notes ?? null,
  source: r.source ?? null,
  contextSummary: r.context_summary ?? null,
  relationshipStage: r.relationship_stage ?? null,
  pipedrivePersonId: r.pipedrive_person_id ?? null,
  pipedriveSyncedAt: r.pipedrive_synced_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface ContactForm {
  name: string;
  companyId: string;
  email: string;
  phone: string;
  role: string;
  contactType: string;
  tags: string[];
  address: string;
  city: string;
  zip: string;
  country: string;
  notes: string;
  source: string;
  contextSummary: string;
  relationshipStage: string;
}

const emptyForm: ContactForm = {
  name: '',
  companyId: '',
  email: '',
  phone: '',
  role: '',
  contactType: 'person',
  tags: [],
  address: '',
  city: '',
  zip: '',
  country: 'Danmark',
  notes: '',
  source: '',
  contextSummary: '',
  relationshipStage: '',
};

interface ContactRefs {
  deals: Array<{ id: string; title: string }>;
  quotes: Array<{ id: string; quote_number: string; title: string }>;
  rfqInvitations: Array<{ id: string; rfq_id: string }>;
}

const emptyContactRefs: ContactRefs = { deals: [], quotes: [], rfqInvitations: [] };

const Contacts: React.FC = () => {
  const { companies } = useCompanies();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'person' | 'org'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Linkede entiteter for kontakten der er åbent i edit-dialog
  const [editingRefs, setEditingRefs] = useState<ContactRefs>(emptyContactRefs);
  const [refsLoading, setRefsLoading] = useState(false);

  const fetchContactRefs = async (contactId: string): Promise<ContactRefs> => {
    const [deals, quotes, invites] = await Promise.all([
      supabase.from('crm_deals_2026_04_12').select('id, title').eq('contact_id', contactId).order('updated_at', { ascending: false }),
      supabase.from('project_quotes_2026_01_16_23_00').select('id, quote_number, title').eq('recipient_contact_id', contactId).order('created_at', { ascending: false }),
      supabase.from('supplier_rfq_invitations').select('id, rfq_id').eq('contact_id', contactId),
    ]);
    return {
      deals: (deals.data ?? []) as any,
      quotes: (quotes.data ?? []) as any,
      rfqInvitations: (invites.data ?? []) as any,
    };
  };

  // Hent linkede entiteter når dialog åbnes for en eksisterende kontakt
  useEffect(() => {
    if (!dialogOpen || !editingId) {
      setEditingRefs(emptyContactRefs);
      return;
    }
    setRefsLoading(true);
    fetchContactRefs(editingId)
      .then(setEditingRefs)
      .catch((err) => console.error('Could not load contact references:', err))
      .finally(() => setRefsLoading(false));
  }, [dialogOpen, editingId]);

  const reload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(TABLE).select('*').order('name');
      if (error) throw error;
      setContacts((data ?? []).map(rowToContact));
    } catch (err) {
      console.error('Error loading contacts:', err);
      toast({ title: 'Fejl', description: 'Kunne ikke indlæse kontakter', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  // Læs URL-params: ?company={id} filtrerer listen, ?new=1 åbner create-dialog med company præudfyldt.
  useEffect(() => {
    const companyParam = searchParams.get('company');
    const newParam = searchParams.get('new');
    if (companyParam) {
      setCompanyFilter(companyParam);
    }
    if (newParam === '1' && companyParam) {
      setEditingId(null);
      setForm({ ...emptyForm, companyId: companyParam });
      setDialogOpen(true);
      // Fjern new-parameter så dialog ikke genåbnes ved tilbage-knap
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saml alle distincte tags på tværs af kontakter
  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => (c.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  // Companies-lookup map for hurtig opslag
  const companyById = useMemo(() => {
    const m = new Map<string, Company>();
    companies.forEach(c => m.set(c.id, c));
    return m;
  }, [companies]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (companyFilter) {
      list = list.filter(c => c.companyId === companyFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter(c => (c.contactType ?? 'person') === typeFilter);
    }
    if (tagFilter) {
      list = list.filter(c => (c.tags ?? []).includes(tagFilter));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.role || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [contacts, companyFilter, typeFilter, tagFilter, search]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: ContactRow) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      companyId: c.companyId ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      role: c.role ?? '',
      contactType: c.contactType ?? 'person',
      tags: c.tags ?? [],
      address: c.address ?? '',
      city: c.city ?? '',
      zip: c.zip ?? '',
      country: c.country ?? 'Danmark',
      notes: c.notes ?? '',
      source: c.source ?? '',
      contextSummary: c.contextSummary ?? '',
      relationshipStage: c.relationshipStage ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Fejl', description: 'Navn er påkrævet', variant: 'destructive' });
      return;
    }
    if (!form.companyId) {
      toast({ title: 'Fejl', description: 'Tilknyt kontakten til et firma', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const company = companyById.get(form.companyId);
      const row = {
        name: form.name.trim(),
        company_id: form.companyId,
        company: company?.name ?? null, // legacy text-felt holdes i sync
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role.trim() || null,
        contact_type: form.contactType || 'person',
        tags: form.tags.length > 0 ? form.tags : null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        zip: form.zip.trim() || null,
        country: form.country.trim() || null,
        notes: form.notes.trim() || null,
        source: form.source.trim() || null,
        context_summary: form.contextSummary.trim() || null,
        relationship_stage: form.relationshipStage.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase.from(TABLE).update(row).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Kontakt opdateret', description: row.name });
      } else {
        const { error } = await supabase.from(TABLE).insert(row);
        if (error) throw error;
        toast({ title: 'Kontakt oprettet', description: row.name });
      }
      setDialogOpen(false);
      await reload();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke gemme kontakt', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from(TABLE).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'Kontakt slettet', description: deleteTarget.name });
      setDeleteTarget(null);
      await reload();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke slette kontakt', variant: 'destructive' });
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
              <ContactIcon className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Kontakter</h1>
            </div>
            <p className="text-muted-foreground">Eksterne personer og organisationer — bruges på tilbud, deals og RFQ.</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Ny kontakt
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <CardTitle className="text-lg">{filtered.length} kontakter</CardTitle>
              <div className="flex flex-1 md:flex-initial gap-2 flex-wrap">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg navn, email, telefon, rolle"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={companyFilter ?? 'all'} onValueChange={(v) => setCompanyFilter(v === 'all' ? null : v)}>
                  <SelectTrigger className="md:w-56">
                    <SelectValue placeholder="Alle firmaer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle firmaer</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  {(['all', 'person', 'org'] as const).map(t => (
                    <Button
                      key={t}
                      size="sm"
                      variant={typeFilter === t ? 'default' : 'outline'}
                      onClick={() => setTypeFilter(t)}
                    >
                      {t === 'all' ? 'Alle' : t === 'person' ? 'Personer' : 'Organisationer'}
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
                {contacts.length === 0 ? 'Ingen kontakter endnu — opret den første via knappen ovenfor.' : 'Ingen match.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const company = c.companyId ? companyById.get(c.companyId) : null;
                    return (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(c)}>
                        <TableCell className="font-medium">
                          {c.name}
                          {c.contactType === 'org' && (
                            <Badge variant="outline" className="ml-2 text-xs font-normal">Org.</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {company ? (
                            <span className="text-foreground">{company.name}</span>
                          ) : c.companyText ? (
                            <span className="text-muted-foreground italic" title="Legacy text-felt — link til firma er ikke sat">
                              {c.companyText}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.role || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.email || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.phone || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(c.tags ?? []).map(t => (
                              <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="h-8 w-8 p-0">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(c)} className="h-8 w-8 p-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Opret/rediger dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Rediger kontakt' : 'Ny kontakt'}</DialogTitle>
              <DialogDescription>
                Eksterne personer og organisationer. Kontakter skal tilknyttes et firma.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ct_name">Navn *</Label>
                <Input
                  id="ct_name"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_company">Firma *</Label>
                <Select
                  value={form.companyId || ''}
                  onValueChange={(v) => setForm(p => ({ ...p, companyId: v }))}
                >
                  <SelectTrigger id="ct_company">
                    <SelectValue placeholder="Vælg firma" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_type">Type</Label>
                <Select
                  value={form.contactType || 'person'}
                  onValueChange={(v) => setForm(p => ({ ...p, contactType: v }))}
                >
                  <SelectTrigger id="ct_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="org">Organisation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_role">Rolle / titel</Label>
                <Input
                  id="ct_role"
                  placeholder="Fx Projektleder, Arkitekt, Indkøber"
                  value={form.role}
                  onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_stage">Relationsstadie</Label>
                <Input
                  id="ct_stage"
                  placeholder="Fx ny, igang, etableret"
                  value={form.relationshipStage}
                  onChange={(e) => setForm(p => ({ ...p, relationshipStage: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_email">Email</Label>
                <Input
                  id="ct_email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_phone">Telefon</Label>
                <Input
                  id="ct_phone"
                  value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ct_address">Adresse</Label>
                <Input
                  id="ct_address"
                  value={form.address}
                  onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_zip">Postnr.</Label>
                <Input
                  id="ct_zip"
                  value={form.zip}
                  onChange={(e) => setForm(p => ({ ...p, zip: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ct_city">By</Label>
                <Input
                  id="ct_city"
                  value={form.city}
                  onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ct_country">Land</Label>
                <Input
                  id="ct_country"
                  value={form.country}
                  onChange={(e) => setForm(p => ({ ...p, country: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Skriv tag og tryk Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = (e.currentTarget.value || '').trim().toLowerCase();
                      if (!v) return;
                      setForm(p => p.tags.includes(v) ? p : { ...p, tags: [...p.tags, v] });
                      e.currentTarget.value = '';
                    }
                  }}
                />
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="text-xs text-muted-foreground">Eksisterende:</span>
                    {allTags
                      .filter(t => !form.tags.includes(t))
                      .slice(0, 12)
                      .map(t => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="cursor-pointer text-xs font-normal hover:bg-muted"
                          onClick={() => setForm(p => ({ ...p, tags: [...p.tags, t] }))}
                        >
                          + {t}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ct_source">Kilde</Label>
                <Input
                  id="ct_source"
                  placeholder="Fx Byggefakta, henvisning, manuel oprettelse"
                  value={form.source}
                  onChange={(e) => setForm(p => ({ ...p, source: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ct_context">Kontekst-resume</Label>
                <Textarea
                  id="ct_context"
                  rows={2}
                  placeholder="Hvad er den nuværende relation? Hvad arbejder vi på?"
                  value={form.contextSummary}
                  onChange={(e) => setForm(p => ({ ...p, contextSummary: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ct_notes">Noter</Label>
                <Textarea
                  id="ct_notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
              {editingId && (
                <div className="md:col-span-2 border-t pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Linkede entiteter</h4>
                    {refsLoading && <span className="text-xs text-muted-foreground">Indlæser…</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
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
                        <div className="text-xs text-muted-foreground italic">—</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground">Deals ({editingRefs.deals.length})</span>
                      {editingRefs.deals.slice(0, 3).map(d => (
                        <div key={d.id} className="text-xs truncate">{d.title}</div>
                      ))}
                      {editingRefs.deals.length > 3 && (
                        <div className="text-xs text-muted-foreground">+ {editingRefs.deals.length - 3} flere</div>
                      )}
                      {editingRefs.deals.length === 0 && !refsLoading && (
                        <div className="text-xs text-muted-foreground italic">—</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground">RFQ-invitationer ({editingRefs.rfqInvitations.length})</span>
                      {editingRefs.rfqInvitations.length === 0 && !refsLoading && (
                        <div className="text-xs text-muted-foreground italic">—</div>
                      )}
                      {editingRefs.rfqInvitations.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {editingRefs.rfqInvitations.length} aktive invitationer
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {editingId && (() => {
                const editing = contacts.find(c => c.id === editingId);
                if (!editing?.pipedrivePersonId) return null;
                return (
                  <div className="md:col-span-2 text-xs text-muted-foreground border-t pt-2 flex items-center gap-2">
                    <Badge variant="outline" className="font-normal">Pipedrive</Badge>
                    person_id <code className="text-xs bg-muted px-1 py-0.5 rounded">{editing.pipedrivePersonId}</code>
                    {editing.pipedriveSyncedAt && (
                      <span>· senest synket {new Date(editing.pipedriveSyncedAt).toLocaleDateString('da-DK')}</span>
                    )}
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annullér</Button>
              <Button onClick={handleSubmit} disabled={saving || !form.name.trim() || !form.companyId}>
                {saving ? 'Gemmer…' : editingId ? 'Gem ændringer' : 'Opret'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Slet-bekræftelse */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Slet kontakt</DialogTitle>
              <DialogDescription>
                {deleteTarget && `Er du sikker på at du vil slette "${deleteTarget.name}"? Handlingen kan ikke fortrydes.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annullér</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Sletter…' : 'Slet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Contacts;
