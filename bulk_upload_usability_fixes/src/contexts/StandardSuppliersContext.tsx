import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  updateSupplier: (id: string, updates: Partial<StandardSupplier>) => void;
  archiveSupplier: (id: string) => void;
}

const StandardSuppliersContext = createContext<StandardSuppliersContextType | undefined>(undefined);

export const useStandardSuppliers = () => {
  const context = useContext(StandardSuppliersContext);
  if (context === undefined) {
    throw new Error('useStandardSuppliers must be used within a StandardSuppliersProvider');
  }
  return context;
};

// Mock data for demonstration
const mockSuppliers: StandardSupplier[] = [
  {
    id: '1',
    name: 'Bygma A/S',
    cvr: '12345678',
    contactPerson: 'Lars Nielsen',
    email: 'lars@bygma.dk',
    phone: '+45 12 34 56 78',
    address: 'Industrivej 10',
    postalCode: '2600',
    city: 'Glostrup',
    country: 'Danmark',
    notes: 'Primær leverandør af træmaterialer og værktøj',
    status: 'Aktiv',
    isStandard: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'XL-BYG Køge',
    cvr: '87654321',
    contactPerson: 'Mette Andersen',
    email: 'mette@xlbyg-koege.dk',
    phone: '+45 87 65 43 21',
    address: 'Byggevej 25',
    postalCode: '4600',
    city: 'Køge',
    country: 'Danmark',
    notes: 'Lokal leverandør med gode priser på skruer og beslag',
    status: 'Aktiv',
    isStandard: true,
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-12'),
  },
  {
    id: '3',
    name: 'Silvan Rødovre',
    cvr: '11223344',
    contactPerson: 'Peter Hansen',
    email: 'peter@silvan.dk',
    phone: '+45 11 22 33 44',
    address: 'Rødovrevej 50',
    postalCode: '2610',
    city: 'Rødovre',
    country: 'Danmark',
    notes: 'Tidligere leverandør - nu arkiveret',
    status: 'Arkiveret',
    isStandard: true,
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: '4',
    name: 'Stark Byggemarked',
    cvr: '55667788',
    contactPerson: 'Anna Sørensen',
    email: 'anna@stark.dk',
    phone: '+45 55 66 77 88',
    address: 'Storkøbenhavn 15',
    postalCode: '2000',
    city: 'Frederiksberg',
    country: 'Danmark',
    notes: 'Specialiseret i køkkenmaterialer og fliser',
    status: 'Aktiv',
    isStandard: true,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-18'),
  },
];

// Helper function to save suppliers to storage
const saveSuppliersToStorage = (suppliers: StandardSupplier[]) => {
  try {
    localStorage.setItem('nem_inventar_suppliers', JSON.stringify(suppliers));
  } catch (error) {
    console.error('Error saving suppliers to storage:', error);
  }
};

export const StandardSuppliersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [suppliers, setSuppliers] = useState<StandardSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Load suppliers from Supabase on mount
  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('standard_suppliers_2026_01_15_06_45')
        .select('*')
        .order('name');

      if (!error && data) {
        const formatted = data.map(s => ({
          id: s.id,
          name: s.name,
          cvr: s.cvr,
          contactPerson: s.contact_person,
          email: s.email,
          phone: s.phone,
          address: s.address,
          postalCode: s.postal_code,
          city: s.city,
          country: s.country,
          notes: s.notes,
          status: s.status,
          isStandard: true,
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at)
        }));
        setSuppliers(formatted);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async (supplierData: Omit<StandardSupplier, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => {
    try {
      const { data, error } = await supabase
        .from('standard_suppliers_2026_01_15_06_45')
        .insert({
          name: supplierData.name,
          cvr: supplierData.cvr,
          contact_person: supplierData.contactPerson,
          email: supplierData.email,
          phone: supplierData.phone,
          address: supplierData.address,
          postal_code: supplierData.postalCode,
          city: supplierData.city,
          country: supplierData.country,
          notes: supplierData.notes,
          status: supplierData.status
        })
        .select()
        .single();

      if (error) throw error;

      const newSupplier: StandardSupplier = {
        id: data.id,
        name: data.name,
        cvr: data.cvr,
        contactPerson: data.contact_person,
        email: data.email,
        phone: data.phone,
        address: data.address,
        postalCode: data.postal_code,
        city: data.city,
        country: data.country,
        notes: data.notes,
        status: data.status,
        isStandard: true,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setSuppliers(prev => [...prev, newSupplier]);
    } catch (error) {
      console.error('Error adding supplier:', error);
      throw error;
    }
  };

  const updateSupplier = (id: string, updates: Partial<StandardSupplier>) => {
    const updatedSuppliers = suppliers.map(supplier => 
      supplier.id === id 
        ? { ...supplier, ...updates, updatedAt: new Date() }
        : supplier
    );
    setSuppliers(updatedSuppliers);
    saveSuppliersToStorage(updatedSuppliers);
  };

  const archiveSupplier = (id: string) => {
    updateSupplier(id, { status: 'Arkiveret' });
  };

  return (
    <StandardSuppliersContext.Provider value={{
      suppliers,
      loading,
      setSuppliers,
      addSupplier,
      updateSupplier,
      archiveSupplier,
    }}>
      {children}
    </StandardSuppliersContext.Provider>
  );
};