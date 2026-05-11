/**
 * useRfqs — wrapper over PurchasingContext der returnerer RFQ-listen
 * plus hjælpere til filtrering (status + fri-tekst søgning).
 *
 * Ingen cachelag — listen kommer allerede fra context (loaded pr. projekt).
 */

import { useMemo, useState } from 'react';
import { usePurchasing } from '../PurchasingContext';
import type { Rfq, RfqStatus } from '../types';

export interface RfqFilters {
  /** Filtrér på én eller flere statuser. `null`/undefined = alle. */
  statuses?: RfqStatus[];
  /** Fri-tekst søgning i titel + beskrivelse (case-insensitive). */
  search?: string;
}

export interface UseRfqsResult {
  rfqs: Rfq[];
  filtered: Rfq[];
  filters: RfqFilters;
  setFilters: (f: RfqFilters) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useRfqs(initialFilters: RfqFilters = {}): UseRfqsResult {
  const { rfqs, loading, refreshRfqs } = usePurchasing();
  const [filters, setFilters] = useState<RfqFilters>(initialFilters);

  const filtered = useMemo(() => {
    const search = filters.search?.trim().toLowerCase();
    return rfqs.filter((rfq) => {
      if (filters.statuses && filters.statuses.length > 0) {
        if (!filters.statuses.includes(rfq.status)) return false;
      }
      if (search) {
        const haystack = `${rfq.title ?? ''} ${rfq.description ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [rfqs, filters]);

  return {
    rfqs,
    filtered,
    filters,
    setFilters,
    loading,
    refresh: refreshRfqs,
  };
}
