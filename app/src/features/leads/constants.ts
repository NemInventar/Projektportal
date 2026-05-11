/**
 * Tabel-navne, enum-værdier og faste lister for Leads-featuren.
 * Holder suffixer og gyldige værdier ét sted — matcher LEADS_PLAN.md §4.2.
 */

export const TABLE = {
  DEALS:       'crm_deals_2026_04_12',
  CONTACTS:    'crm_contacts_2026_04_12',
  ACTIVITIES:  'crm_activities_2026_04_12',
  DEAL_NOTES:  'crm_deal_notes_2026_04_24_10_00',
  LABELS:      'crm_labels_2026_04_24_10_00',
  DEAL_LABELS: 'crm_deal_labels_2026_04_24_10_00',
  PROJECTS:    'projects_2026_01_15_06_45',
  FOCUS_VIEW:  'v_crm_deal_focus_2026_04_24_10_00',
} as const;

export const LEAD_ATTACHMENTS_BUCKET = 'lead-attachments-2026-04-24';

export const CONTACT_TYPE = {
  COMPANY: 'company',
  PERSON:  'person',
} as const;

export type ContactType = typeof CONTACT_TYPE[keyof typeof CONTACT_TYPE];

export const PIPELINE_STAGE = {
  LEAD:      'lead',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  LOST:      'lost',
  ARCHIVED:  'archived',
} as const;

export type PipelineStage = typeof PIPELINE_STAGE[keyof typeof PIPELINE_STAGE];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  lead:      'Åben',
  qualified: 'Kvalificeret',
  converted: 'Konverteret',
  lost:      'Tabt',
  archived:  'Arkiveret',
};

export const OWNER_EMAILS = [
  'js@neminventar.dk',
  'milot@neminventar.dk',
  'foss@neminventar.dk',
] as const;

export type OwnerEmail = typeof OWNER_EMAILS[number];

export const OWNER_NAME: Record<string, string> = {
  'js@neminventar.dk':    'Joachim',
  'milot@neminventar.dk': 'Milot',
  'foss@neminventar.dk':  'Christian Foss',
};

export const CREATED_BY = {
  HUMAN:       'human',
  CLAUDE_AUTO: 'claude_auto',
  IMPORT:      'import',
} as const;

export type CreatedBy = typeof CREATED_BY[keyof typeof CREATED_BY];

export const ACTIVITY_TYPE = {
  CALL:     'call',
  MEETING:  'meeting',
  TASK:     'task',
  EMAIL:    'email',
  DEADLINE: 'deadline',
  OTHER:    'other',
} as const;

export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE];

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  call:     'Opkald',
  meeting:  'Møde',
  task:     'Opgave',
  email:    'Email',
  deadline: 'Deadline',
  other:    'Andet',
};

export const LOGGED_VIA = {
  MANUAL:      'manual',
  CLAUDE_AUTO: 'claude_auto',
  IMPORT:      'import',
  EMAIL_SYNC:  'email_sync',
} as const;

export type LoggedVia = typeof LOGGED_VIA[keyof typeof LOGGED_VIA];
