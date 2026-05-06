import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Læser fra v_suppliers_compat (bagudkompatibel facade ovenpå companies_2026_04_27).
// Skriver til companies_2026_04_27 direkte med is_supplier=true.
// standard_suppliers_2026_01_15_06_45 er deprecated og røres ikke.

export interface StandardSupplier {
  id: string;
  name: string;
  cvr?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country: string;
  notes?: string;
  status: 'Aktiv' | 'Arkiveret';
  isStandard: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StandardSuppliersContextType {
  suppliers: StandardSupplier[];
  loading: boolean;
  setSuppliers: (suppliers: StandardSupplier[]) => void;
  addSupplier: (supplier: Omit<StandardSupplier, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<StandardSupplier>) => Promise<void>;
  archiveSupplier: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const StandardSuppliersContext = createContext<StandardSuppliersContextType | undefined>(undefined);

export const useStandardSuppliers = () => {
  const context = useContext(StandardSuppliersContext);
  if (context === undefined) {
    throw new Error('useStandardSuppliers must be used within a StandardSuppliersProvider');
  }
  return context;
};

// Map fra UI-felter til companies-tabellens kolonnenavne.
const supplierToCompanyRow = (s: Partial<StandardSupplier>): Record<string, any> => {
  const out: Record<string, any> = {};
  if ('name' in s) out.name = s.name;
  if ('cvr' in s) out.cvr = s.cvr ?? null;
  if ('contactPerson' in s) out.default_contact_name = s.contactPerson ?? null;
  if ('email' in s) out.default_contact_email = s.email ?? null;
  if ('phone' in s) out.default_contact_phone = s.phone ?? null;
  if ('address' in s) out.address_line1 = s.address ?? null;
  if ('postalCode' in s) out.address_zip = s.postalCode ?? null;
  if ('city' in s) out.address_city = s.city ?? null;
  if ('country' in s) out.country = s.country ?? null;
  if ('notes' in s) out.notes = s.notes ?? null;
  if ('status' in s) out.status = s.status ?? null;
  return out;
};

const rowToSupplier = (s: any): StandardSupplier => ({
  id: s.id,
  name: s.name,
  cvr: s.cvr ?? undefined,
  contactPerson: s.contact_person ?? undefined,
  email: s.email ?? undefined,
  phone: s.phone ?? undefined,
  address: s.address ?? undefined,
  postalCode: s.postal_code ?? undefined,
  city: s.city ?? undefined,
  country: s.country ?? 'Danmark',
  notes: s.notes ?? undefined,
  status: (s.status as 'Aktiv' | 'Arkiveret') ?? 'Aktiv',
  isStandard: !!s.is_standard,
  createdAt: s.created_at ? new Date(s.created_at) : new Date(),
  updatedAt: s.updated_at ? new Date(s.updated_at) : new Date(),
});

export const StandardSuppliersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [suppliers, setSuppliers] = useState<StandardSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_suppliers_compat')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading suppliers:', error);
        return;
      }
      if (data) setSuppliers(data.map(rowToSupplier));
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async (supplierData: Omit<StandardSupplier, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => {
    const row = {
      ...supplierToCompanyRow(supplierData),
      is_supplier: true,
      is_customer: false,
      is_partner: false,
      is_standard: true,
    };
    const { error } = await supabase
      .from('companies_2026_04_27')
      .insert(row);
    if (error) {
      console.error('Error adding supplier:', error);
      throw error;
    }
    // Reload fra view'et — view'et giver det compat-formatterede shape.
    await loadSuppliers();
  };

  const updateSupplier = async (id: string, updates: Partial<StandardSupplier>) => {
    const row = supplierToCompanyRow(updates);
    if (Object.keys(row).length === 0) return;
    row.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('companies_2026_04_27')
      .update(row)
      .eq('id', id);
    if (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
    setSuppliers(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s))
    );
  };

  const archiveSupplier = async (id: string) => {
    await updateSupplier(id, { status: 'Arkiveret' });
  };

  return (
    <StandardSuppliersContext.Provider value={{
      suppliers,
      loading,
      setSuppliers,
      addSupplier,
      updateSupplier,
      archiveSupplier,
      reload: loadSuppliers,
    }}>
      {children}
    </StandardSuppliersContext.Provider>
  );
};
