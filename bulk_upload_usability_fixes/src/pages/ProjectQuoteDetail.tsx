import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Plus, 
  ChevronDown,
  ChevronRight,
  Calculator,
  Package,
  Trash2,
  Edit,
  GripVertical,
  Archive,
  FileText,
  ExternalLink,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';

interface QuoteLine {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  displayOrder?: number;
  createdAt: string;
  pricing?: QuoteLinePricing;
  items: QuoteLineItem[];
}

interface QuoteLineItem {
  id: string;
  sourceType: 'project_product' | 'custom';
  projectProductId?: string;
  title: string;
  qty: number;
  unit: string;
  costBreakdown: CostBreakdown;
  costTotalPerUnit: number;
}

interface CostBreakdown {
  materials: number;
  transport: number;
  labor_production: number;
  labor_dk: number;
  other: number;
}

interface QuoteLinePricing {
  pricingMode: 'markup_pct' | 'gross_margin_pct' | 'target_unit_price' | 'profit_by_category';
  markupPct?: number;
  grossMarginPct?: number;
  targetUnitPrice?: number;
  riskPerUnit: number;
  profitByCategory?: {
    materials?: number;
    material_transport?: number;
    product_transport?: number;
    labor_production?: number;
    labor_dk?: number;
    other?: number;
  };
}

const ProjectQuoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { products, calculateProductCost } = useProjectProducts();
  
  // Utility function for currency formatting
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // State
  const [quote, setQuote] = useState<any>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [transferringToBudget, setTransferringToBudget] = useState(false);
  const [relatedBudgets, setRelatedBudgets] = useState<any[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [deletingLine, setDeletingLine] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [productUpdates, setProductUpdates] = useState<{[key: string]: any}>({});
  
  // Delete/Archive confirmation states
  const [showDeleteLineConfirm, setShowDeleteLineConfirm] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<string | null>(null);
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showUpdateWarnings, setShowUpdateWarnings] = useState(true);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [showAddLineModal, setShowAddLineModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [selectedLineForItems, setSelectedLineForItems] = useState<string | null>(null);
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<string | null>(null);
  const [productQuantity, setProductQuantity] = useState<number>(1);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  
  // Drag and drop state
  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  
  // Product search and filter state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  
  // Material summary data (Q-V1-10)
  const [productMaterialLines, setProductMaterialLines] = useState<any[]>([]);
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
  
  // Update all prices state
  const [updatingAllPrices, setUpdatingAllPrices] = useState(false);
  const [showUpdateAllConfirm, setShowUpdateAllConfirm] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  
  // Form data for new line
  const [lineFormData, setLineFormData] = useState({
    title: '',
    description: '',
    quantity: 1,
    unit: 'stk'
  });

  // Form data for pricing
  const [pricingFormData, setPricingFormData] = useState({
    pricingMode: 'markup_pct' as const,
    markupPct: 25,
    grossMarginPct: 20,
    targetUnitPrice: 0,
    riskPerUnit: 0,
    profitByCategory: {
      materials: 30,
      material_transport: 30,
      product_transport: 30,
      labor_production: 30,
      labor_dk: 30,
      other: 30
    }
  });

  // Form data for custom item
  const [customItemFormData, setCustomItemFormData] = useState({
    title: '',
    qty: 1,
    unit: 'stk',
    totalCostPerUnit: 0
  });

  // Form data for editing line
  const [editLineFormData, setEditLineFormData] = useState({
    title: '',
    description: '',
    quantity: 1,
    unit: 'stk'
  });

  // Form data for editing item
  const [editItemFormData, setEditItemFormData] = useState({
    title: '',
    qty: 1,
    unit: 'stk',
    totalCostPerUnit: 0
  });

  useEffect(() => {
    if (id && activeProject) {
      loadQuoteData();
    }
  }, [id, activeProject]);

  // Tjek for produktopdateringer når data er indlæst
  useEffect(() => {
    if (lines.length > 0) {
      checkForProductUpdates();
    }
  }, [lines]);

  // Load material data for material summary (Q-V1-10)
  useEffect(() => {
    if (lines.length > 0) {
      loadMaterialData(lines);
    }
  }, [lines]);

  const loadQuoteData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Load quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .select('*')
        .eq('id', id)
        .single();

      if (quoteError) throw quoteError;
      setQuote(quoteData);

      // Load quote lines with pricing and items
      const { data: linesData, error: linesError } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .select(`
          *,
          project_quote_line_pricing_2026_01_16_23_00(*),
          project_quote_line_items_2026_01_16_23_00(*)
        `)
        .eq('project_quote_id', id)
        .neq('archived', true)
        .order('display_order', { nullsLast: true })
        .order('created_at');

      if (linesError) throw linesError;

      if (linesData) {
        // Tildel automatisk display_order til linjer der mangler det
        const hasUpdatedOrders = await assignMissingDisplayOrders(linesData);
        
        // Hvis vi opdaterede display_order, genindlæs data
        let finalLinesData = linesData;
        if (hasUpdatedOrders) {
          const { data: refreshedData } = await supabase
            .from('project_quote_lines_2026_01_16_23_00')
            .select(`
              *,
              project_quote_line_pricing_2026_01_16_23_00(*),
              project_quote_line_items_2026_01_16_23_00(*)
            `)
            .eq('project_quote_id', id)
            .neq('archived', true)
            .order('display_order', { nullsLast: true })
            .order('created_at');
          finalLinesData = refreshedData || linesData;
        }
        
        const formattedLines = finalLinesData.map(line => ({
          id: line.id,
          title: line.title,
          description: line.description,
          quantity: parseFloat(line.quantity),
          unit: line.unit,
          sortOrder: line.sort_order,
          displayOrder: line.display_order,
          createdAt: line.created_at,
          pricing: line.project_quote_line_pricing_2026_01_16_23_00?.[0] ? {
            pricingMode: line.project_quote_line_pricing_2026_01_16_23_00[0].pricing_mode,
            markupPct: line.project_quote_line_pricing_2026_01_16_23_00[0].markup_pct,
            grossMarginPct: line.project_quote_line_pricing_2026_01_16_23_00[0].gross_margin_pct,
            targetUnitPrice: line.project_quote_line_pricing_2026_01_16_23_00[0].target_unit_price,
            riskPerUnit: parseFloat(line.project_quote_line_pricing_2026_01_16_23_00[0].risk_per_unit || 0),
            profitByCategory: line.project_quote_line_pricing_2026_01_16_23_00[0].profit_by_category_json || {}
          } : undefined,
          items: line.project_quote_line_items_2026_01_16_23_00?.map((item: any) => ({
            id: item.id,
            sourceType: item.source_type,
            projectProductId: item.project_product_id,
            title: item.title,
            qty: parseFloat(item.qty),
            unit: item.unit,
            costBreakdown: item.cost_breakdown_json || { materials: 0, transport: 0, labor_production: 0, labor_dk: 0, other: 0 },
            costTotalPerUnit: parseFloat(item.cost_total_per_unit || 0)
          })) || []
        }));
        setLines(formattedLines);
      }
      
      // Load related budgets
      await loadRelatedBudgets(id);
    } catch (error) {
      console.error('Error loading quote data:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse tilbudsdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load related budgets
  const loadRelatedBudgets = async (quoteId: string) => {
    try {
      const { data: budgetsData, error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .select('id, budget_number, title, status')
        .eq('source_quote_id', quoteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRelatedBudgets(budgetsData || []);
    } catch (error) {
      console.error('Error loading related budgets:', error);
      setRelatedBudgets([]);
    }
  };

  // Load material data for material summary (Q-V1-10)
  const loadMaterialData = async (quoteLines: QuoteLine[]) => {
    try {
      // Get all product IDs from quote line items
      const productIds = new Set<string>();
      quoteLines.forEach(line => {
        line.items?.forEach(item => {
          if (item.sourceType === 'project_product' && item.projectProductId) {
            productIds.add(item.projectProductId);
          }
        });
      });

      if (productIds.size === 0) {
        setProductMaterialLines([]);
        setProjectMaterials([]);
        return;
      }

      // Fetch product material lines for these products
      const { data: materialLinesData, error: materialLinesError } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .select('*')
        .in('project_product_id', Array.from(productIds));

      if (materialLinesError) throw materialLinesError;

      // Get unique material IDs
      const materialIds = new Set<string>();
      materialLinesData?.forEach(line => {
        if (line.project_material_id) {
          materialIds.add(line.project_material_id);
        }
      });

      // Fetch project materials
      if (materialIds.size > 0) {
        const { data: materialsData, error: materialsError } = await supabase
          .from('project_materials_2026_01_15_06_45')
          .select('*')
          .in('id', Array.from(materialIds));

        if (materialsError) throw materialsError;
        setProjectMaterials(materialsData || []);
      } else {
        setProjectMaterials([]);
      }

      setProductMaterialLines(materialLinesData || []);
    } catch (error) {
      console.error('Error loading material data:', error);
      setProductMaterialLines([]);
      setProjectMaterials([]);
    }
  };


  // Update quote metadata
  const updateQuoteMetadata = async (updates: any) => {
    if (!quote?.id) return;
    
    try {
      setSavingMetadata(true);
      
      const { error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .update(updates)
        .eq('id', quote.id);

      if (error) throw error;

      // Update local state
      setQuote((prev: any) => ({ ...prev, ...updates }));
      
      toast({
        title: "Metadata opdateret",
        description: "Tilbuddets metadata er blevet gemt",
      });
    } catch (error) {
      console.error('Error updating quote metadata:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering af metadata",
        variant: "destructive",
      });
    } finally {
      setSavingMetadata(false);
    }
  };

  // Transfer accepted quote to budget
  const transferToBudget = async () => {
    if (!quote?.id || !activeProject?.id || quote.status !== 'accepted') {
      toast({
        title: "Fejl",
        description: "Kun accepterede tilbud kan overføres til budget",
        variant: "destructive",
      });
      return;
    }

    try {
      setTransferringToBudget(true);

      // 1. Opret project_budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .insert({
          project_id: activeProject.id,
          source_quote_id: quote.id,
          budget_number: `B-${quote.quote_number || new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
          title: `Budget fra ${quote.title}`,
          status: 'active'
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      const budgetId = budgetData.id;

      // 2. Opret project_budget_lines for hver quote line
      for (const line of lines) {
        const lineTotals = calculateLineTotals(line);
        
        // Opret budget line
        const { data: budgetLineData, error: budgetLineError } = await supabase
          .from('project_budget_lines_2026_01_22_00_00')
          .insert({
            project_budget_id: budgetId,
            source_quote_line_id: line.id,
            title: line.title,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            sort_order: line.sortOrder || 0,
            locked_sell_total: lineTotals.totalSellingPrice,
            baseline_cost_total: 0, // Will be calculated from baseline items
            baseline_cost_breakdown_json: {},
            baseline_risk_total: lineTotals.riskPerUnit * line.quantity || 0
          })
          .select()
          .single();

        if (budgetLineError) throw budgetLineError;

        const budgetLineId = budgetLineData.id;
        let baselineCostTotal = 0;
        const baselineCostBreakdown: any = {};

        // 3. For hver quote line item: opret baseline og current budget line items
        for (const item of line.items) {
          // Hent produktdata hvis det er et projektprodukt
          let productData = null;
          if (item.sourceType === 'project_product' && item.projectProductId) {
            const { data } = await supabase
              .from('project_products_2026_01_15_06_45')
              .select('updated_at')
              .eq('id', item.projectProductId)
              .single();
            productData = data;
          }

          const snapshotUpdatedAt = productData?.updated_at || new Date().toISOString();
          const snapshotCostBreakdown = item.costBreakdown || {};
          const snapshotCostTotal = item.costTotalPerUnit || 0;

          // Opret baseline item
          const { error: baselineError } = await supabase
            .from('project_budget_line_items_2026_01_22_00_00')
            .insert({
              project_budget_line_id: budgetLineId,
              source_quote_line_item_id: item.id,
              source_type: item.sourceType,
              project_product_id: item.projectProductId,
              title: item.title,
              qty: item.qty,
              unit: item.unit,
              mode: 'baseline',
              baseline_cost_breakdown_json: snapshotCostBreakdown,
              baseline_cost_total_per_unit: snapshotCostTotal,
              product_snapshot_updated_at: snapshotUpdatedAt,
              snapshot_cost_breakdown_json: snapshotCostBreakdown,
              snapshot_cost_total_per_unit: snapshotCostTotal
            });

          if (baselineError) throw baselineError;

          // Opret current item (kopi af baseline)
          const { error: currentError } = await supabase
            .from('project_budget_line_items_2026_01_22_00_00')
            .insert({
              project_budget_line_id: budgetLineId,
              source_quote_line_item_id: item.id,
              source_type: item.sourceType,
              project_product_id: item.projectProductId,
              title: item.title,
              qty: item.qty,
              unit: item.unit,
              mode: 'current',
              baseline_cost_breakdown_json: snapshotCostBreakdown,
              baseline_cost_total_per_unit: snapshotCostTotal,
              product_snapshot_updated_at: snapshotUpdatedAt,
              snapshot_cost_breakdown_json: snapshotCostBreakdown,
              snapshot_cost_total_per_unit: snapshotCostTotal
            });

          if (currentError) throw currentError;

          // Akkumuler baseline totals
          baselineCostTotal += snapshotCostTotal * item.qty;
          
          // Akkumuler breakdown
          Object.keys(snapshotCostBreakdown).forEach(key => {
            baselineCostBreakdown[key] = (baselineCostBreakdown[key] || 0) + 
              (snapshotCostBreakdown[key] * item.qty);
          });
        }

        // 4. Opdater budget line med korrekte baseline totals
        const { error: updateLineError } = await supabase
          .from('project_budget_lines_2026_01_22_00_00')
          .update({
            baseline_cost_total: baselineCostTotal,
            baseline_cost_breakdown_json: baselineCostBreakdown
          })
          .eq('id', budgetLineId);

        if (updateLineError) throw updateLineError;
      }

      toast({
        title: "Budget oprettet",
        description: `Tilbuddet er overført til budget: ${budgetData.title}`,
      });

      // Reload related budgets to show the new one
      await loadRelatedBudgets(quote.id);
      
      // Navigate til budget
      navigate(`/project/budgets/${budgetId}`);
      
    } catch (error) {
      console.error('Error transferring to budget:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved overførsel til budget",
        variant: "destructive",
      });
    } finally {
      setTransferringToBudget(false);
    }
  };

  // Automatisk tildeling af display_order for linjer der mangler det
  const assignMissingDisplayOrders = async (quoteLinesData: any[]) => {
    const linesWithoutDisplayOrder = quoteLinesData.filter(line => line.display_order === null || line.display_order === undefined);
    
    if (linesWithoutDisplayOrder.length === 0) return false;

    try {
      // Find højeste eksisterende display_order
      const maxDisplayOrder = Math.max(
        ...quoteLinesData
          .filter(line => line.display_order !== null && line.display_order !== undefined)
          .map(line => line.display_order),
        0
      );

      // Sorter linjer uden display_order efter created_at
      const sortedLinesWithoutOrder = linesWithoutDisplayOrder.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Tildel display_order værdier
      const updates = sortedLinesWithoutOrder.map((line, index) => ({
        id: line.id,
        display_order: maxDisplayOrder + index + 1
      }));

      // Opdater database
      for (const update of updates) {
        await supabase
          .from('project_quote_lines_2026_01_16_23_00')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      console.log(`Tildelt display_order til ${updates.length} tilbudslinjer`);
      return true;
    } catch (error) {
      console.error('Fejl ved tildeling af display_order:', error);
      return false;
    }
  };

  // Filtrer og sorter produkter
  const getFilteredProducts = () => {
    return products
      .filter(product => {
        // Filtrer arkiverede produkter ud
        if (product.status === 'archived') return false;
        
        // Tekstsøgning
        const matchesSearch = productSearchTerm === '' || 
          product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(productSearchTerm.toLowerCase()));
        
        // Type filter
        const matchesType = productTypeFilter === 'all' || product.type === productTypeFilter;
        
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        // Sorter efter navn
        return a.name.localeCompare(b.name, 'da-DK');
      });
  };

  const toggleLineExpansion = (lineId: string) => {
    const newExpanded = new Set(expandedLines);
    if (newExpanded.has(lineId)) {
      newExpanded.delete(lineId);
    } else {
      newExpanded.add(lineId);
    }
    setExpandedLines(newExpanded);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, lineId: string) => {
    setDraggedLineId(lineId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, lineId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLineId(lineId);
  };

  const handleDragLeave = () => {
    setDragOverLineId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    
    if (!draggedLineId || draggedLineId === targetLineId) {
      setDraggedLineId(null);
      setDragOverLineId(null);
      return;
    }

    try {
      // Find the dragged and target lines
      const draggedLine = lines.find(line => line.id === draggedLineId);
      const targetLine = lines.find(line => line.id === targetLineId);
      
      if (!draggedLine || !targetLine) return;

      // Create new order for all lines using display_order
      const sortedLines = [...lines].sort((a, b) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const draggedIndex = sortedLines.findIndex(line => line.id === draggedLineId);
      const targetIndex = sortedLines.findIndex(line => line.id === targetLineId);
      
      // Remove dragged line and insert at target position
      const reorderedLines = [...sortedLines];
      const [removed] = reorderedLines.splice(draggedIndex, 1);
      reorderedLines.splice(targetIndex, 0, removed);
      
      // Update display_order for all affected lines
      const updates = reorderedLines.map((line, index) => ({
        id: line.id,
        displayOrder: index + 1
      }));

      // Update database
      for (const update of updates) {
        await supabase
          .from('project_quote_lines_2026_01_16_23_00')
          .update({ display_order: update.displayOrder })
          .eq('id', update.id);
      }

      // Reload data to reflect changes
      await loadQuoteData();
      
      toast({
        title: "Rækkefølge opdateret",
        description: "Tilbudslinjernes rækkefølge er blevet gemt."
      });
      
    } catch (error) {
      console.error('Error reordering lines:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere rækkefølgen.",
        variant: "destructive"
      });
    } finally {
      setDraggedLineId(null);
      setDragOverLineId(null);
    }
  };

  const calculateLineTotals = (line: QuoteLine) => {
    // Calculate total cost breakdown from all items in the line
    const totalCostBreakdown = line.items.reduce((acc, item) => {
      // Standardiseret cost_breakdown_json struktur - ignorer gamle keys
      const itemCost = item.costBreakdown || { materials: 0, material_transport: 0, product_transport: 0, labor_production: 0, labor_dk: 0, other: 0 };
      
      // Backward compatibility - hvis gamle struktur findes
      const materials = itemCost.materials || 0;
      const materialTransport = itemCost.material_transport || 0;
      const productTransport = itemCost.product_transport || itemCost.transport || 0; // Fallback til gamle transport key
      const laborProduction = itemCost.labor_production || 0;
      const laborDk = itemCost.labor_dk || 0;
      const other = itemCost.other || 0;
      
      return {
        materials: acc.materials + (materials * item.qty),
        material_transport: acc.material_transport + (materialTransport * item.qty),
        product_transport: acc.product_transport + (productTransport * item.qty),
        labor_production: acc.labor_production + (laborProduction * item.qty),
        labor_dk: acc.labor_dk + (laborDk * item.qty),
        other: acc.other + (other * item.qty)
      };
    }, { materials: 0, material_transport: 0, product_transport: 0, labor_production: 0, labor_dk: 0, other: 0 });
    
    // Convert to per unit costs med standardiseret struktur
    const costBreakdownPerUnit = {
      materials: totalCostBreakdown.materials / line.quantity,
      material_transport: totalCostBreakdown.material_transport / line.quantity,
      product_transport: totalCostBreakdown.product_transport / line.quantity,
      labor_production: totalCostBreakdown.labor_production / line.quantity,
      labor_dk: totalCostBreakdown.labor_dk / line.quantity,
      other: totalCostBreakdown.other / line.quantity
    };
    
    const baseCostPerUnit = Object.values(costBreakdownPerUnit).reduce((sum, cost) => sum + cost, 0);
    
    // Add risk
    const riskPerUnit = line.pricing?.riskPerUnit || 0;
    const totalCostPerUnit = baseCostPerUnit + riskPerUnit;
    
    // Calculate selling price based on pricing mode
    let sellingPricePerUnit = totalCostPerUnit;
    
    if (line.pricing) {
      switch (line.pricing.pricingMode) {
        case 'markup_pct':
          if (line.pricing.markupPct) {
            sellingPricePerUnit = totalCostPerUnit * (1 + line.pricing.markupPct / 100);
          }
          break;
        case 'gross_margin_pct':
          if (line.pricing.grossMarginPct) {
            sellingPricePerUnit = totalCostPerUnit / (1 - line.pricing.grossMarginPct / 100);
          }
          break;
        case 'target_unit_price':
          if (line.pricing.targetUnitPrice) {
            sellingPricePerUnit = line.pricing.targetUnitPrice;
          }
          break;
        case 'profit_by_category':
          if (line.pricing.profitByCategory) {
            // Beregn salgspris baseret på profit pr. kategori
            let totalSellPrice = 0;
            const categories = ['materials', 'material_transport', 'product_transport', 'labor_production', 'labor_dk', 'other'];
            
            categories.forEach(category => {
              const costForCategory = costBreakdownPerUnit[category] || 0;
              const profitPct = line.pricing.profitByCategory[category] || 0;
              const sellPriceForCategory = costForCategory * (1 + profitPct / 100);
              totalSellPrice += sellPriceForCategory;
            });
            
            sellingPricePerUnit = totalSellPrice;
          }
          break;
      }
    }
    
    const profitPerUnit = sellingPricePerUnit - totalCostPerUnit;
    const dbPercent = totalCostPerUnit > 0 ? (profitPerUnit / sellingPricePerUnit) * 100 : 0;
    
    return {
      baseCostPerUnit,
      riskPerUnit,
      totalCostPerUnit,
      sellingPricePerUnit,
      profitPerUnit,
      dbPercent,
      totalCost: totalCostPerUnit * line.quantity,
      totalSellingPrice: sellingPricePerUnit * line.quantity,
      totalProfit: profitPerUnit * line.quantity,
      costBreakdown: costBreakdownPerUnit,
      costPercentages: {
        materials: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.materials / sellingPricePerUnit) * 100 : 0,
        material_transport: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.material_transport / sellingPricePerUnit) * 100 : 0,
        product_transport: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.product_transport / sellingPricePerUnit) * 100 : 0,
        labor_production: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.labor_production / sellingPricePerUnit) * 100 : 0,
        labor_dk: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.labor_dk / sellingPricePerUnit) * 100 : 0,
        other: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.other / sellingPricePerUnit) * 100 : 0,
        risk: sellingPricePerUnit > 0 ? (riskPerUnit / sellingPricePerUnit) * 100 : 0,
        profit: sellingPricePerUnit > 0 ? (profitPerUnit / sellingPricePerUnit) * 100 : 0
      }
    };
  };

  const handleAddLine = async () => {
    if (!quote || !lineFormData.title) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the highest display_order for new line positioning
      const maxDisplayOrder = Math.max(...lines.map(l => l.displayOrder || 0), 0);
      
      const lineData = {
        project_quote_id: quote.id,
        title: lineFormData.title,
        description: lineFormData.description || null,
        quantity: lineFormData.quantity,
        unit: lineFormData.unit,
        sort_order: lines.length,
        display_order: maxDisplayOrder + 1
      };

      const { data: newLine, error: lineError } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .insert(lineData)
        .select()
        .single();

      if (lineError) throw lineError;

      // Create default pricing
      const pricingData = {
        project_quote_line_id: newLine.id,
        pricing_mode: 'markup_pct',
        markup_pct: 25,
        risk_per_unit: 0
      };

      const { error: pricingError } = await supabase
        .from('project_quote_line_pricing_2026_01_16_23_00')
        .insert(pricingData);

      if (pricingError) throw pricingError;

      toast({
        title: "Linje tilføjet",
        description: "Tilbudslinjen er blevet oprettet",
      });

      setShowAddLineModal(false);
      setLineFormData({ title: '', description: '', quantity: 1, unit: 'stk' });
      loadQuoteData();
    } catch (error) {
      console.error('Error adding line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved oprettelse",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePricing = async (lineId: string) => {
    // Validering af pricing inputs
    if (pricingFormData.pricingMode === 'markup_pct' && (pricingFormData.markupPct < 0 || pricingFormData.markupPct > 1000)) {
      toast({
        title: "Ugyldig markup",
        description: "Markup skal være mellem 0% og 1000%",
        variant: "destructive",
      });
      return;
    }
    
    if (pricingFormData.pricingMode === 'gross_margin_pct' && (pricingFormData.grossMarginPct < 0 || pricingFormData.grossMarginPct >= 100)) {
      toast({
        title: "Ugyldig DB%",
        description: "DB% skal være mellem 0% og 99%",
        variant: "destructive",
      });
      return;
    }
    
    if (pricingFormData.pricingMode === 'target_unit_price' && pricingFormData.targetUnitPrice <= 0) {
      toast({
        title: "Ugyldig salgspris",
        description: "Salgspris skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    if (pricingFormData.riskPerUnit < 0) {
      toast({
        title: "Ugyldig risk",
        description: "Risk kan ikke være negativ",
        variant: "destructive",
      });
      return;
    }

    setSavingPricing(true);
    try {
      const updateData = {
        pricing_mode: pricingFormData.pricingMode,
        markup_pct: pricingFormData.pricingMode === 'markup_pct' ? pricingFormData.markupPct : null,
        gross_margin_pct: pricingFormData.pricingMode === 'gross_margin_pct' ? pricingFormData.grossMarginPct : null,
        target_unit_price: pricingFormData.pricingMode === 'target_unit_price' ? pricingFormData.targetUnitPrice : null,
        risk_per_unit: pricingFormData.riskPerUnit
      };

      const { error } = await supabase
        .from('project_quote_line_pricing_2026_01_16_23_00')
        .update(updateData)
        .eq('project_quote_line_id', lineId);

      if (error) throw error;

      toast({
        title: "Prisfastsættelse opdateret",
        description: "Prisindstillingerne er blevet gemt",
      });

      setEditingPricing(null);
      loadQuoteData();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    } finally {
      setSavingPricing(false);
    }
  };

  const handleAddProductItem = async (productId: string, quantity: number = 1) => {
    if (!selectedLineForItems) return;

    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      // KORREKT COST SNAPSHOT BEREGNING - Step Q-V1-02
      console.log('Beregner cost snapshot for produkt:', product.name);
      
      // 2.1 Materialer (fra product material lines)
      const { data: materialLines, error: materialError } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .select(`
          qty,
          unit_cost_override,
          project_material_id,
          project_materials_2026_01_15_06_45(
            unit_price,
            transport_estimated_cost
          )
        `)
        .eq('project_product_id', productId);
      
      if (materialError) {
        console.error('Fejl ved hentning af material lines:', materialError);
      }
      
      let materials = 0;
      let materialTransport = 0;
      
      if (materialLines) {
        for (const line of materialLines) {
          const qty = line.qty || 0;
          let unitCost = 0;
          
          // Brug unit_cost_override hvis ikke null, ellers unit_price fra material
          if (line.unit_cost_override !== null) {
            unitCost = line.unit_cost_override;
          } else if (line.project_materials_2026_01_15_06_45?.unit_price) {
            unitCost = line.project_materials_2026_01_15_06_45.unit_price;
          }
          
          const lineCost = qty * unitCost;
          materials += lineCost;
          
          // Material transport (én gang pr material-line)
          const transportCost = line.project_materials_2026_01_15_06_45?.transport_estimated_cost || 0;
          materialTransport += transportCost;
        }
      }
      
      // 2.2 Labor (fra labor lines)
      const { data: laborLines, error: laborError } = await supabase
        .from('project_product_labor_lines_2026_01_15_12_49')
        .select('qty, unit_cost, labor_type')
        .eq('project_product_id', productId);
      
      if (laborError) {
        console.error('Fejl ved hentning af labor lines:', laborError);
      }
      
      let laborProduction = 0;
      let laborDk = 0;
      let otherLabor = 0;
      
      if (laborLines) {
        for (const line of laborLines) {
          const lineCost = (line.qty || 0) * (line.unit_cost || 0);
          
          if (line.labor_type === 'production') {
            laborProduction += lineCost;
          } else if (line.labor_type === 'dk_installation') {
            laborDk += lineCost;
          } else if (line.labor_type === 'other') {
            otherLabor += lineCost;
          }
        }
      }
      
      // 2.3 Produkttransport
      const { data: transportLines, error: transportError } = await supabase
        .from('project_product_transport_lines_2026_01_15_12_49')
        .select('qty, unit_cost')
        .eq('project_product_id', productId);
      
      if (transportError) {
        console.error('Fejl ved hentning af transport lines:', transportError);
      }
      
      let productTransport = 0;
      if (transportLines) {
        productTransport = transportLines.reduce((sum, line) => {
          return sum + ((line.qty || 0) * (line.unit_cost || 0));
        }, 0);
      }
      
      // 2.4 Øvrigt
      const { data: otherLines, error: otherError } = await supabase
        .from('project_product_other_cost_lines_2026_01_15_12_49')
        .select('qty, unit_cost')
        .eq('project_product_id', productId);
      
      if (otherError) {
        console.error('Fejl ved hentning af other cost lines:', otherError);
      }
      
      let otherCosts = 0;
      if (otherLines) {
        otherCosts = otherLines.reduce((sum, line) => {
          return sum + ((line.qty || 0) * (line.unit_cost || 0));
        }, 0);
      }
      
      // 2.6 Samlet transport og other
      const transport = materialTransport + productTransport;
      const other = otherCosts + otherLabor;
      
      // 2.7 Standardiseret cost_breakdown_json struktur (Step Q-V1-02b)
      const costBreakdown = {
        materials: materials,
        material_transport: materialTransport,
        product_transport: productTransport,
        labor_production: laborProduction,
        labor_dk: laborDk,
        other: other
      };
      
      console.log('Beregnet cost breakdown:', costBreakdown);
      
      const totalCost = Object.values(costBreakdown).reduce((sum, cost) => sum + cost, 0);
      console.log('Total cost per unit:', totalCost);
      
      // 4) Fejlhåndtering - vis advarsel hvis cost er 0
      if (totalCost === 0) {
        console.warn('Cost snapshot er 0 - mangler priser eller qty');
      }

      const itemData = {
        project_quote_line_id: selectedLineForItems,
        source_type: 'project_product',
        project_product_id: productId,
        title: product.name,
        qty: quantity,
        unit: product.unit || 'stk',
        cost_breakdown_json: costBreakdown,
        cost_total_per_unit: totalCost
      };

      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .insert(itemData);

      if (error) throw error;

      toast({
        title: "Produkt tilføjet",
        description: `${product.name} er tilføjet til linjen`,
      });

      setShowAddItemModal(false);
      setSelectedLineForItems(null);
      setSelectedProductForAdd(null);
      setProductQuantity(1);
      loadQuoteData();
    } catch (error) {
      console.error('Error adding product item:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved tilføjelse",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomItem = async () => {
    if (!selectedLineForItems || !customItemFormData.title.trim()) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    if (customItemFormData.qty <= 0) {
      toast({
        title: "Ugyldig antal",
        description: "Antal skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    
    if (customItemFormData.totalCostPerUnit < 0) {
      toast({
        title: "Ugyldig total cost",
        description: "Total cost kan ikke være negativ",
        variant: "destructive",
      });
      return;
    }
    
    if (!customItemFormData.unit.trim()) {
      toast({
        title: "Fejl",
        description: "Enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      // For custom costs, always place cost under 'other' category
      const costBreakdown = {
        materials: 0,
        material_transport: 0,
        product_transport: 0,
        labor_production: 0,
        labor_dk: 0,
        other: customItemFormData.totalCostPerUnit
      };

      const itemData = {
        project_quote_line_id: selectedLineForItems,
        source_type: 'custom',
        title: customItemFormData.title,
        qty: customItemFormData.qty,
        unit: customItemFormData.unit,
        cost_breakdown_json: costBreakdown,
        cost_total_per_unit: customItemFormData.totalCostPerUnit
      };

      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .insert(itemData);

      if (error) throw error;

      toast({
        title: "Custom item tilføjet",
        description: `${customItemFormData.title} er tilføjet til linjen`,
      });

      setShowCustomItemModal(false);
      setSelectedLineForItems(null);
      setCustomItemFormData({ title: '', qty: 1, unit: 'stk', totalCostPerUnit: 0 });
      loadQuoteData();
    } catch (error) {
      console.error('Error adding custom item:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved tilføjelse",
        variant: "destructive",
      });
    }
  };

  const checkForProductUpdates = async () => {
    if (!lines.length) return;
    
    setCheckingUpdates(true);
    try {
      const productItems = lines.flatMap(line => 
        line.items.filter(item => item.sourceType === 'project_product' && item.projectProductId)
      );
      
      if (productItems.length === 0) return;
      
      const productIds = productItems.map(item => item.projectProductId).filter(Boolean);
      
      const { data: currentProducts, error } = await supabase
        .from('project_products_2026_01_15_12_49')
        .select('*')
        .in('id', productIds);
        
      if (error) throw error;
      
      const updates: {[key: string]: any} = {};
      
      // Sammenlign snapshot med aktuelle priser fra produktdata
      for (const item of productItems) {
        const currentProduct = currentProducts?.find(p => p.id === item.projectProductId);
        if (currentProduct) {
          // Beregn aktuelle costs fra produktets lines (samme logik som i opdater pris)
          let currentMaterialCost = 0;
          let currentMaterialTransport = 0;
          let currentProductTransport = 0;
          let currentLaborProduction = 0;
          let currentLaborDk = 0;
          let currentOther = 0;
          
          // Hent detaljerede data for produktet
          const { data: detailedProduct } = await supabase
            .from('project_products_2026_01_15_12_49')
            .select(`
              project_product_material_lines_2026_01_15_12_49(
                qty, unit_cost_override,
                project_materials_2026_01_15_06_45(unit_price, transport_estimated_cost)
              ),
              project_product_labor_lines_2026_01_15_12_49(qty, unit_cost, labor_type),
              project_product_transport_lines_2026_01_15_12_49(qty, unit_cost),
              project_product_other_cost_lines_2026_01_15_12_49(qty, unit_cost)
            `)
            .eq('id', item.projectProductId)
            .single();
          
          if (detailedProduct) {
            // Beregn materialer
            detailedProduct.project_product_material_lines_2026_01_15_12_49?.forEach(line => {
              const qty = line.qty || 0;
              const unitCost = line.unit_cost_override || line.project_materials_2026_01_15_06_45?.unit_price || 0;
              currentMaterialCost += qty * unitCost;
              currentMaterialTransport += line.project_materials_2026_01_15_06_45?.transport_estimated_cost || 0;
            });
            
            // Beregn labor
            detailedProduct.project_product_labor_lines_2026_01_15_12_49?.forEach(line => {
              const lineCost = (line.qty || 0) * (line.unit_cost || 0);
              if (line.labor_type === 'production') currentLaborProduction += lineCost;
              else if (line.labor_type === 'dk_installation') currentLaborDk += lineCost;
              else currentOther += lineCost;
            });
            
            // Beregn transport
            currentProductTransport = detailedProduct.project_product_transport_lines_2026_01_15_12_49?.reduce((sum, line) => 
              sum + ((line.qty || 0) * (line.unit_cost || 0)), 0) || 0;
            
            // Beregn other costs
            currentOther += detailedProduct.project_product_other_cost_lines_2026_01_15_12_49?.reduce((sum, line) => 
              sum + ((line.qty || 0) * (line.unit_cost || 0)), 0) || 0;
          }
          
          const currentTotalCost = currentMaterialCost + currentMaterialTransport + currentProductTransport + 
                                 currentLaborProduction + currentLaborDk + currentOther;
          
          // Sammenlign med snapshot
          if (Math.abs(currentTotalCost - item.costTotalPerUnit) > 0.01) {
            updates[item.id] = {
              oldCost: item.costTotalPerUnit,
              newCost: currentTotalCost,
              product: currentProduct,
              currentBreakdown: {
                materials: currentMaterialCost,
                material_transport: currentMaterialTransport,
                product_transport: currentProductTransport,
                labor_production: currentLaborProduction,
                labor_dk: currentLaborDk,
                other: currentOther
              }
            };
          }
        }
      }
      
      setProductUpdates(updates);
      
      if (Object.keys(updates).length > 0 && showUpdateWarnings) {
        toast({
          title: "Produktpriser er ændret",
          description: `${Object.keys(updates).length} produkter har ændrede priser. Tjek for opdateringer.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking product updates:', error);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const updateProductItem = async (itemId: string) => {
    const update = productUpdates[itemId];
    if (!update) return;
    
    try {
      const newCostBreakdown = {
        materials: update.product.total_material_cost || 0,
        transport: update.product.total_transport_cost || 0,
        labor_production: update.product.total_labor_production_cost || 0,
        labor_dk: update.product.total_labor_dk_cost || 0,
        other: update.product.total_other_cost || 0
      };
      
      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update({
          cost_breakdown_json: newCostBreakdown,
          cost_total_per_unit: update.newCost
        })
        .eq('id', itemId);
        
      if (error) throw error;
      
      toast({
        title: "Produkt opdateret",
        description: "Produktprisen er blevet opdateret til den nyeste version",
      });
      
      // Fjern fra updates
      const newUpdates = { ...productUpdates };
      delete newUpdates[itemId];
      setProductUpdates(newUpdates);
      
      loadQuoteData();
    } catch (error) {
      console.error('Error updating product item:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere produktet",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    console.log('handleDeleteItem called with itemId:', itemId);
    setItemToDelete(itemId);
    setShowDeleteItemConfirm(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    
    console.log('User confirmed delete, proceeding with itemId:', itemToDelete);
    setShowDeleteItemConfirm(false);
    setDeletingItem(itemToDelete);
    try {
      console.log('Calling supabase delete...');
      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .delete()
        .eq('id', itemToDelete);
        
      console.log('Supabase delete response:', { error });
      if (error) throw error;
      
      console.log('Delete successful, showing toast...');
      toast({
        title: "Item slettet",
        description: "Item er blevet fjernet fra linjen",
      });
      
      console.log('Reloading quote data...');
      loadQuoteData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke slette item",
        variant: "destructive",
      });
    } finally {
      console.log('Setting deletingItem to null');
      setDeletingItem(null);
      setItemToDelete(null);
    }
  };

  const startEditPricing = (line: QuoteLine) => {
    if (line.pricing) {
      setPricingFormData({
        pricingMode: line.pricing.pricingMode,
        markupPct: line.pricing.markupPct || 25,
        grossMarginPct: line.pricing.grossMarginPct || 20,
        targetUnitPrice: line.pricing.targetUnitPrice || 0,
        riskPerUnit: line.pricing.riskPerUnit,
        profitByCategory: line.pricing.profitByCategory || {
          materials: 30,
          material_transport: 30,
          product_transport: 30,
          labor_production: 30,
          labor_dk: 30,
          other: 30
        }
      });
    }
    setEditingPricing(line.id);
  };

  const startEditLine = (line: QuoteLine) => {
    setEditLineFormData({
      title: line.title,
      description: line.description || '',
      quantity: line.quantity,
      unit: line.unit
    });
    setEditingLine(line.id);
  };

  const handleUpdateLine = async (lineId: string) => {
    if (!editLineFormData.title.trim()) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    if (editLineFormData.quantity <= 0) {
      toast({
        title: "Ugyldig antal",
        description: "Antal skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    if (!editLineFormData.unit.trim()) {
      toast({
        title: "Fejl",
        description: "Enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }

    setSavingLine(true);
    try {
      const updateData = {
        title: editLineFormData.title,
        description: editLineFormData.description || null,
        quantity: editLineFormData.quantity,
        unit: editLineFormData.unit
      };

      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .update(updateData)
        .eq('id', lineId);

      if (error) throw error;

      toast({
        title: "Linje opdateret",
        description: "Tilbudslinjen er blevet opdateret",
      });

      setEditingLine(null);
      loadQuoteData();
    } catch (error) {
      console.error('Error updating line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    } finally {
      setSavingLine(false);
    }
  };

  const startEditItem = (item: QuoteLineItem) => {
    setEditItemFormData({
      title: item.title,
      qty: item.qty,
      unit: item.unit,
      totalCostPerUnit: item.costTotalPerUnit || 0
    });
    setEditingItem(item.id);
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!editItemFormData.title.trim()) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    if (editItemFormData.qty <= 0) {
      toast({
        title: "Ugyldig antal",
        description: "Antal skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    if (!editItemFormData.unit.trim()) {
      toast({
        title: "Fejl",
        description: "Enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    // Additional validation for custom items
    const item = lines.flatMap(line => line.items).find(item => item.id === itemId);
    if (item?.sourceType === 'custom' && editItemFormData.totalCostPerUnit < 0) {
      toast({
        title: "Ugyldig cost",
        description: "Total cost kan ikke være negativ",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the item to check if it's custom
      const item = lines.flatMap(line => line.items).find(item => item.id === itemId);
      
      const updateData: any = {
        title: editItemFormData.title,
        qty: editItemFormData.qty,
        unit: editItemFormData.unit
      };
      
      // If it's a custom item, also update cost_total_per_unit and cost_breakdown_json
      if (item?.sourceType === 'custom') {
        updateData.cost_total_per_unit = editItemFormData.totalCostPerUnit;
        updateData.cost_breakdown_json = {
          materials: 0,
          material_transport: 0,
          product_transport: 0,
          labor_production: 0,
          labor_dk: 0,
          other: editItemFormData.totalCostPerUnit
        };
      }

      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Item opdateret",
        description: "Item er blevet opdateret",
      });

      setEditingItem(null);
      loadQuoteData();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    }
  };

  const handleArchiveLine = async (lineId: string) => {
    try {
      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .update({ archived: true })
        .eq('id', lineId);

      if (error) throw error;

      toast({
        title: "Linje arkiveret",
        description: "Tilbudslinjen er blevet arkiveret",
      });

      loadQuoteData();
    } catch (error) {
      console.error('Error archiving line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved arkivering af linjen",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    setLineToDelete(lineId);
    setShowDeleteLineConfirm(true);
  };

  const confirmDeleteLine = async () => {
    if (!lineToDelete) return;
    
    setShowDeleteLineConfirm(false);

    try {
      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .delete()
        .eq('id', lineToDelete);

      if (error) throw error;

      toast({
        title: "Linje slettet",
        description: "Tilbudslinjen er blevet slettet permanent",
      });

      loadQuoteData();
    } catch (error) {
      console.error('Error deleting line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved sletning af linjen",
        variant: "destructive",
      });
    } finally {
      setLineToDelete(null);
    }
  };

  const confirmArchiveInstead = async () => {
    if (!lineToDelete) return;
    
    setShowDeleteLineConfirm(false);
    await handleArchiveLine(lineToDelete);
    setLineToDelete(null);
  };

  // Helper function to update cost snapshot for a single item
  const updateItemCostSnapshot = async (itemId: string, projectProductId: string) => {
    try {
      console.log('Updating cost snapshot for item:', itemId, 'product:', projectProductId);
      
      // Fetch current product data with all cost lines
      const { data: currentProduct, error: productError } = await supabase
        .from('project_products_2026_01_15_12_49')
        .select(`
          *,
          project_product_material_lines_2026_01_15_12_49(
            qty,
            unit_cost_override,
            project_materials_2026_01_15_06_45(unit_price, transport_estimated_cost)
          ),
          project_product_labor_lines_2026_01_15_12_49(qty, unit_cost, labor_type),
          project_product_transport_lines_2026_01_15_12_49(qty, unit_cost),
          project_product_other_cost_lines_2026_01_15_12_49(qty, unit_cost)
        `)
        .eq('id', projectProductId)
        .single();
      
      if (productError) {
        console.error('Product fetch error:', productError);
        throw productError;
      }
      
      if (!currentProduct) {
        throw new Error('Product not found');
      }
      
      console.log('Product data fetched:', currentProduct.name);
      
      // Calculate current costs
      let materialCost = 0;
      let materialTransport = 0;
      let laborProductionCost = 0;
      let laborDkCost = 0;
      let transportCost = 0;
      let otherCost = 0;
      
      // Materials
      if (currentProduct.project_product_material_lines_2026_01_15_12_49) {
        currentProduct.project_product_material_lines_2026_01_15_12_49.forEach(line => {
          const qty = line.qty || 0;
          const unitCost = line.unit_cost_override || line.project_materials_2026_01_15_06_45?.unit_price || 0;
          materialCost += qty * unitCost;
          materialTransport += line.project_materials_2026_01_15_06_45?.transport_estimated_cost || 0;
        });
      }
      
      // Labor
      if (currentProduct.project_product_labor_lines_2026_01_15_12_49) {
        currentProduct.project_product_labor_lines_2026_01_15_12_49.forEach(line => {
          const lineCost = (line.qty || 0) * (line.unit_cost || 0);
          if (line.labor_type === 'production') laborProductionCost += lineCost;
          else if (line.labor_type === 'dk_installation') laborDkCost += lineCost;
          else otherCost += lineCost;
        });
      }
      
      // Transport
      if (currentProduct.project_product_transport_lines_2026_01_15_12_49) {
        transportCost = currentProduct.project_product_transport_lines_2026_01_15_12_49.reduce((sum, line) => 
          sum + ((line.qty || 0) * (line.unit_cost || 0)), 0);
      }
      
      // Other costs
      if (currentProduct.project_product_other_cost_lines_2026_01_15_12_49) {
        otherCost += currentProduct.project_product_other_cost_lines_2026_01_15_12_49.reduce((sum, line) => 
          sum + ((line.qty || 0) * (line.unit_cost || 0)), 0);
      }
      
      const newCostBreakdown = {
        materials: materialCost,
        material_transport: materialTransport,
        product_transport: transportCost,
        labor_production: laborProductionCost,
        labor_dk: laborDkCost,
        other: otherCost
      };
      
      const newTotalCost = Object.values(newCostBreakdown).reduce((sum, cost) => sum + cost, 0);
      
      console.log('Calculated new cost:', newTotalCost, 'breakdown:', newCostBreakdown);
      
      // Update item in database
      const { error: updateError } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update({
          cost_breakdown_json: newCostBreakdown,
          cost_total_per_unit: newTotalCost
        })
        .eq('id', itemId);
        
      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
      
      console.log('Successfully updated item:', itemId);
      return { success: true, newTotalCost };
    } catch (error) {
      console.error('Error updating item cost snapshot:', error);
      return { success: false, error };
    }
  };

  // Update all items with 0 kr cost in a line
  const updateAllZeroCostItemsInLine = async (lineId: string) => {
    try {
      const line = lines.find(l => l.id === lineId);
      if (!line) return;
      
      // Find all product items with 0 or null cost
      const zeroCostItems = line.items.filter(
        item => item.sourceType === 'project_product' && 
                (item.costTotalPerUnit === 0 || item.costTotalPerUnit === null || !item.costTotalPerUnit) && 
                item.projectProductId
      );
      
      console.log('Found zero cost items:', zeroCostItems.length, zeroCostItems.map(i => ({ title: i.title, cost: i.costTotalPerUnit })));
      
      if (zeroCostItems.length === 0) {
        toast({
          title: "Ingen items at opdatere",
          description: "Alle items har allerede priser",
        });
        return;
      }
      let successCount = 0;
      let failCount = 0;
      
      // Update each item
      for (const item of zeroCostItems) {
        const result = await updateItemCostSnapshot(item.id, item.projectProductId!);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      toast({
        title: "Opdatering fuldført",
        description: `${successCount} items opdateret${failCount > 0 ? `, ${failCount} fejlede` : ''}`,
      });
      
      // Reload data to show updated prices
      loadQuoteData();
    } catch (error) {
      console.error('Error updating zero cost items:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering af items",
        variant: "destructive",
      });
    }
  };

  // Update ALL product prices in the entire quote
  const updateAllProductPrices = async () => {
    try {
      setUpdatingAllPrices(true);
      setShowUpdateAllConfirm(false);
      
      // Find all product items across all lines
      const allProductItems = lines.flatMap(line => 
        line.items.filter(item => 
          item.sourceType === 'project_product' && item.projectProductId
        )
      );
      
      console.log('Updating all product prices. Total items:', allProductItems.length);
      
      if (allProductItems.length === 0) {
        toast({
          title: "Ingen produkter at opdatere",
          description: "Der er ingen produkter i tilbuddet",
        });
        setUpdatingAllPrices(false);
        return;
      }
      
      setUpdateProgress({ current: 0, total: allProductItems.length });
      
      let successCount = 0;
      let failCount = 0;
      
      // Update each item with progress tracking
      for (let i = 0; i < allProductItems.length; i++) {
        const item = allProductItems[i];
        setUpdateProgress({ current: i + 1, total: allProductItems.length });
        
        const result = await updateItemCostSnapshot(item.id, item.projectProductId!);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      toast({
        title: "Opdatering fuldført",
        description: `${successCount} produkter opdateret${failCount > 0 ? `, ${failCount} fejlede` : ''}`,
      });
      
      // Reload data to show updated prices
      await loadQuoteData();
    } catch (error) {
      console.error('Error updating all product prices:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering af produktpriser",
        variant: "destructive",
      });
    } finally {
      setUpdatingAllPrices(false);
      setUpdateProgress({ current: 0, total: 0 });
    }
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Vælg et projekt</h2>
            <p className="text-muted-foreground">Du skal vælge et projekt for at se tilbud.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">Indlæser tilbud...</div>
        </div>
      </Layout>
    );
  }

  if (!quote) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Tilbud ikke fundet</h2>
            <Button onClick={() => navigate('/project/quotes')}>
              Tilbage til tilbud
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Calculate totals for entire quote
  const quoteTotals = lines.reduce((acc, line) => {
    const lineTotals = calculateLineTotals(line);
    const qty = line.quantity;
    
    return {
      totalSellingPrice: acc.totalSellingPrice + lineTotals.totalSellingPrice,
      totalProfit: acc.totalProfit + lineTotals.totalProfit,
      totalCost: acc.totalCost + (lineTotals.totalCostPerUnit * qty),
      // Cost breakdown totals
      costBreakdown: {
        materials: acc.costBreakdown.materials + (lineTotals.costBreakdown.materials * qty),
        material_transport: acc.costBreakdown.material_transport + (lineTotals.costBreakdown.material_transport * qty),
        product_transport: acc.costBreakdown.product_transport + (lineTotals.costBreakdown.product_transport * qty),
        labor_production: acc.costBreakdown.labor_production + (lineTotals.costBreakdown.labor_production * qty),
        labor_dk: acc.costBreakdown.labor_dk + (lineTotals.costBreakdown.labor_dk * qty),
        other: acc.costBreakdown.other + (lineTotals.costBreakdown.other * qty)
      }
    };
  }, { 
    totalSellingPrice: 0, 
    totalProfit: 0, 
    totalCost: 0,
    costBreakdown: {
      materials: 0,
      material_transport: 0,
      product_transport: 0,
      labor_production: 0,
      labor_dk: 0,
      other: 0
    }
  });

  const averageDbPercent = quoteTotals.totalSellingPrice > 0 ? 
    (quoteTotals.totalProfit / quoteTotals.totalSellingPrice) * 100 : 0;
  
  // Calculate custom costs total (sum of all cost breakdown items)
  const customCostsTotal = Object.values(quoteTotals.costBreakdown).reduce((sum, cost) => sum + cost, 0);

  // Calculate risk total (Q-V1-11)
  const riskTotal = lines.reduce((sum, line) => {
    const lineTotals = calculateLineTotals(line);
    return sum + (lineTotals.riskPerUnit * line.quantity);
  }, 0);

  // Calculate base cost total (Q-V1-11)
  const baseCostTotal = customCostsTotal;
  const totalCostInclRisk = baseCostTotal + riskTotal;

  // Build product summary (Q-V1-09)
  const buildProductSummary = (allLines: typeof lines) => {
    // Collect all items from all lines
    const allItems = allLines.flatMap(line => line.items || []);
    
    // Filter only project_product items
    const productItems = allItems.filter(item => item.sourceType === 'project_product');
    
    // Group by project_product_id (fallback to title)
    const grouped = productItems.reduce((acc, item) => {
      const key = item.projectProductId || item.title;
      if (!acc[key]) {
        acc[key] = {
          title: item.title,
          projectProductId: item.projectProductId,
          unit: item.unit,
          totalQty: 0,
          totalCost: 0
        };
      }
      acc[key].totalQty += item.qty;
      acc[key].totalCost += item.costTotalPerUnit * item.qty;
      return acc;
    }, {} as Record<string, { title: string; projectProductId: string | null; unit: string; totalQty: number; totalCost: number }>);
    
    // Convert to array and sort by total cost DESC
    return Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost);
  };


  const productSummary = buildProductSummary(lines);

  // Build material summary (Q-V1-10)
  const buildMaterialSummary = (
    quoteLines: typeof lines,
    materialLines: typeof productMaterialLines,
    materials: typeof projectMaterials
  ) => {
    // Step 1: Find relevant quote items (project_product only)
    const allItems = quoteLines.flatMap(line => line.items || []);
    const productItems = allItems.filter(
      item => item.sourceType === 'project_product' && item.projectProductId
    );

    if (productItems.length === 0) return [];

    // Step 2 & 3: Calculate material quantities for each quote item
    const materialTotals: Record<string, {
      materialId: string;
      name: string;
      category: string;
      unit: string;
      totalQty: number;
      totalCost: number;
    }> = {};

    productItems.forEach(quoteItem => {
      // Find material lines for this product
      const productMaterialLines = materialLines.filter(
        ml => ml.project_product_id === quoteItem.projectProductId
      );

      productMaterialLines.forEach(materialLine => {
        const material = materials.find(m => m.id === materialLine.project_material_id);
        if (!material) return;

        // Calculate quantities
        const materialQtyPerProduct = materialLine.qty || 0;
        const quoteItemQty = quoteItem.qty || 0;
        const materialTotalQtyForItem = materialQtyPerProduct * quoteItemQty;

        // Calculate cost
        const materialUnitCost = materialLine.unit_cost_override ?? material.unit_price ?? 0;
        const materialTotalCostForItem = materialTotalQtyForItem * materialUnitCost;

        // Group by material ID
        const key = material.id;
        if (!materialTotals[key]) {
          materialTotals[key] = {
            materialId: material.id,
            name: material.name || 'Unavngivet materiale',
            category: material.category || 'Ingen kategori',
            unit: material.unit || 'stk',
            totalQty: 0,
            totalCost: 0
          };
        }

        materialTotals[key].totalQty += materialTotalQtyForItem;
        materialTotals[key].totalCost += materialTotalCostForItem;
      });
    });

    // Convert to array and sort by total cost DESC
    return Object.values(materialTotals).sort((a, b) => b.totalCost - a.totalCost);
  };

  const materialSummary = buildMaterialSummary(lines, productMaterialLines, projectMaterials);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/project/quotes')}
              >
                ← Tilbage
              </Button>
              <h1 className="text-3xl font-bold">{quote.title}</h1>
              <Badge variant="secondary">{quote.quote_number}</Badge>
            </div>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
            
            {/* Related Budgets */}
            {relatedBudgets.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Relaterede budgetter:</span>
                  {relatedBudgets.map((budget) => (
                    <Button
                      key={budget.id}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/project/budgets/${budget.id}`)}
                      className="gap-2 h-7 text-xs"
                    >
                      <FileText className="h-3 w-3" />
                      {budget.budget_number}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {Object.keys(productUpdates).length > 0 && (
              <Button 
                onClick={async () => {
                  for (const itemId of Object.keys(productUpdates)) {
                    await updateProductItem(itemId);
                  }
                }}
                variant="default"
                size="sm"
                className="gap-2"
              >
                Opdater alle priser ({Object.keys(productUpdates).length})
              </Button>
            )}
            <Button 
              onClick={checkForProductUpdates} 
              variant="outline" 
              size="sm"
              disabled={checkingUpdates}
              className="gap-2"
            >
              {checkingUpdates ? 'Tjekker...' : 'Tjek opdateringer'}
            </Button>
            <Button 
              onClick={() => setShowUpdateAllConfirm(true)}
              disabled={updatingAllPrices || lines.length === 0}
              variant="default"
              size="sm"
              className="gap-2"
            >
              {updatingAllPrices ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opdaterer {updateProgress.current}/{updateProgress.total}...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Opdater alle produktpriser
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowUpdateWarnings(!showUpdateWarnings)} 
              variant={showUpdateWarnings ? "default" : "outline"}
              size="sm"
            >
              {showUpdateWarnings ? 'Advarsler til' : 'Advarsler fra'}
            </Button>
            {quote?.status === 'accepted' && (
              <Button 
                onClick={transferToBudget}
                disabled={transferringToBudget}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {transferringToBudget ? 'Overfører...' : 'Overfør til budget'}
              </Button>
            )}
            <Button onClick={() => setShowAddLineModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj linje
            </Button>
          </div>
        </div>

        {/* Metadata Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Redigerbare felter */}
              <div className="space-y-2">
                <Label htmlFor="next_delivery_date">Næste leveringsdato</Label>
                <Input
                  id="next_delivery_date"
                  type="date"
                  value={quote?.next_delivery_date || ''}
                  onChange={(e) => updateQuoteMetadata({ next_delivery_date: e.target.value || null })}
                  disabled={savingMetadata}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priority">Prioritet</Label>
                <Select 
                  value={quote?.priority?.toString() || '2'} 
                  onValueChange={(value) => updateQuoteMetadata({ priority: parseInt(value) })}
                  disabled={savingMetadata}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Høj</SelectItem>
                    <SelectItem value="2">2 - Normal</SelectItem>
                    <SelectItem value="3">3 - Lav</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="owner_user_id">Ansvarlig</Label>
                <Input
                  id="owner_user_id"
                  placeholder="Bruger ID (placeholder)"
                  value={quote?.owner_user_id || ''}
                  onChange={(e) => updateQuoteMetadata({ owner_user_id: e.target.value || null })}
                  disabled={savingMetadata}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="next_action">Næste handling</Label>
                <Input
                  id="next_action"
                  placeholder="Beskriv næste handling"
                  value={quote?.next_action || ''}
                  onChange={(e) => updateQuoteMetadata({ next_action: e.target.value || null })}
                  disabled={savingMetadata}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="delivery_note">Leveringsnoter</Label>
                <Textarea
                  id="delivery_note"
                  placeholder="Noter om levering"
                  value={quote?.delivery_note || ''}
                  onChange={(e) => updateQuoteMetadata({ delivery_note: e.target.value || null })}
                  disabled={savingMetadata}
                  rows={2}
                />
              </div>
              
              {/* Read-only felter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="p-2 bg-muted rounded">
                  <Badge variant={quote?.status === 'sent' ? 'default' : 'secondary'}>
                    {quote?.status === 'draft' ? 'Kladde' : 
                     quote?.status === 'sent' ? 'Sendt' : 
                     quote?.status === 'accepted' ? 'Accepteret' : 
                     quote?.status === 'rejected' ? 'Afvist' : quote?.status}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Sendt dato</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  {quote?.sent_at ? new Date(quote.sent_at).toLocaleDateString('da-DK') : 'Ikke sendt'}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Version</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  v{quote?.version_no || 1}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Låst</Label>
                <div className="p-2 bg-muted rounded">
                  <Badge variant={quote?.is_locked ? 'destructive' : 'secondary'}>
                    {quote?.is_locked ? 'Låst' : 'Ulåst'}
                  </Badge>
                  {quote?.locked_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(quote.locked_at).toLocaleDateString('da-DK')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Lines */}
        <div className="space-y-4">
          {lines
            .sort((a, b) => {
              // Primær sortering: display_order
              if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
              }
              // Fallback til created_at hvis display_order mangler
              if (a.displayOrder !== undefined) return -1;
              if (b.displayOrder !== undefined) return 1;
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            })
            .map((line) => {
            const totals = calculateLineTotals(line);
            const isExpanded = expandedLines.has(line.id);
            
            return (
              <Card 
                key={line.id}
                className={`transition-all duration-200 ${
                  dragOverLineId === line.id ? 'border-primary border-2 bg-primary/5' : ''
                } ${
                  draggedLineId === line.id ? 'opacity-50' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, line.id)}
                onDragOver={(e) => handleDragOver(e, line.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, line.id)}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleLineExpansion(line.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GripVertical 
                            className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" 
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <CardTitle className="text-lg">{line.title}</CardTitle>
                            {!isExpanded && (
                              <div className="text-sm font-medium text-foreground mt-1">
                                {line.quantity} {line.unit} • {formatCurrency(totals.sellingPricePerUnit)} kr/{line.unit}
                              </div>
                            )}
                            {isExpanded && line.description && (
                              <p className="text-sm text-muted-foreground mt-1">{line.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          {!isExpanded ? (
                            // Summary-sektion med 4 nøgletal
                            <div className="grid grid-cols-6 gap-3 text-right pointer-events-none">
                              <div>
                                <div className="font-semibold text-base">
                                  {line.quantity}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Antal
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.sellingPricePerUnit)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Enhedspris (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.totalSellingPrice)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Total salgspris (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.totalCost)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Total cost (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.totalProfit)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Total DB (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {totals.dbPercent.toFixed(0)}%
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  DB %
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Udvidet visning - alle detaljer
                            <>
              <div>
                <div className="font-semibold text-lg">
                  Salgspris i alt: {formatCurrency(totals.totalSellingPrice)} kr
                </div>
                <div className="text-base font-medium">
                  Antal: {line.quantity} {line.unit}
                </div>
              </div>
                              <div className="text-right">
                                <Badge variant={totals.dbPercent > 20 ? "default" : "secondary"}>
                                  DB: {totals.dbPercent.toFixed(0)}%
                                </Badge>
                              </div>
                            </>
                          )}
                          {isExpanded && (
                            <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditLine(line);
                              }}
                              title="Redigér linje"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveLine(line.id);
                              }}
                              title="Arkivér linje"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLine(line.id);
                              }}
                              title="Slet linje"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLineExpansion(line.id);
                              }}
                            >
                              {isExpanded ? 'Skjul kalkulation' : 'Vis kalkulation'}
                            </Button>
                            </div>
                          )}
                          
                          {/* Vis kalkulation knap er altid synlig */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLineExpansion(line.id);
                            }}
                          >
                            {isExpanded ? 'Skjul' : 'Vis'}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Rækkebaseret Kalkulation */}
                      <div className="mb-6">
                        <h4 className="font-semibold mb-3">Kalkulation</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-gray-300 px-3 py-2 text-left font-medium">Type</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Beløb (kr)</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Enhedspris (kr)</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Profit %</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Andel af salgspris %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* A. COST (grundomkostninger) */}
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Materialer</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.materials * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.materials)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.materials.toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Materialetransport</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(((totals.costBreakdown.material_transport || 0) * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.material_transport || 0))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{((totals.costBreakdown.material_transport || 0) / totals.sellingPricePerUnit * 100).toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Produktion</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.labor_production * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.labor_production)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.labor_production.toFixed(0)}%</td>
                              </tr>
                              {/* Vis kun produkttransport hvis den findes */}
                              {(totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) > 0 && (
                                <tr>
                                  <td className="border border-gray-300 px-3 py-2">Produkttransport</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * line.quantity))}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0))}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right">{((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) / totals.sellingPricePerUnit * 100).toFixed(0)}%</td>
                                </tr>
                              )}
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">DK montage</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.labor_dk * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.labor_dk)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.labor_dk.toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Øvrigt</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.other * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.other)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.other.toFixed(0)}%</td>
                              </tr>
                              
                              {/* B. Base cost – i alt */}
                              <tr className="border-t-2 bg-gray-100 font-semibold">
                                <td className="border border-gray-300 px-3 py-2">Base cost i alt</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                  {(() => {
                                    const totalBaseCost = ((totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0)) * line.quantity;
                                    return formatCurrency(totalBaseCost);
                                  })()}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                  {(() => {
                                    const totalBaseCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0);
                                    return formatCurrency(totalBaseCostPerUnit);
                                  })()}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                  {(() => {
                                    const baseCostTotal = ((totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0)) * line.quantity;
                                    const baseCostShare = totals.totalSellingPrice > 0 ? (baseCostTotal / totals.totalSellingPrice) * 100 : 0;
                                    return baseCostShare.toFixed(0) + '%';
                                  })()}
                                </td>
                              </tr>
                              
                              {/* D. Profit-række */}
                              <tr className="border-t bg-blue-50">
                                <td className="border border-gray-300 px-3 py-2 font-semibold text-blue-700">
                                  Profit ({(() => {
                                    if (line.pricing?.pricingMode === 'markup_pct') return 'Markup %';
                                    if (line.pricing?.pricingMode === 'gross_margin_pct') return 'DB %';
                                    if (line.pricing?.pricingMode === 'target_unit_price') return 'Target price';
                                    if (line.pricing?.pricingMode === 'profit_by_category') return 'Profit pr. kategori';
                                    return 'Standard';
                                  })()})
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {formatCurrency(totals.totalProfit)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {formatCurrency((totals.totalProfit / line.quantity))}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {(() => {
                                    const baseCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0);
                                    const markupPercent = baseCostPerUnit > 0 ? ((totals.totalProfit / line.quantity) / baseCostPerUnit) * 100 : 0;
                                    return '+' + markupPercent.toFixed(0) + '%';
                                  })()} 
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {(() => {
                                    const profitShare = totals.totalSellingPrice > 0 ? (totals.totalProfit / totals.totalSellingPrice) * 100 : 0;
                                    return profitShare.toFixed(0) + '%';
                                  })()}
                                </td>
                              </tr>
                              
                              {/* E. Risikotillæg */}
                              <tr className="border-t">
                                <td className="border border-gray-300 px-3 py-2">Risikotillæg</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.riskPerUnit * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.riskPerUnit)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">0%</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.risk.toFixed(0)}%</td>
                              </tr>
                              
                              {/* G. Salgspris – total */}
                              <tr className="border-t-2 bg-green-50 font-bold">
                                <td className="border border-gray-300 px-3 py-2 text-green-700">Salgspris i alt</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{formatCurrency(totals.totalSellingPrice)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{formatCurrency(totals.sellingPricePerUnit)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{totals.costPercentages.profit.toFixed(0)}%</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">100.0%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pricing Settings */}
                      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold">Prisfastsættelse</h4>
                          {editingPricing === line.id ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleUpdatePricing(line.id)}>Gem</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingPricing(null)}>Annullér</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => startEditPricing(line)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {editingPricing === line.id ? (
                          <div className="space-y-4">
                            <div>
                              <Label>Prisfastsættelse</Label>
                              <Select 
                                value={pricingFormData.pricingMode} 
                                onValueChange={(value: 'markup_pct' | 'gross_margin_pct' | 'target_unit_price') => 
                                  setPricingFormData(prev => ({ ...prev, pricingMode: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="markup_pct">Markup % på (cost + risk)</SelectItem>
                                  <SelectItem value="gross_margin_pct">Target DB %</SelectItem>
                                  <SelectItem value="target_unit_price">Jeg sætter salgspris</SelectItem>
                                  <SelectItem value="profit_by_category">Profit pr. kategori</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              {pricingFormData.pricingMode === 'markup_pct' && (
                                <div>
                                  <Label>Markup %</Label>
                                  <Input
                                    type="number"
                                    value={pricingFormData.markupPct}
                                    onChange={(e) => setPricingFormData(prev => ({ ...prev, markupPct: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              )}
                              
                              {pricingFormData.pricingMode === 'gross_margin_pct' && (
                                <div>
                                  <Label>DB %</Label>
                                  <Input
                                    type="number"
                                    value={pricingFormData.grossMarginPct}
                                    onChange={(e) => setPricingFormData(prev => ({ ...prev, grossMarginPct: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              )}
                              
                              {pricingFormData.pricingMode === 'target_unit_price' && (
                                <div>
                                  <Label>Salgspris kr/{line.unit}</Label>
                                  <Input
                                    type="number"
                                    value={pricingFormData.targetUnitPrice}
                                    onChange={(e) => setPricingFormData(prev => ({ ...prev, targetUnitPrice: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              )}
                              
                              <div>
                                <Label>Risk kr/{line.unit}</Label>
                                <Input
                                  type="number"
                                  value={pricingFormData.riskPerUnit}
                                  onChange={(e) => setPricingFormData(prev => ({ ...prev, riskPerUnit: parseFloat(e.target.value) || 0 }))}
                                />
                              </div>
                            </div>
                            
                            {/* Profit by Category UI */}
                            {pricingFormData.pricingMode === 'profit_by_category' && (
                              <div className="mt-4">
                                <Label className="text-sm font-medium mb-2 block">Profit % pr. kategori</Label>
                                <div className="border rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">Kategori</th>
                                        <th className="px-3 py-2 text-right font-medium">Cost pr enhed (kr)</th>
                                        <th className="px-3 py-2 text-right font-medium">Profit %</th>
                                        <th className="px-3 py-2 text-right font-medium">Profit pr enhed (kr)</th>
                                        <th className="px-3 py-2 text-right font-medium">Total pr enhed (kr)</th>
                                        <th className="px-3 py-2 text-right font-medium">Total (kr)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Materialer</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.materials.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.materials || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                materials: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.materials * (1 + (pricingFormData.profitByCategory?.materials || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.materials * (1 + (pricingFormData.profitByCategory?.materials || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Materialetransport</td>
                                        <td className="px-3 py-2 text-right">{(totals.costBreakdown.material_transport || 0).toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.material_transport || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                material_transport: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.material_transport || 0) * (1 + (pricingFormData.profitByCategory?.material_transport || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(((totals.costBreakdown.material_transport || 0) * (1 + (pricingFormData.profitByCategory?.material_transport || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Produkttransport</td>
                                        <td className="px-3 py-2 text-right">{(totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0).toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.product_transport || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                product_transport: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (1 + (pricingFormData.profitByCategory?.product_transport || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (1 + (pricingFormData.profitByCategory?.product_transport || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Labor (produktion)</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.labor_production.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.labor_production || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                labor_production: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.labor_production * (1 + (pricingFormData.profitByCategory?.labor_production || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.labor_production * (1 + (pricingFormData.profitByCategory?.labor_production || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Labor (DK montage)</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.labor_dk.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.labor_dk || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                labor_dk: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.labor_dk * (1 + (pricingFormData.profitByCategory?.labor_dk || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.labor_dk * (1 + (pricingFormData.profitByCategory?.labor_dk || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Øvrigt</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.other.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.other || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                other: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.other * (1 + (pricingFormData.profitByCategory?.other || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.other * (1 + (pricingFormData.profitByCategory?.other || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t-2 bg-gray-50 font-semibold">
                                        <td className="px-3 py-2">I alt (excl. risk)</td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            return totalCostPerUnit.toLocaleString('da-DK');
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            return totalProfitPerUnit.toLocaleString('da-DK');
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            const totalSellingPricePerUnit = totalCostPerUnit + totalProfitPerUnit;
                                            return totalSellingPricePerUnit.toLocaleString('da-DK');
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            const totalSellingPricePerUnit = totalCostPerUnit + totalProfitPerUnit;
                                            return (totalSellingPricePerUnit * line.quantity).toLocaleString('da-DK');
                                          })()}
                                        </td>
                                      </tr>
                                      <tr className="border-t bg-blue-50">
                                        <td className="px-3 py-2 font-semibold">Resulterende DB%</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            const totalSellingPricePerUnit = totalCostPerUnit + totalProfitPerUnit;
                                            const dbPercent = totalSellingPricePerUnit > 0 ? (totalProfitPerUnit / totalSellingPricePerUnit) * 100 : 0;
                                            return dbPercent.toFixed(0) + '%';
                                          })()}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2 pt-4">
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdatePricing(line.id)}
                                disabled={savingPricing}
                              >
                                {savingPricing ? 'Gemmer...' : 'Gem pricing'}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setEditingPricing(null)}
                              >
                                Annullér
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <div className="text-sm space-y-1">
                              <div>Mode: {line.pricing?.pricingMode === 'markup_pct' ? 'Markup %' : line.pricing?.pricingMode === 'gross_margin_pct' ? 'DB %' : 'Target pris'}</div>
                              <div>Risk: {line.pricing?.riskPerUnit || 0} kr/{line.unit}</div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => startEditPricing(line)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Redigér pricing
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Line Items */}
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold">Line Items</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedLineForItems(line.id);
                                setProductSearchTerm('');
                                setProductTypeFilter('all');
                                setShowAddItemModal(true);
                              }}
                            >
                              <Package className="h-4 w-4 mr-1" />
                              Tilføj produkt
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedLineForItems(line.id);
                                setShowCustomItemModal(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Custom cost
                            </Button>
                          </div>
                        </div>
                        
                        {line.items.length > 0 ? (
                          <div className="space-y-2">
                            {line.items.map((item) => (
                              <div key={item.id} className="p-3 bg-muted/50 rounded border">
                                {editingItem === item.id ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                      <div>
                                        <Label>Titel</Label>
                                        <Input
                                          value={editItemFormData.title}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Antal</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editItemFormData.qty}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 1 }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Enhed</Label>
                                        <Input
                                          value={editItemFormData.unit}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, unit: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                    {item.sourceType === 'custom' && (
                                      <div>
                                        <Label>Total cost pr. unit</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={editItemFormData.totalCostPerUnit}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, totalCostPerUnit: parseFloat(e.target.value) || 0 }))}
                                          placeholder="0.00"
                                        />
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleUpdateItem(item.id)}>Gem</Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Annullér</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{item.title}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {item.sourceType === 'project_product' ? 'Produkt' : 'Custom'}
                                        </Badge>

                                      </div>
                                      <div className="text-sm text-muted-foreground mt-1">
                                        {item.qty} {item.unit} • Cost: {formatCurrency(item.costTotalPerUnit)} kr/{item.unit}
                                        {item.costTotalPerUnit === 0 && (
                                          <Badge variant="destructive" className="ml-2 text-xs">
                                            Snapshot = 0 – mangler priser eller qty
                                          </Badge>
                                        )}
                                      </div>
                                      {item.sourceType === 'project_product' && item.costBreakdown && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                          <div className="grid grid-cols-1 gap-1">
                                            <span>Materialekost: {item.costBreakdown.materials?.toLocaleString('da-DK') || '0'} kr</span>
                                            <span>Materialetransport: {item.costBreakdown.material_transport?.toLocaleString('da-DK') || '0'} kr</span>
                                            <span>Produkttransport: {item.costBreakdown.product_transport?.toLocaleString('da-DK') || item.costBreakdown.transport?.toLocaleString('da-DK') || '0'} kr</span>
                                            <span>Labor (produktion): {item.costBreakdown.labor_production?.toLocaleString('da-DK') || '0'} kr</span>
                                            <span>Labor (montage i DK): {item.costBreakdown.labor_dk?.toLocaleString('da-DK') || '0'} kr</span>
                                            <span>Øvrige omkostninger: {item.costBreakdown.other?.toLocaleString('da-DK') || '0'} kr</span>
                                            <span className="font-medium text-green-600 pt-1 border-t">
                                              ✅ Total Landed Cost (DK) = {formatCurrency(item.costTotalPerUnit)} kr
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      {item.sourceType === 'project_product' && item.projectProductId && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              const result = await updateItemCostSnapshot(item.id, item.projectProductId!);
                                              
                                              if (result.success) {
                                                toast({
                                                  title: "Pris opdateret",
                                                  description: `Produktprisen er opdateret til ${formatCurrency(result.newTotalCost!)}`,
                                                });
                                                loadQuoteData();
                                              } else {
                                                throw result.error;
                                              }
                                            } catch (error) {
                                              console.error('Error updating product price:', error);
                                              toast({
                                                title: "Fejl",
                                                description: "Kunne ikke opdatere produktprisen",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                          title="Opdater til nyeste produktpris"
                                        >
                                          Opdater pris
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEditItem(item)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={deletingItem === item.id}
                                        onClick={() => {
                                          console.log('Delete button clicked for item:', item.id);
                                          handleDeleteItem(item.id);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Ingen items tilføjet endnu</p>
                            <p className="text-sm">Tilføj produkter eller custom costs for at beregne priser</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        {/* Cost Breakdown - Nøgletal */}
        <Card>
          <CardHeader>
            <CardTitle>Nøgletal - Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-4">
              {/* Materialekost */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.materials)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Materialekost</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.materials / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Materialetransport */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.material_transport)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Materialetransport</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.material_transport / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Produkttransport */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.product_transport)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Produkttransport</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.product_transport / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Labor produktion */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.labor_production)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Labor produktion</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.labor_production / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Labor montage DK */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.labor_dk)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Labor montage DK</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.labor_dk / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Øvrige omkostninger */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.other)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Øvrige omkostninger</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.other / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Tilbud totaler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(quoteTotals.totalSellingPrice)}
                </div>
                <div className="text-sm text-muted-foreground">Total salgspris</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(quoteTotals.totalProfit)}
                </div>
                <div className="text-sm text-muted-foreground">Total fortjeneste</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {averageDbPercent.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Gennemsnitlig DB</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Summary (Q-V1-09) - Internal use only */}
        {productSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Produktopsummering (intern)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Samlet oversigt over alle produkter på tværs af tilbudslinjer
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Produkt</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Antal</th>
                      <th className="border border-gray-300 px-4 py-2 text-center font-medium">Enhed</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Samlet cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSummary.map((product, index) => (
                      <tr key={product.projectProductId || product.title || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{product.title}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                          {product.totalQty.toLocaleString('da-DK')}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{product.unit}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {product.totalCost.toLocaleString('da-DK')} kr
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gray-100 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2">Total</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                        {productSummary.reduce((sum, p) => sum + p.totalCost, 0).toLocaleString('da-DK')} kr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Material Summary (Q-V1-10) - Internal use only */}
        {materialSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Materialeopsummering (intern)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Samlet oversigt over alle materialer fra produkter på tværs af tilbudslinjer
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Materiale</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Kategori</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Samlet mængde</th>
                      <th className="border border-gray-300 px-4 py-2 text-center font-medium">Enhed</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Samlet cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialSummary.map((material, index) => (
                      <tr key={material.materialId || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{material.name}</td>
                        <td className="border border-gray-300 px-4 py-2 text-muted-foreground">{material.category}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                          {material.totalQty.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{material.unit}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {material.totalCost.toLocaleString('da-DK')} kr
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gray-100 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2">Total</td>
                      <td className="border border-gray-300 px-4 py-2 text-muted-foreground">
                        {/* Empty - category */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                        {materialSummary.reduce((sum, m) => sum + m.totalCost, 0).toLocaleString('da-DK')} kr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Internal Calculation Summary (Q-V1-11) */}
        {lines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Samlet intern kalkulation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Økonomisk overblik for hele tilbuddet
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Type</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Beløb</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Andel af salgspris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* COST - Individual categories */}
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Materialer</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.materials.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.materials / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Materialetransport</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.material_transport.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.material_transport / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Produkttransport</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.product_transport.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.product_transport / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Produktion</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.labor_production.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.labor_production / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">DK montage</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.labor_dk.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.labor_dk / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Øvrigt</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.other.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.other / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    
                    {/* SUM - Base cost total */}
                    <tr className="bg-blue-50 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2">Base cost i alt</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {baseCostTotal.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((baseCostTotal / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    
                    {/* RISK / RESULT */}
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Risikotillæg</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {riskTotal.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((riskTotal / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Profit</td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-600 font-semibold">
                        {quoteTotals.totalProfit.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-600 font-semibold">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.totalProfit / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    
                    {/* Total selling price */}
                    <tr className="bg-green-50 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2 text-green-700">Salgspris i alt</td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-700">
                        {quoteTotals.totalSellingPrice.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-700">
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Line Modal */}
        <Dialog open={showAddLineModal} onOpenChange={setShowAddLineModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj tilbudslinje</DialogTitle>
              <DialogDescription>
                Opret en ny linje i tilbuddet.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="lineTitle">Titel *</Label>
                <Input
                  id="lineTitle"
                  value={lineFormData.title}
                  onChange={(e) => setLineFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Linjetitel"
                />
              </div>

              <div>
                <Label htmlFor="lineDescription">Beskrivelse</Label>
                <Textarea
                  id="lineDescription"
                  value={lineFormData.description}
                  onChange={(e) => setLineFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beskrivelse af linjen"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lineQuantity">Antal</Label>
                  <Input
                    id="lineQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lineFormData.quantity}
                    onChange={(e) => setLineFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lineUnit">Enhed</Label>
                  <Input
                    id="lineUnit"
                    value={lineFormData.unit}
                    onChange={(e) => setLineFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="stk, m², etc."
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setShowAddLineModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleAddLine}>
                  Tilføj linje
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Product Item Modal */}
        <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj produkt</DialogTitle>
              <DialogDescription>
                Vælg et produkt fra projektet at tilføje til linjen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Søge- og filtersektion */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="product-search">Søg produkter</Label>
                  <Input
                    id="product-search"
                    placeholder="Søg efter navn eller beskrivelse..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="product-type-filter">Filtrer efter type</Label>
                  <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle typer</SelectItem>
                      <SelectItem value="gardin">Gardin</SelectItem>
                      <SelectItem value="køkken">Køkken</SelectItem>
                      <SelectItem value="møbel">Møbel</SelectItem>
                      <SelectItem value="andet">Andet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const filteredProducts = getFilteredProducts();
                return filteredProducts.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredProducts.map((product) => {
                      // Beregn total cost korrekt ved at bruge calculateProductCost
                      const costCalculation = calculateProductCost(product.id);
                      const totalCost = costCalculation.grandTotal;
                      
                      return (
                        <div 
                          key={product.id} 
                          className={`p-3 border rounded ${selectedProductForAdd === product.id ? 'border-primary bg-primary/5' : 'cursor-pointer hover:bg-muted/50'}`}
                          onClick={() => {
                            if (selectedProductForAdd !== product.id) {
                              setSelectedProductForAdd(product.id);
                              setProductQuantity(1);
                            }
                          }}
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Cost: {formatCurrency(totalCost)}
                            {product.type && (
                              <span className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                                {product.type}
                              </span>
                            )}
                          </div>
                          
                          {selectedProductForAdd === product.id && (
                            <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <Label htmlFor="product-quantity">Antal</Label>
                                <Input
                                  id="product-quantity"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={productQuantity}
                                  onChange={(e) => setProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleAddProductItem(product.id, productQuantity)}
                                  className="flex-1"
                                >
                                  Tilføj {productQuantity > 1 ? `(${productQuantity} stk)` : ''}
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedProductForAdd(null);
                                    setProductQuantity(1);
                                  }}
                                >
                                  Annullér
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ingen produkter matcher søgningen</p>
                  <p className="text-sm">
                    {products.length === 0 
                      ? "Opret produkter først for at kunne tilføje dem"
                      : "Prøv at ændre søgekriterier eller filter"
                    }
                  </p>
                </div>
                );
              })()}
              
              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => {
                  setShowAddItemModal(false);
                  setSelectedProductForAdd(null);
                  setProductQuantity(1);
                }} variant="outline">
                  Luk
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Custom Item Modal */}
        <Dialog open={showCustomItemModal} onOpenChange={setShowCustomItemModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj custom cost</DialogTitle>
              <DialogDescription>
                Opret en custom cost item til linjen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="customTitle">Titel *</Label>
                <Input
                  id="customTitle"
                  value={customItemFormData.title}
                  onChange={(e) => setCustomItemFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Item titel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customQty">Antal</Label>
                  <Input
                    id="customQty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={customItemFormData.qty}
                    onChange={(e) => setCustomItemFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="customUnit">Enhed</Label>
                  <Input
                    id="customUnit"
                    value={customItemFormData.unit}
                    onChange={(e) => setCustomItemFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="stk, m², etc."
                  />
                </div>
              </div>


              <div>
                <Label htmlFor="totalCostPerUnit">Total cost pr. unit</Label>
                <Input
                  id="totalCostPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customItemFormData.totalCostPerUnit}
                  onChange={(e) => setCustomItemFormData(prev => ({ ...prev, totalCostPerUnit: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setShowCustomItemModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleAddCustomItem}>
                  Tilføj item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Line Modal */}
        <Dialog open={editingLine !== null} onOpenChange={() => setEditingLine(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redigér tilbudslinje</DialogTitle>
              <DialogDescription>
                Redigér oplysningerne for tilbudslinjen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="editLineTitle">Titel *</Label>
                <Input
                  id="editLineTitle"
                  value={editLineFormData.title}
                  onChange={(e) => setEditLineFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Linjetitel"
                />
              </div>

              <div>
                <Label htmlFor="editLineDescription">Beskrivelse</Label>
                <Textarea
                  id="editLineDescription"
                  value={editLineFormData.description}
                  onChange={(e) => setEditLineFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beskrivelse af linjen"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editLineQuantity">Antal</Label>
                  <Input
                    id="editLineQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editLineFormData.quantity}
                    onChange={(e) => setEditLineFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="editLineUnit">Enhed</Label>
                  <Input
                    id="editLineUnit"
                    value={editLineFormData.unit}
                    onChange={(e) => setEditLineFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="stk, m², etc."
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setEditingLine(null)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={() => editingLine && handleUpdateLine(editingLine)}>
                  Gem ændringer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Delete Line Confirmation Dialog */}
        <Dialog open={showDeleteLineConfirm} onOpenChange={setShowDeleteLineConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slet tilbudslinje</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">Er du sikker på, at du vil slette denne tilbudslinje?</p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Sletning er permanent.</strong> Du kan i stedet vælge at arkivere linjen.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteLineConfirm(false);
                  setLineToDelete(null);
                }}
              >
                Annullér
              </Button>
              <Button 
                variant="secondary" 
                onClick={confirmArchiveInstead}
              >
                Arkivér i stedet
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteLine}
              >
                Slet permanent
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Item Confirmation Dialog */}
        <Dialog open={showDeleteItemConfirm} onOpenChange={setShowDeleteItemConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slet item</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">Er du sikker på, at du vil slette dette item?</p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Sletning er permanent.</strong> Itemet vil blive fjernet fra tilbudslinjen.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteItemConfirm(false);
                  setItemToDelete(null);
                }}
              >
                Annullér
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteItem}
                disabled={deletingItem !== null}
              >
                Slet permanent
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Update All Prices Confirmation Dialog */}
        <Dialog open={showUpdateAllConfirm} onOpenChange={setShowUpdateAllConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opdater alle produktpriser?</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">
                Dette vil opdatere ALLE {lines.flatMap(line => line.items.filter(item => item.sourceType === 'project_product' && item.projectProductId)).length} produkter i tilbuddet til deres nyeste priser fra produktdatabasen.
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Eksisterende priser vil blive overskrevet.</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Dette kan tage et øjeblik afhængigt af antallet af produkter.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowUpdateAllConfirm(false)}
                disabled={updatingAllPrices}
              >
                Annullér
              </Button>
              <Button 
                onClick={updateAllProductPrices}
                disabled={updatingAllPrices}
              >
                Opdater alle priser
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectQuoteDetail;