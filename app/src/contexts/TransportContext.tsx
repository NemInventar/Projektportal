import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MaterialTransportRate, ProjectMaterialTransport } from '@/types/transport';

interface TransportContextType {
  // Material transport rates (standard materials)
  materialTransportRates: MaterialTransportRate[];
  projectMaterialTransports: ProjectMaterialTransport[];
  loading: boolean;
  
  // Material transport rate operations
  addMaterialTransportRate: (rate: Omit<MaterialTransportRate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMaterialTransportRate: (id: string, updates: Partial<MaterialTransportRate>) => Promise<void>;
  getMaterialTransportRates: (materialId: string) => MaterialTransportRate[];
  getLatestTransportRates: (materialId: string) => MaterialTransportRate[];
  
  // Project material transport operations
  addProjectMaterialTransport: (transport: Omit<ProjectMaterialTransport, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProjectMaterialTransport: (id: string, updates: Partial<ProjectMaterialTransport>) => Promise<void>;
  getProjectMaterialTransports: (projectMaterialId: string) => ProjectMaterialTransport[];
  copyTransportFromStandard: (standardMaterialId: string, projectMaterialId: string) => Promise<void>;
}

const TransportContext = createContext<TransportContextType | undefined>(undefined);

export const useTransport = () => {
  const context = useContext(TransportContext);
  if (context === undefined) {
    throw new Error('useTransport must be used within a TransportProvider');
  }
  return context;
};

export const TransportProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [materialTransportRates, setMaterialTransportRates] = useState<MaterialTransportRate[]>([]);
  const [projectMaterialTransports, setProjectMaterialTransports] = useState<ProjectMaterialTransport[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase on mount
  useEffect(() => {
    loadTransportData();
  }, []);

  const loadTransportData = async () => {
    try {
      // Load material transport rates
      const { data: ratesData, error: ratesError } = await supabase
        .from('material_transport_rates_2026_01_15_06_45')
        .select('*')
        .order('created_at', { ascending: false });

      if (ratesError) {
        console.error('Error loading material transport rates:', ratesError);
      } else {
        const formattedRates = ratesData.map(r => ({
          id: r.id,
          standardMaterialId: r.standard_material_id,
          routeType: r.route_type,
          fromLocation: r.from_location,
          toLocation: r.to_location,
          costModel: r.cost_model,
          unitCost: parseFloat(r.unit_cost),
          currency: r.currency,
          validFrom: new Date(r.valid_from),
          validTo: r.valid_to ? new Date(r.valid_to) : undefined,
          note: r.note,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at)
        }));
        setMaterialTransportRates(formattedRates);
      }

      // Load project material transports
      const { data: transportsData, error: transportsError } = await supabase
        .from('project_material_transport_2026_01_15_06_45')
        .select('*')
        .order('created_at', { ascending: false });

      if (transportsError) {
        console.error('Error loading project material transports:', transportsError);
      } else {
        const formattedTransports = transportsData.map(t => ({
          id: t.id,
          projectMaterialId: t.project_material_id,
          routeType: t.route_type,
          fromLocation: t.from_location,
          toLocation: t.to_location,
          expectedCostModel: t.expected_cost_model,
          expectedUnitCost: parseFloat(t.expected_unit_cost),
          currency: t.currency,
          expectedNote: t.expected_note,
          actualCostModel: t.actual_cost_model,
          actualUnitCost: t.actual_unit_cost ? parseFloat(t.actual_unit_cost) : undefined,
          actualNote: t.actual_note,
          createdAt: new Date(t.created_at),
          updatedAt: new Date(t.updated_at)
        }));
        setProjectMaterialTransports(formattedTransports);
      }
    } catch (error) {
      console.error('Error loading transport data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMaterialTransportRate = async (rateData: Omit<MaterialTransportRate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('material_transport_rates_2026_01_15_06_45')
        .insert({
          standard_material_id: rateData.standardMaterialId,
          route_type: rateData.routeType,
          from_location: rateData.fromLocation,
          to_location: rateData.toLocation,
          cost_model: rateData.costModel,
          unit_cost: rateData.unitCost,
          currency: rateData.currency,
          valid_from: rateData.validFrom.toISOString().split('T')[0],
          valid_to: rateData.validTo ? rateData.validTo.toISOString().split('T')[0] : null,
          note: rateData.note
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding material transport rate:', error);
        return;
      }

      const newRate: MaterialTransportRate = {
        id: data.id,
        standardMaterialId: data.standard_material_id,
        routeType: data.route_type,
        fromLocation: data.from_location,
        toLocation: data.to_location,
        costModel: data.cost_model,
        unitCost: parseFloat(data.unit_cost),
        currency: data.currency,
        validFrom: new Date(data.valid_from),
        validTo: data.valid_to ? new Date(data.valid_to) : undefined,
        note: data.note,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setMaterialTransportRates(prev => [newRate, ...prev]);
    } catch (error) {
      console.error('Error adding material transport rate:', error);
    }
  };

  const updateMaterialTransportRate = async (id: string, updates: Partial<MaterialTransportRate>) => {
    try {
      const updateData: any = {};
      
      if (updates.routeType) updateData.route_type = updates.routeType;
      if (updates.fromLocation) updateData.from_location = updates.fromLocation;
      if (updates.toLocation) updateData.to_location = updates.toLocation;
      if (updates.costModel) updateData.cost_model = updates.costModel;
      if (updates.unitCost !== undefined) updateData.unit_cost = updates.unitCost;
      if (updates.currency) updateData.currency = updates.currency;
      if (updates.validFrom) updateData.valid_from = updates.validFrom.toISOString().split('T')[0];
      if (updates.validTo !== undefined) updateData.valid_to = updates.validTo ? updates.validTo.toISOString().split('T')[0] : null;
      if (updates.note !== undefined) updateData.note = updates.note;

      const { error } = await supabase
        .from('material_transport_rates_2026_01_15_06_45')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating material transport rate:', error);
        return;
      }

      setMaterialTransportRates(prev => prev.map(rate => 
        rate.id === id ? { ...rate, ...updates, updatedAt: new Date() } : rate
      ));
    } catch (error) {
      console.error('Error updating material transport rate:', error);
    }
  };

  const addProjectMaterialTransport = async (transportData: Omit<ProjectMaterialTransport, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('project_material_transport_2026_01_15_06_45')
        .insert({
          project_material_id: transportData.projectMaterialId,
          route_type: transportData.routeType,
          from_location: transportData.fromLocation,
          to_location: transportData.toLocation,
          expected_cost_model: transportData.expectedCostModel,
          expected_unit_cost: transportData.expectedUnitCost,
          currency: transportData.currency,
          expected_note: transportData.expectedNote,
          actual_cost_model: transportData.actualCostModel,
          actual_unit_cost: transportData.actualUnitCost,
          actual_note: transportData.actualNote
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding project material transport:', error);
        return;
      }

      const newTransport: ProjectMaterialTransport = {
        id: data.id,
        projectMaterialId: data.project_material_id,
        routeType: data.route_type,
        fromLocation: data.from_location,
        toLocation: data.to_location,
        expectedCostModel: data.expected_cost_model,
        expectedUnitCost: parseFloat(data.expected_unit_cost),
        currency: data.currency,
        expectedNote: data.expected_note,
        actualCostModel: data.actual_cost_model,
        actualUnitCost: data.actual_unit_cost ? parseFloat(data.actual_unit_cost) : undefined,
        actualNote: data.actual_note,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setProjectMaterialTransports(prev => [newTransport, ...prev]);
    } catch (error) {
      console.error('Error adding project material transport:', error);
    }
  };

  const updateProjectMaterialTransport = async (id: string, updates: Partial<ProjectMaterialTransport>) => {
    try {
      const updateData: any = {};
      
      if (updates.routeType) updateData.route_type = updates.routeType;
      if (updates.fromLocation) updateData.from_location = updates.fromLocation;
      if (updates.toLocation) updateData.to_location = updates.toLocation;
      if (updates.expectedCostModel) updateData.expected_cost_model = updates.expectedCostModel;
      if (updates.expectedUnitCost !== undefined) updateData.expected_unit_cost = updates.expectedUnitCost;
      if (updates.currency) updateData.currency = updates.currency;
      if (updates.expectedNote !== undefined) updateData.expected_note = updates.expectedNote;
      if (updates.actualCostModel !== undefined) updateData.actual_cost_model = updates.actualCostModel;
      if (updates.actualUnitCost !== undefined) updateData.actual_unit_cost = updates.actualUnitCost;
      if (updates.actualNote !== undefined) updateData.actual_note = updates.actualNote;

      const { error } = await supabase
        .from('project_material_transport_2026_01_15_06_45')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating project material transport:', error);
        return;
      }

      setProjectMaterialTransports(prev => prev.map(transport => 
        transport.id === id ? { ...transport, ...updates, updatedAt: new Date() } : transport
      ));
    } catch (error) {
      console.error('Error updating project material transport:', error);
    }
  };

  const getMaterialTransportRates = (materialId: string) => {
    return materialTransportRates.filter(rate => rate.standardMaterialId === materialId);
  };

  const getLatestTransportRates = (materialId: string) => {
    const rates = getMaterialTransportRates(materialId);
    const now = new Date();
    
    // Group by route type and get the latest valid rate for each
    const latestRates: { [key: string]: MaterialTransportRate } = {};
    
    rates.forEach(rate => {
      const isValid = rate.validFrom <= now && (!rate.validTo || rate.validTo >= now);
      if (isValid) {
        const key = rate.routeType;
        if (!latestRates[key] || rate.validFrom > latestRates[key].validFrom) {
          latestRates[key] = rate;
        }
      }
    });
    
    return Object.values(latestRates);
  };

  const getProjectMaterialTransports = (projectMaterialId: string) => {
    return projectMaterialTransports.filter(transport => transport.projectMaterialId === projectMaterialId);
  };

  const copyTransportFromStandard = async (standardMaterialId: string, projectMaterialId: string) => {
    try {
      const latestRates = getLatestTransportRates(standardMaterialId);
      
      for (const rate of latestRates) {
        await addProjectMaterialTransport({
          projectMaterialId,
          routeType: rate.routeType,
          fromLocation: rate.fromLocation,
          toLocation: rate.toLocation,
          expectedCostModel: rate.costModel,
          expectedUnitCost: rate.unitCost,
          currency: rate.currency,
          expectedNote: `Kopieret fra standard materiale (${new Date().toLocaleDateString('da-DK')})`
        });
      }
    } catch (error) {
      console.error('Error copying transport from standard:', error);
    }
  };

  return (
    <TransportContext.Provider value={{
      materialTransportRates,
      projectMaterialTransports,
      loading,
      addMaterialTransportRate,
      updateMaterialTransportRate,
      getMaterialTransportRates,
      getLatestTransportRates,
      addProjectMaterialTransport,
      updateProjectMaterialTransport,
      getProjectMaterialTransports,
      copyTransportFromStandard,
    }}>
      {children}
    </TransportContext.Provider>
  );
};