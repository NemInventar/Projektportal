/**
 * LeadsContext — global store for leads-modulet.
 *
 * Holder:
 *   - deals:       liste til LeadsInbox
 *   - labels:      genanvendelige labels (sjældent ændret, cached)
 *   - overdueCount: antal åbne aktiviteter forfaldne → sidebar-badge
 *
 * Følger mønstret fra PurchasingContext: ren useState + useEffect.
 * Ingen realtime i V1 — context reloader manuelt efter mutations.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/integrations/supabase/client';
import { TABLE } from './constants';
import { listDeals } from './lib/dealsApi';
import { listLabels } from './lib/labelsApi';
import type { DealListRow, Label } from './types';

interface LeadsContextValue {
  deals: DealListRow[];
  labels: Label[];
  overdueCount: number;
  loading: boolean;
  reloadDeals: () => Promise<void>;
  reloadLabels: () => Promise<void>;
  reloadOverdue: (ownerEmail?: string) => Promise<void>;
}

const LeadsContext = createContext<LeadsContextValue | undefined>(undefined);

export function useLeads(): LeadsContextValue {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error('useLeads must be used within LeadsProvider');
  return ctx;
}

export const LeadsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deals, setDeals] = useState<DealListRow[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reloadDeals = useCallback(async () => {
    try {
      const rows = await listDeals();
      setDeals(rows);
    } catch (err) {
      console.error('[LeadsContext] reloadDeals failed', err);
    }
  }, []);

  const reloadLabels = useCallback(async () => {
    try {
      const rows = await listLabels();
      setLabels(rows);
    } catch (err) {
      console.error('[LeadsContext] reloadLabels failed', err);
    }
  }, []);

  const reloadOverdue = useCallback(async (ownerEmail?: string) => {
    try {
      let query = supabase
        .from(TABLE.FOCUS_VIEW)
        .select('deal_id', { count: 'exact', head: true })
        .eq('is_overdue', true);
      if (ownerEmail) query = query.eq('assigned_to', ownerEmail);
      const { count, error } = await query;
      if (error) return;
      setOverdueCount(count ?? 0);
    } catch (err) {
      console.error('[LeadsContext] reloadOverdue failed', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([reloadDeals(), reloadLabels(), reloadOverdue()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadDeals, reloadLabels, reloadOverdue]);

  return (
    <LeadsContext.Provider
      value={{ deals, labels, overdueCount, loading, reloadDeals, reloadLabels, reloadOverdue }}
    >
      {children}
    </LeadsContext.Provider>
  );
};
