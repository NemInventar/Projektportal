import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from './ProjectContext';

export interface ProjectMaterialApproval {
  id: string;
  type: 'production' | 'sustainability';
  status: 'approved' | 'not_approved';
  comment?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ProjectMaterialOrder {
  id: string;
  projectMaterialId: string;
  orderDate: Date;
  supplierId: string;
  orderedQuantity: number;
  expectedDelivery?: Date;
  status: 'ordered' | 'received' | 'partially_received';
  comment?: string;
  createdAt: Date;
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  standardMaterialId?: string; // Reference to standard material
  name: string;
  category: string;
  unit: string;
  notes?: string; // Project-specific notes
  
  // Supplier & Price (project-specific)
  supplierId?: string;
  supplierProductCode?: string;
  supplierProductUrl?: string;
  unitPrice?: number;
  currency: string;
  priceStatus: 'not_confirmed' | 'confirmed';
  priceNote?: string;
  
  // Approvals
  approvals: ProjectMaterialApproval[];
  
  // Orders - DEPRECATED but kept for migration
  orders: ProjectMaterialOrder[];
  
  // Derived values (calculated from PO lines)
  orderedQtyTotal?: number;
  nextDeliveryDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectMaterialsContextType {
  projectMaterials: ProjectMaterial[];
  loading: boolean;
  setProjectMaterials: (materials: ProjectMaterial[]) => void;
  addProjectMaterial: (material: Omit<ProjectMaterial, 'id' | 'createdAt' | 'updatedAt' | 'approvals' | 'orders'>) => Promise<void>;
  updateProjectMaterial: (id: string, updates: Partial<ProjectMaterial>) => Promise<void>;
  removeProjectMaterial: (id: string) => Promise<void>;
  addApproval: (materialId: string, approval: Omit<ProjectMaterialApproval, 'id'>) => void;
  updateApproval: (materialId: string, approvalId: string, updates: Partial<ProjectMaterialApproval>) => void;
  
  // DEPRECATED: Use PurchaseOrdersContext instead
  // addOrder: (order: Omit<ProjectMaterialOrder, 'id' | 'createdAt'>) => void;
  // updateOrder: (orderId: string, updates: Partial<ProjectMaterialOrder>) => void;
  
  getApprovalStatus: (materialId: string) => 'not_approved' | 'partially_approved' | 'fully_approved';
  isFullyApproved: (materialId: string) => boolean;
  validateOrderCreation: (materialId: string) => { canOrder: boolean; reason?: string };
  getTotalOrderedQuantity: (materialId: string) => number;
  getNextExpectedDelivery: (materialId: string) => Date | null;
}

const ProjectMaterialsContext = createContext<ProjectMaterialsContextType | undefined>(undefined);

export const useProjectMaterials = () => {
  const context = useContext(ProjectMaterialsContext);
  if (context === undefined) {
    throw new Error('useProjectMaterials must be used within a ProjectMaterialsProvider');
  }
  return context;
};

// Mock data for demonstration
const mockProjectMaterials: ProjectMaterial[] = [
  {
    id: '1',
    projectId: '1', // Køkkenrenovering Villa Skovvej
    standardMaterialId: '1',
    name: 'Krydsfiner Birk 18mm',
    category: 'Plademateriale',
    unit: 'm²',
    notes: 'Til køkkenlåger - skal være A-kvalitet',
    supplierId: '1',
    supplierProductCode: 'KF-BIRK-18-A',
    unitPrice: 295.00,
    currency: 'DKK',
    priceStatus: 'confirmed',
    priceNote: 'Pris bekræftet med Bygma d. 15/1',
    approvals: [
      {
        id: '1',
        type: 'production',
        status: 'approved',
        comment: 'Kvalitet godkendt til køkkenprojekt',
        approvedBy: 'Lars Tømrer',
        approvedAt: new Date('2024-01-16'),
      },
      {
        id: '2',
        type: 'sustainability',
        status: 'not_approved',
        comment: 'Afventer FSC-certifikat dokumentation',
        approvedBy: undefined,
        approvedAt: undefined,
      }
    ],
    orders: [
      {
        id: '1',
        projectMaterialId: '1',
        orderDate: new Date('2024-01-18'),
        supplierId: '1',
        orderedQuantity: 15,
        expectedDelivery: new Date('2024-01-25'),
        status: 'ordered',
        comment: 'Første delbestilling til køkkenlåger',
        createdAt: new Date('2024-01-18'),
      }
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: '2',
    projectId: '1',
    standardMaterialId: '2',
    name: 'Skruer 4x50mm rustfri',
    category: 'Beslag & Skruer',
    unit: 'stk',
    supplierId: '2',
    unitPrice: 0.90,
    currency: 'DKK',
    priceStatus: 'not_confirmed',
    priceNote: 'Afventer pristilbud fra XL-BYG',
    approvals: [],
    orders: [],
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
  },
];

const mockOrders: ProjectMaterialOrder[] = [
  {
    id: '1',
    projectMaterialId: '1',
    orderDate: new Date('2024-01-18'),
    supplierId: '1',
    orderedQuantity: 15,
    expectedDelivery: new Date('2024-01-25'),
    status: 'ordered',
    comment: 'Første delbestilling til køkkenlåger',
    createdAt: new Date('2024-01-18'),
  }
];



export const ProjectMaterialsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeProject } = useProject();
  const [projectMaterials, setProjectMaterials] = useState<ProjectMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  // Load project materials when active project changes
  useEffect(() => {
    if (activeProject) {
      loadProjectMaterials(activeProject.id);
    } else {
      setProjectMaterials([]);
      setLoading(false);
    }
  }, [activeProject]);

  const loadProjectMaterials = async (projectId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .select(`
          *,
          project_material_approvals_2026_01_15_06_45(*)
        `)
        .eq('project_id', projectId)
        .order('name');

      if (!error && data) {
        const formatted = data.map(m => ({
          id: m.id,
          projectId: m.project_id,
          standardMaterialId: m.standard_material_id,
          name: m.name,
          category: m.category,
          unit: m.unit,
          notes: m.notes,
          supplierId: m.supplier_id,
          supplierProductCode: m.supplier_product_code,
          supplierProductUrl: m.supplier_product_url,
          unitPrice: m.unit_price ? parseFloat(m.unit_price) : undefined,
          currency: m.currency,
          priceStatus: m.price_status,
          priceNote: m.price_note,
          approvals: m.project_material_approvals_2026_01_15_06_45?.map((a: any) => ({
            id: a.id,
            type: a.type,
            status: a.status,
            comment: a.comment,
            approvedBy: a.approved_by,
            approvedAt: a.approved_at ? new Date(a.approved_at) : undefined
          })) || [],
          orders: [], // Deprecated - use PO system
          createdAt: new Date(m.created_at),
          updatedAt: new Date(m.updated_at)
        }));
        setProjectMaterials(formatted);
      }
    } catch (error) {
      console.error('Error loading project materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProjectMaterial = async (materialData: Omit<ProjectMaterial, 'id' | 'createdAt' | 'updatedAt' | 'approvals' | 'orders'>) => {
    try {
      console.log('addProjectMaterial called with:', materialData);
      
      // Clean and validate data
      const insertData = {
        project_id: materialData.projectId,
        standard_material_id: materialData.standardMaterialId || null,
        name: materialData.name,
        category: materialData.category,
        unit: materialData.unit,
        notes: materialData.notes || null,
        supplier_id: materialData.supplierId || null,
        supplier_product_code: materialData.supplierProductCode || null,
        supplier_product_url: materialData.supplierProductUrl || null,
        unit_price: materialData.unitPrice || null,
        currency: materialData.currency,
        price_status: materialData.priceStatus,
        price_note: materialData.priceNote || null
      };
      
      console.log('Cleaned insert data:', insertData);
      
      // Insert project material
      const { data: materialData_result, error: materialError } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .insert(insertData)
        .select()
        .single();

      if (materialError) {
        console.error('Error inserting material:', materialError);
        throw materialError;
      }

      console.log('Material inserted successfully:', materialData_result);
      
      // Skip approvals for now - just get basic import working
      console.log('Skipping approvals creation for now');
      
      // Reload project materials to get the new data
      if (activeProject) {
        console.log('Reloading project materials...');
        await loadProjectMaterials(activeProject.id);
        console.log('Project materials reloaded successfully');
      }
    } catch (error) {
      console.error('Error adding project material:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      throw error;
    }
  };

  const updateProjectMaterial = async (id: string, updates: Partial<ProjectMaterial>) => {
    try {
      console.log('Updating project material:', id, updates);
      
      // Update in Supabase
      const { data, error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .update({
          name: updates.name,
          category: updates.category,
          unit: updates.unit,
          notes: updates.notes,
          supplier_id: updates.supplierId,
          supplier_product_code: updates.supplierProductCode,
          supplier_product_url: updates.supplierProductUrl,
          unit_price: updates.unitPrice,
          currency: updates.currency,
          price_status: updates.priceStatus,
          price_note: updates.priceNote
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating material:', error);
        throw error;
      }

      console.log('Material updated successfully in Supabase:', data);
      
      // Update local state
      setProjectMaterials(prev => prev.map(material => 
        material.id === id 
          ? { ...material, ...updates, updatedAt: new Date() }
          : material
      ));
      
      console.log('Local state updated');
    } catch (error) {
      console.error('Error updating project material:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      throw error;
    }
  };

  const removeProjectMaterial = async (id: string) => {
    try {
      console.log('Attempting to delete project material with id:', id);
      
      // First delete related purchase order lines
      const { error: poLinesError } = await supabase
        .from('purchase_order_lines_2026_01_15_06_45')
        .delete()
        .eq('project_material_id', id);

      if (poLinesError) {
        console.error('Error deleting purchase order lines:', poLinesError);
        // Don't throw - continue with deletion
      }
      
      // Then delete related approvals
      const { error: approvalsError } = await supabase
        .from('project_material_approvals_2026_01_15_06_45')
        .delete()
        .eq('project_material_id', id);

      if (approvalsError) {
        console.error('Error deleting approvals:', approvalsError);
        // Don't throw - continue with deletion
      }

      // Then delete the material
      const { error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting material:', error);
        throw error;
      }

      console.log('Material deleted successfully from Supabase');
      
      // Update local state
      setProjectMaterials(prev => prev.filter(material => material.id !== id));
      console.log('Local state updated');
    } catch (error) {
      console.error('Error removing project material:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      
      // Check if it's a foreign key constraint error
      if (error.code === '23503' && error.details?.includes('purchase_order_lines')) {
        throw new Error('Dette materiale kan ikke slettes da det allerede er bestilt i en indkøbsordre. Slet først indkøbsordren eller fjern materialet fra ordren.');
      }
      
      throw error;
    }
  };

  const addApproval = (materialId: string, approvalData: Omit<ProjectMaterialApproval, 'id'>) => {
    const newApproval: ProjectMaterialApproval = {
      ...approvalData,
      id: Date.now().toString(),
    };
    
    setProjectMaterials(prev => 
      prev.map(material => 
        material.id === materialId 
          ? { 
              ...material, 
              approvals: [...material.approvals.filter(a => a.type !== approvalData.type), newApproval],
              updatedAt: new Date() 
            }
          : material
      )
    );
  };

  const updateApproval = (materialId: string, approvalId: string, updates: Partial<ProjectMaterialApproval>) => {
    setProjectMaterials(prev => 
      prev.map(material => 
        material.id === materialId 
          ? { 
              ...material, 
              approvals: material.approvals.map(approval =>
                approval.id === approvalId ? { ...approval, ...updates } : approval
              ),
              updatedAt: new Date() 
            }
          : material
      )
    );
  };

  const getTotalOrderedQuantity = (materialId: string): number => {
    const material = projectMaterials.find(m => m.id === materialId);
    if (!material) return 0;
    
    return material.orders.reduce((total, order) => total + order.orderedQuantity, 0);
  };

  const getNextExpectedDelivery = (materialId: string): Date | null => {
    const material = projectMaterials.find(m => m.id === materialId);
    if (!material) return null;
    
    const upcomingOrders = material.orders
      .filter(order => order.expectedDelivery && order.status === 'ordered')
      .sort((a, b) => (a.expectedDelivery!.getTime() - b.expectedDelivery!.getTime()));
    
    return upcomingOrders.length > 0 ? upcomingOrders[0].expectedDelivery! : null;
  };

  const getApprovalStatus = (materialId: string): 'not_approved' | 'partially_approved' | 'fully_approved' => {
    const material = projectMaterials.find(m => m.id === materialId);
    if (!material) return 'not_approved';
    
    const approvedCount = material.approvals.filter(a => a.status === 'approved').length;
    
    if (approvedCount === 0) return 'not_approved';
    if (approvedCount === 1) return 'partially_approved';
    return 'fully_approved';
  };

  // DEPRECATED: These functions moved to PurchaseOrdersContext
  // const getTotalOrderedQuantity = ...
  // const getNextExpectedDelivery = ...

  const isFullyApproved = (materialId: string): boolean => {
    return getApprovalStatus(materialId) === 'fully_approved';
  };

  const validateOrderCreation = (materialId: string): { canOrder: boolean; reason?: string } => {
    const material = projectMaterials.find(m => m.id === materialId);
    if (!material) {
      return { canOrder: false, reason: 'Materiale ikke fundet' };
    }

    const approvalStatus = getApprovalStatus(materialId);
    if (approvalStatus !== 'fully_approved') {
      const productionApproval = material.approvals.find(a => a.type === 'production');
      const sustainabilityApproval = material.approvals.find(a => a.type === 'sustainability');
      
      const missingApprovals = [];
      if (productionApproval?.status !== 'approved') {
        missingApprovals.push('Produktionsgodkendelse');
      }
      if (sustainabilityApproval?.status !== 'approved') {
        missingApprovals.push('DGNB/Bæredygtighedsgodkendelse');
      }
      
      return {
        canOrder: false,
        reason: `Du kan ikke bestille dette materiale før både ${missingApprovals.join(' og ')} er gennemført.`
      };
    }

    return { canOrder: true };
  };

  return (
    <ProjectMaterialsContext.Provider value={{
      projectMaterials,
      loading,
      setProjectMaterials,
      addProjectMaterial,
      updateProjectMaterial,
      removeProjectMaterial,
      addApproval,
      updateApproval,
      getApprovalStatus,
      isFullyApproved,
      validateOrderCreation,
      getTotalOrderedQuantity,
      getNextExpectedDelivery,
    }}>
      {children}
    </ProjectMaterialsContext.Provider>
  );
};