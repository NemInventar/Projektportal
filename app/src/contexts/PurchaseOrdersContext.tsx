import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from './ProjectContext';

export interface PurchaseOrder {
  id: string;
  projectId: string;
  supplierId: string;
  status: 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';
  orderDate?: Date;
  expectedDeliveryDate?: Date;
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
  deliveredDate?: Date; // faktisk leveringsdato — adskilt fra expectedDeliveryDate
  status: 'ordered' | 'confirmed' | 'delivered' | 'cancelled';
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

  // PO operations — persist to Supabase
  createPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => Promise<void>;

  // POL operations — persist to Supabase
  createPurchaseOrderLine: (line: Omit<PurchaseOrderLine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PurchaseOrderLine>;
  updatePurchaseOrderLine: (id: string, updates: Partial<PurchaseOrderLine>) => Promise<void>;

  // Helper functions
  findOrCreateDraftPO: (projectId: string, supplierId: string) => Promise<PurchaseOrder>;
  getPOLinesByMaterial: (projectMaterialId: string) => PurchaseOrderLine[];
  getPOsByProject: (projectId: string) => PurchaseOrder[];
  getTotalOrderedQty: (projectMaterialId: string) => number;
  getNextDeliveryDate: (projectMaterialId: string) => Date | null;
}

const PurchaseOrdersContext = createContext<PurchaseOrdersContextType | undefined>(undefined);

export const usePurchaseOrders = () => {
  const context = useContext(PurchaseOrdersContext);
  if (context === undefined) {
    throw new Error('usePurchaseOrders must be used within a PurchaseOrdersProvider');
  }
  return context;
};

const toDateOnly = (date?: Date) => (date ? date.toISOString().split('T')[0] : null);

const mapOrder = (o: any): PurchaseOrder => ({
  id: o.id,
  projectId: o.project_id,
  supplierId: o.supplier_id,
  status: o.status,
  orderDate: o.order_date ? new Date(o.order_date) : undefined,
  expectedDeliveryDate: o.expected_delivery_date ? new Date(o.expected_delivery_date) : undefined,
  notes: o.notes,
  createdAt: new Date(o.created_at),
  updatedAt: new Date(o.updated_at),
});

const mapLine = (l: any): PurchaseOrderLine => ({
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
  deliveredDate: l.delivered_date ? new Date(l.delivered_date) : undefined,
  status: l.status,
  notes: l.notes,
  approvalOverride: l.approval_override,
  approvalOverrideReason: l.approval_override_reason,
  approvalOverrideBy: l.approval_override_by,
  approvalOverrideAt: l.approval_override_at ? new Date(l.approval_override_at) : undefined,
  createdAt: new Date(l.created_at),
  updatedAt: new Date(l.updated_at),
});

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

      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders_2026_01_15_06_45')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: linesData, error: linesError } = await supabase
        .from('purchase_order_lines_2026_01_15_06_45')
        .select('*')
        .in('purchase_order_id', ordersData?.map(o => o.id) || [])
        .order('created_at');

      if (linesError) throw linesError;

      setPurchaseOrders((ordersData || []).map(mapOrder));
      setPurchaseOrderLines((linesData || []).map(mapLine));
    } catch (error) {
      console.error('Error loading purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseOrder = async (orderData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> => {
    const { data, error } = await supabase
      .from('purchase_orders_2026_01_15_06_45')
      .insert({
        project_id: orderData.projectId,
        supplier_id: orderData.supplierId,
        status: orderData.status,
        order_date: toDateOnly(orderData.orderDate),
        expected_delivery_date: toDateOnly(orderData.expectedDeliveryDate),
        notes: orderData.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    const newOrder = mapOrder(data);
    setPurchaseOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updatePurchaseOrder = async (id: string, updates: Partial<PurchaseOrder>) => {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.supplierId !== undefined) payload.supplier_id = updates.supplierId;
    if (updates.orderDate !== undefined) payload.order_date = toDateOnly(updates.orderDate);
    if (updates.expectedDeliveryDate !== undefined) payload.expected_delivery_date = toDateOnly(updates.expectedDeliveryDate);

    const { error } = await supabase
      .from('purchase_orders_2026_01_15_06_45')
      .update(payload)
      .eq('id', id);

    if (error) throw error;

    setPurchaseOrders(prev => prev.map(po => (po.id === id ? { ...po, ...updates, updatedAt: new Date() } : po)));
  };

  const createPurchaseOrderLine = async (lineData: Omit<PurchaseOrderLine, 'id' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrderLine> => {
    const { data, error } = await supabase
      .from('purchase_order_lines_2026_01_15_06_45')
      .insert({
        purchase_order_id: lineData.purchaseOrderId,
        project_material_id: lineData.projectMaterialId,
        supplier_id: lineData.supplierId,
        supplier_product_code: lineData.supplierProductCode || null,
        supplier_product_url: lineData.supplierProductUrl || null,
        ordered_qty: lineData.orderedQty,
        unit: lineData.unit,
        unit_price: lineData.unitPrice ?? null,
        currency: lineData.currency,
        expected_delivery_date: toDateOnly(lineData.expectedDeliveryDate),
        delivered_date: toDateOnly(lineData.deliveredDate),
        status: lineData.status,
        notes: lineData.notes || null,
        approval_override: lineData.approvalOverride || false,
        approval_override_reason: lineData.approvalOverrideReason || null,
        approval_override_by: lineData.approvalOverrideBy || null,
        approval_override_at: lineData.approvalOverrideAt ? lineData.approvalOverrideAt.toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    const newLine = mapLine(data);
    setPurchaseOrderLines(prev => [...prev, newLine]);
    return newLine;
  };

  const updatePurchaseOrderLine = async (id: string, updates: Partial<PurchaseOrderLine>) => {
    const payload: Record<string, unknown> = {};
    if (updates.orderedQty !== undefined) payload.ordered_qty = updates.orderedQty;
    if (updates.unitPrice !== undefined) payload.unit_price = updates.unitPrice;
    if (updates.supplierProductCode !== undefined) payload.supplier_product_code = updates.supplierProductCode;
    if (updates.expectedDeliveryDate !== undefined) payload.expected_delivery_date = toDateOnly(updates.expectedDeliveryDate);
    if (updates.deliveredDate !== undefined) payload.delivered_date = toDateOnly(updates.deliveredDate);
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.approvalOverride !== undefined) payload.approval_override = updates.approvalOverride;
    if (updates.approvalOverrideReason !== undefined) payload.approval_override_reason = updates.approvalOverrideReason;
    if (updates.approvalOverrideBy !== undefined) payload.approval_override_by = updates.approvalOverrideBy;
    if (updates.approvalOverrideAt !== undefined) {
      payload.approval_override_at = updates.approvalOverrideAt ? updates.approvalOverrideAt.toISOString() : null;
    }

    const { error } = await supabase
      .from('purchase_order_lines_2026_01_15_06_45')
      .update(payload)
      .eq('id', id);

    if (error) throw error;

    setPurchaseOrderLines(prev =>
      prev.map(line => (line.id === id ? { ...line, ...updates, updatedAt: new Date() } : line))
    );
  };

  const findOrCreateDraftPO = async (projectId: string, supplierId: string): Promise<PurchaseOrder> => {
    const existingDraftPO = purchaseOrders.find(
      po => po.projectId === projectId && po.supplierId === supplierId && po.status === 'draft'
    );

    if (existingDraftPO) {
      return existingDraftPO;
    }

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
    const lines = getPOLinesByMaterial(projectMaterialId).filter(line => line.status !== 'cancelled');
    return lines.reduce((total, line) => total + line.orderedQty, 0);
  };

  const getNextDeliveryDate = (projectMaterialId: string): Date | null => {
    const lines = getPOLinesByMaterial(projectMaterialId)
      .filter(line => line.expectedDeliveryDate && (line.status === 'ordered' || line.status === 'confirmed'))
      .sort((a, b) => a.expectedDeliveryDate!.getTime() - b.expectedDeliveryDate!.getTime());

    return lines.length > 0 ? lines[0].expectedDeliveryDate! : null;
  };

  return (
    <PurchaseOrdersContext.Provider
      value={{
        purchaseOrders,
        purchaseOrderLines,
        loading,
        createPurchaseOrder,
        updatePurchaseOrder,
        createPurchaseOrderLine,
        updatePurchaseOrderLine,
        findOrCreateDraftPO,
        getPOLinesByMaterial,
        getPOsByProject,
        getTotalOrderedQty,
        getNextDeliveryDate,
      }}
    >
      {children}
    </PurchaseOrdersContext.Provider>
  );
};
