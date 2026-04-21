import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StandardMaterial {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  status: 'Aktiv' | 'Arkiveret';
  primarySupplierId?: string;
  supplierProductCode?: string;
  supplierProductUrl?: string;
  materialType?: string;
  certifications: string[];
  isStandard: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialPrice {
  id: string;
  materialId: string;
  supplierId: string;
  unitPrice: number;
  currency: string;
  validFrom: Date;
  createdAt: Date;
}

export interface MaterialDocument {
  id: string;
  materialId: string;
  fileName: string;
  fileUrl: string;
  documentType: 'Sikkerhedsdatablad' | 'Certifikat' | 'Datablad' | 'Andet';
  notes?: string;
  uploadedAt: Date;
}

interface StandardMaterialsContextType {
  materials: StandardMaterial[];
  prices: MaterialPrice[];
  documents: MaterialDocument[];
  loading: boolean;
  setMaterials: (materials: StandardMaterial[]) => void;
  addMaterial: (material: Omit<StandardMaterial, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => Promise<void>;
  updateMaterial: (id: string, updates: Partial<StandardMaterial>) => Promise<void>;
  archiveMaterial: (id: string) => void;
  addPrice: (price: Omit<MaterialPrice, 'id' | 'createdAt'>) => Promise<void>;
  addDocument: (document: Omit<MaterialDocument, 'id' | 'uploadedAt'>) => void;
  removeDocument: (id: string) => void;
  getLatestPrice: (materialId: string) => MaterialPrice | null;
  getMaterialDocuments: (materialId: string) => MaterialDocument[];
}

const StandardMaterialsContext = createContext<StandardMaterialsContextType | undefined>(undefined);

export const useStandardMaterials = () => {
  const context = useContext(StandardMaterialsContext);
  if (context === undefined) {
    throw new Error('useStandardMaterials must be used within a StandardMaterialsProvider');
  }
  return context;
};

// Mock data for demonstration
const mockMaterials: StandardMaterial[] = [
  {
    id: '1',
    name: 'Krydsfiner Birk 18mm',
    description: 'Højkvalitets krydsfiner i birk, 18mm tykkelse',
    category: 'Plademateriale',
    unit: 'm²',
    status: 'Aktiv',
    primarySupplierId: '1', // Bygma A/S
    supplierProductCode: 'KF-BIRK-18',
    supplierProductUrl: 'https://bygma.dk/produkter/krydsfiner-birk-18mm',
    materialType: 'Plade',
    certifications: ['FSC', 'PEFC'],
    isStandard: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Skruer 4x50mm rustfri',
    description: 'Rustfri stålskruer med krydsslids',
    category: 'Beslag & Skruer',
    unit: 'stk',
    status: 'Aktiv',
    primarySupplierId: '2', // XL-BYG
    supplierProductCode: 'SKR-4X50-RF',
    materialType: 'Beslag',
    certifications: [],
    isStandard: true,
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-12'),
  },
  {
    id: '3',
    name: 'Lak Transparent Mat',
    description: 'Vandbaseret transparent lak med mat finish',
    category: 'Overfladebehandling',
    unit: 'liter',
    status: 'Aktiv',
    primarySupplierId: '4', // Stark
    supplierProductCode: 'LAK-TRANS-MAT-1L',
    materialType: 'Overflade',
    certifications: ['Svanemærket'],
    isStandard: true,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: '4',
    name: 'Gammel Lim Type X',
    description: 'Forældet limtype - erstattet af ny formulering',
    category: 'Lim & Klæber',
    unit: 'kg',
    status: 'Arkiveret',
    materialType: 'Andet',
    certifications: [],
    isStandard: true,
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-01-05'),
  },
];

const mockPrices: MaterialPrice[] = [
  {
    id: '1',
    materialId: '1',
    supplierId: '1',
    unitPrice: 285.50,
    currency: 'DKK',
    validFrom: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    materialId: '1',
    supplierId: '1',
    unitPrice: 275.00,
    currency: 'DKK',
    validFrom: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    materialId: '2',
    supplierId: '2',
    unitPrice: 0.85,
    currency: 'DKK',
    validFrom: new Date('2024-01-10'),
    createdAt: new Date('2024-01-10'),
  },
  {
    id: '4',
    materialId: '3',
    supplierId: '4',
    unitPrice: 125.00,
    currency: 'DKK',
    validFrom: new Date('2024-01-18'),
    createdAt: new Date('2024-01-18'),
  },
];

const mockDocuments: MaterialDocument[] = [
  {
    id: '1',
    materialId: '1',
    fileName: 'krydsfiner_birk_sikkerhedsdatablad.pdf',
    fileUrl: '/documents/krydsfiner_birk_sds.pdf',
    documentType: 'Sikkerhedsdatablad',
    notes: 'Opdateret sikkerhedsdatablad fra leverandør',
    uploadedAt: new Date('2024-01-10'),
  },
  {
    id: '2',
    materialId: '1',
    fileName: 'fsc_certifikat_krydsfiner.pdf',
    fileUrl: '/documents/fsc_cert_krydsfiner.pdf',
    documentType: 'Certifikat',
    notes: 'FSC certificering',
    uploadedAt: new Date('2024-01-12'),
  },
  {
    id: '3',
    materialId: '3',
    fileName: 'lak_datablad_teknisk.pdf',
    fileUrl: '/documents/lak_datablad.pdf',
    documentType: 'Datablad',
    uploadedAt: new Date('2024-01-18'),
  },
];



export const StandardMaterialsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [materials, setMaterials] = useState<StandardMaterial[]>([]);
  const [prices, setPrices] = useState<MaterialPrice[]>([]);
  const [documents, setDocuments] = useState<MaterialDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase on mount
  useEffect(() => {
    loadMaterials();
    loadPrices();
    loadDocuments();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('standard_materials_2026_01_15_06_45')
        .select('*')
        .order('name');

      if (!error && data) {
        const formatted = data.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          category: m.category,
          unit: m.unit,
          status: m.status,
          primarySupplierId: m.primary_supplier_id,
          supplierProductCode: m.supplier_product_code,
          supplierProductUrl: m.supplier_product_url,
          materialType: m.material_type,
          certifications: m.certifications || [],
          isStandard: true,
          createdAt: new Date(m.created_at),
          updatedAt: new Date(m.updated_at)
        }));
        setMaterials(formatted);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('standard_material_price_snapshots_2026_01_19_15_00')
        .select('*')
        .order('price_date', { ascending: false });

      if (!error && data) {
        const formatted = data.map(p => ({
          id: p.id,
          materialId: p.material_id,
          supplierId: p.supplier_id,
          unitPrice: parseFloat(p.price),
          currency: p.currency,
          validFrom: new Date(p.price_date),
          createdAt: new Date(p.created_at)
        }));
        setPrices(formatted);
      }
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('material_documents_2026_01_15_06_45')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (!error && data) {
        const formatted = data.map(d => ({
          id: d.id,
          materialId: d.material_id,
          fileName: d.file_name,
          fileUrl: d.file_url,
          documentType: d.document_type,
          notes: d.notes,
          uploadedAt: new Date(d.uploaded_at)
        }));
        setDocuments(formatted);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const addMaterial = async (materialData: Omit<StandardMaterial, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => {
    try {
      console.log('addMaterial called with data:', materialData);
      
      // Clean data for Supabase (handle empty strings and undefined values)
      const insertData = {
        name: materialData.name,
        description: materialData.description || null,
        category: materialData.category,
        unit: materialData.unit,
        status: materialData.status,
        primary_supplier_id: materialData.primarySupplierId || null,
        supplier_product_code: materialData.supplierProductCode || null,
        supplier_product_url: materialData.supplierProductUrl || null,
        material_type: materialData.materialType || null,
        certifications: materialData.certifications || []
      };
      
      console.log('Cleaned insert data:', insertData);
      
      const { data, error } = await supabase
        .from('standard_materials_2026_01_15_06_45')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Material created successfully:', data);
      const newMaterial: StandardMaterial = {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        unit: data.unit,
        status: data.status,
        primarySupplierId: data.primary_supplier_id,
        supplierProductCode: data.supplier_product_code,
        supplierProductUrl: data.supplier_product_url,
        materialType: data.material_type,
        certifications: data.certifications || [],
        isStandard: true,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setMaterials(prev => [...prev, newMaterial]);
      console.log('Material added to state successfully');
    } catch (error) {
      console.error('Error adding material:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      throw error;
    }
  };

  const updateMaterial = async (id: string, updates: Partial<StandardMaterial>) => {
    try {
      const { data, error } = await supabase
        .from('standard_materials_2026_01_15_06_45')
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
          unit: updates.unit,
          status: updates.status,
          primary_supplier_id: updates.primarySupplierId,
          supplier_product_code: updates.supplierProductCode,
          supplier_product_url: updates.supplierProductUrl,
          material_type: updates.materialType,
          certifications: updates.certifications
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedMaterial: StandardMaterial = {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        unit: data.unit,
        status: data.status,
        primarySupplierId: data.primary_supplier_id,
        supplierProductCode: data.supplier_product_code,
        supplierProductUrl: data.supplier_product_url,
        materialType: data.material_type,
        certifications: data.certifications || [],
        isStandard: true,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setMaterials(prev => prev.map(m => m.id === id ? updatedMaterial : m));
    } catch (error) {
      console.error('Error updating material:', error);
      throw error;
    }
  };

  const archiveMaterial = (id: string) => {
    updateMaterial(id, { status: 'Arkiveret' });
  };

  const addPrice = async (priceData: Omit<MaterialPrice, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('standard_material_price_snapshots_2026_01_19_15_00')
        .insert({
          material_id: priceData.materialId,
          supplier_id: priceData.supplierId,
          price: priceData.unitPrice.toString(),
          currency: priceData.currency,
          price_date: priceData.validFrom.toISOString().split('T')[0] // Only date part
        })
        .select()
        .single();

      if (error) throw error;

      const newPrice: MaterialPrice = {
        id: data.id,
        materialId: data.material_id,
        supplierId: data.supplier_id,
        unitPrice: parseFloat(data.price),
        currency: data.currency,
        validFrom: new Date(data.price_date),
        createdAt: new Date(data.created_at)
      };

      setPrices(prev => [...prev, newPrice]);
      console.log('Price added successfully to state:', newPrice);
    } catch (error) {
      console.error('Error adding price:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      throw error;
    }
  };

  const addDocument = (documentData: Omit<MaterialDocument, 'id' | 'uploadedAt'>) => {
    const newDocument: MaterialDocument = {
      ...documentData,
      id: Date.now().toString(),
      uploadedAt: new Date(),
    };
    const updatedDocuments = [...documents, newDocument];
    setDocuments(updatedDocuments);
    saveMaterialsToStorage(materials, prices, updatedDocuments);
  };

  const removeDocument = (id: string) => {
    const updatedDocuments = documents.filter(doc => doc.id !== id);
    setDocuments(updatedDocuments);
    saveMaterialsToStorage(materials, prices, updatedDocuments);
  };

  const getLatestPrice = (materialId: string): MaterialPrice | null => {
    const materialPrices = prices
      .filter(price => price.materialId === materialId)
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
    
    return materialPrices.length > 0 ? materialPrices[0] : null;
  };

  const getMaterialDocuments = (materialId: string): MaterialDocument[] => {
    return documents.filter(doc => doc.materialId === materialId);
  };

  return (
    <StandardMaterialsContext.Provider value={{
      materials,
      prices,
      documents,
      loading,
      setMaterials,
      addMaterial,
      updateMaterial,
      archiveMaterial,
      addPrice,
      addDocument,
      removeDocument,
      getLatestPrice,
      getMaterialDocuments,
    }}>
      {children}
    </StandardMaterialsContext.Provider>
  );
};