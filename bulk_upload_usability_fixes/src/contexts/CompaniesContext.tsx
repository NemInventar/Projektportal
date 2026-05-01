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
  defaultContactName?: string;
  defaultContactEmail?: string;
  defaultContactPhone?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isPartner: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;

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
  defaultContactName: r.default_contact_name ?? undefined,
  defaultContactEmail: r.default_contact_email ?? undefined,
  defaultContactPhone: r.default_contact_phone ?? undefined,
  isCustomer: !!r.is_customer,
  isSupplier: !!r.is_supplier,
  isPartner: !!r.is_partner,
  notes: r.notes ?? undefined,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

const inputToRow = (input: Partial<CompanyInput>) => ({
  name: input.name,
  cvr: input.cvr ?? null,
  address_line1: input.addressLine1 ?? null,
  address_line2: input.addressLine2 ?? null,
  address_zip: input.addressZip ?? null,
  address_city: input.addressCity ?? null,
  default_contact_name: input.defaultContactName ?? null,
  default_contact_email: input.defaultContactEmail ?? null,
  default_contact_phone: input.defaultContactPhone ?? null,
  is_customer: input.isCustomer ?? false,
  is_supplier: input.isSupplier ?? false,
  is_partner: input.isPartner ?? false,
  notes: input.notes ?? null,
});

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
