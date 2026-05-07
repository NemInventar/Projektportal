import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { useSearchParams } from 'react-router-dom';
import { useEmployees, Employee, EmployeeInput } from '@/contexts/EmployeesContext';
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
import { Plus, Search, Pencil, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emptyForm: EmployeeInput = {
  fullName: '',
  firstName: '',
  lastName: '',
  initials: '',
  nickname: '',
  email: '',
  phone: '',
  role: '',
  department: '',
  active: true,
  startDate: '',
  endDate: '',
  photoUrl: '',
  bio: '',
  notes: '',
  address: '',
  postalCode: '',
  city: '',
  country: 'Danmark',
  cpr: '',
  taxCardType: '',
  employmentType: '',
  salaryDkkMonthly: null,
  hourlyRateDkk: null,
  birthday: '',
  primaryVehicleRegistration: '',
};

const Employees: React.FC = () => {
  const { employees, loading, addEmployee, updateEmployee, removeEmployee, countQuotesUsing } = useEmployees();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showHrFields, setShowHrFields] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = employees;
    if (!showInactive) list = list.filter(e => e.active);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(e =>
        e.fullName.toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [employees, showInactive, search]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowHrFields(false);
    setDialogOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditingId(e.id);
    setForm({
      fullName: e.fullName,
      firstName: e.firstName ?? '',
      lastName: e.lastName ?? '',
      initials: e.initials ?? '',
      nickname: e.nickname ?? '',
      email: e.email ?? '',
      phone: e.phone ?? '',
      role: e.role ?? '',
      department: e.department ?? '',
      active: e.active,
      startDate: e.startDate ?? '',
      endDate: e.endDate ?? '',
      photoUrl: e.photoUrl ?? '',
      bio: e.bio ?? '',
      notes: e.notes ?? '',
      address: e.address ?? '',
      postalCode: e.postalCode ?? '',
      city: e.city ?? '',
      country: e.country ?? 'Danmark',
      cpr: e.cpr ?? '',
      taxCardType: e.taxCardType ?? '',
      employmentType: e.employmentType ?? '',
      salaryDkkMonthly: e.salaryDkkMonthly ?? null,
      hourlyRateDkk: e.hourlyRateDkk ?? null,
      birthday: e.birthday ?? '',
      primaryVehicleRegistration: e.primaryVehicleRegistration ?? '',
    });
    setShowHrFields(false);
    setDialogOpen(true);
  };

  // ?edit={id} fra URL: åbn dialog automatisk for den medarbejder
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && employees.length > 0) {
      const target = employees.find(e => e.id === editId);
      if (target) {
        openEdit(target);
        searchParams.delete('edit');
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length]);

  const handleSubmit = async () => {
    const firstName = form.firstName?.trim() ?? '';
    const lastName = form.lastName?.trim() ?? '';
    if (!firstName) {
      toast({ title: 'Fejl', description: 'Fornavn er påkrævet', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload: EmployeeInput = {
        ...form,
        // full_name beregnes i DB — sendes ikke
        fullName: `${firstName} ${lastName}`.trim(),
        firstName: firstName || null,
        lastName: lastName || null,
        initials: form.initials?.trim() || null,
        nickname: form.nickname?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        role: form.role?.trim() || null,
        department: form.department?.trim() || null,
        startDate: form.startDate?.trim() || null,
        endDate: form.endDate?.trim() || null,
        photoUrl: form.photoUrl?.trim() || null,
        bio: form.bio?.trim() || null,
        notes: form.notes?.trim() || null,
        address: form.address?.trim() || null,
        postalCode: form.postalCode?.trim() || null,
        city: form.city?.trim() || null,
        country: form.country?.trim() || null,
        cpr: form.cpr?.trim() || null,
        taxCardType: form.taxCardType?.trim() || null,
        employmentType: form.employmentType?.trim() || null,
        birthday: form.birthday?.trim() || null,
        primaryVehicleRegistration: form.primaryVehicleRegistration?.trim() || null,
      };
      if (editingId) {
        await updateEmployee(editingId, payload);
        toast({ title: 'Medarbejder opdateret', description: payload.fullName });
      } else {
        await addEmployee(payload);
        toast({ title: 'Medarbejder oprettet', description: payload.fullName });
      }
      setDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke gemme medarbejder', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openDelete = async (e: Employee) => {
    setDeleteTarget(e);
    setDeleteUsage(null);
    try {
      const count = await countQuotesUsing(e.id);
      setDeleteUsage(count);
    } catch {
      setDeleteUsage(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if ((deleteUsage ?? 0) > 0) return;
    try {
      setDeleting(true);
      await removeEmployee(deleteTarget.id);
      toast({ title: 'Medarbejder slettet', description: deleteTarget.fullName });
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Fejl', description: err?.message ?? 'Kunne ikke slette medarbejder', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const setField = <K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) => {
    setForm(p => ({ ...p, [key]: value }));
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Users className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Medarbejdere</h1>
            </div>
            <p className="text-muted-foreground">Interne personer — bruges som tilbudsgiver på tilbud og PDF.</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Ny medarbejder
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <CardTitle className="text-lg">{filtered.length} medarbejder{filtered.length === 1 ? '' : 'e'}</CardTitle>
              <div className="flex flex-1 md:flex-initial gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg navn, email, rolle"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  size="sm"
                  variant={showInactive ? 'default' : 'outline'}
                  onClick={() => setShowInactive(v => !v)}
                >
                  {showInactive ? 'Vis kun aktive' : 'Vis alle'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Indlæser…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {employees.length === 0 ? 'Ingen medarbejdere endnu — opret den første via knappen ovenfor.' : 'Ingen match.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(e)}>
                      <TableCell className="font-medium">
                        {e.fullName}
                        {e.nickname && (
                          <span className="text-xs text-muted-foreground ml-2">({e.nickname})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.role || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.email || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.phone || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {e.active
                            ? <Badge variant="secondary">Aktiv</Badge>
                            : <Badge variant="outline" className="text-muted-foreground">Inaktiv</Badge>}
                          {e.authUserId && <Badge variant="outline" className="text-xs">Login</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(e)} className="h-8 w-8 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDelete(e)} className="h-8 w-8 p-0 text-destructive">
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Rediger medarbejder' : 'Ny medarbejder'}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Ændringer slår igennem på tilbuds-PDF (afsender-info hentes live fra denne række).'
                  : 'Tilføj intern medarbejder.'}
              </DialogDescription>
            </DialogHeader>

            {/* Basale felter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="emp_first">Fornavn *</Label>
                <Input id="emp_first" value={form.firstName ?? ''} onChange={(e) => setField('firstName', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_last">Efternavn</Label>
                <Input id="emp_last" value={form.lastName ?? ''} onChange={(e) => setField('lastName', e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2 text-xs text-muted-foreground">
                Fulde navn beregnes automatisk: <span className="font-medium text-foreground">{`${form.firstName ?? ''} ${form.lastName ?? ''}`.trim() || '—'}</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_init">Initialer</Label>
                <Input id="emp_init" value={form.initials ?? ''} onChange={(e) => setField('initials', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_nick">Kælenavn</Label>
                <Input id="emp_nick" value={form.nickname ?? ''} onChange={(e) => setField('nickname', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_email">Email</Label>
                <Input id="emp_email" type="email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_phone">Telefon</Label>
                <Input id="emp_phone" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_role">Rolle</Label>
                <Input id="emp_role" placeholder="Fx Ejer, Snedker, UE" value={form.role ?? ''} onChange={(e) => setField('role', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_dept">Afdeling</Label>
                <Input id="emp_dept" value={form.department ?? ''} onChange={(e) => setField('department', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_start">Startdato</Label>
                <Input id="emp_start" type="date" value={form.startDate ?? ''} onChange={(e) => setField('startDate', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_end">Slutdato</Label>
                <Input id="emp_end" type="date" value={form.endDate ?? ''} onChange={(e) => setField('endDate', e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={form.active}
                    onCheckedChange={(v) => setField('active', !!v)}
                  />
                  Aktiv medarbejder (vises i tilbudsgiver-dropdown)
                </label>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="emp_photo">Foto-URL</Label>
                <Input id="emp_photo" placeholder="https://..." value={form.photoUrl ?? ''} onChange={(e) => setField('photoUrl', e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="emp_bio">Bio</Label>
                <Textarea id="emp_bio" rows={2} value={form.bio ?? ''} onChange={(e) => setField('bio', e.target.value)} />
              </div>

              {/* Adresse */}
              <div className="space-y-1 md:col-span-2 pt-2 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Adresse</h4>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="emp_addr">Adresse</Label>
                <Input id="emp_addr" value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_zip">Postnr.</Label>
                <Input id="emp_zip" value={form.postalCode ?? ''} onChange={(e) => setField('postalCode', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_city">By</Label>
                <Input id="emp_city" value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="emp_country">Land</Label>
                <Input id="emp_country" value={form.country ?? ''} onChange={(e) => setField('country', e.target.value)} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="emp_notes">Noter</Label>
                <Textarea id="emp_notes" rows={2} value={form.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
              </div>

              {/* HR-felter (sensitive — skjult bag toggle) */}
              <div className="md:col-span-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHrFields(v => !v)}
                  className="gap-2 text-muted-foreground"
                >
                  {showHrFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showHrFields ? 'Skjul HR-felter' : 'Vis HR-felter (CPR, løn)'}
                </Button>
              </div>

              {showHrFields && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="emp_cpr">CPR</Label>
                    <Input id="emp_cpr" placeholder="DDMMÅÅ-XXXX" value={form.cpr ?? ''} onChange={(e) => setField('cpr', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp_tax">Skattekort</Label>
                    <Input id="emp_tax" placeholder="Hovedkort / bikort" value={form.taxCardType ?? ''} onChange={(e) => setField('taxCardType', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp_emp_type">Ansættelsestype</Label>
                    <Input id="emp_emp_type" placeholder="Fuldtid, deltid, freelance" value={form.employmentType ?? ''} onChange={(e) => setField('employmentType', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp_birthday">Fødselsdag</Label>
                    <Input id="emp_birthday" type="date" value={form.birthday ?? ''} onChange={(e) => setField('birthday', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp_salary">Månedsløn (DKK)</Label>
                    <Input
                      id="emp_salary"
                      type="number"
                      value={form.salaryDkkMonthly ?? ''}
                      onChange={(e) => setField('salaryDkkMonthly', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp_hourly">Timeløn (DKK)</Label>
                    <Input
                      id="emp_hourly"
                      type="number"
                      value={form.hourlyRateDkk ?? ''}
                      onChange={(e) => setField('hourlyRateDkk', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="emp_vehicle">Primær køretøj (registrering)</Label>
                    <Input id="emp_vehicle" value={form.primaryVehicleRegistration ?? ''} onChange={(e) => setField('primaryVehicleRegistration', e.target.value)} />
                  </div>
                </>
              )}

              {editingId && (() => {
                const editing = employees.find(e => e.id === editingId);
                if (!editing?.authUserId) return null;
                return (
                  <div className="md:col-span-2 text-xs text-muted-foreground border-t pt-2 flex items-center gap-2">
                    <Badge variant="outline" className="font-normal">Login</Badge>
                    auth_user_id <code className="text-xs bg-muted px-1 py-0.5 rounded">{editing.authUserId}</code>
                  </div>
                );
              })()}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annullér</Button>
              <Button onClick={handleSubmit} disabled={saving || !(form.firstName ?? '').trim()}>
                {saving ? 'Gemmer…' : editingId ? 'Gem ændringer' : 'Opret'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Slet-bekræftelse */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Slet medarbejder</DialogTitle>
              <DialogDescription>
                {deleteTarget && (
                  deleteUsage === null
                    ? `Tjekker om "${deleteTarget.fullName}" bruges på tilbud…`
                    : deleteUsage > 0
                      ? `"${deleteTarget.fullName}" er linket til ${deleteUsage} tilbud og kan ikke slettes. Sæt vedkommende til inaktiv i stedet.`
                      : `Er du sikker på at du vil slette "${deleteTarget.fullName}"? Handlingen kan ikke fortrydes.`
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {(deleteUsage ?? 0) > 0 ? 'Luk' : 'Annullér'}
              </Button>
              {(deleteUsage ?? 0) === 0 && deleteUsage !== null && (
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

export default Employees;
