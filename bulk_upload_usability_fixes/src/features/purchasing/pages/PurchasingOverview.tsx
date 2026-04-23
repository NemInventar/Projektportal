/**
 * PurchasingOverview — hovedsiden for indkøbsoverblik (/purchasing).
 *
 * Viser liste over RFQs på aktivt projekt + filtre + review-queue panel.
 *
 * Layout jf. plan §5.3:
 *   - Topbar: titel, projekt-navn, knap "Ny prisforespørgsel".
 *   - Filter-chips: status, "kun frist passeret", fri-tekst søg.
 *   - Hovedtabel: RFQListTable.
 *   - Højrepanel (kollapsbart): "Kræver gennemsyn" med count-badge.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, Plus, Search } from 'lucide-react';
import Layout from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProject } from '@/contexts/ProjectContext';

import { useRfqs } from '../hooks/useRfqs';
import { useQuoteReview } from '../hooks/useQuoteReview';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { usePurchasing } from '../PurchasingContext';
import { RFQListTable, type RfqCounts } from '../components/RFQListTable';
import type { Rfq, RfqStatus } from '../types';

const STATUS_LABEL: Record<RfqStatus, string> = {
  draft: 'Kladder',
  sent: 'Sendt',
  partially_received: 'Delvist modtaget',
  closed: 'Lukket',
  awarded: 'Tildelt',
  cancelled: 'Annulleret',
};

const STATUS_ORDER: RfqStatus[] = [
  'draft',
  'sent',
  'partially_received',
  'closed',
  'awarded',
  'cancelled',
];

function isDeadlinePassed(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return false;
  return d < Date.now();
}

export const PurchasingOverview: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const { rfqs, loading } = usePurchasing();
  const { filtered, filters, setFilters } = useRfqs();
  const { count: reviewCount, queue: reviewQueue } = useQuoteReview();
  const { suppliers } = useStandardSuppliers();

  const [deadlinePassedOnly, setDeadlinePassedOnly] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');

  const supplierNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) m[s.id] = s.name;
    return m;
  }, [suppliers]);

  // Compute counts pr. rfq ved hjælp af detail-data er tungt — i første V1
  // har vi ingen pre-aggregeret count. Vi viser 0/0/0 indtil vi fetcher detail.
  // For at undgå n+1 i listen: lad RFQListTable tage counts hvor kalderen
  // giver dem. Vi udfylder dem tomme; pagen loader derefter på detail.
  const counts = useMemo<Record<string, RfqCounts>>(() => ({}), []);

  // Apply yderligere filter: deadline passed
  const displayed = useMemo(() => {
    if (!deadlinePassedOnly) return filtered;
    return filtered.filter((r) => isDeadlinePassed(r.deadline));
  }, [filtered, deadlinePassedOnly]);

  const toggleStatus = (s: RfqStatus) => {
    const current = filters.statuses ?? [];
    const next = current.includes(s)
      ? current.filter((x) => x !== s)
      : [...current, s];
    setFilters({ ...filters, statuses: next.length ? next : undefined });
  };

  const applySearch = () => {
    setFilters({ ...filters, search: searchDraft.trim() || undefined });
  };

  const handleOpen = (rfq: Rfq) => {
    navigate(`/purchasing/rfq/${rfq.id}`);
  };

  const handleCreate = () => {
    navigate('/purchasing/rfq/new');
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-2">Vælg et projekt</h2>
            <p className="text-muted-foreground">
              Du skal vælge et projekt for at se indkøbsoverblik.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">Indkøb</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Projekt:{' '}
              <span className="font-medium text-foreground">
                {activeProject.name}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reviewCount > 0 && (
              <Button
                variant="outline"
                onClick={() => navigate('/purchasing/review')}
                className="gap-2"
              >
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Kræver gennemsyn
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  {reviewCount}
                </Badge>
              </Button>
            )}
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Ny prisforespørgsel
            </Button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onBlur={applySearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              placeholder="Søg i titel eller beskrivelse..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {STATUS_ORDER.map((s) => {
              const active = filters.statuses?.includes(s) ?? false;
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-muted'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
            <button
              onClick={() => setDeadlinePassedOnly((v) => !v)}
              className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                deadlinePassedOnly
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-white hover:bg-muted'
              }`}
            >
              Frist passeret
            </button>
          </div>
        </div>

        {/* Main layout: table + side panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div>
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">
                Indlæser prisforespørgsler...
              </div>
            ) : (
              <RFQListTable
                rfqs={displayed}
                counts={counts}
                onOpen={handleOpen}
              />
            )}
            <div className="text-xs text-muted-foreground mt-2">
              Viser {displayed.length} af {rfqs.length} prisforespørgsler
            </div>
          </div>

          {/* Right panel: review queue */}
          <Card className="p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Kræver gennemsyn</h3>
              <Badge
                className={
                  reviewCount > 0
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {reviewCount}
              </Badge>
            </div>
            {reviewQueue.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ingen svar kræver gennemsyn lige nu.
              </p>
            ) : (
              <ul className="space-y-2">
                {reviewQueue.slice(0, 5).map((q) => (
                  <li
                    key={q.id}
                    onClick={() => navigate('/purchasing/review')}
                    className="cursor-pointer rounded border p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-xs font-medium truncate">
                      {supplierNames[q.supplier_id] ?? 'Leverandør'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {q.total_price != null
                        ? `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(q.total_price)} ${q.currency}`
                        : 'Ingen total'}
                    </div>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => navigate('/purchasing/review')}
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    Se alle <ChevronRight className="h-3 w-3" />
                  </button>
                </li>
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default PurchasingOverview;
