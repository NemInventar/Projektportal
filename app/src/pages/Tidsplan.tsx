import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { useProject, Project } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarRange, AlertTriangle, Check, Filter, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  addDays, addWeeks, addMonths, addQuarters, addYears, differenceInCalendarDays, format, parseISO,
  startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, getISOWeek, getQuarter, isWeekend,
  min as minDate, max as maxDate,
} from 'date-fns';
import { da } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Tidsplan — simpel Gantt over vundne projekter i tre lag: Projekt → Tilbud → Produkt.
// Fem faste faser pr. lag. Datoer redigeres ved klik på en bjælke.
// Data: tidsplan_faser (se supabase/migrations/2026-09-23_tidsplan_faser.sql).
// Et projekt forsvinder fra listen når det sættes i fasen 'Garanti' (eller senere).
// ---------------------------------------------------------------------------

const TABLE = 'tidsplan_faser';
const QUOTES_TABLE = 'project_quotes_2026_01_16_23_00';
const LINES_TABLE = 'project_quote_lines_2026_01_16_23_00';

// Hvilke projekt-faser tæller som "vundet og i gang". Garanti/Afsluttet/Arkiv er ude.
const VISIBLE_PROJECT_PHASES: Project['phase'][] = ['Kontrakt og planlægning', 'Produktion'];

type FaseKey = 'refinement' | 'materialebestilling' | 'produktion' | 'transport' | 'installation';
type FaseStatus = 'planlagt' | 'igang' | 'faerdig';

const FASER: { key: FaseKey; label: string; color: string; defaultDays: number }[] = [
  { key: 'refinement',          label: 'Refinement',          color: 'bg-slate-400',   defaultDays: 14 },
  { key: 'materialebestilling', label: 'Materialebestilling', color: 'bg-amber-400',   defaultDays: 14 },
  { key: 'produktion',          label: 'Produktion',          color: 'bg-blue-500',    defaultDays: 28 },
  { key: 'transport',           label: 'Transport',           color: 'bg-violet-500',  defaultDays: 14 },
  { key: 'installation',        label: 'Installation',        color: 'bg-emerald-500', defaultDays: 7  },
];
const FASE_BY_KEY = Object.fromEntries(FASER.map(f => [f.key, f])) as Record<FaseKey, typeof FASER[number]>;

const STATUS_LABEL: Record<FaseStatus, string> = { planlagt: 'Planlagt', igang: 'I gang', faerdig: 'Færdig' };

interface FaseRow {
  id: string;
  project_id: string;
  quote_id: string | null;
  quote_line_id: string | null;
  fase: FaseKey;
  start_date: string; // yyyy-MM-dd
  end_date: string;
  status: FaseStatus;
  note: string | null;
}

interface QuoteLite { id: string; project_id: string; quote_number: string | null; title: string | null; cached_sell_total: number | null }
interface LineLite  { id: string; project_quote_id: string; title: string; quantity: number | null; unit: string | null; display_order: number | null; sort_order: number | null }

type Level = 'project' | 'quote' | 'line';

// -- Visninger ---------------------------------------------------------------
type ViewKey = 'dag' | 'uge' | 'maaned' | 'kvartal' | 'aar';
type Unit = 'day' | 'week' | 'month' | 'quarter' | 'year';

// spanDays = hvor mange dage vinduet viser. Bredden på skærmen er altid den samme.
const VIEWS: { key: ViewKey; label: string; spanDays: number; major: Unit; minor: Unit }[] = [
  { key: 'dag',     label: 'Dag',     spanDays: 28,   major: 'month', minor: 'day' },
  { key: 'uge',     label: 'Uge',     spanDays: 91,   major: 'month', minor: 'week' },
  { key: 'maaned',  label: 'Måned',   spanDays: 182,  major: 'year',  minor: 'month' },
  { key: 'kvartal', label: 'Kvartal', spanDays: 365,  major: 'year',  minor: 'quarter' },
  { key: 'aar',     label: 'År',      spanDays: 1096, major: 'year',  minor: 'quarter' },
];
const VIEW_BY_KEY = Object.fromEntries(VIEWS.map(v => [v.key, v])) as Record<ViewKey, typeof VIEWS[number]>;

const startOfUnit = (d: Date, u: Unit) =>
  u === 'day' ? startOfDay(d) : u === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : u === 'month' ? startOfMonth(d)
  : u === 'quarter' ? startOfQuarter(d) : startOfYear(d);
const addUnit = (d: Date, u: Unit, n = 1) =>
  u === 'day' ? addDays(d, n) : u === 'week' ? addWeeks(d, n) : u === 'month' ? addMonths(d, n)
  : u === 'quarter' ? addQuarters(d, n) : addYears(d, n);

function unitLabel(d: Date, u: Unit, isMajor: boolean): string {
  switch (u) {
    case 'day':     return format(d, 'EEEEE d', { locale: da });
    case 'week':    return `Uge ${getISOWeek(d)}`;
    case 'month':   return isMajor ? format(d, 'MMMM yyyy', { locale: da }) : format(d, 'MMM', { locale: da });
    case 'quarter': return `K${getQuarter(d)}`;
    case 'year':    return format(d, 'yyyy');
  }
}

// Projekttyper der ikke har produktion. Slået fra som standard i filteret.
const TYPE_DEFAULT_OFF = new Set(['konsulent', 'intern']);
const TYPE_LABEL: Record<string, string> = {
  inventar: 'Inventar', fast_inventar: 'Fast inventar', moebler: 'Møbler', montage: 'Montage',
  konsulent: 'Konsulent', intern: 'Intern', andet: 'Andet', '': 'Uden type',
};

const LS_KEY = 'ni_tidsplan_prefs_v1';
interface Prefs { view: ViewKey; typesOff: string[]; hiddenProjects: string[]; faserOff: FaseKey[]; search: string }
const loadPrefs = (): Prefs => {
  const def: Prefs = { view: 'uge', typesOff: [...TYPE_DEFAULT_OFF], hiddenProjects: [], faserOff: [], search: '' };
  try { const raw = localStorage.getItem(LS_KEY); return raw ? { ...def, ...JSON.parse(raw) } : def; } catch { return def; }
};

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const nullUuid = (v: string | null) => v ?? null;

/** Nøgle for et niveau: hvilke rækker hører til denne linje i Gantt'en. */
const levelKey = (projectId: string, quoteId: string | null, lineId: string | null) =>
  `${projectId}|${quoteId ?? ''}|${lineId ?? ''}`;

/** Standard-tidsplan: sekventielle faser. Med leveringsdato regnes der baglæns så Installation slutter der. */
function buildDefaultSchedule(anchor: { deliveryDate?: string | null; startDate?: string | null }): Record<FaseKey, { start: string; end: string }> {
  const out = {} as Record<FaseKey, { start: string; end: string }>;
  if (anchor.deliveryDate) {
    let end = parseISO(anchor.deliveryDate);
    for (const f of [...FASER].reverse()) {
      const start = addDays(end, -(f.defaultDays - 1));
      out[f.key] = { start: ymd(start), end: ymd(end) };
      end = addDays(start, -1);
    }
  } else {
    let start = anchor.startDate ? parseISO(anchor.startDate) : new Date();
    for (const f of FASER) {
      const end = addDays(start, f.defaultDays - 1);
      out[f.key] = { start: ymd(start), end: ymd(end) };
      start = addDays(end, 1);
    }
  }
  return out;
}

const Tidsplan: React.FC = () => {
  const { projects, loading: projectsLoading } = useProject();
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<FaseRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteLite[]>([]);
  const [lines, setLines] = useState<LineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  const view = VIEW_BY_KEY[prefs.view] ?? VIEW_BY_KEY.uge;
  const typesOff = useMemo(() => new Set(prefs.typesOff), [prefs.typesOff]);
  const hiddenProjects = useMemo(() => new Set(prefs.hiddenProjects), [prefs.hiddenProjects]);
  const faserOff = useMemo(() => new Set(prefs.faserOff), [prefs.faserOff]);
  const toggleIn = <K extends 'typesOff' | 'hiddenProjects' | 'faserOff'>(key: K, value: string) =>
    setPrefs(p => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
    });
  const [editing, setEditing] = useState<FaseRow | null>(null);
  const [editForm, setEditForm] = useState({ start_date: '', end_date: '', status: 'planlagt' as FaseStatus, note: '' });
  const [saving, setSaving] = useState(false);

  // Vundne projekter der stadig er i gang. Interne omkostningssteder er ikke sager.
  // Kandidater = vundne og i gang. Filtrene virker ovenpå.
  const candidateProjects = useMemo(
    () => projects
      .filter(p => VISIBLE_PROJECT_PHASES.includes(p.phase))
      .sort((a, b) => (a.projectNumber ?? '').localeCompare(b.projectNumber ?? '')),
    [projects],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(candidateProjects.map(p => p.projectType ?? ''))).sort(),
    [candidateProjects],
  );
  const visibleProjects = useMemo(() => {
    const q = prefs.search.trim().toLowerCase();
    return candidateProjects.filter(p =>
      !typesOff.has(p.projectType ?? '') &&
      !hiddenProjects.has(p.id) &&
      (!q || `${p.projectNumber ?? ''} ${p.name} ${p.customer ?? ''}`.toLowerCase().includes(q)));
  }, [candidateProjects, typesOff, hiddenProjects, prefs.search]);
  const visibleProjectIds = useMemo(() => candidateProjects.map(p => p.id), [candidateProjects]);

  // -- Load -----------------------------------------------------------------
  const load = useCallback(async () => {
    if (visibleProjectIds.length === 0) { setRows([]); setQuotes([]); setLines([]); setLoading(false); return; }
    setLoading(true);
    const [faseRes, quoteRes] = await Promise.all([
      supabase.from(TABLE).select('id, project_id, quote_id, quote_line_id, fase, start_date, end_date, status, note').in('project_id', visibleProjectIds),
      supabase.from(QUOTES_TABLE).select('id, project_id, quote_number, title, cached_sell_total').in('project_id', visibleProjectIds).eq('status', 'accepted').order('quote_number'),
    ]);
    if (faseRes.error) {
      // 42P01 = relation findes ikke → migrationen er ikke kørt endnu
      if ((faseRes.error as any).code === '42P01' || /does not exist/i.test(faseRes.error.message)) setTableMissing(true);
      else toast({ title: 'Fejl', description: faseRes.error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setTableMissing(false);
    const q = (quoteRes.data ?? []) as QuoteLite[];
    setQuotes(q);
    if (q.length) {
      const lineRes = await supabase.from(LINES_TABLE)
        .select('id, project_quote_id, title, quantity, unit, display_order, sort_order')
        .in('project_quote_id', q.map(x => x.id))
        .or('archived.is.null,archived.eq.false');
      setLines((lineRes.data ?? []) as LineLite[]);
    } else setLines([]);
    setRows((faseRes.data ?? []) as FaseRow[]);
    setLoading(false);
  }, [visibleProjectIds, toast]);

  useEffect(() => { if (!projectsLoading) load(); }, [projectsLoading, load]);

  // -- Opslag ----------------------------------------------------------------
  const rowsByLevel = useMemo(() => {
    const m = new Map<string, FaseRow[]>();
    for (const r of rows) {
      const k = levelKey(r.project_id, r.quote_id, r.quote_line_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [rows]);

  const quotesByProject = useMemo(() => {
    const m = new Map<string, QuoteLite[]>();
    for (const q of quotes) { if (!m.has(q.project_id)) m.set(q.project_id, []); m.get(q.project_id)!.push(q); }
    return m;
  }, [quotes]);

  const linesByQuote = useMemo(() => {
    const m = new Map<string, LineLite[]>();
    for (const l of lines) { if (!m.has(l.project_quote_id)) m.set(l.project_quote_id, []); m.get(l.project_quote_id)!.push(l); }
    for (const arr of m.values()) arr.sort((a, b) => (a.display_order ?? a.sort_order ?? 0) - (b.display_order ?? b.sort_order ?? 0));
    return m;
  }, [lines]);

  // -- Seeding: opret de fem faser på et niveau hvis de mangler -------------
  const seedLevel = useCallback(async (
    projectId: string, quoteId: string | null, lineId: string | null,
    schedule: Record<FaseKey, { start: string; end: string }>,
  ) => {
    const existing = new Set((rowsByLevel.get(levelKey(projectId, quoteId, lineId)) ?? []).map(r => r.fase));
    const missing = FASER.filter(f => !existing.has(f.key));
    if (missing.length === 0) return;
    const payload = missing.map(f => ({
      project_id: projectId, quote_id: nullUuid(quoteId), quote_line_id: nullUuid(lineId),
      fase: f.key, start_date: schedule[f.key].start, end_date: schedule[f.key].end,
      status: 'planlagt', updated_by: user?.email ?? null,
    }));
    const { data, error } = await supabase.from(TABLE).insert(payload).select('id, project_id, quote_id, quote_line_id, fase, start_date, end_date, status, note');
    if (error) { toast({ title: 'Kunne ikke oprette faser', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => [...prev, ...((data ?? []) as FaseRow[])]);
  }, [rowsByLevel, user, toast]);

  // Projekt-laget seedes automatisk når siden åbnes — ellers er Gantt'en tom første gang.
  const [seededOnce, setSeededOnce] = useState(false);
  useEffect(() => {
    if (loading || tableMissing || seededOnce || visibleProjects.length === 0) return;
    (async () => {
      for (const p of visibleProjects) {
        if (!rowsByLevel.has(levelKey(p.id, null, null))) {
          await seedLevel(p.id, null, null, buildDefaultSchedule({ deliveryDate: p.deliveryDate, startDate: p.startDate }));
        }
      }
      setSeededOnce(true);
    })();
  }, [loading, tableMissing, seededOnce, visibleProjects, rowsByLevel, seedLevel]);

  /** Børn arver forældrenes datoer ved første åbning. */
  const scheduleFromRows = (parentRows: FaseRow[], fallback: Record<FaseKey, { start: string; end: string }>) => {
    const s = { ...fallback };
    for (const r of parentRows) s[r.fase] = { start: r.start_date, end: r.end_date };
    return s;
  };

  const toggleProject = async (p: Project) => {
    const next = new Set(expandedProjects);
    if (next.has(p.id)) { next.delete(p.id); setExpandedProjects(next); return; }
    next.add(p.id); setExpandedProjects(next);
    const parent = rowsByLevel.get(levelKey(p.id, null, null)) ?? [];
    const fallback = buildDefaultSchedule({ deliveryDate: p.deliveryDate, startDate: p.startDate });
    for (const q of quotesByProject.get(p.id) ?? []) {
      if (!rowsByLevel.has(levelKey(p.id, q.id, null))) await seedLevel(p.id, q.id, null, scheduleFromRows(parent, fallback));
    }
  };

  const toggleQuote = async (p: Project, q: QuoteLite) => {
    const next = new Set(expandedQuotes);
    if (next.has(q.id)) { next.delete(q.id); setExpandedQuotes(next); return; }
    next.add(q.id); setExpandedQuotes(next);
    const parent = rowsByLevel.get(levelKey(p.id, q.id, null)) ?? rowsByLevel.get(levelKey(p.id, null, null)) ?? [];
    const fallback = buildDefaultSchedule({ deliveryDate: p.deliveryDate, startDate: p.startDate });
    for (const l of linesByQuote.get(q.id) ?? []) {
      if (!rowsByLevel.has(levelKey(p.id, q.id, l.id))) await seedLevel(p.id, q.id, l.id, scheduleFromRows(parent, fallback));
    }
  };

  // -- Tidsakse --------------------------------------------------------------
  // Tidsaksen har FAST bredde (fylder skærmen). Visningen bestemmer kun hvor mange dage
  // vinduet dækker; pile/"I dag" flytter vinduet. Intet vandret scroll, ingen resize af siden.
  const today = startOfDay(new Date());
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(900);
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => { const w = entries[0]?.contentRect.width; if (w && w > 100) setTimelineWidth(w); });
    ro.observe(el);
    return () => ro.disconnect();
  });
  const spanDays = view.spanDays;
  const [windowStart, setWindowStart] = useState<Date>(() => addDays(today, -Math.round(spanDays * 0.2)));
  const prevSpan = React.useRef(spanDays);
  // Skift af visning: behold det samme midtpunkt i tid.
  useEffect(() => {
    if (prevSpan.current === spanDays) return;
    setWindowStart(ws => addDays(ws, Math.round((prevSpan.current - spanDays) / 2)));
    prevSpan.current = spanDays;
  }, [spanDays]);
  const shiftWindow = (dir: -1 | 1) => setWindowStart(ws => addDays(ws, dir * Math.max(1, Math.round(spanDays / 3))));
  const goToday = () => setWindowStart(addDays(today, -Math.round(spanDays * 0.2)));

  const range = useMemo(() => {
    const from = startOfDay(windowStart);
    const to = addDays(from, spanDays - 1);
    return { from, to, days: spanDays };
  }, [windowStart, spanDays]);
  const pxPerDay = timelineWidth / range.days;

  const ticks = (u: Unit) => {
    const out: { start: Date; end: Date }[] = [];
    let d = startOfUnit(range.from, u);
    while (d <= range.to) { const n = addUnit(d, u); out.push({ start: d < range.from ? range.from : d, end: n }); d = n; }
    return out;
  };
  const majorTicks = useMemo(() => ticks(view.major), [range, view.major]); // eslint-disable-line react-hooks/exhaustive-deps
  const minorTicks = useMemo(() => ticks(view.minor), [range, view.minor]); // eslint-disable-line react-hooks/exhaustive-deps
  const tickX = (d: Date) => differenceInCalendarDays(d, range.from) * pxPerDay;
  const tickW = (t: { start: Date; end: Date }) => differenceInCalendarDays(t.end, t.start) * pxPerDay;

  const xOf = (dateStr: string) => differenceInCalendarDays(parseISO(dateStr), range.from) * pxPerDay;
  const wOf = (start: string, end: string) => (differenceInCalendarDays(parseISO(end), parseISO(start)) + 1) * pxPerDay;
  const todayX = differenceInCalendarDays(today, range.from) * pxPerDay;

  const filtersActive = typesOff.size !== TYPE_DEFAULT_OFF.size || [...TYPE_DEFAULT_OFF].some(t => !typesOff.has(t))
    || hiddenProjects.size > 0 || faserOff.size > 0 || prefs.search.trim() !== '';
  const resetFilters = () => setPrefs(p => ({ ...p, typesOff: [...TYPE_DEFAULT_OFF], hiddenProjects: [], faserOff: [], search: '' }));

  // -- Redigering ------------------------------------------------------------
  const openEdit = (r: FaseRow) => {
    setEditing(r);
    setEditForm({ start_date: r.start_date, end_date: r.end_date, status: r.status, note: r.note ?? '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.start_date || !editForm.end_date) return;
    if (editForm.end_date < editForm.start_date) {
      toast({ title: 'Slutdato før startdato', description: 'Ret datoerne før du gemmer.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const patch = { start_date: editForm.start_date, end_date: editForm.end_date, status: editForm.status, note: editForm.note || null, updated_by: user?.email ?? null };
    const { error } = await supabase.from(TABLE).update(patch).eq('id', editing.id);
    setSaving(false);
    if (error) { toast({ title: 'Kunne ikke gemme', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => prev.map(r => r.id === editing.id ? { ...r, ...patch } as FaseRow : r));
    setEditing(null);
  };

  // -- Render-hjælpere -------------------------------------------------------
  const levelLabel = (level: Level) => level === 'project' ? 'Projekt' : level === 'quote' ? 'Tilbud' : 'Produkt';

  const GanttBars: React.FC<{ levelRows: FaseRow[]; level: Level }> = ({ levelRows, level }) => (
    <div className="relative h-14" style={{ width: timelineWidth }}>
      {levelRows.filter(r => !faserOff.has(r.fase)).map(r => {
        const f = FASE_BY_KEY[r.fase];
        const rawLeft = xOf(r.start_date);
        const rawRight = rawLeft + wOf(r.start_date, r.end_date);
        if (rawRight < 0 || rawLeft > timelineWidth) return null; // uden for vinduet
        const left = Math.max(0, rawLeft);
        const width = Math.max(Math.min(rawRight, timelineWidth) - left, 2);
        const overdue = r.status !== 'faerdig' && parseISO(r.end_date) < today;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => openEdit(r)}
            title={`${f.label} · ${format(parseISO(r.start_date), 'd. MMM', { locale: da })} – ${format(parseISO(r.end_date), 'd. MMM yyyy', { locale: da })} · ${STATUS_LABEL[r.status]}${r.note ? `\n${r.note}` : ''}`}
            className={cn(
              'absolute top-2 h-10 rounded text-sm font-medium leading-10 text-white px-2 truncate text-left shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring',
              f.color,
              level === 'project' ? 'opacity-100' : level === 'quote' ? 'opacity-90' : 'opacity-80',
              r.status === 'faerdig' && 'opacity-50 line-through',
              r.status === 'igang' && 'ring-2 ring-offset-1 ring-foreground/40',
              overdue && 'outline outline-2 outline-red-500',
            )}
            style={{ left, width }}
          >
            {width > 40 ? f.label : ''}{width > 190 ? ` · ${format(parseISO(r.start_date), 'd/M')}–${format(parseISO(r.end_date), 'd/M')}` : ''}
            {r.status === 'faerdig' && width > 70 ? <Check className="inline h-4 w-4 ml-1 -mt-0.5" /> : null}
          </button>
        );
      })}
    </div>
  );

  const RowLabel: React.FC<{ depth: number; expandable?: boolean; expanded?: boolean; onToggle?: () => void; title: string; sub?: string; level: Level; count?: number }> =
    ({ depth, expandable, expanded, onToggle, title, sub, level, count }) => (
      <div
        className={cn('h-14 flex items-center gap-1 pr-2 border-r border-border bg-card', expandable && 'cursor-pointer hover:bg-muted/60')}
        style={{ paddingLeft: 12 + depth * 24 }}
        onClick={expandable ? onToggle : undefined}
      >
        {expandable ? (expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />) : <span className="w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-base', level === 'project' ? 'font-semibold' : level === 'quote' ? 'font-medium' : 'text-muted-foreground')} title={title}>{title}</div>
          {sub ? <div className="truncate text-xs text-muted-foreground -mt-0.5">{sub}</div> : null}
        </div>
        {count !== undefined ? <Badge variant="outline" className="text-xs h-5 px-1.5">{count}</Badge> : null}
      </div>
    );

  // -- Side ------------------------------------------------------------------
  return (
    <Layout>
      <div className="p-4 space-y-4 w-full">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarRange className="h-6 w-6" /> Tidsplan</h1>
            <p className="text-sm text-muted-foreground">
              Viser {visibleProjects.length} af {candidateProjects.length} vundne projekter i gang. Klik på et projekt for tilbud, på et tilbud for produkter. Klik på en bjælke for at rette datoer.
              Projekter forsvinder herfra når de sættes i <em>Garanti</em>.
            </p>
          </div>
          {/* Navigation + visning */}
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftWindow(-1)} title="Tilbage"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-9" onClick={goToday}>I dag</Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftWindow(1)} title="Frem"><ChevronRight className="h-4 w-4" /></Button>
            <span className="ml-2 text-sm text-muted-foreground whitespace-nowrap tabular-nums">
              {format(range.from, 'd. MMM yyyy', { locale: da })} – {format(range.to, 'd. MMM yyyy', { locale: da })}
            </span>
          </div>
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5" role="group" aria-label="Visning">
            {VIEWS.map(v => (
              <Button key={v.key} size="sm" variant={prefs.view === v.key ? 'default' : 'ghost'} className="h-8 px-3"
                onClick={() => setPrefs(p => ({ ...p, view: v.key }))}>
                {v.label}
              </Button>
            ))}
          </div>
          </div>
        </div>

        {/* Filtre */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={prefs.search} onChange={e => setPrefs(p => ({ ...p, search: e.target.value }))}
              placeholder="Søg projekt, nr. eller kunde" className="h-9 w-64 pl-8" />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="h-4 w-4" /> Projekttype
                {typeOptions.some(t => typesOff.has(t)) && <Badge variant="secondary" className="h-5 px-1.5 text-xs">{typeOptions.filter(t => !typesOff.has(t)).length}/{typeOptions.length}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-2">
              {typeOptions.map(t => (
                <label key={t || 'none'} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox checked={!typesOff.has(t)} onCheckedChange={() => toggleIn('typesOff', t)} />
                  <span className="flex-1">{TYPE_LABEL[t] ?? t}</span>
                  <span className="text-xs text-muted-foreground">{candidateProjects.filter(p => (p.projectType ?? '') === t).length}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="h-4 w-4" /> Projekter
                {hiddenProjects.size > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-xs">{hiddenProjects.size} skjult</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-2 max-h-96 overflow-y-auto">
              {candidateProjects.map(p => (
                <label key={p.id} className={cn('flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm', typesOff.has(p.projectType ?? '') && 'opacity-50')}>
                  <Checkbox checked={!hiddenProjects.has(p.id)} onCheckedChange={() => toggleIn('hiddenProjects', p.id)} />
                  <span className="flex-1 truncate">{p.projectNumber} {p.name}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[p.projectType ?? ''] ?? p.projectType}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1 ml-1">
            <span className="text-xs text-muted-foreground mr-1">Faser:</span>
            {FASER.map(f => {
              const on = !faserOff.has(f.key);
              return (
                <button key={f.key} type="button" onClick={() => toggleIn('faserOff', f.key)}
                  className={cn('flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-xs transition-colors',
                    on ? 'border-border bg-card text-foreground' : 'border-dashed border-border text-muted-foreground opacity-60')}
                  title={on ? `Skjul ${f.label}` : `Vis ${f.label}`}>
                  <span className={cn('inline-block h-3 w-3 rounded-sm', f.color, !on && 'opacity-40')} /> {f.label}
                </button>
              );
            })}
          </div>

          {filtersActive && (
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={resetFilters}><X className="h-4 w-4" /> Nulstil filtre</Button>
          )}
        </div>

        {tableMissing && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tabellen tidsplan_faser findes ikke endnu</AlertTitle>
            <AlertDescription>
              Kør migrationen <code>supabase/migrations/2026-09-23_tidsplan_faser.sql</code> i Supabase, og genindlæs siden.
            </AlertDescription>
          </Alert>
        )}

        {!tableMissing && !loading && visibleProjects.length === 0 && (
          <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">
            {candidateProjects.length === 0
              ? <>Ingen projekter i faserne <em>Kontrakt og planlægning</em> eller <em>Produktion</em>.</>
              : <>Filtrene skjuler alle projekter. <button className="underline" onClick={resetFilters}>Nulstil filtre</button></>}
          </div>
        )}

        {!tableMissing && visibleProjects.length > 0 && (
          <div className="border rounded-md overflow-hidden bg-card">
            <div className="overflow-hidden">
              <div className="flex w-full">
                {/* Venstre: hierarki */}
                <div className="w-[460px] shrink-0 z-20 bg-card border-r border-border">
                  <div className="h-14 border-b border-border flex items-end px-3 pb-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Projekt / Tilbud / Produkt</div>
                  {visibleProjects.map(p => {
                    const pQuotes = quotesByProject.get(p.id) ?? [];
                    const pOpen = expandedProjects.has(p.id);
                    return (
                      <React.Fragment key={p.id}>
                        <div className="border-b border-border">
                          <RowLabel depth={0} level="project" expandable={pQuotes.length > 0} expanded={pOpen} onToggle={() => toggleProject(p)}
                            title={`${p.projectNumber ?? ''} ${p.name}`.trim()} sub={p.customer} count={pQuotes.length} />
                        </div>
                        {pOpen && pQuotes.map(q => {
                          const qLines = linesByQuote.get(q.id) ?? [];
                          const qOpen = expandedQuotes.has(q.id);
                          return (
                            <React.Fragment key={q.id}>
                              <div className="border-b border-border/60">
                                <RowLabel depth={1} level="quote" expandable={qLines.length > 0} expanded={qOpen} onToggle={() => toggleQuote(p, q)}
                                  title={`${q.quote_number ?? 'Tilbud'} ${q.title ?? ''}`.trim()} count={qLines.length} />
                              </div>
                              {qOpen && qLines.map(l => (
                                <div key={l.id} className="border-b border-border/40">
                                  <RowLabel depth={2} level="line" title={l.title} sub={l.quantity != null ? `${l.quantity} ${l.unit ?? 'stk'}` : undefined} />
                                </div>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Højre: tidsakse + bjælker */}
                <div className="relative flex-1 min-w-0 overflow-hidden" ref={timelineRef}>
                  {/* Header: stor enhed øverst, lille enhed nederst (afhænger af visning) */}
                  <div className="h-14 border-b border-border relative bg-muted/30 overflow-hidden">
                    {majorTicks.map(t => (
                      <div key={`M${t.start.toISOString()}`} className="absolute top-0 h-7 leading-7 pl-1.5 border-l border-border text-sm font-semibold text-foreground whitespace-nowrap overflow-hidden capitalize"
                        style={{ left: tickX(t.start), width: tickW(t) }}>
                        {unitLabel(t.start, view.major, true)}
                      </div>
                    ))}
                    {minorTicks.map(t => (
                      <div key={`m${t.start.toISOString()}`}
                        className={cn('absolute top-7 h-7 leading-7 border-l border-border/60 text-xs text-muted-foreground whitespace-nowrap overflow-hidden capitalize',
                          view.minor === 'day' ? 'text-center' : 'pl-1',
                          view.minor === 'day' && isWeekend(t.start) && 'bg-muted/70')}
                        style={{ left: tickX(t.start), width: tickW(t) }}>
                        {tickW(t) >= 18 ? unitLabel(t.start, view.minor, false) : ''}
                      </div>
                    ))}
                  </div>

                  {/* Baggrunds-gitter */}
                  <div className="absolute inset-x-0 top-14 bottom-0 pointer-events-none">
                    {minorTicks.map(t => (
                      <div key={t.start.toISOString()}
                        className={cn('absolute top-0 bottom-0 border-l border-border/30', view.minor === 'day' && isWeekend(t.start) && 'bg-muted/40')}
                        style={{ left: tickX(t.start), width: view.minor === 'day' ? tickW(t) : undefined }} />
                    ))}
                    {majorTicks.map(t => (
                      <div key={`g${t.start.toISOString()}`} className="absolute top-0 bottom-0 border-l border-border/70" style={{ left: tickX(t.start) }} />
                    ))}
                    {todayX >= 0 && todayX <= timelineWidth && (
                      <div className="absolute top-0 bottom-0 border-l-2 border-red-500/70" style={{ left: todayX }} title="I dag" />
                    )}
                  </div>

                  {/* Rækker — samme rækkefølge som venstre kolonne */}
                  {visibleProjects.map(p => {
                    const pQuotes = quotesByProject.get(p.id) ?? [];
                    const pOpen = expandedProjects.has(p.id);
                    return (
                      <React.Fragment key={p.id}>
                        <div className="border-b border-border"><GanttBars level="project" levelRows={rowsByLevel.get(levelKey(p.id, null, null)) ?? []} /></div>
                        {pOpen && pQuotes.map(q => {
                          const qLines = linesByQuote.get(q.id) ?? [];
                          const qOpen = expandedQuotes.has(q.id);
                          return (
                            <React.Fragment key={q.id}>
                              <div className="border-b border-border/60"><GanttBars level="quote" levelRows={rowsByLevel.get(levelKey(p.id, q.id, null)) ?? []} /></div>
                              {qOpen && qLines.map(l => (
                                <div key={l.id} className="border-b border-border/40"><GanttBars level="line" levelRows={rowsByLevel.get(levelKey(p.id, q.id, l.id)) ?? []} /></div>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && !tableMissing && <p className="text-sm text-muted-foreground">Henter tidsplan…</p>}
      </div>

      {/* Redigér fase */}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={cn('inline-block h-3 w-3 rounded-sm', FASE_BY_KEY[editing.fase].color)} />
                  {FASE_BY_KEY[editing.fase].label}
                </DialogTitle>
                <DialogDescription>
                  {levelLabel(editing.quote_line_id ? 'line' : editing.quote_id ? 'quote' : 'project')}-laget. Ændringen gælder kun denne række.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="tp-start">Start</Label>
                  <Input id="tp-start" type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tp-end">Slut</Label>
                  <Input id="tp-end" type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as FaseStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as FaseStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="tp-note">Note</Label>
                  <Textarea id="tp-note" rows={2} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Fx: afventer beslag fra Häfele" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Annullér</Button>
                <Button onClick={saveEdit} disabled={saving}>{saving ? 'Gemmer…' : 'Gem'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Tidsplan;
