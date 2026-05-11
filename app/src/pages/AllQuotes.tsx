/**
 * AllQuotes — global tilbudsoversigt på tværs af projekter.
 *
 * Skalerer til ~200 tilbud client-side. Server-pagination er V2.
 * Bruger `cached_sell_total` direkte (trigger holder det opdateret).
 *
 * Row-klik: sætter activeProject fra quote'ens project_id og navigerer til
 * eksisterende detalje-side `/project/quotes/:id`. Undgår projektkontekst-bug.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, Lock, AlertTriangle, ExternalLink,
} from 'lucide-react';
import {
  formatCurrency, statusLabel, statusColorClasses, formatDateDanish,
  relativeDanish, isValidityExpired, QUOTE_STATUS_LABEL,
} from '@/lib/quoteHelpers';

interface QuoteRow {
  id: string;
  project_id: string | null;
  quote_number: string | null;
  title: string | null;
  status: string | null;
  is_locked: boolean;
  cached_sell_total: number | null;
  sent_at: string | null;
  valid_until: string | null;
  updated_at: string | null;
  created_at: string | null;
}

type SortCol = 'quote_number' | 'project' | 'customer' | 'status' | 'total' | 'sent_at' | 'valid_until' | 'updated_at';
type SortDir = 'asc' | 'desc';

export default function AllQuotes() {
  const navigate = useNavigate();
  const { projects, setActiveProject } = useProject();

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('sent_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingValidUntilId, setEditingValidUntilId] = useState<string | null>(null);

  const updateValidUntil = async (quoteId: string, newDate: string | null) => {
    const { error } = await supabase
      .from('project_quotes_2026_01_16_23_00')
      .update({ valid_until: newDate, updated_at: new Date().toISOString() })
      .eq('id', quoteId);
    if (!error) {
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, valid_until: newDate } : q));
    }
    setEditingValidUntilId(null);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from('project_quotes_2026_01_16_23_00')
        .select('id, project_id, quote_number, title, status, is_locked, cached_sell_total, sent_at, valid_until, updated_at, created_at');
      if (!includeArchived) q = q.neq('status', 'archived');
      const { data, error } = await q;
      if (!error && data) {
        setQuotes(data as unknown as QuoteRow[]);
      }
      setLoading(false);
    };
    load();
  }, [includeArchived]);

  const projectsById = useMemo(() => {
    const m: Record<string, { id: string; name: string; customer: string | null; project_number: string | null; phase: string | null }> = {};
    projects.forEach((p: any) => {
      m[p.id] = { id: p.id, name: p.name, customer: p.customer, project_number: p.projectNumber ?? p.project_number ?? null, phase: p.phase };
    });
    return m;
  }, [projects]);

  const customers = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => { if (p.customer) set.add(p.customer); });
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const inactivePhases = new Set(['Tabt', 'Arkiv']);
    return quotes.filter((q) => {
      const project = q.project_id ? projectsById[q.project_id] : null;
      // Skjul tilbud fra arkiverede/tabte projekter medmindre brugeren vælger "Vis arkiverede"
      if (!includeArchived && project?.phase && inactivePhases.has(project.phase)) return false;
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (customerFilter !== 'all' && project?.customer !== customerFilter) return false;
      if (s.length > 0) {
        const hay = [
          q.quote_number, q.title, project?.name, project?.customer, project?.project_number,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [quotes, search, statusFilter, customerFilter, projectsById, includeArchived]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const rows = [...filtered];
    rows.sort((a, b) => {
      const pa = a.project_id ? projectsById[a.project_id] : null;
      const pb = b.project_id ? projectsById[b.project_id] : null;
      let av: any;
      let bv: any;
      switch (sortCol) {
        case 'quote_number':
          av = a.quote_number ?? ''; bv = b.quote_number ?? ''; break;
        case 'project':
          av = pa?.name ?? ''; bv = pb?.name ?? ''; break;
        case 'customer':
          av = pa?.customer ?? ''; bv = pb?.customer ?? ''; break;
        case 'status':
          av = a.status ?? ''; bv = b.status ?? ''; break;
        case 'total':
          av = a.cached_sell_total ?? -1; bv = b.cached_sell_total ?? -1; break;
        case 'sent_at':
          av = a.sent_at ?? ''; bv = b.sent_at ?? ''; break;
        case 'valid_until':
          av = a.valid_until ?? ''; bv = b.valid_until ?? ''; break;
        case 'updated_at':
          av = a.updated_at ?? ''; bv = b.updated_at ?? ''; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [filtered, sortCol, sortDir, projectsById]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'sent_at' || col === 'updated_at' || col === 'total' ? 'desc' : 'asc');
    }
  };

  const openQuote = (q: QuoteRow) => {
    if (q.project_id) {
      const project = projects.find((p: any) => p.id === q.project_id);
      if (project) setActiveProject(project);
    }
    navigate(`/project/quotes/${q.id}`);
  };

  const openProject = (projectId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!projectId) return;
    const project = projects.find((p: any) => p.id === projectId);
    if (project) {
      setActiveProject(project);
      navigate('/project/overview');
    }
  };

  const sortIcon = (col: SortCol) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Aggreger totals pr. status for synlige rækker
  const totals = useMemo(() => {
    const bucket = { count: 0, sum: 0 };
    const t = {
      all: { ...bucket },
      draft: { ...bucket },
      sent: { ...bucket },
      accepted: { ...bucket },
      rejected: { ...bucket },
      archived: { ...bucket },
    };
    for (const q of sorted) {
      const val = q.cached_sell_total ?? 0;
      t.all.count += 1;
      t.all.sum += val;
      const key = (q.status ?? 'draft') as keyof typeof t;
      if (t[key]) {
        t[key].count += 1;
        t[key].sum += val;
      }
    }
    return t;
  }, [sorted]);
  const totalSum = totals.all.sum;

  return (
    <Layout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tilbud</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? 'Indlæser…' : `${sorted.length} af ${quotes.length} tilbud · ${formatCurrency(totalSum)}`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg på tilbudsnr, titel, projekt eller kunde…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statuser</SelectItem>
                  {Object.entries(QUOTE_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {customers.length > 0 && (
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle kunder</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant={includeArchived ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIncludeArchived(v => !v)}
              >
                {includeArchived ? 'Skjul arkiverede' : 'Vis arkiverede'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => toggleSort('quote_number')} className="flex items-center gap-1 hover:text-foreground">
                      Tilbudsnr {sortIcon('quote_number')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('project')} className="flex items-center gap-1 hover:text-foreground">
                      Projekt {sortIcon('project')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('customer')} className="flex items-center gap-1 hover:text-foreground">
                      Kunde {sortIcon('customer')}
                    </button>
                  </TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-foreground">
                      Status {sortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort('total')} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      Total {sortIcon('total')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('sent_at')} className="flex items-center gap-1 hover:text-foreground">
                      Sendt {sortIcon('sent_at')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('valid_until')} className="flex items-center gap-1 hover:text-foreground">
                      Gyldig til {sortIcon('valid_until')}
                    </button>
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((q) => {
                  const project = q.project_id ? projectsById[q.project_id] : null;
                  const expired = isValidityExpired(q.valid_until) && q.status === 'sent';
                  return (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openQuote(q)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {q.quote_number || '-'}
                          {q.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {project?.name ?? <span className="text-muted-foreground">—</span>}
                        {project?.project_number && (
                          <span className="text-xs text-muted-foreground block">{project.project_number}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {project?.customer ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={q.title ?? undefined}>
                        {q.title || '(uden titel)'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColorClasses(q.status)}>{statusLabel(q.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(q.cached_sell_total)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {q.sent_at ? (
                          <span title={formatDateDanish(q.sent_at)}>{relativeDanish(q.sent_at)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                        {editingValidUntilId === q.id ? (
                          <Input
                            type="date"
                            autoFocus
                            defaultValue={q.valid_until ?? ''}
                            onBlur={(e) => updateValidUntil(q.id, e.target.value || null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingValidUntilId(null);
                            }}
                            className="h-7 text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingValidUntilId(q.id)}
                            className={`text-left w-full hover:bg-muted/50 -mx-2 px-2 py-1 rounded ${expired ? 'text-red-700 font-medium' : ''}`}
                            title="Klik for at redigere (også på låste tilbud)"
                          >
                            {q.valid_until ? (
                              <span className="flex items-center gap-1">
                                {expired && <AlertTriangle className="h-3 w-3" />}
                                {formatDateDanish(q.valid_until)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Sæt dato…</span>
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => openProject(q.project_id, e)}
                          title="Åbn projekt"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {sorted.length > 0 && (
                <TableFooter className="bg-muted/40">
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>Kladder: <span className="font-medium text-foreground">{totals.draft.count}</span> · {formatCurrency(totals.draft.sum)}</span>
                        <span>Sendt: <span className="font-medium text-foreground">{totals.sent.count}</span> · {formatCurrency(totals.sent.sum)}</span>
                        <span>Accepteret: <span className="font-medium text-green-700">{totals.accepted.count}</span> · <span className="text-green-700 font-medium">{formatCurrency(totals.accepted.sum)}</span></span>
                        {totals.rejected.count > 0 && (
                          <span>Afvist: <span className="font-medium text-foreground">{totals.rejected.count}</span></span>
                        )}
                        {totals.archived.count > 0 && (
                          <span>Arkiv: <span className="font-medium text-foreground">{totals.archived.count}</span></span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="font-medium">{totals.all.count} i alt</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-base">
                      {formatCurrency(totals.all.sum)}
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>

            {!loading && sorted.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                {quotes.length === 0
                  ? 'Ingen tilbud endnu. Opret et fra et projekt.'
                  : 'Ingen tilbud matcher filtrene.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
