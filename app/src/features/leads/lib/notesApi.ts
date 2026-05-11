/**
 * CRUD på crm_deal_notes_2026_04_24_10_00.
 */

import { supabase } from '@/integrations/supabase/client';
import { TABLE } from '../constants';
import type { DealNote, CreateNoteInput } from '../types';

export async function createNote(input: CreateNoteInput): Promise<DealNote> {
  const payload = {
    deal_id: input.deal_id,
    body: input.body,
    pinned: input.pinned ?? false,
    author_email: input.author_email ?? 'js@neminventar.dk',
    created_by: input.created_by ?? 'human',
  };
  const { data, error } = await supabase
    .from(TABLE.DEAL_NOTES)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from(TABLE.DEALS)
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', input.deal_id);

  return data as DealNote;
}

export async function updateNote(
  noteId: string,
  patch: Partial<Pick<DealNote, 'body' | 'pinned'>>,
): Promise<DealNote> {
  const { data, error } = await supabase
    .from(TABLE.DEAL_NOTES)
    .update(patch)
    .eq('id', noteId)
    .select()
    .single();
  if (error) throw error;
  return data as DealNote;
}

export async function togglePin(noteId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from(TABLE.DEAL_NOTES)
    .update({ pinned })
    .eq('id', noteId);
  if (error) throw error;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE.DEAL_NOTES)
    .delete()
    .eq('id', noteId);
  if (error) throw error;
}
