/**
 * CRUD på crm_activities_2026_04_12 + helpers til quick-time picker.
 */

import { supabase } from '@/integrations/supabase/client';
import { TABLE, LOGGED_VIA, ACTIVITY_TYPE } from '../constants';
import type { Activity, CreateActivityInput } from '../types';

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const payload = {
    deal_id: input.deal_id,
    activity_type: input.activity_type ?? ACTIVITY_TYPE.TASK,
    title: input.title,
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    due_time: input.due_time ?? null,
    assigned_to: input.assigned_to ?? null,
    logged_via: input.logged_via ?? LOGGED_VIA.MANUAL,
    contact_id: input.contact_id ?? null,
    done: false,
  };
  const { data, error } = await supabase
    .from(TABLE.ACTIVITIES)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  // Opdatér last_activity_at på deal'et
  await supabase
    .from(TABLE.DEALS)
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', input.deal_id);

  return data as Activity;
}

export async function updateActivity(
  activityId: string,
  patch: Partial<Pick<Activity,
    'title'|'description'|'due_date'|'due_time'|'activity_type'|'assigned_to'>>,
): Promise<Activity> {
  const { data, error } = await supabase
    .from(TABLE.ACTIVITIES)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', activityId)
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

/**
 * Markér som udført. Opretter automatisk en note i timeline med outcome.
 * V1-beslutning (§13 Q10 = default aktiveret).
 */
export async function completeActivity(
  activityId: string,
  completedOutcome: string,
  opts?: { autoNote?: boolean; authorEmail?: string },
): Promise<Activity> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE.ACTIVITIES)
    .update({
      done: true,
      done_at: nowIso,
      completed_outcome: completedOutcome,
      updated_at: nowIso,
    })
    .eq('id', activityId)
    .select()
    .single();
  if (error) throw error;
  const activity = data as Activity;

  const autoNote = opts?.autoNote ?? true;
  if (autoNote && activity.deal_id) {
    const typeLabel = (activity.activity_type ?? 'activity').toUpperCase();
    await supabase.from(TABLE.DEAL_NOTES).insert({
      deal_id: activity.deal_id,
      body: `[${typeLabel}] ${completedOutcome}`,
      author_email: opts?.authorEmail ?? activity.assigned_to ?? 'js@neminventar.dk',
      created_by: 'human',
    });
    await supabase
      .from(TABLE.DEALS)
      .update({ last_activity_at: nowIso })
      .eq('id', activity.deal_id);
  }

  return activity;
}

export async function deleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.ACTIVITIES)
    .delete()
    .eq('id', activityId);
  if (error) throw error;
}
