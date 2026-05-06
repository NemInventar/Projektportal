import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanySettings {
  id: string;
  // Firma-info (overruler COMPANY_INFO config)
  companyName?: string | null;
  cvr?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
  phone?: string | null;
  email?: string | null;
  // Bank
  bankName?: string | null;
  bankRegNo?: string | null;
  bankAccountNo?: string | null;
  bankIban?: string | null;
  bankBic?: string | null;
  // Tilbuds-defaults
  defaultPaymentTerms?: string | null;
  defaultDeliveryPeriod?: string | null;
  defaultReservations?: string | null;
  defaultValidityDays?: number | null;
  defaultRecipientProfile?: string | null;
}

export type CompanySettingsInput = Omit<CompanySettings, 'id'>;

interface CompanySettingsContextType {
  settings: CompanySettings | null;
  loading: boolean;
  reload: () => Promise<void>;
  update: (patch: Partial<CompanySettingsInput>) => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined);

const TABLE = 'company_settings_2026_05_03';

const rowToSettings = (r: any): CompanySettings => ({
  id: r.id,
  companyName: r.company_name ?? null,
  cvr: r.cvr ?? null,
  addressLine1: r.address_line1 ?? null,
  addressLine2: r.address_line2 ?? null,
  addressZip: r.address_zip ?? null,
  addressCity: r.address_city ?? null,
  phone: r.phone ?? null,
  email: r.email ?? null,
  bankName: r.bank_name ?? null,
  bankRegNo: r.bank_reg_no ?? null,
  bankAccountNo: r.bank_account_no ?? null,
  bankIban: r.bank_iban ?? null,
  bankBic: r.bank_bic ?? null,
  defaultPaymentTerms: r.default_payment_terms ?? null,
  defaultDeliveryPeriod: r.default_delivery_period ?? null,
  defaultReservations: r.default_reservations ?? null,
  defaultValidityDays: r.default_validity_days ?? null,
  defaultRecipientProfile: r.default_recipient_profile ?? null,
});

const inputToRow = (input: Partial<CompanySettingsInput>): Record<string, any> => {
  const out: Record<string, any> = {};
  if ('companyName' in input) out.company_name = input.companyName ?? null;
  if ('cvr' in input) out.cvr = input.cvr ?? null;
  if ('addressLine1' in input) out.address_line1 = input.addressLine1 ?? null;
  if ('addressLine2' in input) out.address_line2 = input.addressLine2 ?? null;
  if ('addressZip' in input) out.address_zip = input.addressZip ?? null;
  if ('addressCity' in input) out.address_city = input.addressCity ?? null;
  if ('phone' in input) out.phone = input.phone ?? null;
  if ('email' in input) out.email = input.email ?? null;
  if ('bankName' in input) out.bank_name = input.bankName ?? null;
  if ('bankRegNo' in input) out.bank_reg_no = input.bankRegNo ?? null;
  if ('bankAccountNo' in input) out.bank_account_no = input.bankAccountNo ?? null;
  if ('bankIban' in input) out.bank_iban = input.bankIban ?? null;
  if ('bankBic' in input) out.bank_bic = input.bankBic ?? null;
  if ('defaultPaymentTerms' in input) out.default_payment_terms = input.defaultPaymentTerms ?? null;
  if ('defaultDeliveryPeriod' in input) out.default_delivery_period = input.defaultDeliveryPeriod ?? null;
  if ('defaultReservations' in input) out.default_reservations = input.defaultReservations ?? null;
  if ('defaultValidityDays' in input) out.default_validity_days = input.defaultValidityDays ?? null;
  if ('defaultRecipientProfile' in input) out.default_recipient_profile = input.defaultRecipientProfile ?? null;
  return out;
};

export const CompanySettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(TABLE).select('*').limit(1).maybeSingle();
      if (error) {
        // Tabel findes ikke endnu eller anden fejl: fallback til null (COMPANY_INFO bruges)
        console.warn('CompanySettings load failed (forventet hvis migration ikke er kørt):', error.message);
        setSettings(null);
      } else if (data) {
        setSettings(rowToSettings(data));
      } else {
        setSettings(null);
      }
    } catch (err) {
      console.warn('CompanySettings load fejlede:', err);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const update = async (patch: Partial<CompanySettingsInput>) => {
    const row = inputToRow(patch);
    if (Object.keys(row).length === 0) return;
    row.updated_at = new Date().toISOString();
    if (settings?.id) {
      const { error } = await supabase.from(TABLE).update(row).eq('id', settings.id);
      if (error) throw error;
      setSettings(prev => prev ? { ...prev, ...patch } : prev);
    } else {
      // Ingen row endnu — opret én
      const { data, error } = await supabase.from(TABLE).insert(row).select().single();
      if (error) throw error;
      setSettings(rowToSettings(data));
    }
  };

  return (
    <CompanySettingsContext.Provider value={{ settings, loading, reload, update }}>
      {children}
    </CompanySettingsContext.Provider>
  );
};

export const useCompanySettings = () => {
  const ctx = useContext(CompanySettingsContext);
  if (!ctx) throw new Error('useCompanySettings must be used within CompanySettingsProvider');
  return ctx;
};
