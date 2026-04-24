/**
 * CRUD + liste-forespørgsler på crm_deals_2026_04_12.
 */

import { supabase } from '@/integrations/supabase/client';
import { TABLE, CONTACT_TYPE, PIPELINE_STAGE } from '../constants';
import type {
  Deal,
  DealListRow,
  DealWithRelations,
  CreateDealInput,
  UpdateDealInput,
  Contact,
  Label,
  Activity,
  DealNote,
  DealFocus,
} from '../types';

/** Liste af deals til inbox, joined med org + labels + focus. */
export async function listDeals(opts?: {
  includeArchived?: boolean;
}): Promise<DealListRow[]> {
  let query = supabase
    .from(TABLE.DEALS)
    .select(`
      *,
      organization:contact_id ( id, name, city, contact_type ),
      labels_junction:${TABLE.DEAL_LABELS} (
        label:${TABLE.LABELS} ( id, name, color, created_at )
      )
    `)
    .order('created_at', { ascending: false });

  if (!opts?.includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  const deals = (data ?? []) as any[];

  // Hent focus-rækker for de viste deals (én query)
  const dealIds = deals.map((d) => d.id);
  const focusMap = await loadFocusMap(dealIds);

  return deals.map((d) => ({
    ...(d as Deal),
    organization: d.organization ?? null,
    labels: (d.labels_junction ?? [])
      .map((j: any) => j.label)
      .filter(Boolean) as Label[],
    focus: focusMap.get(d.id) ?? null,
  }));
}

async function loadFocusMap(dealIds: string[]): Promise<Map<string, DealFocus>> {
  const map = new Map<string, DealFocus>();
  if (dealIds.length === 0) return map;
  const { data, error } = await supabase
    .from(TABLE.FOCUS_VIEW)
    .select('*')
    .in('deal_id', dealIds);
  if (error) return map;
  (data ?? []).forEach((row: any) => map.set(row.deal_id, row as DealFocus));
  return map;
}

/** Hent en deal med alle relationer for LeadDetail-siden. */
export async function getDealWithRelations(dealId: string): Promise<DealWithRelations | null> {
  const [dealRes, notesRes, activitiesRes, labelsRes, focusRes] = await Promise.all([
    supabase
      .from(TABLE.DEALS)
      .select(`*, organization:contact_id ( * )`)
      .eq('id', dealId)
      .maybeSingle(),
    supabase
      .from(TABLE.DEAL_NOTES)
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false }),
    supabase
      .from(TABLE.ACTIVITIES)
      .select('*')
      .eq('deal_id', dealId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('due_time', { ascending: true, nullsFirst: false }),
    supabase
      .from(TABLE.DEAL_LABELS)
      .select(`label:${TABLE.LABELS} ( id, name, color, created_at )`)
      .eq('deal_id', dealId),
    supabase
      .from(TABLE.FOCUS_VIEW)
      .select('*')
      .eq('deal_id', dealId)
      .maybeSingle(),
  ]);

  if (dealRes.error) throw dealRes.error;
  if (!dealRes.data) return null;

  const deal = dealRes.data as any;
  return {
    ...(deal as Deal),
    organization: (deal.organization as Contact) ?? null,
    notes: (notesRes.data ?? []) as DealNote[],
    activities: (activitiesRes.data ?? []) as Activity[],
    labels: ((labelsRes.data ?? []) as any[])
      .map((row) => row.label)
      .filter(Boolean) as Label[],
    focus: (focusRes.data as DealFocus | null) ?? null,
  };
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const payload = {
    title: input.title,
    contact_id: input.contact_id ?? null,
    primary_contact: input.primary_contact ?? null,
    primary_contact_phone: input.primary_contact_phone ?? null,
    value_dkk: input.value_dkk ?? null,
    currency: input.currency ?? 'DKK',
    expected_close_date: input.expected_close_date ?? null,
    assigned_to: input.assigned_to ?? null,
    source_channel: input.source_channel ?? null,
    pipeline_stage: input.pipeline_stage ?? PIPELINE_STAGE.LEAD,
    created_by: input.created_by ?? 'human',
    description: input.description ?? null,
    municipality: input.municipality ?? null,
    region: input.region ?? null,
    address: input.address ?? null,
  };
  const { data, error } = await supabase
    .from(TABLE.DEALS)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function updateDeal(dealId: string, patch: UpdateDealInput): Promise<Deal> {
  const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from(TABLE.DEALS)
    .update(payload)
    .eq('id', dealId)
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

/** Soft-archive — sæt archived=true. */
export async function archiveDeal(dealId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.DEALS)
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', dealId);
  if (error) throw error;
}

/** Bulk-opdater pipeline_stage. */
export async function bulkUpdateStage(dealIds: string[], stage: string): Promise<void> {
  if (dealIds.length === 0) return;
  const { error } = await supabase
    .from(TABLE.DEALS)
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
    .in('id', dealIds);
  if (error) throw error;
}

export async function bulkUpdateOwner(dealIds: string[], assignedTo: string): Promise<void> {
  if (dealIds.length === 0) return;
  const { error } = await supabase
    .from(TABLE.DEALS)
    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
    .in('id', dealIds);
  if (error) throw error;
}

export async function bulkArchive(dealIds: string[]): Promise<void> {
  if (dealIds.length === 0) return;
  const { error } = await supabase
    .from(TABLE.DEALS)
    .update({ archived: true, updated_at: new Date().toISOString() })
    .in('id', dealIds);
  if (error) throw error;
}

/** Markér som tabt — §W4. */
export async function markDealLost(
  dealId: string,
  lostReason: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error: dealErr } = await supabase
    .from(TABLE.DEALS)
    .update({
      pipeline_stage: PIPELINE_STAGE.LOST,
      lost_at: nowIso,
      lost_reason: lostReason,
      updated_at: nowIso,
    })
    .eq('id', dealId);
  if (dealErr) throw dealErr;

  // Auto-note (§W4)
  const { error: noteErr } = await supabase
    .from(TABLE.DEAL_NOTES)
    .insert({
      deal_id: dealId,
      body: `[TABT] ${lostReason}`,
      created_by: 'human',
    });
  if (noteErr) throw noteErr;
}

/** Genåbn tabt deal. */
export async function reopenDeal(dealId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.DEALS)
    .update({
      pipeline_stage: PIPELINE_STAGE.LEAD,
      lost_at: null,
      lost_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId);
  if (error) throw error;
}

// Re-eksporter filter-helpers for UI
export { CONTACT_TYPE };
