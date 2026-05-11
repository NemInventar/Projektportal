import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// TODO (V2): Overvej at merge companies_2026_04_27 og crm_contacts (leads)
// til ét unified system. I V1 holdes de adskilte for at undgå migration af leads-data.

export interface Company {
  id: string;
  name: string;
  cvr?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressZip?: string;
  addressCity?: string;
  country?: string;
  defaultContactName?: string;
  defaultContactEmail?: string;
  defaultContactPhone?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isPartner: boolean;
  isStandard?: boolean;
  status?: string;
  website?: string;
  tags?: string[];
  legacySupplierId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'legacySupplierId'>;

interface CompaniesContextType {
  companies: Company[];
  loading: boolean;
  reload: () => Promise<void>;
  addCompany: (input: CompanyInput) => Promise<Company>;
  updateCompany: (id: string, updates: Partial<CompanyInput>) => Promise<void>;
  removeCompany: (id: string) => Promise<void>;
  countQuotesUsing: (id: string) => Promise<number>;
}

const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined);

const TABLE = 'companies_2026_04_27';

const rowToCompany = (r: any): Company => ({
  id: r.id,
  name: r.name,
  cvr: r.cvr ?? undefined,
  addressLine1: r.address_line1 ?? undefined,
  addressLine2: r.address_line2 ?? undefined,
  addressZip: r.address_zip ?? undefined,
  addressCity: r.address_city ?? undefined,
  country: r.country ?? undefined,
  defaultContactName: r.default_contact_name ?? undefined,
  defaultContactEmail: r.default_contact_email ?? undefined,
  defaultContactPhone: r.default_contact_phone ?? undefined,
  isCustomer: !!r.is_customer,
  isSupplier: !!r.is_supplier,
  isPartner: !!r.is_partner,
  isStandard: r.is_standard ?? undefined,
  status: r.status ?? undefined,
  website: r.website ?? undefined,
  tags: Array.isArray(r.tags) ? r.tags : undefined,
  legacySupplierId: r.legacy_supplier_id ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

// Patch-builder: kun felter der eksplicit er med i input bliver mappet til DB.
// Forhindrer at en partial update overskriver eksisterende værdier med null.
const inputToRow = (input: Partial<CompanyInput>): Record<string, any> => {
  const out: Record<string, any> = {};
  if ('name' in input) out.name = input.name;
  if ('cvr' in input) out.cvr = input.cvr ?? null;
  if ('addressLine1' in input) out.address_line1 = input.addressLine1 ?? null;
  if ('addressLine2' in input) out.address_line2 = input.addressLine2 ?? null;
  if ('addressZip' in input) out.address_zip = input.addressZip ?? null;
  if ('addressCity' in input) out.address_city = input.addressCity ?? null;
  if ('country' in input) out.country = input.country ?? null;
  if ('defaultContactName' in input) out.default_contact_name = input.defaultContactName ?? null;
  if ('defaultContactEmail' in input) out.default_contact_email = input.defaultContactEmail ?? null;
  if ('defaultContactPhone' in input) out.default_contact_phone = input.defaultContactPhone ?? null;
  if ('isCustomer' in input) out.is_customer = input.isCustomer ?? false;
  if ('isSupplier' in input) out.is_supplier = input.isSupplier ?? false;
  if ('isPartner' in input) out.is_partner = input.isPartner ?? false;
  if ('isStandard' in input) out.is_standard = input.isStandard ?? null;
  if ('status' in input) out.status = input.status ?? null;
  if ('website' in input) out.website = input.website ?? null;
  if ('tags' in input) out.tags = input.tags ?? null;
  if ('notes' in input) out.notes = input.notes ?? null;
  return out;
};

export const CompaniesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(TABLE).select('*').order('name');
      if (error) throw error;
      setCompanies((data ?? []).map(rowToCompany));
    } catch (err) {
      console.error('Error loading companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const addCompany = async (input: CompanyInput): Promise<Company> => {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(inputToRow(input))
      .select()
      .single();
    if (error) throw error;
    const company = rowToCompany(data);
    setCompanies(prev => [...prev, company].sort((a, b) => a.name.localeCompare(b.name)));
    return company;
  };

  const updateCompany = async (id: string, updates: Partial<CompanyInput>) => {
    const { error } = await supabase
      .from(TABLE)
      .update({ ...inputToRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    setCompanies(prev =>
      prev
        .map(c => (c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  };

  const countQuotesUsing = async (id: string): Promise<number> => {
    const { count, error } = await supabase
      .from('project_quotes_2026_01_16_23_00')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id);
    if (error) throw error;
    return count ?? 0;
  };

  const removeCompany = async (id: string) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    setCompanies(prev => prev.filter(c => c.id !== id));
  };

  return (
    <CompaniesContext.Provider value={{ companies, loading, reload, addCompany, updateCompany, removeCompany, countQuotesUsing }}>
      {children}
    </CompaniesContext.Provider>
  );
};

export const useCompanies = () => {
  const ctx = useContext(CompaniesContext);
  if (!ctx) throw new Error('useCompanies must be used within CompaniesProvider');
  return ctx;
};
