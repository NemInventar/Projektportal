import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from './ProjectContext';

export interface PurchaseOrder {
  id: string;
  projectId: string;
  supplierId: string;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  orderDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  projectMaterialId: string;
  supplierId: string; // snapshot
  supplierProductCode?: string; // snapshot
  supplierProductUrl?: string; // snapshot
  orderedQty: number;
  unit: string; // snapshot
  unitPrice?: number; // snapshot
  currency: string; // snapshot
  expectedDeliveryDate?: Date;
  status: 'ordered' | 'partially_received' | 'received';
  notes?: string;
  // Approval override fields
  approvalOverride?: boolean;
  approvalOverrideReason?: string;
  approvalOverrideBy?: string;
  approvalOverrideAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface PurchaseOrdersContextType {
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  loading: boolean;
  setPurchaseOrders: (orders: PurchaseOrder[]) => void;
  setPurchaseOrderLines: (lines: PurchaseOrderLine[]) => void;
  
  // PO operations
  createPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => PurchaseOrder;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  
  // POL operations
  createPurchaseOrderLine: (line: Omit<PurchaseOrderLine, 'id' | 'createdAt' | 'updatedAt'>) => PurchaseOrderLine;
  updatePurchaseOrderLine: (id: string, updates: Partial<PurchaseOrderLine>) => void;
  
  // Helper functions
  findOrCreateDraftPO: (projectId: string, supplierId: string) => PurchaseOrder;
  getPOLinesByMaterial: (projectMaterialId: string) => PurchaseOrderLine[];
  getPOsByProject: (projectId: string) => PurchaseOrder[];
  getTotalOrderedQty: (projectMaterialId: string) => number;
  getNextDeliveryDate: (projectMaterialId: string) => Date | null;
  
  // Migration function
  migrateMaterialOrders: () => void;
}

const PurchaseOrdersContext = createContext<PurchaseOrdersContextType | undefined>(undefined);

export const usePurchaseOrders = () => {
  const context = useContext(PurchaseOrdersContext);
  if (context === undefined) {
    throw new Error('usePurchaseOrders must be used within a PurchaseOrdersProvider');
  }
  return context;
};

// Mock data - will be populated by migration
const mockPurchaseOrders: PurchaseOrder[] = [];
const mockPurchaseOrderLines: PurchaseOrderLine[] = [];

// Helper functions for localStorage


export const PurchaseOrdersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeProject } = useProject();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderLines, setPurchaseOrderLines] = useState<PurchaseOrderLine[]>([]);
  const [loading, setLoading] = useState(true);

  // Load purchase orders when active project changes
  useEffect(() => {
    if (activeProject) {
      loadPurchaseOrders(activeProject.id);
    } else {
      setPurchaseOrders([]);
      setPurchaseOrderLines([]);
      setLoading(false);
    }
  }, [activeProject]);

  const loadPurchaseOrders = async (projectId: string) => {
    try {
      setLoading(true);
      
      // Load purchase orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders_2026_01_15_06_45')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Load purchase order lines
      const { data: linesData, error: linesError } = await supabase
        .from('purchase_order_lines_2026_01_15_06_45')
        .select('*')
        .in('purchase_order_id', ordersData?.map(o => o.id) || [])
        .order('created_at');

      if (linesError) throw linesError;

      // Format orders
      const formattedOrders = ordersData?.map(o => ({
        id: o.id,
        projectId: o.project_id,
        supplierId: o.supplier_id,
        status: o.status,
        orderDate: o.order_date ? new Date(o.order_date) : undefined,
        notes: o.notes,
        createdAt: new Date(o.created_at),
        updatedAt: new Date(o.updated_at)
      })) || [];

      // Format lines
      const formattedLines = linesData?.map(l => ({
        id: l.id,
        purchaseOrderId: l.purchase_order_id,
        projectMaterialId: l.project_material_id,
        supplierId: l.supplier_id,
        supplierProductCode: l.supplier_product_code,
        supplierProductUrl: l.supplier_product_url,
        orderedQty: parseFloat(l.ordered_qty),
        unit: l.unit,
        unitPrice: l.unit_price ? parseFloat(l.unit_price) : undefined,
        currency: l.currency,
        expectedDeliveryDate: l.expected_delivery_date ? new Date(l.expected_delivery_date) : undefined,
        status: l.status,
        notes: l.notes,
        approvalOverride: l.approval_override,
        approvalOverrideReason: l.approval_override_reason,
        approvalOverrideBy: l.approval_override_by,
        approvalOverrideAt: l.approval_override_at ? new Date(l.approval_override_at) : undefined,
        createdAt: new Date(l.created_at),
        updatedAt: new Date(l.updated_at)
      })) || [];

      setPurchaseOrders(formattedOrders);
      setPurchaseOrderLines(formattedLines);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseOrder = (orderData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): PurchaseOrder => {
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: `po_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const updatedOrders = [...purchaseOrders, newOrder];
    setPurchaseOrders(updatedOrders);
    return newOrder;
  };

  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => {
    const updatedOrders = purchaseOrders.map(order => 
      order.id === id 
        ? { ...order, ...updates, updatedAt: new Date() }
        : order
    );
    setPurchaseOrders(updatedOrders);
  };

  const createPurchaseOrderLine = (lineData: Omit<PurchaseOrderLine, 'id' | 'createdAt' | 'updatedAt'>): PurchaseOrderLine => {
    const newLine: PurchaseOrderLine = {
      ...lineData,
      id: `pol_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const updatedLines = [...purchaseOrderLines, newLine];
    setPurchaseOrderLines(updatedLines);
    return newLine;
  };

  const updatePurchaseOrderLine = (id: string, updates: Partial<PurchaseOrderLine>) => {
    setPurchaseOrderLines(prev => 
      prev.map(line => 
        line.id === id 
          ? { ...line, ...updates, updatedAt: new Date() }
          : line
      )
    );
  };

  const findOrCreateDraftPO = (projectId: string, supplierId: string): PurchaseOrder => {
    // Find existing draft PO
    const existingDraftPO = purchaseOrders.find(po => 
      po.projectId === projectId && 
      po.supplierId === supplierId && 
      po.status === 'draft'
    );
    
    if (existingDraftPO) {
      return existingDraftPO;
    }
    
    // Create new draft PO
    return createPurchaseOrder({
      projectId,
      supplierId,
      status: 'draft',
    });
  };

  const getPOLinesByMaterial = (projectMaterialId: string): PurchaseOrderLine[] => {
    return purchaseOrderLines.filter(line => line.projectMaterialId === projectMaterialId);
  };

  const getPOsByProject = (projectId: string): PurchaseOrder[] => {
    return purchaseOrders.filter(po => po.projectId === projectId);
  };

  const getTotalOrderedQty = (projectMaterialId: string): number => {
    const lines = getPOLinesByMaterial(projectMaterialId);
    return lines.reduce((total, line) => total + line.orderedQty, 0);
  };

  const getNextDeliveryDate = (projectMaterialId: string): Date | null => {
    const lines = getPOLinesByMaterial(projectMaterialId)
      .filter(line => line.expectedDeliveryDate && line.status === 'ordered')
      .sort((a, b) => (a.expectedDeliveryDate!.getTime() - b.expectedDeliveryDate!.getTime()));
    
    return lines.length > 0 ? lines[0].expectedDeliveryDate! : null;
  };

  const migrateMaterialOrders = (projectMaterials: any[]) => {
    console.log('Starting migration of material orders to PO/POL structure...');
    
    // Clear existing PO data
    setPurchaseOrders([]);
    setPurchaseOrderLines([]);
    
    const newPOs: PurchaseOrder[] = [];
    const newPOLs: PurchaseOrderLine[] = [];
    
    projectMaterials.forEach(material => {
      if (material.orders && material.orders.length > 0) {
        material.orders.forEach((order: any) => {
          // Find or create PO for this supplier + project
          let po = newPOs.find(p => 
            p.projectId === material.projectId && 
            p.supplierId === order.supplierId &&
            p.status === 'draft'
          );
          
          if (!po) {
            po = {
              id: `po_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              projectId: material.projectId,
              supplierId: order.supplierId,
              status: order.status === 'ordered' ? 'ordered' : 'draft',
              orderDate: order.orderDate,
              createdAt: order.createdAt || new Date(),
              updatedAt: new Date(),
            };
            newPOs.push(po);
          }
          
          // Create POL
          const pol: PurchaseOrderLine = {
            id: `pol_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            purchaseOrderId: po.id,
            projectMaterialId: material.id,
            supplierId: order.supplierId,
            supplierProductCode: material.supplierProductCode,
            supplierProductUrl: material.supplierProductUrl,
            orderedQty: order.orderedQuantity,
            unit: material.unit,
            unitPrice: material.unitPrice,
            currency: material.currency || 'DKK',
            expectedDeliveryDate: order.expectedDelivery,
            status: order.status === 'ordered' ? 'ordered' : 'ordered',
            notes: order.comment,
            createdAt: order.createdAt || new Date(),
            updatedAt: new Date(),
          };
          newPOLs.push(pol);
        });
      }
    });
    
    setPurchaseOrders(newPOs);
    setPurchaseOrderLines(newPOLs);
    
    console.log(`Migration completed: ${newPOs.length} POs, ${newPOLs.length} POLs created`);
  };

  return (
    <PurchaseOrdersContext.Provider value={{
      purchaseOrders,
      purchaseOrderLines,
      loading,
      setPurchaseOrders,
      setPurchaseOrderLines,
      createPurchaseOrder,
      updatePurchaseOrder,
      createPurchaseOrderLine,
      updatePurchaseOrderLine,
      findOrCreateDraftPO,
      getPOLinesByMaterial,
      getPOsByProject,
      getTotalOrderedQty,
      getNextDeliveryDate,
      migrateMaterialOrders,
    }}>
      {children}
    </PurchaseOrdersContext.Provider>
  );
};