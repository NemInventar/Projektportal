/**
 * CRUD på crm_labels + crm_deal_labels junction.
 */

import { supabase } from '@/integrations/supabase/client';
import { TABLE } from '../constants';
import type { Label } from '../types';

export async function listLabels(): Promise<Label[]> {
  const { data, error } = await supabase
    .from(TABLE.LABELS)
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Label[];
}

export async function createLabel(name: string, color: string): Promise<Label> {
  const { data, error } = await supabase
    .from(TABLE.LABELS)
    .insert({ name, color })
    .select()
    .single();
  if (error) throw error;
  return data as Label;
}

export async function deleteLabel(labelId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.LABELS)
    .delete()
    .eq('id', labelId);
  if (error) throw error;
}

/** Tilføj label til deal (ingen fejl hvis allerede tilknyttet). */
export async function attachLabelToDeal(dealId: string, labelId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.DEAL_LABELS)
    .upsert({ deal_id: dealId, label_id: labelId }, { onConflict: 'deal_id,label_id' });
  if (error) throw error;
}

export async function detachLabelFromDeal(dealId: string, labelId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.DEAL_LABELS)
    .delete()
    .eq('deal_id', dealId)
    .eq('label_id', labelId);
  if (error) throw error;
}

/** Bulk: tilføj label til mange deals — brugt i inbox bulk-action. */
export async function bulkAttachLabel(dealIds: string[], labelId: string): Promise<void> {
  if (dealIds.length === 0) return;
  const rows = dealIds.map((dealId) => ({ deal_id: dealId, label_id: labelId }));
  const { error } = await supabase
    .from(TABLE.DEAL_LABELS)
    .upsert(rows, { onConflict: 'deal_id,label_id' });
  if (error) throw error;
}

/** Hent alle labels på et deal. */
export async function listLabelsForDeal(dealId: string): Promise<Label[]> {
  const { data, error } = await supabase
    .from(TABLE.DEAL_LABELS)
    .select(`label:${TABLE.LABELS} ( id, name, color, created_at )`)
    .eq('deal_id', dealId);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.label).filter(Boolean) as Label[];
}
