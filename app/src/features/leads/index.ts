/**
 * Public exports for leads-featuren.
 * Importér fra `@/features/leads` i stedet for direkte sti.
 *
 * Routes (wired i App.tsx):
 *   #/leads             → LeadsInbox
 *   #/leads/:dealId     → LeadDetail
 */

export { LeadsProvider, useLeads } from './LeadsContext';

export { LeadsInbox } from './pages/LeadsInbox';
export { LeadDetail } from './pages/LeadDetail';

export type {
  Deal,
  DealListRow,
  DealWithRelations,
  Contact,
  Organization,
  Person,
  Activity,
  DealNote,
  Label,
  DealFocus,
  CreateDealInput,
  UpdateDealInput,
  CreateActivityInput,
  CreateNoteInput,
  CreateContactInput,
  ConvertDealInput,
} from './types';

export {
  TABLE as LEADS_TABLE,
  LEAD_ATTACHMENTS_BUCKET,
  CONTACT_TYPE,
  PIPELINE_STAGE,
  PIPELINE_STAGE_LABEL,
  OWNER_EMAILS,
  OWNER_NAME,
  ACTIVITY_TYPE,
  ACTIVITY_TYPE_LABEL,
} from './constants';
