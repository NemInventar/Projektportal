/**
 * Leads inbox — planens §4.3.
 *
 * - Søg i titel + org-navn + primary_contact
 * - Filter: pipeline_stage (multi), owner, label, forfaldne, uden aktivitet
 * - Tabel med bulk-actions
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Clock, AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useLeads } from '../LeadsContext';
import { LeadCreateDialog } from '../components/LeadCreateDialog';
import {
  bulkUpdateStage,
  bulkUpdateOwner,
  bulkArchive,
} from '../lib/dealsApi';
import { bulkAttachLabel } from '../lib/labelsApi';
import {
  OWNER_EMAILS,
  OWNER_NAME,
  PIPELINE_STAGE,
  PIPELINE_STAGE_LABEL,
  type PipelineStage,
} from '../constants';
import type { DealListRow } from '../types';

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('da-DK') : '-';

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

export const LeadsInbox: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deals, labels, loading, reloadDeals, reloadOverdue } = useLeads();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | PipelineStage>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [noActivity, setNoActivity] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return deals.filter((d: DealListRow) => {
      if (stageFilter !== 'all' && d.pipeline_stage !== stageFilter) return false;
      if (ownerFilter !== 'all' && d.assigned_to !== ownerFilter) return false;
      if (labelFilter !== 'all' && !d.labels.some((l) => l.id === labelFilter)) return false;
      if (overdueOnly && !d.focus?.is_overdue) return false;
      if (noActivity && d.focus) return false;
      if (s.length > 0) {
        const hay = [
          d.title,
          d.organization?.name ?? '',
          d.primary_contact ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [deals, search, stageFilter, ownerFilter, labelFilter, overdueOnly, noActivity]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((d) => selected.has(d.id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((d) => d.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const afterBulk = async () => {
    setSelected(new Set());
    await Promise.all([reloadDeals(), reloadOverdue()]);
  };

  const handleBulkStage = async (stage: PipelineStage) => {
    try {
      await bulkUpdateStage(Array.from(selected), stage);
      toast({ title: `Status opdateret (${selected.size})` });
      await afterBulk();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  const handleBulkOwner = async (email: string) => {
    try {
      await bulkUpdateOwner(Array.from(selected), email);
      toast({ title: `Ejer opdateret (${selected.size})` });
      await afterBulk();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  const handleBulkLabel = async (labelId: string) => {
    try {
      await bulkAttachLabel(Array.from(selected), labelId);
      toast({ title: `Label tilføjet (${selected.size})` });
      await afterBulk();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Arkivér ${selected.size} lead(s)?`)) return;
    try {
      await bulkArchive(Array.from(selected));
      toast({ title: `Arkiveret (${selected.size})` });
      await afterBulk();
    } catch (err: any) {
      toast({ title: 'Fejl', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading ? 'Indlæser…' : `${filtered.length} af ${deals.length} leads`}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Ny lead
          </Button>
        </div>

        {/* Filter-bar */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg i titel, organisation, kontaktperson…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statuser</SelectItem>
                  {Object.values(PIPELINE_STAGE).map((s) => (
                    <SelectItem key={s} value={s}>
                      {PIPELINE_STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ejer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle ejere</SelectItem>
                  {OWNER_EMAILS.map((email) => (
                    <SelectItem key={email} value={email}>
                      {OWNER_NAME[email] ?? email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={labelFilter} onValueChange={setLabelFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle labels</SelectItem>
                  {labels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={overdueOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOverdueOnly((v) => !v)}
                className="gap-2"
              >
                <AlertTriangle className="h-3 w-3" /> Forfaldne
              </Button>

              <Button
                variant={noActivity ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNoActivity((v) => !v)}
                className="gap-2"
              >
                <Clock className="h-3 w-3" /> Uden aktivitet
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk-action bar */}
        {selected.size > 0 && (
          <Card className="border-primary">
            <CardContent className="pt-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">{selected.size} valgt</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Skift status</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {Object.values(PIPELINE_STAGE).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => handleBulkStage(s)}>
                      {PIPELINE_STAGE_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Skift ejer</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {OWNER_EMAILS.map((email) => (
                    <DropdownMenuItem key={email} onClick={() => handleBulkOwner(email)}>
                      {OWNER_NAME[email] ?? email}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Tilføj label</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Vælg label</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {labels.map((l) => (
                    <DropdownMenuItem key={l.id} onClick={() => handleBulkLabel(l.id)}>
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: l.color }}
                      />
                      {l.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={handleBulkArchive}>
                Arkivér
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Ryd
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabel */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Kontaktperson</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ejer</TableHead>
                  <TableHead>Tegninger aftalt</TableHead>
                  <TableHead>Næste aktivitet</TableHead>
                  <TableHead>Oprettet</TableHead>
                  <TableHead>Labels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: DealListRow) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/leads/${d.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(d.id)}
                        onCheckedChange={() => toggleOne(d.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.organization?.name ?? <span className="text-muted-foreground">—</span>}
                      {d.organization?.city && (
                        <span className="block text-xs text-muted-foreground">
                          {d.organization.city}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{d.title}</TableCell>
                    <TableCell className="text-sm">
                      {d.primary_contact ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={stageColor(d.pipeline_stage)}>
                        {d.pipeline_stage
                          ? PIPELINE_STAGE_LABEL[d.pipeline_stage as PipelineStage] ?? d.pipeline_stage
                          : '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.assigned_to ? OWNER_NAME[d.assigned_to] ?? d.assigned_to : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(d.tegninger_aftalt_date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.focus ? (
                        <div className="flex items-center gap-1">
                          {d.focus.is_overdue && (
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                          )}
                          <span className={d.focus.is_overdue ? 'text-red-700 font-medium' : ''}>
                            {formatDate(d.focus.due_date)}{' '}
                            {d.focus.due_time?.slice(0, 5) ?? ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {d.labels.slice(0, 3).map((l) => (
                          <Badge
                            key={l.id}
                            variant="outline"
                            style={{ borderColor: l.color, color: l.color }}
                          >
                            {l.name}
                          </Badge>
                        ))}
                        {d.labels.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{d.labels.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length === 0 && !loading && (
              <div className="p-12 text-center text-muted-foreground">
                {deals.length === 0
                  ? 'Ingen leads endnu — opret din første med "Ny lead".'
                  : 'Ingen leads matcher filtrene.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LeadCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (dealId) => {
          await reloadDeals();
          navigate(`/leads/${dealId}`);
        }}
      />
    </Layout>
  );
};

export default LeadsInbox;
