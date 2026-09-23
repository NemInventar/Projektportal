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
import { ChevronRight, ChevronDown, CalendarRange, ZoomIn, ZoomOut, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  addDays, differenceInCalendarDays, format, parseISO, startOfWeek, getISOWeek, isSameMonth, min as minDate, max as maxDate,
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
  const [pxPerDay, setPxPerDay] = useState(10);
  const [editing, setEditing] = useState<FaseRow | null>(null);
  const [editForm, setEditForm] = useState({ start_date: '', end_date: '', status: 'planlagt' as FaseStatus, note: '' });
  const [saving, setSaving] = useState(false);

  // Vundne projekter der stadig er i gang. Interne omkostningssteder er ikke sager.
  const visibleProjects = useMemo(
    () => projects
      .filter(p => VISIBLE_PROJECT_PHASES.includes(p.phase) && p.projectType !== 'intern')
      .sort((a, b) => (a.projectNumber ?? '').localeCompare(b.projectNumber ?? '')),
    [projects],
  );
  const visibleProjectIds = useMemo(() => visibleProjects.map(p => p.id), [visibleProjects]);

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
  const today = new Date();
  const range = useMemo(() => {
    const starts = rows.map(r => parseISO(r.start_date));
    const ends = rows.map(r => parseISO(r.end_date));
    const lo = starts.length ? minDate([...starts, addDays(today, -14)]) : addDays(today, -14);
    const hi = ends.length ? maxDate([...ends, addDays(today, 60)]) : addDays(today, 120);
    const from = startOfWeek(addDays(lo, -7), { weekStartsOn: 1 });
    const to = addDays(hi, 21);
    return { from, to, days: differenceInCalendarDays(to, from) + 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const weeks = useMemo(() => {
    const out: { start: Date; week: number; showMonth: boolean }[] = [];
    let d = range.from;
    let prev: Date | null = null;
    while (d <= range.to) {
      out.push({ start: d, week: getISOWeek(d), showMonth: !prev || !isSameMonth(prev, d) });
      prev = d; d = addDays(d, 7);
    }
    return out;
  }, [range]);

  const xOf = (dateStr: string) => differenceInCalendarDays(parseISO(dateStr), range.from) * pxPerDay;
  const wOf = (start: string, end: string) => (differenceInCalendarDays(parseISO(end), parseISO(start)) + 1) * pxPerDay;
  const timelineWidth = range.days * pxPerDay;
  const todayX = differenceInCalendarDays(today, range.from) * pxPerDay;

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
      {levelRows.map(r => {
        const f = FASE_BY_KEY[r.fase];
        const left = xOf(r.start_date);
        const width = Math.max(wOf(r.start_date, r.end_date), 2);
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
              Vundne projekter i gang ({visibleProjects.length}). Klik på et projekt for tilbud, på et tilbud for produkter. Klik på en bjælke for at rette datoer.
              Projekter forsvinder herfra når de sættes i <em>Garanti</em>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-3 mr-2">
              {FASER.map(f => (
                <span key={f.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={cn('inline-block h-3 w-3 rounded-sm', f.color)} /> {f.label}
                </span>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => setPxPerDay(v => Math.max(3, v - 2))} title="Zoom ud"><ZoomOut className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setPxPerDay(v => Math.min(30, v + 2))} title="Zoom ind"><ZoomIn className="h-4 w-4" /></Button>
          </div>
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
            Ingen projekter i faserne <em>Kontrakt og planlægning</em> eller <em>Produktion</em>.
          </div>
        )}

        {!tableMissing && visibleProjects.length > 0 && (
          <div className="border rounded-md overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <div className="flex" style={{ minWidth: 460 + timelineWidth }}>
                {/* Venstre: hierarki */}
                <div className="w-[460px] shrink-0 sticky left-0 z-20 bg-card border-r border-border">
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
                <div className="relative" style={{ width: timelineWidth }}>
                  {/* Header: måneder + uger */}
                  <div className="h-14 border-b border-border relative bg-muted/30">
                    {weeks.map(w => {
                      const left = differenceInCalendarDays(w.start, range.from) * pxPerDay;
                      return (
                        <React.Fragment key={w.start.toISOString()}>
                          {w.showMonth && (
                            <div className="absolute top-0 text-sm font-semibold text-foreground pl-1 border-l border-border h-7 leading-7 whitespace-nowrap" style={{ left }}>
                              {format(w.start, 'MMM yyyy', { locale: da })}
                            </div>
                          )}
                          <div className="absolute top-7 h-7 text-xs text-muted-foreground border-l border-border/60 pl-1 leading-7" style={{ left, width: 7 * pxPerDay }}>
                            {pxPerDay >= 3 ? `Uge ${w.week}` : ''}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Baggrunds-gitter (uger) */}
                  <div className="absolute inset-x-0 top-14 bottom-0 pointer-events-none">
                    {weeks.map(w => (
                      <div key={w.start.toISOString()} className="absolute top-0 bottom-0 border-l border-border/30" style={{ left: differenceInCalendarDays(w.start, range.from) * pxPerDay }} />
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
