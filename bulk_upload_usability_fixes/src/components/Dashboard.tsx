import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProject, Project } from '@/contexts/ProjectContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Star, ChevronDown, ChevronRight, FileText,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, Edit, GripVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusBucket { count: number; sum: number; }

interface ProjectStats {
  draft:    StatusBucket;
  sent:     StatusBucket;
  accepted: StatusBucket;
  rejected: StatusBucket;
}

type SortCol = 'name' | 'customer' | 'phase' | 'acceptedSum' | 'updatedAt' | 'sortOrder';
type SortDir = 'asc' | 'desc';
type ViewMode = 'cards' | 'list';

const PHASE_ORDER: Project['phase'][] = ['Tilbud', 'Produktion', 'Garanti'];
const INACTIVE: Project['phase'][] = ['Tabt', 'Arkiv'];

const BADGE: Record<string, string> = {
  Tilbud:     'bg-blue-100 text-blue-800 border-blue-200',
  Produktion: 'bg-green-100 text-green-800 border-green-200',
  Garanti:    'bg-purple-100 text-purple-800 border-purple-200',
  Tabt:       'bg-red-100 text-red-800 border-red-200',
  Arkiv:      'bg-gray-100 text-gray-800 border-gray-200',
};

const HEADING: Record<string, string> = {
  Tilbud:     'text-blue-700',
  Produktion: 'text-green-700',
  Garanti:    'text-purple-700',
};

const EMPTY_BUCKET: StatusBucket = { count: 0, sum: 0 };
const EMPTY_STATS: ProjectStats = { draft: { ...EMPTY_BUCKET }, sent: { ...EMPTY_BUCKET }, accepted: { ...EMPTY_BUCKET }, rejected: { ...EMPTY_BUCKET } };

const fmt = (n: number) =>
  new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' kr.';

// ─── Quote total calculation ──────────────────────────────────────────────────

function calcSellingPrice(items: any[], quantity: number, pricing: any): number {
  if (!quantity) return 0;
  const cb = items.reduce((acc: any, item: any) => {
    const c = item.cost_breakdown_json || {};
    const q = parseFloat(item.qty) || 0;
    return {
      materials:          acc.materials          + (c.materials || 0) * q,
      material_transport: acc.material_transport + (c.material_transport || 0) * q,
      product_transport:  acc.product_transport  + ((c.product_transport || c.transport) || 0) * q,
      labor_production:   acc.labor_production   + (c.labor_production || 0) * q,
      labor_dk:           acc.labor_dk           + (c.labor_dk || 0) * q,
      other:              acc.other              + (c.other || 0) * q,
    };
  }, { materials: 0, material_transport: 0, product_transport: 0, labor_production: 0, labor_dk: 0, other: 0 });

  const pu: Record<string, number> = {};
  Object.keys(cb).forEach(k => { pu[k] = cb[k] / quantity; });
  const base = Object.values(pu).reduce((s: number, v: any) => s + v, 0);
  const risk = parseFloat(pricing?.risk_per_unit || 0);
  const cost = base + risk;

  if (!pricing) return cost * quantity;
  switch (pricing.pricing_mode) {
    case 'markup_pct':       return pricing.markup_pct       ? cost * (1 + pricing.markup_pct / 100) * quantity : cost * quantity;
    case 'gross_margin_pct': return pricing.gross_margin_pct ? cost / (1 - pricing.gross_margin_pct / 100) * quantity : cost * quantity;
    case 'target_unit_price':return pricing.target_unit_price ? parseFloat(pricing.target_unit_price) * quantity : cost * quantity;
    case 'profit_by_category': {
      if (!pricing.profit_by_category_json) return cost * quantity;
      let total = 0;
      ['materials','material_transport','product_transport','labor_production','labor_dk','other'].forEach(k => {
        total += (pu[k] || 0) * (1 + (pricing.profit_by_category_json[k] || 0) / 100);
      });
      return total * quantity;
    }
    default: return cost * quantity;
  }
}

// ─── Edit form ────────────────────────────────────────────────────────────────

type FormData = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <Label className="text-xs mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function ProjectForm({ project, onSubmit, onCancel }: {
  project?: Project;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormData>({
    name:            project?.name            || '',
    customer:        project?.customer        || '',
    projectNumber:   project?.projectNumber   || '',
    phase:           project?.phase           || 'Tilbud',
    isStarred:       project?.isStarred       || false,
    sortOrder:       project?.sortOrder       ?? 0,
    projectType:     project?.projectType     || '',
    contractType:    project?.contractType    || '',
    description:     project?.description     || '',
    client:          project?.client          || '',
    architect:       project?.architect       || '',
    contractor:      project?.contractor      || '',
    owner:           project?.owner           || '',
    customerContact: project?.customerContact || '',
    customerEmail:   project?.customerEmail   || '',
    customerPhone:   project?.customerPhone   || '',
    deliveryAddress: project?.deliveryAddress || '',
    startDate:       project?.startDate       || '',
    endDate:         project?.endDate         || '',
    deliveryDate:    project?.deliveryDate    || '',
    budgetAmount:    project?.budgetAmount,
    source:          project?.source          || '',
    sharepointUrl:   project?.sharepointUrl   || '',
  });

  const set = (k: keyof FormData, v: any) => setF(p => ({ ...p, [k]: v }));
  const inp = (k: keyof FormData) => ({ value: (f[k] as string) || '', onChange: (e: any) => set(k, e.target.value) });

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (f.name.trim()) { onSubmit(f); onCancel(); } }}
      className="space-y-5 max-h-[70vh] overflow-y-auto pr-1"
    >
      <Section title="Projekt">
        <Field label="Projektnavn *" full>
          <Input {...inp('name')} required autoFocus />
        </Field>
        <Field label="Projekt nr.">
          <Input {...inp('projectNumber')} />
        </Field>
        <Field label="Fase">
          <Select value={f.phase} onValueChange={v => set('phase', v as Project['phase'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Tilbud">Tilbud</SelectItem>
              <SelectItem value="Produktion">Produktion</SelectItem>
              <SelectItem value="Garanti">Garanti</SelectItem>
              <SelectItem value="Tabt">Tabt</SelectItem>
              <SelectItem value="Arkiv">Arkiv</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Projekttype">
          <Input {...inp('projectType')} placeholder="fx nybygning, renovering..." />
        </Field>
        <Field label="Kontrakttype">
          <Input {...inp('contractType')} placeholder="fx totalentreprise, fagentreprise..." />
        </Field>
        <Field label="Kilde">
          <Input {...inp('source')} placeholder="fx udbud, direkte henvendelse..." />
        </Field>
      </Section>

      <Section title="Parter">
        <Field label="Kunde">
          <Input {...inp('customer')} />
        </Field>
        <Field label="Bygherre / klient">
          <Input {...inp('client')} />
        </Field>
        <Field label="Arkitekt">
          <Input {...inp('architect')} />
        </Field>
        <Field label="Totalentreprenør">
          <Input {...inp('contractor')} />
        </Field>
        <Field label="Ejer">
          <Input {...inp('owner')} />
        </Field>
      </Section>

      <Section title="Kontakt & adresse">
        <Field label="Kontaktperson">
          <Input {...inp('customerContact')} />
        </Field>
        <Field label="Email">
          <Input type="email" {...inp('customerEmail')} />
        </Field>
        <Field label="Telefon">
          <Input {...inp('customerPhone')} />
        </Field>
        <Field label="Leveringsadresse" full>
          <Input {...inp('deliveryAddress')} />
        </Field>
      </Section>

      <Section title="Tidsplan">
        <Field label="Startdato">
          <Input type="date" {...inp('startDate')} />
        </Field>
        <Field label="Slutdato">
          <Input type="date" {...inp('endDate')} />
        </Field>
        <Field label="Aflevering">
          <Input type="date" {...inp('deliveryDate')} />
        </Field>
      </Section>

      <Section title="Økonomi & links">
        <Field label="Budgetbeløb (kr.)">
          <Input
            type="number"
            value={f.budgetAmount ?? ''}
            onChange={e => set('budgetAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="0"
          />
        </Field>
        <Field label="SharePoint URL" full>
          <Input {...inp('sharepointUrl')} placeholder="https://..." />
        </Field>
      </Section>

      <Section title="Beskrivelse">
        <Field label="" full>
          <Textarea
            value={f.description || ''}
            onChange={e => set('description', e.target.value)}
            placeholder="Intern beskrivelse af projektet..."
            rows={3}
          />
        </Field>
      </Section>

      <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
        <Button type="submit" className="flex-1">{project ? 'Gem ændringer' : 'Opret projekt'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Annuller</Button>
      </div>
    </form>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ label, count, sum, color }: { label: string; count: number; sum?: number; color: string }) {
  return (
    <div className={`rounded-lg border bg-white px-4 py-3 flex items-center gap-4 border-l-4 ${color}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-2xl font-bold w-8 text-center">{count}</span>
      <span className="flex-1" />
      {sum != null && sum > 0 && (
        <span className="text-lg font-semibold text-right">{fmt(sum)}</span>
      )}
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({ col, label, current, dir, onSort }: {
  col: SortCol; label: string; current: SortCol; dir: SortDir; onSort: (c: SortCol) => void;
}) {
  const active = col === current;
  return (
    <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {label}
      {active
        ? dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        : <ArrowUpDown className="h-3 w-3 opacity-30" />}
    </button>
  );
}

// ─── Sortable list row ────────────────────────────────────────────────────────

function SortableTableRow({ project, stats, isActive, onSelect, onGoToQuotes, onEdit }: {
  project: Project;
  stats?: ProjectStats;
  isActive: boolean;
  onSelect: (p: Project) => void;
  onGoToQuotes: (p: Project) => void;
  onEdit: (p: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const s = stats;

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onSelect(project)}
      className={`cursor-pointer hover:bg-muted/50 ${isActive ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
    >
      <TableCell className="w-6 pr-0 pl-3">
        <button
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="w-6">{project.isStarred && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}</TableCell>
      <TableCell className="font-medium">{project.name}</TableCell>
      <TableCell className="text-muted-foreground">{project.customer || '—'}</TableCell>
      <TableCell><Badge className={`text-xs ${BADGE[project.phase]}`}>{project.phase}</Badge></TableCell>
      <TableCell className="text-right font-medium">
        {s?.accepted.sum > 0 ? fmt(s.accepted.sum) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right text-muted-foreground text-sm">{project.updatedAt.toLocaleDateString('da-DK')}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onGoToQuotes(project); }} className="gap-1 text-xs h-7">
            <FileText className="h-3 w-3" />Tilbud
          </Button>
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onEdit(project); }} className="h-7 w-7 p-0">
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function QuoteLine({ label, bucket, noSum }: { label: string; bucket: StatusBucket; noSum?: boolean }) {
  if (bucket.count === 0) return null;
  return (
    <div className="flex items-baseline text-xs">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium w-6 text-right">{bucket.count}</span>
      {!noSum && bucket.sum > 0 && (
        <>
          <span className="text-muted-foreground mx-1">·</span>
          <span className="font-medium text-right ml-auto">{fmt(bucket.sum)}</span>
        </>
      )}
    </div>
  );
}

function ProjectCard({ project, stats, isActive, onSelect, onGoToQuotes, onEdit }: {
  project: Project; stats?: ProjectStats; isActive: boolean;
  onSelect: (p: Project) => void;
  onGoToQuotes: (p: Project) => void;
  onEdit: (p: Project) => void;
}) {
  const s = stats || EMPTY_STATS;
  const hasQuotes = s.draft.count + s.sent.count + s.accepted.count + s.rejected.count > 0;

  return (
    <div
      onClick={() => onSelect(project)}
      className={`rounded-lg border bg-white p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/40 space-y-2.5
        ${isActive ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-gray-200'}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {project.isStarred && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
          <span className="font-semibold text-sm truncate">{project.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={`text-xs ${BADGE[project.phase]}`}>{project.phase}</Badge>
          <button
            onClick={e => { e.stopPropagation(); onEdit(project); }}
            className="p-0.5 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground"
          >
            <Edit className="h-3 w-3" />
          </button>
        </div>
      </div>

      {(project.customer || project.projectNumber) && (
        <div className="text-xs text-muted-foreground">
          {[project.customer, project.projectNumber].filter(Boolean).join(' · ')}
        </div>
      )}

      {hasQuotes && (
        <div className="border-t pt-2 space-y-1">
          <QuoteLine label="Kladder"    bucket={s.draft}    />
          <QuoteLine label="Sendt"      bucket={s.sent}     />
          <QuoteLine label="Accepteret" bucket={s.accepted} />
          <QuoteLine label="Afvist"     bucket={s.rejected} noSum />
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); onGoToQuotes(project); }}
        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 pt-0.5"
      >
        <FileText className="h-3 w-3" />
        Tilbud →
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, activeProject, setActiveProject, addProject, updateProject, reorderProjects, loading } = useProject();
  const { toast } = useToast();

  const [stats, setStats] = useState<Record<string, ProjectStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('dashboard_view') as ViewMode) || 'cards'
  );
  const [sortCol, setSortCol] = useState<SortCol>('sortOrder');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { if (projects.length > 0) fetchStats(); }, [projects]);

  const fetchStats = async () => {
    const ids = projects.map(p => p.id);
    if (!ids.length) return;
    setStatsLoading(true);
    try {
      const { data: quotesData } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .select('id, project_id, status, include_in_project_total')
        .in('project_id', ids)
        .neq('status', 'archived');

      const quoteIds = (quotesData || []).map(q => q.id);
      let quoteSums: Record<string, number> = {};

      if (quoteIds.length > 0) {
        const { data: linesData } = await supabase
          .from('project_quote_lines_2026_01_16_23_00')
          .select(`id, project_quote_id, quantity,
            project_quote_line_pricing_2026_01_16_23_00(pricing_mode,markup_pct,gross_margin_pct,target_unit_price,risk_per_unit,profit_by_category_json),
            project_quote_line_items_2026_01_16_23_00(qty,cost_breakdown_json)`)
          .in('project_quote_id', quoteIds)
          .neq('archived', true);

        (linesData || []).forEach(line => {
          const qty = parseFloat(line.quantity) || 0;
          const pricing = (line.project_quote_line_pricing_2026_01_16_23_00 as any[])?.[0] || null;
          const items   = (line.project_quote_line_items_2026_01_16_23_00 as any[]) || [];
          quoteSums[line.project_quote_id] = (quoteSums[line.project_quote_id] || 0) + calcSellingPrice(items, qty, pricing);
        });
      }

      const result: Record<string, ProjectStats> = {};
      for (const id of ids) {
        const pq = (quotesData || []).filter(q => q.project_id === id);
        const bucket = (status: string): StatusBucket => {
          // Exclude quotes explicitly unchecked from project total
          const qs = pq.filter(q => q.status === status && q.include_in_project_total !== false);
          return { count: qs.length, sum: qs.reduce((s, q) => s + (quoteSums[q.id] || 0), 0) };
        };
        result[id] = { draft: bucket('draft'), sent: bucket('sent'), accepted: bucket('accepted'), rejected: bucket('rejected') };
      }
      setStats(result);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSelect = (p: Project) => { setActiveProject(p); toast({ title: `${p.name} er nu aktivt projekt` }); };
  const handleGoToQuotes = (p: Project) => { setActiveProject(p); navigate('/project/quotes'); };
  const handleCreate = async (data: FormData) => { await addProject(data); toast({ title: 'Projekt oprettet', description: data.name }); };
  const handleUpdate = async (data: FormData) => {
    if (!editingProject) return;
    await updateProject(editingProject.id, data);
    toast({ title: 'Projekt opdateret' });
    setEditingProject(null);
  };
  const toggleView = (m: ViewMode) => { setViewMode(m); localStorage.setItem('dashboard_view', m); };
  const handleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedProjects.findIndex(p => p.id === active.id);
    const newIndex = sortedProjects.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(sortedProjects, oldIndex, newIndex);
    setSortCol('sortOrder');
    setSortDir('asc');
    reorderProjects(newOrder.map(p => p.id));
  };

  // ── Global aggregates ─────────────────────────────────────────────────────

  const agg = (status: keyof ProjectStats) =>
    Object.values(stats).reduce((acc, s) => ({
      count: acc.count + (s[status] as StatusBucket).count,
      sum:   acc.sum   + (s[status] as StatusBucket).sum,
    }), { count: 0, sum: 0 });

  const globalDraft    = agg('draft');
  const globalSent     = agg('sent');
  const globalAccepted = agg('accepted');
  const globalRejected = agg('rejected');

  // ── Sorted list ───────────────────────────────────────────────────────────

  const sortedProjects = useMemo(() => {
    const all = [...projects].filter(p => !INACTIVE.includes(p.phase));
    all.sort((a, b) => {
      let va: any, vb: any;
      switch (sortCol) {
        case 'name':        va = a.name; vb = b.name; break;
        case 'customer':    va = a.customer || ''; vb = b.customer || ''; break;
        case 'phase':       va = a.phase; vb = b.phase; break;
        case 'acceptedSum': va = stats[a.id]?.accepted.sum ?? 0; vb = stats[b.id]?.accepted.sum ?? 0; break;
        case 'updatedAt':   va = a.updatedAt; vb = b.updatedAt; break;
        case 'sortOrder':   va = a.sortOrder ?? 0; vb = b.sortOrder ?? 0; break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return all;
  }, [projects, stats, sortCol, sortDir]);

  const activeGroups = PHASE_ORDER.map(phase => ({
    phase,
    items: projects.filter(p => p.phase === phase).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  })).filter(g => g.items.length > 0);

  const inactiveProjects = projects.filter(p => INACTIVE.includes(p.phase));

  if (loading) return <div className="p-6 text-muted-foreground">Indlæser projekter...</div>;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Projekter</h1>
          {activeProject && (
            <p className="text-sm text-muted-foreground mt-1">
              Aktivt: <span className="font-medium text-foreground">{activeProject.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={() => toggleView('cards')} className={`px-3 py-1.5 transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-gray-50'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => toggleView('list')} className={`px-3 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-gray-50'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nyt projekt</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Opret nyt projekt</DialogTitle></DialogHeader>
              <ProjectForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stat rows */}
      <div className="space-y-2">
        <StatRow label="Kladder"    count={globalDraft.count}    sum={globalDraft.sum}    color="border-gray-400" />
        <StatRow label="Sendt"      count={globalSent.count}     sum={globalSent.sum}     color="border-blue-400" />
        <StatRow label="Accepteret" count={globalAccepted.count} sum={globalAccepted.sum} color="border-green-500" />
        <StatRow label="Afvist"     count={globalRejected.count}                          color="border-red-400" />
      </div>

      {/* Card view */}
      {viewMode === 'cards' && (
        <div className="space-y-8">
          {activeGroups.map(({ phase, items }) => (
            <div key={phase}>
              <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${HEADING[phase] || 'text-gray-700'}`}>
                {phase} · {items.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(p => (
                  <ProjectCard key={p.id} project={p} stats={stats[p.id]}
                    isActive={activeProject?.id === p.id}
                    onSelect={handleSelect} onGoToQuotes={handleGoToQuotes} onEdit={setEditingProject}
                  />
                ))}
              </div>
            </div>
          ))}
          {projects.filter(p => PHASE_ORDER.includes(p.phase)).length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="mb-4">Ingen aktive projekter.</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />Opret første projekt
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-6 pr-0 pl-3" />
                <TableHead className="w-6" />
                <TableHead><SortHeader col="name"        label="Projekt"     current={sortCol} dir={sortDir} onSort={handleSort} /></TableHead>
                <TableHead><SortHeader col="customer"    label="Kunde"       current={sortCol} dir={sortDir} onSort={handleSort} /></TableHead>
                <TableHead><SortHeader col="phase"       label="Fase"        current={sortCol} dir={sortDir} onSort={handleSort} /></TableHead>
                <TableHead className="text-right"><SortHeader col="acceptedSum" label="Accepteret" current={sortCol} dir={sortDir} onSort={handleSort} /></TableHead>
                <TableHead className="text-right"><SortHeader col="updatedAt"   label="Opdateret"  current={sortCol} dir={sortDir} onSort={handleSort} /></TableHead>
                <TableHead className="w-28 text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {sortedProjects.map(p => (
                    <SortableTableRow key={p.id} project={p} stats={stats[p.id]}
                      isActive={activeProject?.id === p.id}
                      onSelect={handleSelect} onGoToQuotes={handleGoToQuotes} onEdit={setEditingProject}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </DndContext>
          </Table>
          {sortedProjects.length === 0 && <div className="text-center py-12 text-muted-foreground">Ingen aktive projekter</div>}
        </div>
      )}

      {/* Inactive */}
      {inactiveProjects.length > 0 && (
        <div>
          <button onClick={() => setInactiveOpen(o => !o)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {inactiveOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Tabt &amp; Arkiv · {inactiveProjects.length}
          </button>
          {inactiveOpen && (
            <div className={`mt-3 ${viewMode === 'cards' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'rounded-lg border bg-white overflow-hidden'}`}>
              {viewMode === 'cards' && inactiveProjects.map(p => (
                <ProjectCard key={p.id} project={p} stats={stats[p.id]}
                  isActive={activeProject?.id === p.id}
                  onSelect={handleSelect} onGoToQuotes={handleGoToQuotes} onEdit={setEditingProject}
                />
              ))}
              {viewMode === 'list' && (
                <Table><TableBody>
                  {inactiveProjects.map(p => (
                    <TableRow key={p.id} onClick={() => handleSelect(p)} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="w-6 pl-3" />
                      <TableCell className="w-6" />
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.customer || '—'}</TableCell>
                      <TableCell><Badge className={`text-xs ${BADGE[p.phase]}`}>{p.phase}</Badge></TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setEditingProject(p); }} className="h-7 w-7 p-0">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingProject} onOpenChange={open => { if (!open) setEditingProject(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject?.name}</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <ProjectForm project={editingProject} onSubmit={handleUpdate} onCancel={() => setEditingProject(null)} />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
