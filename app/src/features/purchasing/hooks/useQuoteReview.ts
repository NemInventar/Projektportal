/**
 * useQuoteReview — wrapper over PurchasingContext.reviewQueue
 * plus bekvemmelighedsaktioner til godkend/afvis.
 */

import { useCallback } from 'react';
import { usePurchasing } from '../PurchasingContext';
import type { Quote } from '../types';

export interface UseQuoteReviewResult {
  queue: Quote[];
  count: number;
  loading: boolean;
  approve: (quoteId: string, reviewedBy: string) => Promise<void>;
  reject: (quoteId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useQuoteReview(): UseQuoteReviewResult {
  const {
    reviewQueue,
    loading,
    approveQuote,
    rejectQuote,
    refreshReviewQueue,
  } = usePurchasing();

  const approve = useCallback(
    (quoteId: string, reviewedBy: string) => approveQuote(quoteId, reviewedBy),
    [approveQuote],
  );

  const reject = useCallback(
    (quoteId: string) => rejectQuote(quoteId),
    [rejectQuote],
  );

  return {
    queue: reviewQueue,
    count: reviewQueue.length,
    loading,
    approve,
    reject,
    refresh: refreshReviewQueue,
  };
}
