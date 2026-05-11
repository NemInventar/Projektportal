/**
 * Konvertering lead → projekt. Planens §3.2.
 *
 * Supabase JS-klienten kører ikke multi-statement transactions, så vi laver det
 * som to kald efter hinanden. Hvis step 2 fejler, rollback'er vi step 1 manuelt
 * (projektet slettes). Det er OK for V1 — alternativet er at flytte transaktionen
 * til en Supabase RPC-funktion, hvilket er en senere optimering.
 */

import { supabase } from '@/integrations/supabase/client';
import { TABLE, PIPELINE_STAGE } from '../constants';
import type { ConvertDealInput } from '../types';

export interface ConvertResult {
  projectId: string;
  projectNumber: string;
}

export async function convertDealToProject(input: ConvertDealInput): Promise<ConvertResult> {
  // 1) Hent deal + evt. org-data (til snapshot)
  const { data: dealData, error: dealErr } = await supabase
    .from(TABLE.DEALS)
    .select(`
      *,
      organization:contact_id ( name, email, phone )
    `)
    .eq('id', input.deal_id)
    .maybeSingle();
  if (dealErr) throw dealErr;
  if (!dealData) throw new Error('Deal ikke fundet');

  const deal = dealData as any;

  if (deal.converted_project_id) {
    throw new Error('Deal er allerede konverteret');
  }

  const org = deal.organization;
  const projectName = input.project_name && input.project_name.trim().length > 0
    ? input.project_name
    : deal.title;

  // 2) Opret projekt
  const projectPayload = {
    name: projectName,
    customer: org?.name ?? 'Ukendt kunde',
    project_number: input.project_number,
    phase: input.phase ?? 'Tilbud',
    description: deal.full_description ?? deal.short_description ?? deal.description ?? null,
    client: org?.name ?? null,
    contractor: deal.main_contractor ?? null,
    customer_contact: deal.primary_contact ?? null,
    customer_email: org?.email ?? null,
    customer_phone: deal.primary_contact_phone ?? org?.phone ?? null,
    delivery_address: deal.delivery_address ?? deal.address ?? null,
    source: deal.source_channel ?? null,
  };

  const { data: projectData, error: projectErr } = await supabase
    .from(TABLE.PROJECTS)
    .insert(projectPayload)
    .select('id, project_number')
    .single();
  if (projectErr) throw projectErr;
  const newProjectId = (projectData as any).id as string;

  // 3) Opdatér deal med reference
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from(TABLE.DEALS)
    .update({
      pipeline_stage: PIPELINE_STAGE.CONVERTED,
      converted_project_id: newProjectId,
      converted_at: nowIso,
      converted_by: input.user_email,
      won_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', input.deal_id);

  if (updateErr) {
    // Rollback: fjern det lige-oprettede projekt for at undgå orphan
    await supabase.from(TABLE.PROJECTS).delete().eq('id', newProjectId);
    throw updateErr;
  }

  // 4) Auto-note — revisionsspor
  await supabase.from(TABLE.DEAL_NOTES).insert({
    deal_id: input.deal_id,
    body: `[KONVERTERET] Til projekt ${input.project_number}`,
    author_email: input.user_email,
    created_by: 'human',
  });

  return {
    projectId: newProjectId,
    projectNumber: (projectData as any).project_number as string,
  };
}
