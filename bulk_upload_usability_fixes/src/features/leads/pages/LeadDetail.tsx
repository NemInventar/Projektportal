/**
 * LeadDetail — planens §4.3.
 *
 * Tre-kolonne layout:
 *   Venstre: header + stamdata/metadata (inline edit på key-felter)
 *   Midt:    Focus-card (næste aktivitet) + Timeline (noter + activities)
 *   Højre:   actions (Konvertér, Markér tabt, Arkivér), Labels, Filer V2
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Tag,
  Phone,
  Mail,
  Building,
  Archive,
  XCircle,
  ArrowRightCircle,
  CalendarDays,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { getDealWithRelations, updateDeal, archiveDeal } from '../lib/dealsApi';
import { createNote, togglePin, deleteNote } from '../lib/notesApi';
import { completeActivity, deleteActivity } from '../lib/activitiesApi';
import { attachLabelToDeal, detachLabelFromDeal } from '../lib/labelsApi';
import { toDue, isOverdue, QUICK_TIMES } from '../lib/focus';
import { createActivity } from '../lib/activitiesApi';

import { LeadActivityDialog } from '../components/LeadActivityDialog';
import { ConvertLeadDialog } from '../components/ConvertLeadDialog';
import { MarkLeadLostDialog } from '../components/MarkLeadLostDialog';
import { useLeads } from '../LeadsContext';
import {
  OWNER_EMAILS,
  OWNER_NAME,
  PIPELINE_STAGE,
  PIPELINE_STAGE_LABEL,
  ACTIVITY_TYPE_LABEL,
  type PipelineStage,
} from '../constants';
import type { Activity, DealNote, DealWithRelations, Label } from '../types';

const CURRENT_USER_EMAIL = 'js@neminventar.dk'; // V1: hardkodet — TODO hent fra AuthContext

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('da-DK') : '-';

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.toLocaleDateString('da-DK')} ${d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`;
};

const stageColor = (stage: string | null | undefined) => {
  switch (stage) {
    case 'lead':      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'qualified': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'converted': return 'bg-green-100 text-green-800 border-green-200';
    case 'lost':      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'archived':  return 'bg-gray-100 text-gray-700 border-gray-200';
    default:          return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// ---------------------------------------------------------------------------
// Sub-komponenter (inline for at holde én fil)
// ---------------------------------------------------------------------------

const InlineField: React.FC<{
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
}> = ({ label, value, onEdit }) => (
  <div
    className={`py-2 ${onEdit ? 'cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded' : ''}`}
    onClick={onEdit}
  >
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm mt-0.5">{value ?? <span className="text-muted-foreground">—</span>}</div>
  </div>
);

const FocusCard: React.FC<{
  deal: DealWithRelations;
  onChanged: () => void;
}> = ({ deal, onChanged }) => {
  const { toast } = useToast();
  const focus = deal.focus;
  const [completing, setCompleting] = useState(false);
  const [outcome, setOutcome] = useState('');

  const handleComplete = async () => {
    if (!focus?.focus_activity_id) return;
    try {
      await completeActivity(focus.focus_activity_id, outcome.trim() || 'Udført');
      toast({ title: 'Aktivitet markeret som udført' });
      setCompleting(false);
      setOutcome('');
      onChanged();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  const quickAddActivity = async (label: string, fn: () => { due_date: string; due_time: string }) => {
    const { due_date, due_time } = fn();
    try {
      await createActivity({
        deal_id: deal.id,
        title: label,
        activity_type: 'call',
        due_date,
        due_time,
        assigned_to: deal.assigned_to ?? CURRENT_USER_EMAIL,
      });
      toast({ title: 'Opfølgning oprettet' });
      onChanged();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Næste handling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {focus ? (
          <>
            <div className="flex items-center gap-2">
              {focus.is_overdue && (
                <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
                  <AlertTriangle className="h-3 w-3" /> Forfalden
                </Badge>
              )}
              <Badge variant="outline">
                {focus.activity_type ? ACTIVITY_TYPE_LABEL[focus.activity_type] ?? focus.activity_type : 'Opgave'}
              </Badge>
            </div>
            <div className="font-medium">{focus.subject}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-3 w-3" />
              {formatDate(focus.due_date)} {focus.due_time?.slice(0, 5) ?? ''}
              {focus.assigned_to && (
                <span>· {OWNER_NAME[focus.assigned_to] ?? focus.assigned_to}</span>
              )}
            </div>

            {completing ? (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  rows={2}
                  placeholder="Hvad skete der? Fx 'fik fat i Maria, sender tegning torsdag'"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleComplete} className="flex-1 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Udført
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setCompleting(false); setOutcome(''); }}>
                    Annullér
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" onClick={() => setCompleting(true)} className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Markér som udført
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">Ingen åben aktivitet.</div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Planlæg hurtigt:</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_TIMES.map((qt) => (
                  <Button
                    key={qt.key}
                    size="sm"
                    variant="outline"
                    onClick={() => quickAddActivity(`Opfølgning ${qt.label.toLowerCase()}`, qt.fn)}
                  >
                    {qt.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

type TimelineItem =
  | { kind: 'note'; at: string; note: DealNote }
  | { kind: 'activity'; at: string; activity: Activity };

const Timeline: React.FC<{
  deal: DealWithRelations;
  onChanged: () => void;
}> = ({ deal, onChanged }) => {
  const { toast } = useToast();
  const [noteBody, setNoteBody] = useState('');
  const [adding, setAdding] = useState(false);

  const items: TimelineItem[] = useMemo(() => {
    const notes = deal.notes.map((n) => ({ kind: 'note' as const, at: n.created_at, note: n }));
    const activities = deal.activities.map((a) => {
      const at = a.done && a.done_at
        ? a.done_at
        : (toDue(a.due_date, a.due_time)?.toISOString() ?? a.created_at);
      return { kind: 'activity' as const, at, activity: a };
    });
    return [...notes, ...activities].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [deal.notes, deal.activities]);

  const pinned = deal.notes.filter((n) => n.pinned);

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setAdding(true);
    try {
      await createNote({
        deal_id: deal.id,
        body: noteBody.trim(),
        author_email: CURRENT_USER_EMAIL,
      });
      setNoteBody('');
      onChanged();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleTogglePin = async (note: DealNote) => {
    await togglePin(note.id, !note.pinned);
    onChanged();
  };

  const handleDeleteNote = async (note: DealNote) => {
    if (!confirm('Slet note?')) return;
    await deleteNote(note.id);
    onChanged();
  };

  const handleDeleteActivity = async (activity: Activity) => {
    if (!confirm('Slet aktivitet?')) return;
    await deleteActivity(activity.id);
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick note input */}
        <div className="space-y-2">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Skriv en note… (Ctrl+Enter for at gemme)"
            rows={2}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleAddNote();
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddNote} disabled={adding || !noteBody.trim()}>
              {adding ? 'Gemmer…' : 'Tilføj note'}
            </Button>
          </div>
        </div>

        {pinned.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded p-3 space-y-2">
            <div className="text-xs font-medium text-amber-900 flex items-center gap-1">
              <Pin className="h-3 w-3" /> Pin'ede noter
            </div>
            {pinned.map((n) => (
              <div key={n.id} className="text-sm">
                {n.body}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Ingen aktivitet endnu.
            </div>
          ) : (
            items.map((item) => {
              if (item.kind === 'note') {
                const n = item.note;
                return (
                  <div key={`n-${n.id}`} className="border-l-2 border-blue-300 pl-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {n.author_email.split('@')[0]} ·{' '}
                        {formatDateTime(n.created_at)}
                        {n.created_by === 'claude_auto' && (
                          <Badge variant="outline" className="ml-2 text-xs">AI</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleTogglePin(n)}
                          title={n.pinned ? 'Un-pin' : 'Pin'}
                        >
                          {n.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteNote(n)}
                          title="Slet"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap">{n.body}</div>
                  </div>
                );
              }
              const a = item.activity;
              const color = a.done ? 'border-green-300' : isOverdue(a.due_date, a.due_time) ? 'border-red-400' : 'border-amber-300';
              return (
                <div key={`a-${a.id}`} className={`border-l-2 ${color} pl-3 group`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {a.activity_type ? ACTIVITY_TYPE_LABEL[a.activity_type] ?? a.activity_type : 'Opgave'}
                      </Badge>
                      {a.done ? (
                        <span className="text-green-700">Udført {formatDateTime(a.done_at)}</span>
                      ) : (
                        <span>{formatDate(a.due_date)} {a.due_time?.slice(0, 5) ?? ''}</span>
                      )}
                      {a.assigned_to && (
                        <span>· {OWNER_NAME[a.assigned_to] ?? a.assigned_to}</span>
                      )}
                    </div>
                    <button
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteActivity(a)}
                      title="Slet"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-sm font-medium mt-1">{a.title}</div>
                  {a.description && (
                    <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {a.description}
                    </div>
                  )}
                  {a.completed_outcome && (
                    <div className="text-sm mt-1 italic">→ {a.completed_outcome}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Hovedside
// ---------------------------------------------------------------------------

export const LeadDetail: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { labels: allLabels, reloadDeals, reloadOverdue } = useLeads();

  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const d = await getDealWithRelations(dealId);
      setDeal(d);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), reloadDeals(), reloadOverdue()]);
  }, [load, reloadDeals, reloadOverdue]);

  const startEdit = (field: string, current: string | null | undefined) => {
    setEditingField(field);
    setEditValue(current ?? '');
  };

  const saveEdit = async () => {
    if (!deal || !editingField) return;
    const patch: Record<string, unknown> = {};
    if (editingField === 'value_dkk') {
      const num = parseFloat(editValue.replace(',', '.'));
      patch.value_dkk = isNaN(num) ? null : num;
    } else {
      patch[editingField] = editValue.trim().length > 0 ? editValue.trim() : null;
    }
    try {
      const updated = await updateDeal(deal.id, patch as any);
      setDeal({ ...deal, ...updated });
      setEditingField(null);
      await reloadDeals();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  const updateStage = async (stage: PipelineStage) => {
    if (!deal) return;
    const updated = await updateDeal(deal.id, { pipeline_stage: stage });
    setDeal({ ...deal, ...updated });
    await reloadDeals();
  };

  const updateOwner = async (email: string) => {
    if (!deal) return;
    const updated = await updateDeal(deal.id, { assigned_to: email });
    setDeal({ ...deal, ...updated });
    await reloadDeals();
  };

  const toggleLabel = async (label: Label) => {
    if (!deal) return;
    const has = deal.labels.some((l) => l.id === label.id);
    if (has) {
      await detachLabelFromDeal(deal.id, label.id);
    } else {
      await attachLabelToDeal(deal.id, label.id);
    }
    await load();
    await reloadDeals();
  };

  const handleArchive = async () => {
    if (!deal) return;
    if (!confirm('Arkivér lead?')) return;
    await archiveDeal(deal.id);
    toast({ title: 'Arkiveret' });
    await reloadDeals();
    navigate('/leads');
  };

  if (loading) {
    return <Layout><div className="p-6">Indlæser lead…</div></Layout>;
  }
  if (!deal) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Tilbage
          </Button>
          <Card><CardContent className="p-8 text-center text-muted-foreground">Lead ikke fundet.</CardContent></Card>
        </div>
      </Layout>
    );
  }

  const canConvert =
    (deal.pipeline_stage === PIPELINE_STAGE.LEAD || deal.pipeline_stage === PIPELINE_STAGE.QUALIFIED) &&
    !deal.converted_project_id;

  return (
    <Layout>
      <div className="p-6 space-y-4 max-w-[1400px]">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="gap-2 mb-2">
            <ArrowLeft className="h-4 w-4" /> Leads
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold break-words">{deal.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={stageColor(deal.pipeline_stage)}>
                  {deal.pipeline_stage
                    ? PIPELINE_STAGE_LABEL[deal.pipeline_stage] ?? deal.pipeline_stage
                    : '—'}
                </Badge>
                {deal.labels.map((l) => (
                  <Badge
                    key={l.id}
                    variant="outline"
                    style={{ borderColor: l.color, color: l.color }}
                  >
                    {l.name}
                  </Badge>
                ))}
                {deal.converted_project_id && (
                  <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                    <ArrowRightCircle className="h-3 w-3" />
                    Konverteret
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3-kolonne */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-4">
          {/* VENSTRE */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building className="h-4 w-4" /> Organisation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {deal.organization ? (
                  <>
                    <div className="font-medium">{deal.organization.name}</div>
                    {deal.organization.city && (
                      <div className="text-muted-foreground text-xs">
                        {[deal.organization.address, deal.organization.zip, deal.organization.city]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                    {deal.organization.email && (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Mail className="h-3 w-3" /> {deal.organization.email}
                      </div>
                    )}
                    {deal.organization.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Phone className="h-3 w-3" /> {deal.organization.phone}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">Ingen organisation tilknyttet</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Kontaktperson</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>{deal.primary_contact || <span className="text-muted-foreground">—</span>}</div>
                {deal.primary_contact_phone && (
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Phone className="h-3 w-3" /> {deal.primary_contact_phone}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Detaljer</CardTitle>
              </CardHeader>
              <CardContent className="text-sm divide-y">
                {/* Value */}
                {editingField === 'value_dkk' ? (
                  <div className="py-2">
                    <div className="text-xs text-muted-foreground mb-1">Værdi (DKK)</div>
                    <div className="flex gap-1">
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') setEditingField(null);
                        }}
                        onBlur={saveEdit}
                      />
                    </div>
                  </div>
                ) : (
                  <InlineField
                    label="Værdi"
                    value={
                      deal.value_dkk != null
                        ? `${deal.value_dkk.toLocaleString('da-DK')} ${deal.currency ?? 'DKK'}`
                        : null
                    }
                    onEdit={() => startEdit('value_dkk', deal.value_dkk?.toString() ?? '')}
                  />
                )}

                <InlineField
                  label="Status"
                  value={
                    <Select value={deal.pipeline_stage ?? 'lead'} onValueChange={(v) => updateStage(v as PipelineStage)}>
                      <SelectTrigger className="h-7 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PIPELINE_STAGE).map((s) => (
                          <SelectItem key={s} value={s}>
                            {PIPELINE_STAGE_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />

                <InlineField
                  label="Ejer"
                  value={
                    <Select value={deal.assigned_to ?? ''} onValueChange={updateOwner}>
                      <SelectTrigger className="h-7 w-full text-xs">
                        <SelectValue placeholder="Vælg…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OWNER_EMAILS.map((e) => (
                          <SelectItem key={e} value={e}>{OWNER_NAME[e] ?? e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />

                {editingField === 'expected_close_date' ? (
                  <div className="py-2">
                    <div className="text-xs text-muted-foreground mb-1">Forventet luk</div>
                    <Input
                      autoFocus
                      type="date"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                    />
                  </div>
                ) : (
                  <InlineField
                    label="Forventet luk"
                    value={formatDate(deal.expected_close_date)}
                    onEdit={() => startEdit('expected_close_date', deal.expected_close_date ?? '')}
                  />
                )}

                {editingField === 'tegninger_aftalt_date' ? (
                  <div className="py-2">
                    <div className="text-xs text-muted-foreground mb-1">Tegninger aftalt</div>
                    <Input
                      autoFocus
                      type="date"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                    />
                  </div>
                ) : (
                  <InlineField
                    label="Tegninger aftalt"
                    value={formatDate(deal.tegninger_aftalt_date)}
                    onEdit={() => startEdit('tegninger_aftalt_date', deal.tegninger_aftalt_date ?? '')}
                  />
                )}

                {editingField === 'source_channel' ? (
                  <div className="py-2">
                    <div className="text-xs text-muted-foreground mb-1">Kilde</div>
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null); }}
                    />
                  </div>
                ) : (
                  <InlineField
                    label="Kilde"
                    value={deal.source_channel}
                    onEdit={() => startEdit('source_channel', deal.source_channel ?? '')}
                  />
                )}

                <InlineField label="Kommune" value={deal.municipality} onEdit={() => startEdit('municipality', deal.municipality ?? '')} />
                <InlineField label="Region" value={deal.region} onEdit={() => startEdit('region', deal.region ?? '')} />
                <InlineField label="Entrepriseform" value={deal.contract_form} onEdit={() => startEdit('contract_form', deal.contract_form ?? '')} />
                <InlineField label="Stadie" value={deal.stage} onEdit={() => startEdit('stage', deal.stage ?? '')} />
                <InlineField label="Projektnr. ekst." value={deal.project_number_ext} onEdit={() => startEdit('project_number_ext', deal.project_number_ext ?? '')} />

                {editingField && !['value_dkk','expected_close_date','tegninger_aftalt_date','source_channel','municipality','region','contract_form','stage','project_number_ext'].includes(editingField) && (
                  <div className="py-2">
                    <div className="text-xs text-muted-foreground mb-1">{editingField}</div>
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null); }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {deal.byggefakta_id && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Byggefakta</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <div className="text-muted-foreground">ID: {deal.byggefakta_id}</div>
                  {deal.byggefakta_url && (
                    <a
                      href={deal.byggefakta_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      Åbn i Byggefakta
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* MIDT */}
          <div className="space-y-4">
            <FocusCard deal={deal} onChanged={refreshAll} />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)} className="gap-2">
                <Plus className="h-3 w-3" /> Ny aktivitet
              </Button>
            </div>
            <Timeline deal={deal} onChanged={refreshAll} />
          </div>

          {/* HØJRE — actions */}
          <div className="space-y-4">
            {canConvert && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => setConvertOpen(true)}
              >
                <ArrowRightCircle className="h-4 w-4" /> Konvertér til projekt
              </Button>
            )}

            {deal.converted_project_id && (
              <Card>
                <CardContent className="pt-4 text-sm space-y-2">
                  <div className="text-xs text-muted-foreground">Konverteret</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/project/overview`)}
                  >
                    Gå til projekt
                  </Button>
                </CardContent>
              </Card>
            )}

            {deal.pipeline_stage !== PIPELINE_STAGE.LOST && deal.pipeline_stage !== PIPELINE_STAGE.CONVERTED && (
              <Button variant="outline" className="w-full gap-2" onClick={() => setLostOpen(true)}>
                <XCircle className="h-4 w-4" /> Markér som tabt
              </Button>
            )}

            <Button variant="outline" className="w-full gap-2" onClick={handleArchive}>
              <Archive className="h-4 w-4" /> Arkivér
            </Button>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Labels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Tilføj/fjern
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Labels</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allLabels.map((l) => {
                      const on = deal.labels.some((x) => x.id === l.id);
                      return (
                        <DropdownMenuItem
                          key={l.id}
                          onClick={(e) => { e.preventDefault(); toggleLabel(l); }}
                        >
                          <span
                            className="inline-block w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: l.color }}
                          />
                          {l.name}
                          {on && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {deal.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {deal.labels.map((l) => (
                      <Badge
                        key={l.id}
                        variant="outline"
                        style={{ borderColor: l.color, color: l.color }}
                      >
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <LeadActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        dealId={deal.id}
        defaultOwner={deal.assigned_to ?? CURRENT_USER_EMAIL}
        onCreated={refreshAll}
      />
      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        deal={deal}
        userEmail={CURRENT_USER_EMAIL}
        onConverted={(pid) => {
          refreshAll();
          toast({ title: 'Projekt oprettet — åbn det for at begynde tilbud' });
        }}
      />
      <MarkLeadLostDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        dealId={deal.id}
        onLost={refreshAll}
      />
    </Layout>
  );
};

export default LeadDetail;
