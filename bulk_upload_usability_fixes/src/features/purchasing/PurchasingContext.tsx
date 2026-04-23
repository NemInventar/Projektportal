/**
 * PurchasingContext — 8. provider i App.tsx.
 *
 * Følger ProjectContext-mønstret: ren `useState` + `useEffect` + Supabase-kald
 * (ingen TanStack Query i selve context'en for at holde stilen konsistent).
 *
 * State:
 *   - rfqs:         Liste over RFQs for aktivt projekt
 *   - activeRfq:    Én fuldt hydreret RFQ (linjer + suppliers + quotes)
 *   - reviewQueue:  Quotes med needs_review=true for aktivt projekt
 *   - loading:      Generel loading-flag på første load pr. projekt
 *
 * V1-beslutning: ingen realtime subscription. Context reloader manuelt efter
 * mutations. (Plan spørgsmål #9 foreslog realtime — udskudt til V2.)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useProject } from '@/contexts/ProjectContext';

import {
  addRfqLine as apiAddRfqLine,
  createRfq as apiCreateRfq,
  getRfqWithRelations as apiGetRfqWithRelations,
  inviteSupplier as apiInviteSupplier,
  listRfqs as apiListRfqs,
  removeRfqLine as apiRemoveRfqLine,
  removeSupplierInvite as apiRemoveSupplierInvite,
  updateRfq as apiUpdateRfq,
  updateRfqStatus as apiUpdateRfqStatus,
} from './lib/rfqApi';
import {
  approveQuote as apiApproveQuote,
  assignWinners as apiAssignWinners,
  listReviewQueue as apiListReviewQueue,
  rejectQuote as apiRejectQuote,
  upsertQuote as apiUpsertQuote,
  upsertQuoteLines as apiUpsertQuoteLines,
} from './lib/quoteApi';

import type {
  CreateRfqInput,
  CreateRfqLineInput,
  Quote,
  QuoteLine,
  Rfq,
  RfqLine,
  RfqStatus,
  RfqSupplier,
  RfqWithRelations,
  UpdateRfqInput,
  UpsertQuoteInput,
  UpsertQuoteLineInput,
} from './types';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface PurchasingContextValue {
  // State
  rfqs: Rfq[];
  activeRfq: RfqWithRelations | null;
  reviewQueue: Quote[];
  loading: boolean;

  // Load/refresh
  refreshRfqs: () => Promise<void>;
  loadActiveRfq: (rfqId: string) => Promise<RfqWithRelations | null>;
  clearActiveRfq: () => void;
  refreshReviewQueue: () => Promise<void>;

  // RFQ CRUD
  createRfq: (input: Omit<CreateRfqInput, 'project_id'>) => Promise<Rfq>;
  updateRfq: (id: string, patch: UpdateRfqInput) => Promise<void>;
  updateRfqStatus: (id: string, status: RfqStatus) => Promise<void>;

  // RFQ lines
  addRfqLine: (rfqId: string, line: CreateRfqLineInput) => Promise<RfqLine>;
  removeRfqLine: (lineId: string) => Promise<void>;

  // Suppliers
  inviteSupplier: (
    rfqId: string,
    supplierId: string,
    contactEmail?: string | null,
    contactPerson?: string | null,
  ) => Promise<RfqSupplier>;
  removeSupplierInvite: (rfqSupplierId: string) => Promise<void>;

  // Quotes
  upsertQuote: (input: UpsertQuoteInput) => Promise<Quote>;
  upsertQuoteLines: (
    quoteId: string,
    lines: UpsertQuoteLineInput[],
  ) => Promise<QuoteLine[]>;
  approveQuote: (quoteId: string, reviewedBy: string) => Promise<void>;
  rejectQuote: (quoteId: string) => Promise<void>;
  assignWinners: (rfqId: string, winningQuoteIds: string[]) => Promise<void>;
}

const PurchasingContext = createContext<PurchasingContextValue | undefined>(
  undefined,
);

export const usePurchasing = (): PurchasingContextValue => {
  const ctx = useContext(PurchasingContext);
  if (ctx === undefined) {
    throw new Error('usePurchasing must be used within a PurchasingProvider');
  }
  return ctx;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const PurchasingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { activeProject } = useProject();

  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [activeRfq, setActiveRfq] = useState<RfqWithRelations | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // ------------------------------------------------------------------
  // Load when project changes
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activeProject) {
        setRfqs([]);
        setActiveRfq(null);
        setReviewQueue([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [rfqList, queue] = await Promise.all([
          apiListRfqs(activeProject.id),
          apiListReviewQueue(activeProject.id),
        ]);
        if (cancelled) return;
        setRfqs(rfqList);
        setReviewQueue(queue);
      } catch (err) {
        console.error('[PurchasingContext] Kunne ikke loade RFQs:', err);
        if (!cancelled) {
          setRfqs([]);
          setReviewQueue([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  // ------------------------------------------------------------------
  // Refresh helpers
  // ------------------------------------------------------------------
  const refreshRfqs = useCallback(async () => {
    if (!activeProject) return;
    try {
      const list = await apiListRfqs(activeProject.id);
      setRfqs(list);
    } catch (err) {
      console.error('[PurchasingContext] refreshRfqs fejlede:', err);
    }
  }, [activeProject]);

  const refreshReviewQueue = useCallback(async () => {
    if (!activeProject) return;
    try {
      const queue = await apiListReviewQueue(activeProject.id);
      setReviewQueue(queue);
    } catch (err) {
      console.error('[PurchasingContext] refreshReviewQueue fejlede:', err);
    }
  }, [activeProject]);

  const loadActiveRfq = useCallback(
    async (rfqId: string): Promise<RfqWithRelations | null> => {
      try {
        const rfq = await apiGetRfqWithRelations(rfqId);
        setActiveRfq(rfq);
        return rfq;
      } catch (err) {
        console.error('[PurchasingContext] loadActiveRfq fejlede:', err);
        setActiveRfq(null);
        return null;
      }
    },
    [],
  );

  const clearActiveRfq = useCallback(() => {
    setActiveRfq(null);
  }, []);

  /**
   * Hvis activeRfq er sat til `rfqId`, så reload dens relationer.
   * Bruges efter mutations der påvirker den aktive RFQ.
   */
  const reloadActiveRfqIfMatches = useCallback(
    async (rfqId: string) => {
      if (activeRfq?.id === rfqId) {
        try {
          const fresh = await apiGetRfqWithRelations(rfqId);
          setActiveRfq(fresh);
        } catch (err) {
          console.error(
            '[PurchasingContext] reloadActiveRfqIfMatches fejlede:',
            err,
          );
        }
      }
    },
    [activeRfq?.id],
  );

  // ------------------------------------------------------------------
  // RFQ CRUD (med optimistisk state-opdatering)
  // ------------------------------------------------------------------
  const createRfq = useCallback(
    async (input: Omit<CreateRfqInput, 'project_id'>): Promise<Rfq> => {
      if (!activeProject) {
        throw new Error('Intet aktivt projekt — kan ikke oprette RFQ');
      }
      const created = await apiCreateRfq({
        ...input,
        project_id: activeProject.id,
      });
      setRfqs((prev) => [created, ...prev]);
      return created;
    },
    [activeProject],
  );

  const updateRfq = useCallback(
    async (id: string, patch: UpdateRfqInput): Promise<void> => {
      await apiUpdateRfq(id, patch);
      setRfqs((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } as Rfq : r)),
      );
      await reloadActiveRfqIfMatches(id);
    },
    [reloadActiveRfqIfMatches],
  );

  const updateRfqStatus = useCallback(
    async (id: string, status: RfqStatus): Promise<void> => {
      await apiUpdateRfqStatus(id, status);
      setRfqs((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      await reloadActiveRfqIfMatches(id);
    },
    [reloadActiveRfqIfMatches],
  );

  // ------------------------------------------------------------------
  // RFQ lines
  // ------------------------------------------------------------------
  const addRfqLine = useCallback(
    async (rfqId: string, line: CreateRfqLineInput): Promise<RfqLine> => {
      const created = await apiAddRfqLine(rfqId, line);
      await reloadActiveRfqIfMatches(rfqId);
      return created;
    },
    [reloadActiveRfqIfMatches],
  );

  const removeRfqLine = useCallback(
    async (lineId: string): Promise<void> => {
      await apiRemoveRfqLine(lineId);
      // Hvis den slettede linje hører til activeRfq, reload den.
      const rfqId = activeRfq?.lines.find((l) => l.id === lineId)?.rfq_id;
      if (rfqId) {
        await reloadActiveRfqIfMatches(rfqId);
      }
    },
    [activeRfq, reloadActiveRfqIfMatches],
  );

  // ------------------------------------------------------------------
  // Suppliers
  // ------------------------------------------------------------------
  const inviteSupplier = useCallback(
    async (
      rfqId: string,
      supplierId: string,
      contactEmail?: string | null,
      contactPerson?: string | null,
    ): Promise<RfqSupplier> => {
      const created = await apiInviteSupplier(
        rfqId,
        supplierId,
        contactEmail,
        contactPerson,
      );
      await reloadActiveRfqIfMatches(rfqId);
      return created;
    },
    [reloadActiveRfqIfMatches],
  );

  const removeSupplierInvite = useCallback(
    async (rfqSupplierId: string): Promise<void> => {
      await apiRemoveSupplierInvite(rfqSupplierId);
      const rfqId = activeRfq?.suppliers.find((s) => s.id === rfqSupplierId)
        ?.rfq_id;
      if (rfqId) {
        await reloadActiveRfqIfMatches(rfqId);
      }
    },
    [activeRfq, reloadActiveRfqIfMatches],
  );

  // ------------------------------------------------------------------
  // Quotes
  // ------------------------------------------------------------------
  const upsertQuote = useCallback(
    async (input: UpsertQuoteInput): Promise<Quote> => {
      const quote = await apiUpsertQuote(input);
      await reloadActiveRfqIfMatches(input.rfq_id);
      await refreshReviewQueue();
      return quote;
    },
    [reloadActiveRfqIfMatches, refreshReviewQueue],
  );

  const upsertQuoteLines = useCallback(
    async (
      quoteId: string,
      lines: UpsertQuoteLineInput[],
    ): Promise<QuoteLine[]> => {
      const result = await apiUpsertQuoteLines(quoteId, lines);
      // Find rfq_id via activeRfq hvis vi kan, ellers skip local reload.
      const rfqId = activeRfq?.quotes.find((q) => q.id === quoteId)?.rfq_id;
      if (rfqId) {
        await reloadActiveRfqIfMatches(rfqId);
      }
      return result;
    },
    [activeRfq, reloadActiveRfqIfMatches],
  );

  const approveQuote = useCallback(
    async (quoteId: string, reviewedBy: string): Promise<void> => {
      await apiApproveQuote(quoteId, reviewedBy);
      // Fjern fra review queue lokalt.
      setReviewQueue((prev) => prev.filter((q) => q.id !== quoteId));
      const rfqId = activeRfq?.quotes.find((q) => q.id === quoteId)?.rfq_id;
      if (rfqId) {
        await reloadActiveRfqIfMatches(rfqId);
      }
    },
    [activeRfq, reloadActiveRfqIfMatches],
  );

  const rejectQuote = useCallback(
    async (quoteId: string): Promise<void> => {
      const rfqId = activeRfq?.quotes.find((q) => q.id === quoteId)?.rfq_id;
      await apiRejectQuote(quoteId);
      setReviewQueue((prev) => prev.filter((q) => q.id !== quoteId));
      if (rfqId) {
        await reloadActiveRfqIfMatches(rfqId);
      }
    },
    [activeRfq, reloadActiveRfqIfMatches],
  );

  const assignWinners = useCallback(
    async (rfqId: string, winningQuoteIds: string[]): Promise<void> => {
      await apiAssignWinners(rfqId, winningQuoteIds);
      // RFQ-status skifter til awarded i DB — reload begge dele.
      await refreshRfqs();
      await reloadActiveRfqIfMatches(rfqId);
    },
    [refreshRfqs, reloadActiveRfqIfMatches],
  );

  // ------------------------------------------------------------------
  const value: PurchasingContextValue = {
    rfqs,
    activeRfq,
    reviewQueue,
    loading,

    refreshRfqs,
    loadActiveRfq,
    clearActiveRfq,
    refreshReviewQueue,

    createRfq,
    updateRfq,
    updateRfqStatus,

    addRfqLine,
    removeRfqLine,

    inviteSupplier,
    removeSupplierInvite,

    upsertQuote,
    upsertQuoteLines,
    approveQuote,
    rejectQuote,
    assignWinners,
  };

  return (
    <PurchasingContext.Provider value={value}>
      {children}
    </PurchasingContext.Provider>
  );
};
