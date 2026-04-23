/**
 * Public exports for purchasing-featuren.
 * Importér fra `@/features/purchasing` i stedet for direkte sti.
 *
 * ---------------------------------------------------------------------------
 * Routes som Fase 4 skal wire op i App.tsx (hash-routing):
 *   #/purchasing                      → PurchasingOverview
 *   #/purchasing/rfq/new              → RFQCreate
 *   #/purchasing/rfq/:rfqId           → RFQDetail
 *   #/purchasing/rfq/:rfqId/compare   → RFQCompare
 *   #/purchasing/review               → QuoteReviewQueue
 *
 * Plus sidebar-link til /purchasing (og evt. badge med review-count).
 * ---------------------------------------------------------------------------
 */

// Context + hooks
export { PurchasingProvider, usePurchasing } from './PurchasingContext';
export { useRfqs } from './hooks/useRfqs';
export { useRfq } from './hooks/useRfq';
export { useQuoteReview } from './hooks/useQuoteReview';

// Pages
export { PurchasingOverview } from './pages/PurchasingOverview';
export { RFQCreate } from './pages/RFQCreate';
export { RFQDetail } from './pages/RFQDetail';
export { RFQCompare } from './pages/RFQCompare';
export { QuoteReviewQueue } from './pages/QuoteReviewQueue';

// Components
export { RFQListTable } from './components/RFQListTable';
export { RFQHeaderCard } from './components/RFQHeaderCard';
export { RFQLinesTable } from './components/RFQLinesTable';
export { RFQSuppliersTable } from './components/RFQSuppliersTable';
export { QuoteInputDialog } from './components/QuoteInputDialog';
export { QuoteComparisonMatrix } from './components/QuoteComparisonMatrix';
export { QuoteReviewCard } from './components/QuoteReviewCard';
export { AttachmentUploader } from './components/AttachmentUploader';
export { SupplierPickerDialog } from './components/SupplierPickerDialog';
export { ProjectMaterialsPickerDialog } from './components/ProjectMaterialsPickerDialog';

// Types
export type {
  Rfq,
  RfqLine,
  RfqSupplier,
  RfqStatus,
  RfqWithRelations,
  Quote,
  QuoteLine,
  QuoteStatus,
  QuoteWithLines,
  InviteStatus,
  CreatedBy,
  CreateRfqInput,
  UpdateRfqInput,
  CreateRfqLineInput,
  UpsertQuoteInput,
  UpsertQuoteLineInput,
} from './types';

export {
  RFQ_TABLE,
  RFQ_LINES_TABLE,
  RFQ_SUPPLIERS_TABLE,
  QUOTE_TABLE,
  QUOTE_LINES_TABLE,
  RFQ_ATTACHMENTS_BUCKET,
} from './types';

export { canTransitionRfq, VALID_RFQ_TRANSITIONS } from './lib/statusTransitions';
