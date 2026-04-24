/**
 * CRUD på crm_contacts_2026_04_12 (unified organizations + persons).
 * Filtrér altid på contact_type.
 */

import { supabase } from '@/integrations/supabase/client';
import { TABLE, CONTACT_TYPE, type ContactType } from '../constants';
import type { Contact, CreateContactInput } from '../types';

export async function listContacts(
  contactType: ContactType,
  opts?: { search?: string; limit?: number },
): Promise<Contact[]> {
  let query = supabase
    .from(TABLE.CONTACTS)
    .select('*')
    .eq('contact_type', contactType)
    .order('name', { ascending: true });

  if (opts?.search && opts.search.trim().length > 0) {
    const term = `%${opts.search.trim()}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function listOrganizations(search?: string): Promise<Contact[]> {
  return listContacts(CONTACT_TYPE.COMPANY, { search, limit: 50 });
}

export async function listPersons(search?: string): Promise<Contact[]> {
  return listContacts(CONTACT_TYPE.PERSON, { search, limit: 50 });
}

export async function getContact(contactId: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from(TABLE.CONTACTS)
    .select('*')
    .eq('id', contactId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Contact | null;
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const payload = {
    name: input.name,
    contact_type: input.contact_type,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    role: input.role ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    zip: input.zip ?? null,
    country: input.country ?? 'DK',
    notes: input.notes ?? null,
    source: input.source ?? null,
  };
  const { data, error } = await supabase
    .from(TABLE.CONTACTS)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(
  contactId: string,
  patch: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Contact> {
  const { data, error } = await supabase
    .from(TABLE.CONTACTS)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', contactId)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}
