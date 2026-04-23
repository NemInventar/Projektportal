/**
 * RFQ status-transitioner.
 *
 * Diagrammet fra INDKOB_PLAN.md afsnit W5:
 *
 *   draft → sent → partially_received → (closed | awarded | cancelled)
 *          ↘ cancelled
 *
 * Re-open: kun fra `closed` → `sent`. Fra `awarded`/`cancelled` er det låst.
 */

import type { RfqStatus } from '../types';

/**
 * Gyldige overgange pr. from-status. Tom liste = terminal state.
 */
export const VALID_RFQ_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['partially_received', 'closed', 'awarded', 'cancelled'],
  partially_received: ['closed', 'awarded', 'cancelled'],
  closed: ['sent', 'awarded'], // re-open tilladt fra closed → sent; kan stadig awardes bagefter
  awarded: [],
  cancelled: [],
};

/**
 * Returnerer `true` hvis overgangen fra `from` → `to` er tilladt.
 * Identitet (fx draft → draft) returnerer `false`.
 */
export function canTransitionRfq(from: RfqStatus, to: RfqStatus): boolean {
  if (from === to) return false;
  return VALID_RFQ_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Kaster hvis overgangen ikke er tilladt. Brug før man skriver til DB.
 */
export function assertCanTransitionRfq(from: RfqStatus, to: RfqStatus): void {
  if (!canTransitionRfq(from, to)) {
    throw new Error(
      `Ugyldig statusovergang for RFQ: ${from} → ${to}. ` +
        `Tilladte næste statuser: ${VALID_RFQ_TRANSITIONS[from].join(', ') || '(ingen)'}`,
    );
  }
}
