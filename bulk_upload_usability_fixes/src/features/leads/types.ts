/**
 * Row-typer for Leads-featuren.
 * 1:1 match med DB (snake_case fra Supabase).
 */

import type { ContactType, PipelineStage, ActivityType, CreatedBy, LoggedVia } from './constants';

// ---------------------------------------------------------------------------
// crm_contacts_2026_04_12 — unified personer + virksomheder
// ---------------------------------------------------------------------------
export interface Contact {
  id: string;
  pipedrive_person_id: number | null;
  pipedrive_org_id: number | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  contact_type: ContactType | null;
  tags: string[] | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  source: string | null;
  last_contact_at: string | null;
  last_contact_channel: string | null;
  interaction_count: number | null;
  relationship_stage: string | null;
  context_summary: string | null;
  context_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// crm_deals_2026_04_12 — leads/deals (alle relevante felter, incl. V1-udvidelser)
// ---------------------------------------------------------------------------
export interface Deal {
  id: string;
  pipedrive_deal_id: number | null;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  subtitle: string | null;
  value_dkk: number | null;
  currency: string | null;
  pipeline_stage: PipelineStage | null;
  probability_pct: number | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  description: string | null;
  short_description: string | null;
  full_description: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  archived: boolean;

  // Byggefakta-felter
  byggefakta_id: string | null;
  byggefakta_url: string | null;
  byggefakta_imported_at: string | null;

  // Adresse/region/stadie
  address: string | null;
  municipality: string | null;
  region: string | null;
  stage: string | null;
  contract_form: string | null;
  area_m2: number | null;
  construction_start: string | null;
  construction_end: string | null;
  main_contractor: string | null;
  other_parties: string | null;
  contact_info: string | null;
  primary_contact: string | null;
  primary_contact_phone: string | null;

  // Nye V1-felter
  tegninger_aftalt_date: string | null;
  converted_project_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_by: CreatedBy;
  source_channel: string | null;
  project_number_ext: string | null;
  delivery_address: string | null;

  // Scoring/AI
  relevance: string | null;
  timing: string | null;
  next_step: string | null;
  context_summary: string | null;
  context_updated_at: string | null;

  // Budget
  budget_raw: string | null;
  budget_dkk: number | null;

  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// crm_activities_2026_04_12
// ---------------------------------------------------------------------------
export interface Activity {
  id: string;
  pipedrive_activity_id: number | null;
  deal_id: string | null;
  contact_id: string | null;
  activity_type: ActivityType | null;
  title: string;
  description: string | null;
  due_date: string | null;      // 'YYYY-MM-DD'
  due_time: string | null;      // 'HH:MM:SS'
  done: boolean;
  done_at: string | null;
  completed_outcome: string | null;
  assigned_to: string | null;
  direction: string | null;
  interaction_at: string | null;
  raw_note: string | null;
  summary: string | null;
  sentiment: string | null;
  next_step: string | null;
  follow_up_clickup_task_id: string | null;
  email_message_id: string | null;
  email_thread_id: string | null;
  email_from: string | null;
  email_to: string[] | null;
  email_cc: string[] | null;
  email_subject: string | null;
  logged_via: LoggedVia;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// crm_deal_notes_2026_04_24_10_00
// ---------------------------------------------------------------------------
export interface DealNote {
  id: string;
  deal_id: string;
  body: string;
  pinned: boolean;
  author_email: string;
  created_by: 'human' | 'claude_auto';
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// crm_labels_2026_04_24_10_00 + junction
// ---------------------------------------------------------------------------
export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DealLabel {
  deal_id: string;
  label_id: string;
}

// ---------------------------------------------------------------------------
// Focus-view — v_crm_deal_focus_2026_04_24_10_00
// ---------------------------------------------------------------------------
export interface DealFocus {
  deal_id: string;
  focus_activity_id: string;
  due_date: string | null;
  due_time: string | null;
  due_at: string | null;
  activity_type: ActivityType | null;
  subject: string;
  done: boolean;
  assigned_to: string | null;
  is_overdue: boolean;
}

// ---------------------------------------------------------------------------
// Aggregerede typer til UI
// ---------------------------------------------------------------------------

/** Organization shorthand — crm_contacts-række hvor contact_type='company'. */
export type Organization = Contact;

/** Person shorthand — crm_contacts-række hvor contact_type='person'. */
export type Person = Contact;

/** Deal joined med org + labels + focus — brugt i LeadsInbox. */
export interface DealListRow extends Deal {
  organization: Pick<Contact, 'id' | 'name' | 'city' | 'contact_type'> | null;
  labels: Label[];
  focus: DealFocus | null;
}

/** Fully hydrated deal for LeadDetail. */
export interface DealWithRelations extends Deal {
  organization: Contact | null;
  notes: DealNote[];
  activities: Activity[];
  labels: Label[];
  focus: DealFocus | null;
}

// ---------------------------------------------------------------------------
// Input-typer
// ---------------------------------------------------------------------------

export type CreateDealInput = {
  title: string;
  contact_id?: string | null;
  primary_contact?: string | null;
  primary_contact_phone?: string | null;
  value_dkk?: number | null;
  currency?: string;
  expected_close_date?: string | null;
  assigned_to?: string | null;
  source_channel?: string | null;
  pipeline_stage?: PipelineStage;
  created_by?: CreatedBy;
  description?: string | null;
  municipality?: string | null;
  region?: string | null;
  address?: string | null;
};

export type UpdateDealInput = Partial<CreateDealInput> & {
  tegninger_aftalt_date?: string | null;
  project_number_ext?: string | null;
  delivery_address?: string | null;
  contract_form?: string | null;
  stage?: string | null;
  tags?: string[] | null;
  archived?: boolean;
};

export type CreateActivityInput = {
  deal_id: string;
  activity_type?: ActivityType;
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  assigned_to?: string | null;
  logged_via?: LoggedVia;
  contact_id?: string | null;
};

export type CompleteActivityInput = {
  activity_id: string;
  completed_outcome?: string | null;
};

export type CreateNoteInput = {
  deal_id: string;
  body: string;
  pinned?: boolean;
  author_email?: string;
  created_by?: 'human' | 'claude_auto';
};

export type CreateContactInput = {
  name: string;
  contact_type: ContactType;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  notes?: string | null;
  source?: string | null;
};

export type ConvertDealInput = {
  deal_id: string;
  project_number: string;
  project_name?: string;
  phase?: string;
  user_email: string;
};
