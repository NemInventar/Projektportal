/**
 * useRfq — henter én RFQ med alle relationer (linjer, suppliers, quotes).
 *
 * Bruger direkte API-kald frem for PurchasingContext.activeRfq fordi context
 * kun holder én activeRfq ad gangen. Det her hook kan bruges fra flere
 * komponenter uden at trampe på hinanden.
 */

import { useCallback, useEffect, useState } from 'react';
import { getRfqWithRelations } from '../lib/rfqApi';
import type { RfqWithRelations } from '../types';

export interface UseRfqResult {
  rfq: RfqWithRelations | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRfq(rfqId: string | null | undefined): UseRfqResult {
  const [rfq, setRfq] = useState<RfqWithRelations | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!rfqId) {
      setRfq(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fresh = await getRfqWithRelations(rfqId);
      setRfq(fresh);
    } catch (err) {
      console.error('[useRfq] load fejlede:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setRfq(null);
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    rfq,
    loading,
    error,
    refresh: load,
  };
}
