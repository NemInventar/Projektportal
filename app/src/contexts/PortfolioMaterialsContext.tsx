import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioMaterial {
  standardMaterialId: string;
  materialName: string;
  category: string | null;
  unit: string;
  primarySupplierId: string | null;
  qtySecure: number;
  qtyTentative: number;
  qtyTotal: number;
  qtyOrdered: number;
  qtyMissing: number;
  nextDeliveryDate: string | null;
  leadTimeDays: number | null;
}

export interface PortfolioMaterialProject {
  standardMaterialId: string;
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  phase: string;
  demandClass: 'secure' | 'tentative';
  qty: number;
  projectMaterialId: string;
}

interface PortfolioMaterialsContextType {
  materials: PortfolioMaterial[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getProjectsForMaterial: (standardMaterialId: string) => Promise<PortfolioMaterialProject[]>;
}

const PortfolioMaterialsContext = createContext<PortfolioMaterialsContextType | undefined>(undefined);

export function PortfolioMaterialsProvider({ children }: { children: ReactNode }) {
  const [materials, setMaterials] = useState<PortfolioMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('v_portfolio_materials')
      .select('*')
      .order('qty_missing', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMaterials(
      (data ?? []).map((r: any) => ({
        standardMaterialId: r.standard_material_id,
        materialName: r.material_name,
        category: r.category,
        unit: r.unit,
        primarySupplierId: r.primary_supplier_id,
        qtySecure: Number(r.qty_secure),
        qtyTentative: Number(r.qty_tentative),
        qtyTotal: Number(r.qty_total),
        qtyOrdered: Number(r.qty_ordered),
        qtyMissing: Number(r.qty_missing),
        nextDeliveryDate: r.next_delivery_date,
        leadTimeDays: r.lead_time_days,
      }))
    );
    setLoading(false);
  }, []);

  const getProjectsForMaterial = useCallback(async (standardMaterialId: string) => {
    const { data, error: err } = await supabase
      .from('v_portfolio_material_projects')
      .select('*')
      .eq('standard_material_id', standardMaterialId);
    if (err) throw err;
    return (data ?? []).map((r: any) => ({
      standardMaterialId: r.standard_material_id,
      projectId: r.project_id,
      projectName: r.project_name,
      projectNumber: r.project_number,
      phase: r.phase,
      demandClass: r.demand_class,
      qty: Number(r.qty),
      projectMaterialId: r.project_material_id,
    }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PortfolioMaterialsContext.Provider value={{ materials, loading, error, refresh, getProjectsForMaterial }}>
      {children}
    </PortfolioMaterialsContext.Provider>
  );
}

export function usePortfolioMaterials() {
  const ctx = useContext(PortfolioMaterialsContext);
  if (!ctx) throw new Error('usePortfolioMaterials must be used within PortfolioMaterialsProvider');
  return ctx;
}
