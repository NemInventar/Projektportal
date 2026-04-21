import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ProjectProduct, 
  ProjectProductMaterialLine, 
  ProjectProductLaborLine, 
  ProjectProductTransportLine, 
  ProjectProductOtherCostLine,
  ProductCostCalculation 
} from '@/types/products';
import { useProject } from './ProjectContext';
import { useProjectMaterials } from './ProjectMaterialsContext';
import { useTransport } from './TransportContext';

interface ProjectProductsContextType {
  // Products
  products: ProjectProduct[];
  materialLines: ProjectProductMaterialLine[];
  laborLines: ProjectProductLaborLine[];
  transportLines: ProjectProductTransportLine[];
  otherCostLines: ProjectProductOtherCostLine[];
  loading: boolean;
  
  // Product operations
  addProduct: (product: Omit<ProjectProduct, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ProjectProduct>;
  updateProduct: (id: string, updates: Partial<ProjectProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  copyProduct: (id: string) => Promise<void>;
  
  // Material line operations
  addMaterialLine: (line: Omit<ProjectProductMaterialLine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMaterialLine: (id: string, updates: Partial<ProjectProductMaterialLine>) => Promise<void>;
  deleteMaterialLine: (id: string) => Promise<void>;
  
  // Labor line operations
  addLaborLine: (line: Omit<ProjectProductLaborLine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateLaborLine: (id: string, updates: Partial<ProjectProductLaborLine>) => Promise<void>;
  deleteLaborLine: (id: string) => Promise<void>;
  
  // Transport line operations
  addTransportLine: (line: Omit<ProjectProductTransportLine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTransportLine: (id: string, updates: Partial<ProjectProductTransportLine>) => Promise<void>;
  deleteTransportLine: (id: string) => Promise<void>;
  
  // Other cost line operations
  addOtherCostLine: (line: Omit<ProjectProductOtherCostLine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateOtherCostLine: (id: string, updates: Partial<ProjectProductOtherCostLine>) => Promise<void>;
  deleteOtherCostLine: (id: string) => Promise<void>;
  
  // Calculations
  calculateProductCost: (productId: string) => ProductCostCalculation;
  getProductMaterialLines: (productId: string) => ProjectProductMaterialLine[];
  getProductLaborLines: (productId: string) => ProjectProductLaborLine[];
  getProductTransportLines: (productId: string) => ProjectProductTransportLine[];
  getProductOtherCostLines: (productId: string) => ProjectProductOtherCostLine[];
}

const ProjectProductsContext = createContext<ProjectProductsContextType | undefined>(undefined);

export const useProjectProducts = () => {
  const context = useContext(ProjectProductsContext);
  if (context === undefined) {
    throw new Error('useProjectProducts must be used within a ProjectProductsProvider');
  }
  return context;
};

export const ProjectProductsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<ProjectProduct[]>([]);
  const [materialLines, setMaterialLines] = useState<ProjectProductMaterialLine[]>([]);
  const [laborLines, setLaborLines] = useState<ProjectProductLaborLine[]>([]);
  const [transportLines, setTransportLines] = useState<ProjectProductTransportLine[]>([]);
  const [otherCostLines, setOtherCostLines] = useState<ProjectProductOtherCostLine[]>([]);
  const [loading, setLoading] = useState(true);

  const { activeProject } = useProject();
  const { projectMaterials } = useProjectMaterials();
  const { getProjectMaterialTransports } = useTransport();

  // Load data when active project changes
  useEffect(() => {
    if (activeProject) {
      loadProductsData();
    } else {
      setProducts([]);
      setMaterialLines([]);
      setLaborLines([]);
      setTransportLines([]);
      setOtherCostLines([]);
      setLoading(false);
    }
  }, [activeProject]);

  const loadProductsData = async () => {
    if (!activeProject) return;
    
    try {
      setLoading(true);
      
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('project_products_2026_01_15_12_49')
        .select('*')
        .eq('project_id', activeProject.id)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error loading products:', productsError);
        return;
      }

      const formattedProducts = productsData.map(p => ({
        id: p.id,
        projectId: p.project_id,
        name: p.name,
        productType: p.product_type,
        unit: p.unit,
        quantity: parseFloat(p.quantity),
        description: p.description,
        notes: p.notes,
        status: p.status,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at)
      }));
      setProducts(formattedProducts);

      // Load all related lines
      await Promise.all([
        loadMaterialLines(),
        loadLaborLines(),
        loadTransportLines(),
        loadOtherCostLines()
      ]);
      
    } catch (error) {
      console.error('Error loading products data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterialLines = async () => {
    const { data, error } = await supabase
      .from('project_product_material_lines_2026_01_15_12_49')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const formatted = data.map(l => ({
        id: l.id,
        projectProductId: l.project_product_id,
        projectMaterialId: l.project_material_id,
        lineTitle: l.line_title,
        lineDescription: l.line_description,
        calcEnabled: l.calc_enabled,
        calcLengthM: l.calc_length_m ? parseFloat(l.calc_length_m) : undefined,
        calcWidthM: l.calc_width_m ? parseFloat(l.calc_width_m) : undefined,
        calcCount: l.calc_count ? parseFloat(l.calc_count) : undefined,
        baseQty: parseFloat(l.base_qty),
        wastePct: parseFloat(l.waste_pct),
        qty: parseFloat(l.qty),
        unit: l.unit,
        unitCostOverride: l.unit_cost_override ? parseFloat(l.unit_cost_override) : undefined,
        note: l.note,
        sortOrder: l.sort_order,
        createdAt: new Date(l.created_at),
        updatedAt: new Date(l.updated_at)
      }));
      setMaterialLines(formatted);
    }
  };

  const loadLaborLines = async () => {
    const { data, error } = await supabase
      .from('project_product_labor_lines_2026_01_15_12_49')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const formatted = data.map(l => ({
        id: l.id,
        projectProductId: l.project_product_id,
        laborType: l.labor_type,
        title: l.title,
        qty: parseFloat(l.qty),
        unit: l.unit,
        unitCost: parseFloat(l.unit_cost),
        note: l.note,
        sortOrder: l.sort_order,
        createdAt: new Date(l.created_at),
        updatedAt: new Date(l.updated_at)
      }));
      setLaborLines(formatted);
    }
  };

  const loadTransportLines = async () => {
    const { data, error } = await supabase
      .from('project_product_transport_lines_2026_01_15_12_49')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const formatted = data.map(l => ({
        id: l.id,
        projectProductId: l.project_product_id,
        title: l.title,
        qty: parseFloat(l.qty),
        unit: l.unit,
        unitCost: parseFloat(l.unit_cost),
        note: l.note,
        sortOrder: l.sort_order,
        createdAt: new Date(l.created_at),
        updatedAt: new Date(l.updated_at)
      }));
      setTransportLines(formatted);
    }
  };

  const loadOtherCostLines = async () => {
    const { data, error } = await supabase
      .from('project_product_other_cost_lines_2026_01_15_12_49')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const formatted = data.map(l => ({
        id: l.id,
        projectProductId: l.project_product_id,
        title: l.title,
        qty: parseFloat(l.qty),
        unit: l.unit,
        unitCost: parseFloat(l.unit_cost),
        note: l.note,
        sortOrder: l.sort_order,
        createdAt: new Date(l.created_at),
        updatedAt: new Date(l.updated_at)
      }));
      setOtherCostLines(formatted);
    }
  };

  const addProduct = async (productData: Omit<ProjectProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectProduct> => {
    try {
      console.log('Adding product:', productData);
      const { data, error } = await supabase
        .from('project_products_2026_01_15_12_49')
        .insert({
          project_id: productData.projectId,
          name: productData.name,
          product_type: productData.productType,
          unit: productData.unit,
          quantity: productData.quantity,
          description: productData.description,
          notes: productData.notes,
          status: productData.status
        })
        .select()
        .single();

      console.log('Supabase insert response:', { data, error });
      if (error) throw error;

      const newProduct: ProjectProduct = {
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        productType: data.product_type,
        unit: data.unit,
        quantity: parseFloat(data.quantity),
        description: data.description,
        notes: data.notes,
        status: data.status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setProducts(prev => [newProduct, ...prev]);
      return newProduct;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<ProjectProduct>) => {
    try {
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.productType) updateData.product_type = updates.productType;
      if (updates.unit) updateData.unit = updates.unit;
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.status) updateData.status = updates.status;

      const { error } = await supabase
        .from('project_products_2026_01_15_12_49')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.map(product => 
        product.id === id ? { ...product, ...updates, updatedAt: new Date() } : product
      ));
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_products_2026_01_15_12_49')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(product => product.id !== id));
      // Related lines will be deleted by CASCADE
      setMaterialLines(prev => prev.filter(line => line.projectProductId !== id));
      setLaborLines(prev => prev.filter(line => line.projectProductId !== id));
      setTransportLines(prev => prev.filter(line => line.projectProductId !== id));
      setOtherCostLines(prev => prev.filter(line => line.projectProductId !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  };

  const copyProduct = async (id: string) => {
    try {
      const originalProduct = products.find(p => p.id === id);
      if (!originalProduct) return;

      // Create new product
      const newProductData = {
        ...originalProduct,
        name: `${originalProduct.name} (Kopi)`,
        projectId: originalProduct.projectId
      };
      delete (newProductData as any).id;
      delete (newProductData as any).createdAt;
      delete (newProductData as any).updatedAt;

      const newProduct = await addProduct(newProductData);
      
      // Copy all lines
      const productMaterialLines = getProductMaterialLines(id);
      const productLaborLines = getProductLaborLines(id);
      const productTransportLines = getProductTransportLines(id);
      const productOtherCostLines = getProductOtherCostLines(id);

      // Copy material lines
      for (const line of productMaterialLines) {
        const newLineData = { ...line, projectProductId: newProduct.id };
        delete (newLineData as any).id;
        delete (newLineData as any).createdAt;
        delete (newLineData as any).updatedAt;
        await addMaterialLine(newLineData);
      }

      // Copy labor lines
      for (const line of productLaborLines) {
        const newLineData = { ...line, projectProductId: newProduct.id };
        delete (newLineData as any).id;
        delete (newLineData as any).createdAt;
        delete (newLineData as any).updatedAt;
        await addLaborLine(newLineData);
      }

      // Copy transport lines
      for (const line of productTransportLines) {
        const newLineData = { ...line, projectProductId: newProduct.id };
        delete (newLineData as any).id;
        delete (newLineData as any).createdAt;
        delete (newLineData as any).updatedAt;
        await addTransportLine(newLineData);
      }

      // Copy other cost lines
      for (const line of productOtherCostLines) {
        const newLineData = { ...line, projectProductId: newProduct.id };
        delete (newLineData as any).id;
        delete (newLineData as any).createdAt;
        delete (newLineData as any).updatedAt;
        await addOtherCostLine(newLineData);
      }
    } catch (error) {
      console.error('Error copying product:', error);
      throw error;
    }
  };

  // Material line operations
  const addMaterialLine = async (lineData: Omit<ProjectProductMaterialLine, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .insert({
          project_product_id: lineData.projectProductId,
          project_material_id: lineData.projectMaterialId,
          line_title: lineData.lineTitle,
          line_description: lineData.lineDescription,
          calc_enabled: lineData.calcEnabled,
          calc_length_m: lineData.calcLengthM,
          calc_width_m: lineData.calcWidthM,
          calc_count: lineData.calcCount,
          base_qty: lineData.baseQty,
          waste_pct: lineData.wastePct,
          qty: lineData.qty,
          unit: lineData.unit,
          unit_cost_override: lineData.unitCostOverride,
          note: lineData.note,
          sort_order: lineData.sortOrder
        })
        .select()
        .single();

      if (error) throw error;

      const newLine: ProjectProductMaterialLine = {
        id: data.id,
        projectProductId: data.project_product_id,
        projectMaterialId: data.project_material_id,
        lineTitle: data.line_title,
        lineDescription: data.line_description,
        calcEnabled: data.calc_enabled,
        calcLengthM: data.calc_length_m ? parseFloat(data.calc_length_m) : undefined,
        calcWidthM: data.calc_width_m ? parseFloat(data.calc_width_m) : undefined,
        calcCount: data.calc_count ? parseFloat(data.calc_count) : undefined,
        baseQty: parseFloat(data.base_qty),
        wastePct: parseFloat(data.waste_pct),
        qty: parseFloat(data.qty),
        unit: data.unit,
        unitCostOverride: data.unit_cost_override ? parseFloat(data.unit_cost_override) : undefined,
        note: data.note,
        sortOrder: data.sort_order,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setMaterialLines(prev => [...prev, newLine]);
    } catch (error) {
      console.error('Error adding material line:', error);
      throw error;
    }
  };

  const updateMaterialLine = async (id: string, updates: Partial<ProjectProductMaterialLine>) => {
    try {
      const updateData: any = {};
      if (updates.lineTitle) updateData.line_title = updates.lineTitle;
      if (updates.lineDescription !== undefined) updateData.line_description = updates.lineDescription;
      if (updates.calcEnabled !== undefined) updateData.calc_enabled = updates.calcEnabled;
      if (updates.calcLengthM !== undefined) updateData.calc_length_m = updates.calcLengthM;
      if (updates.calcWidthM !== undefined) updateData.calc_width_m = updates.calcWidthM;
      if (updates.calcCount !== undefined) updateData.calc_count = updates.calcCount;
      if (updates.baseQty !== undefined) updateData.base_qty = updates.baseQty;
      if (updates.wastePct !== undefined) updateData.waste_pct = updates.wastePct;
      if (updates.qty !== undefined) updateData.qty = updates.qty;
      if (updates.unitCostOverride !== undefined) updateData.unit_cost_override = updates.unitCostOverride;
      if (updates.note !== undefined) updateData.note = updates.note;
      if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

      const { error } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setMaterialLines(prev => prev.map(line => 
        line.id === id ? { ...line, ...updates, updatedAt: new Date() } : line
      ));
    } catch (error) {
      console.error('Error updating material line:', error);
      throw error;
    }
  };

  const deleteMaterialLine = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMaterialLines(prev => prev.filter(line => line.id !== id));
    } catch (error) {
      console.error('Error deleting material line:', error);
      throw error;
    }
  };

  // Labor line operations (similar pattern)
  const addLaborLine = async (lineData: Omit<ProjectProductLaborLine, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('project_product_labor_lines_2026_01_15_12_49')
        .insert({
          project_product_id: lineData.projectProductId,
          labor_type: lineData.laborType,
          title: lineData.title,
          qty: lineData.qty,
          unit: lineData.unit,
          unit_cost: lineData.unitCost,
          note: lineData.note,
          sort_order: lineData.sortOrder
        })
        .select()
        .single();

      if (error) throw error;

      const newLine: ProjectProductLaborLine = {
        id: data.id,
        projectProductId: data.project_product_id,
        laborType: data.labor_type,
        title: data.title,
        qty: parseFloat(data.qty),
        unit: data.unit,
        unitCost: parseFloat(data.unit_cost),
        note: data.note,
        sortOrder: data.sort_order,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setLaborLines(prev => [...prev, newLine]);
    } catch (error) {
      console.error('Error adding labor line:', error);
      throw error;
    }
  };

  const updateLaborLine = async (id: string, updates: Partial<ProjectProductLaborLine>) => {
    try {
      const updateData: any = {};
      if (updates.laborType) updateData.labor_type = updates.laborType;
      if (updates.title) updateData.title = updates.title;
      if (updates.qty !== undefined) updateData.qty = updates.qty;
      if (updates.unit) updateData.unit = updates.unit;
      if (updates.unitCost !== undefined) updateData.unit_cost = updates.unitCost;
      if (updates.note !== undefined) updateData.note = updates.note;
      if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

      const { error } = await supabase
        .from('project_product_labor_lines_2026_01_15_12_49')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setLaborLines(prev => prev.map(line => 
        line.id === id ? { ...line, ...updates, updatedAt: new Date() } : line
      ));
    } catch (error) {
      console.error('Error updating labor line:', error);
      throw error;
    }
  };

  const deleteLaborLine = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_product_labor_lines_2026_01_15_12_49')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLaborLines(prev => prev.filter(line => line.id !== id));
    } catch (error) {
      console.error('Error deleting labor line:', error);
      throw error;
    }
  };

  // Transport line operations
  const addTransportLine = async (lineData: Omit<ProjectProductTransportLine, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('project_product_transport_lines_2026_01_15_12_49')
        .insert({
          project_product_id: lineData.projectProductId,
          title: lineData.title,
          qty: lineData.qty,
          unit: lineData.unit,
          unit_cost: lineData.unitCost,
          note: lineData.note,
          sort_order: lineData.sortOrder
        })
        .select()
        .single();

      if (error) throw error;

      const newLine: ProjectProductTransportLine = {
        id: data.id,
        projectProductId: data.project_product_id,
        title: data.title,
        qty: parseFloat(data.qty),
        unit: data.unit,
        unitCost: parseFloat(data.unit_cost),
        note: data.note,
        sortOrder: data.sort_order,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setTransportLines(prev => [...prev, newLine]);
    } catch (error) {
      console.error('Error adding transport line:', error);
      throw error;
    }
  };

  const updateTransportLine = async (id: string, updates: Partial<ProjectProductTransportLine>) => {
    try {
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.qty !== undefined) updateData.qty = updates.qty;
      if (updates.unit) updateData.unit = updates.unit;
      if (updates.unitCost !== undefined) updateData.unit_cost = updates.unitCost;
      if (updates.note !== undefined) updateData.note = updates.note;
      if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

      const { error } = await supabase
        .from('project_product_transport_lines_2026_01_15_12_49')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setTransportLines(prev => prev.map(line => 
        line.id === id ? { ...line, ...updates, updatedAt: new Date() } : line
      ));
    } catch (error) {
      console.error('Error updating transport line:', error);
      throw error;
    }
  };

  const deleteTransportLine = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_product_transport_lines_2026_01_15_12_49')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransportLines(prev => prev.filter(line => line.id !== id));
    } catch (error) {
      console.error('Error deleting transport line:', error);
      throw error;
    }
  };

  // Other cost line operations
  const addOtherCostLine = async (lineData: Omit<ProjectProductOtherCostLine, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('project_product_other_cost_lines_2026_01_15_12_49')
        .insert({
          project_product_id: lineData.projectProductId,
          title: lineData.title,
          qty: lineData.qty,
          unit: lineData.unit,
          unit_cost: lineData.unitCost,
          note: lineData.note,
          sort_order: lineData.sortOrder
        })
        .select()
        .single();

      if (error) throw error;

      const newLine: ProjectProductOtherCostLine = {
        id: data.id,
        projectProductId: data.project_product_id,
        title: data.title,
        qty: parseFloat(data.qty),
        unit: data.unit,
        unitCost: parseFloat(data.unit_cost),
        note: data.note,
        sortOrder: data.sort_order,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setOtherCostLines(prev => [...prev, newLine]);
    } catch (error) {
      console.error('Error adding other cost line:', error);
      throw error;
    }
  };

  const updateOtherCostLine = async (id: string, updates: Partial<ProjectProductOtherCostLine>) => {
    try {
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.qty !== undefined) updateData.qty = updates.qty;
      if (updates.unit) updateData.unit = updates.unit;
      if (updates.unitCost !== undefined) updateData.unit_cost = updates.unitCost;
      if (updates.note !== undefined) updateData.note = updates.note;
      if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

      const { error } = await supabase
        .from('project_product_other_cost_lines_2026_01_15_12_49')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setOtherCostLines(prev => prev.map(line => 
        line.id === id ? { ...line, ...updates, updatedAt: new Date() } : line
      ));
    } catch (error) {
      console.error('Error updating other cost line:', error);
      throw error;
    }
  };

  const deleteOtherCostLine = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_product_other_cost_lines_2026_01_15_12_49')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOtherCostLines(prev => prev.filter(line => line.id !== id));
    } catch (error) {
      console.error('Error deleting other cost line:', error);
      throw error;
    }
  };

  // Helper functions
  const getProductMaterialLines = (productId: string) => {
    return materialLines.filter(line => line.projectProductId === productId);
  };

  const getProductLaborLines = (productId: string) => {
    return laborLines.filter(line => line.projectProductId === productId);
  };

  const getProductTransportLines = (productId: string) => {
    return transportLines.filter(line => line.projectProductId === productId);
  };

  const getProductOtherCostLines = (productId: string) => {
    return otherCostLines.filter(line => line.projectProductId === productId);
  };

  const calculateProductCost = (productId: string): ProductCostCalculation => {
    const productMaterialLines = getProductMaterialLines(productId);
    const productLaborLines = getProductLaborLines(productId);
    const productTransportLines = getProductTransportLines(productId);
    const productOtherCostLines = getProductOtherCostLines(productId);

    // Calculate material costs with breakdown
    let materialProductCost = 0;
    let materialWasteCost = 0;
    let materialTransportCost = 0;

    productMaterialLines.forEach(line => {
      const material = projectMaterials.find(m => m.id === line.projectMaterialId);
      if (material) {
        const unitCost = line.unitCostOverride ?? material.unitPrice;
        
        // Base product cost (without waste)
        const baseProductCost = line.baseQty * unitCost;
        materialProductCost += baseProductCost;
        
        // Waste cost (difference between total qty and base qty)
        const wasteCost = (line.qty - line.baseQty) * unitCost;
        materialWasteCost += wasteCost;

        // Calculate transport cost for this material
        const materialTransports = getProjectMaterialTransports(line.projectMaterialId);
        const transportPerUnit = materialTransports
          .filter(t => t.expectedCostModel === 'per_unit')
          .reduce((sum, t) => sum + t.expectedUnitCost, 0);
        
        materialTransportCost += line.qty * transportPerUnit;
      }
    });
    
    const totalMaterialCost = materialProductCost + materialWasteCost;

    // Calculate labor costs
    const laborCosts = {
      production: 0,
      dkInstallation: 0,
      other: 0,
      total: 0
    };

    productLaborLines.forEach(line => {
      const lineCost = line.qty * line.unitCost;
      laborCosts.total += lineCost;
      
      switch (line.laborType) {
        case 'production':
          laborCosts.production += lineCost;
          break;
        case 'dk_installation':
          laborCosts.dkInstallation += lineCost;
          break;
        case 'other':
          laborCosts.other += lineCost;
          break;
      }
    });

    // Calculate transport costs (product level)
    const transportCosts = {
      total: productTransportLines.reduce((sum, line) => sum + (line.qty * line.unitCost), 0)
    };

    // Calculate other costs
    const otherCosts = {
      total: productOtherCostLines.reduce((sum, line) => sum + (line.qty * line.unitCost), 0)
    };

    const materialCosts = {
      materialCost: totalMaterialCost,
      productCost: materialProductCost,
      wasteCost: materialWasteCost,
      transportCost: materialTransportCost,
      total: totalMaterialCost + materialTransportCost
    };

    const grandTotal = materialCosts.total + laborCosts.total + transportCosts.total + otherCosts.total;

    return {
      materialCosts,
      laborCosts,
      transportCosts,
      otherCosts,
      grandTotal
    };
  };

  return (
    <ProjectProductsContext.Provider value={{
      products,
      materialLines,
      laborLines,
      transportLines,
      otherCostLines,
      loading,
      addProduct,
      updateProduct,
      deleteProduct,
      copyProduct,
      addMaterialLine,
      updateMaterialLine,
      deleteMaterialLine,
      addLaborLine,
      updateLaborLine,
      deleteLaborLine,
      addTransportLine,
      updateTransportLine,
      deleteTransportLine,
      addOtherCostLine,
      updateOtherCostLine,
      deleteOtherCostLine,
      calculateProductCost,
      getProductMaterialLines,
      getProductLaborLines,
      getProductTransportLines,
      getProductOtherCostLines,
    }}>
      {children}
    </ProjectProductsContext.Provider>
  );
};