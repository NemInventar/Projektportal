import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ArrowLeft,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';

interface ProjectBudget {
  id: string;
  projectId: string;
  sourceQuoteId?: string;
  budgetNumber: string;
  title: string;
  status: 'active' | 'locked' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

interface SourceQuote {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
}

interface BudgetLineItem {
  id: string;
  projectBudgetLineId: string;
  sourceQuoteLineItemId?: string;
  sourceType: 'project_product' | 'custom';
  projectProductId?: string;
  title: string;
  qty: number;
  unit: string;
  mode: 'baseline' | 'current';
  baselineCostBreakdown: any;
  baselineCostTotalPerUnit: number;
  productSnapshotUpdatedAt?: Date;
  snapshotCostBreakdown: any;
  snapshotCostTotalPerUnit: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BudgetLine {
  id: string;
  projectBudgetId: string;
  sourceQuoteLineId?: string;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  lockedSellTotal: number;
  baselineCostTotal: number;
  baselineCostBreakdown: any;
  baselineRiskTotal: number;
  createdAt: Date;
  updatedAt: Date;
  items: BudgetLineItem[];
}

const ProjectBudgetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { products } = useProjectProducts();
  
  // State
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [sourceQuote, setSourceQuote] = useState<SourceQuote | null>(null);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedLineForItems, setSelectedLineForItems] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<BudgetLineItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  
  // Form data for editing items
  const [editItemFormData, setEditItemFormData] = useState({
    qty: 1
  });

  useEffect(() => {
    if (id && activeProject) {
      loadBudgetData();
    }
  }, [id, activeProject]);

  const loadBudgetData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Load budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .select('*')
        .eq('id', id)
        .single();

      if (budgetError) throw budgetError;

      const formattedBudget: ProjectBudget = {
        id: budgetData.id,
        projectId: budgetData.project_id,
        sourceQuoteId: budgetData.source_quote_id,
        budgetNumber: budgetData.budget_number,
        title: budgetData.title,
        status: budgetData.status,
        createdAt: new Date(budgetData.created_at),
        updatedAt: new Date(budgetData.updated_at)
      };

      setBudget(formattedBudget);

      // Load source quote if exists
      if (budgetData.source_quote_id) {
        const { data: quoteData, error: quoteError } = await supabase
          .from('project_quotes_2026_01_16_23_00')
          .select('id, quote_number, title, status')
          .eq('id', budgetData.source_quote_id)
          .single();

        if (!quoteError && quoteData) {
          setSourceQuote({
            id: quoteData.id,
            quoteNumber: quoteData.quote_number,
            title: quoteData.title,
            status: quoteData.status
          });
        }
      }

      // Load budget lines
      const { data: linesData, error: linesError } = await supabase
        .from('project_budget_lines_2026_01_22_00_00')
        .select(`
          *,
          project_budget_line_items_2026_01_22_00_00(*)
        `)
        .eq('project_budget_id', id)
        .order('sort_order');

      if (linesError) throw linesError;

      if (linesData) {
        const formattedLines: BudgetLine[] = linesData.map(line => ({
          id: line.id,
          projectBudgetId: line.project_budget_id,
          sourceQuoteLineId: line.source_quote_line_id,
          title: line.title,
          description: line.description,
          quantity: parseFloat(line.quantity),
          unit: line.unit,
          sortOrder: line.sort_order,
          lockedSellTotal: parseFloat(line.locked_sell_total || 0),
          baselineCostTotal: parseFloat(line.baseline_cost_total || 0),
          baselineCostBreakdown: line.baseline_cost_breakdown_json || {},
          baselineRiskTotal: parseFloat(line.baseline_risk_total || 0),
          createdAt: new Date(line.created_at),
          updatedAt: new Date(line.updated_at),
          items: (line.project_budget_line_items_2026_01_22_00_00 || []).map((item: any) => ({
            id: item.id,
            projectBudgetLineId: item.project_budget_line_id,
            sourceQuoteLineItemId: item.source_quote_line_item_id,
            sourceType: item.source_type,
            projectProductId: item.project_product_id,
            title: item.title,
            qty: parseFloat(item.qty),
            unit: item.unit,
            mode: item.mode,
            baselineCostBreakdown: item.baseline_cost_breakdown_json || {},
            baselineCostTotalPerUnit: parseFloat(item.baseline_cost_total_per_unit || 0),
            productSnapshotUpdatedAt: item.product_snapshot_updated_at ? new Date(item.product_snapshot_updated_at) : undefined,
            snapshotCostBreakdown: item.snapshot_cost_breakdown_json || {},
            snapshotCostTotalPerUnit: parseFloat(item.snapshot_cost_total_per_unit || 0),
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
          }))
        }));
        setBudgetLines(formattedLines);
      }

    } catch (error) {
      console.error('Error loading budget data:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse budgetdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr`;
  };

  // Toggle expanded state for budget lines
  const toggleLineExpanded = (lineId: string) => {
    setExpandedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  // Beregningsfunktioner for budget line totaler
  const calculateLineCurrentBaseCost = (line: BudgetLine) => {
    return line.items
      .filter(item => item.mode === 'current')
      .reduce((sum, item) => sum + (item.snapshotCostTotalPerUnit * item.qty), 0);
  };

  const calculateLineCurrentTotalCost = (line: BudgetLine) => {
    const currentBaseCost = calculateLineCurrentBaseCost(line);
    return currentBaseCost + line.baselineRiskTotal; // V1: use baseline risk
  };

  const calculateLineBaselineTotalCost = (line: BudgetLine) => {
    return line.baselineCostTotal + line.baselineRiskTotal;
  };

  const calculateLineVarianceKr = (line: BudgetLine) => {
    const currentTotalCost = calculateLineCurrentTotalCost(line);
    const baselineTotalCost = calculateLineBaselineTotalCost(line);
    return currentTotalCost - baselineTotalCost;
  };

  const calculateLineVariancePercent = (line: BudgetLine) => {
    const baselineTotalCost = calculateLineBaselineTotalCost(line);
    if (baselineTotalCost === 0) return 0;
    const varianceKr = calculateLineVarianceKr(line);
    return (varianceKr / baselineTotalCost) * 100;
  };

  const calculateLineDbKr = (line: BudgetLine) => {
    const currentTotalCost = calculateLineCurrentTotalCost(line);
    return line.lockedSellTotal - currentTotalCost;
  };

  const calculateLineDbPercent = (line: BudgetLine) => {
    if (line.lockedSellTotal === 0) return 0;
    const dbKr = calculateLineDbKr(line);
    return (dbKr / line.lockedSellTotal) * 100;
  };

  // Check if product has been updated since snapshot
  const isProductUpdated = (item: BudgetLineItem) => {
    if (!item.projectProductId) {
      console.log('Missing productId for item:', item.title);
      return false;
    }
    
    // If no snapshot date, assume it needs updating
    if (!item.productSnapshotUpdatedAt) {
      console.log('No snapshot date for item:', item.title, '- assuming needs update');
      return true;
    }
    
    const product = products.find(p => p.id === item.projectProductId);
    if (!product) {
      console.log('Product not found for item:', item.title, 'productId:', item.projectProductId);
      return false;
    }
    
    const productUpdated = new Date(product.updatedAt);
    const snapshotDate = new Date(item.productSnapshotUpdatedAt);
    
    console.log('Checking product update for:', item.title);
    console.log('Product updated at:', productUpdated.toISOString());
    console.log('Snapshot taken at:', snapshotDate.toISOString());
    console.log('Is updated:', productUpdated > snapshotDate);
    
    return productUpdated > snapshotDate;
  };

  // Update snapshot for a current item
  const handleUpdateSnapshot = async (item: BudgetLineItem) => {
    if (!item.projectProductId) return;
    
    try {
      setSavingItem(true);
      
      const product = products.find(p => p.id === item.projectProductId);
      if (!product) {
        toast({
          title: "Fejl",
          description: "Produkt ikke fundet",
          variant: "destructive",
        });
        return;
      }

      // Get current product cost data
      const costBreakdown = product.costBreakdown || {};
      const costTotalPerUnit = product.costTotalPerUnit || 0;

      const { error } = await supabase
        .from('project_budget_line_items_2026_01_22_00_00')
        .update({
          product_snapshot_updated_at: new Date().toISOString(),
          snapshot_cost_breakdown_json: costBreakdown,
          snapshot_cost_total_per_unit: costTotalPerUnit
        })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Snapshot opdateret",
        description: `Snapshot for ${item.title} er blevet opdateret med nye produktpriser`,
      });

      // Reload budget data to refresh the items and recalculate totals
      await loadBudgetData();
    } catch (error) {
      console.error('Error updating snapshot:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere snapshot",
        variant: "destructive",
      });
    } finally {
      setSavingItem(false);
    }
  };

  // Update all snapshots for a line
  const handleUpdateAllSnapshots = async (line: BudgetLine) => {
    const outdatedItems = line.items.filter(item => item.mode === 'current' && isProductUpdated(item));
    
    if (outdatedItems.length === 0) return;
    
    try {
      setSavingItem(true);
      
      for (const item of outdatedItems) {
        if (!item.projectProductId) continue;
        
        const product = products.find(p => p.id === item.projectProductId);
        if (!product) continue;

        const costBreakdown = product.costBreakdown || {};
        const costTotalPerUnit = product.costTotalPerUnit || 0;

        await supabase
          .from('project_budget_line_items_2026_01_22_00_00')
          .update({
            product_snapshot_updated_at: new Date().toISOString(),
            snapshot_cost_breakdown_json: costBreakdown,
            snapshot_cost_total_per_unit: costTotalPerUnit
          })
          .eq('id', item.id);
      }
      
      toast({
        title: "Alle snapshots opdateret",
        description: `${outdatedItems.length} snapshots er blevet opdateret`,
      });
      
      // Reload budget data
      await loadBudgetData();
    } catch (error) {
      console.error('Error updating all snapshots:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere alle snapshots",
        variant: "destructive",
      });
    } finally {
      setSavingItem(false);
    }
  };

  // Current items management functions
  const handleAddProductItem = async (productId: string, lineId: string) => {
    try {
      setSavingItem(true);
      
      const product = products.find(p => p.id === productId);
      if (!product) {
        toast({
          title: "Fejl",
          description: "Produkt ikke fundet",
          variant: "destructive",
        });
        return;
      }

      // Get current product cost data
      const costBreakdown = product.costBreakdown || {};
      const costTotalPerUnit = product.costTotalPerUnit || 0;

      const { data, error } = await supabase
        .from('project_budget_line_items_2026_01_22_00_00')
        .insert({
          project_budget_line_id: lineId,
          source_type: 'project_product',
          project_product_id: productId,
          title: product.name,
          qty: 1,
          unit: product.unit,
          mode: 'current',
          baseline_cost_breakdown_json: costBreakdown,
          baseline_cost_total_per_unit: costTotalPerUnit,
          product_snapshot_updated_at: new Date().toISOString(),
          snapshot_cost_breakdown_json: costBreakdown,
          snapshot_cost_total_per_unit: costTotalPerUnit
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Item tilføjet",
        description: `${product.name} er tilføjet til budget linjen`,
      });

      // Reload budget data to refresh the items
      await loadBudgetData();
      setShowAddItemModal(false);
      setSelectedLineForItems(null);
    } catch (error) {
      console.error('Error adding product item:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke tilføje item",
        variant: "destructive",
      });
    } finally {
      setSavingItem(false);
    }
  };

  const handleEditItemQty = (item: BudgetLineItem) => {
    setEditingItem(item);
    setEditItemFormData({ qty: item.qty });
  };

  const handleUpdateItemQty = async () => {
    if (!editingItem) return;

    try {
      setSavingItem(true);
      
      const { error } = await supabase
        .from('project_budget_line_items_2026_01_22_00_00')
        .update({ qty: editItemFormData.qty })
        .eq('id', editingItem.id);

      if (error) throw error;

      toast({
        title: "Item opdateret",
        description: "Antal er blevet opdateret",
      });

      // Reload budget data
      await loadBudgetData();
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item qty:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere antal",
        variant: "destructive",
      });
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette item?')) return;

    try {
      setDeletingItem(itemId);
      
      const { error } = await supabase
        .from('project_budget_line_items_2026_01_22_00_00')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Item slettet",
        description: "Item er blevet slettet",
      });

      // Reload budget data
      await loadBudgetData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke slette item",
        variant: "destructive",
      });
    } finally {
      setDeletingItem(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'locked': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      active: 'Aktiv',
      locked: 'Låst',
      archived: 'Arkiveret'
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Vælg et projekt</h2>
            <p className="text-muted-foreground">Du skal vælge et projekt for at se budgetdetaljer.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <p>Indlæser budgetdata...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!budget) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Budget ikke fundet</h2>
            <p className="text-muted-foreground mb-4">Det angivne budget kunne ikke findes.</p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/project/budgets')}
            >
              ← Tilbage til budgetter
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

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
                onClick={() => navigate('/project/budgets')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til budgetter
              </Button>
              <h1 className="text-3xl font-bold">{budget.title}</h1>
              <Badge variant="secondary">{budget.budgetNumber}</Badge>
              <Badge className={getStatusColor(budget.status)}>
                {getStatusLabel(budget.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
            
            {/* Source Quote Link */}
            {sourceQuote && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/project/quotes/${sourceQuote.id}`)}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Vis kildetilbud: {sourceQuote.quoteNumber}
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Budget Content Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Detaljer</CardTitle>
          </CardHeader>
          <CardContent>
            {budgetLines.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Ingen budget linjer</h3>
                <p className="text-muted-foreground">
                  Dette budget har ingen linjer endnu
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Budget Linjer ({budgetLines.length})</h3>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Beskrivelse</TableHead>
                      <TableHead className="text-right">Antal</TableHead>
                      <TableHead className="text-right">Locked Salg</TableHead>
                      <TableHead className="text-right">Baseline Total</TableHead>
                      <TableHead className="text-right">Current Base</TableHead>
                      <TableHead className="text-right">Current Total</TableHead>
                      <TableHead className="text-right">Variance Kr</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                      <TableHead className="text-right">DB Kr</TableHead>
                      <TableHead className="text-right">DB %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetLines.map((line) => {
                      const baselineTotalCost = calculateLineBaselineTotalCost(line);
                      const currentBaseCost = calculateLineCurrentBaseCost(line);
                      const currentTotalCost = calculateLineCurrentTotalCost(line);
                      const varianceKr = calculateLineVarianceKr(line);
                      const variancePercent = calculateLineVariancePercent(line);
                      const dbKr = calculateLineDbKr(line);
                      const dbPercent = calculateLineDbPercent(line);
                      const isExpanded = expandedLines.has(line.id);
                      const baselineItems = line.items.filter(item => item.mode === 'baseline');
                      
                      return (
                        <React.Fragment key={line.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleLineExpanded(line.id)}
                                  className="p-1 hover:bg-muted rounded transition-colors"
                                  title={isExpanded ? 'Fold sammen' : 'Fold ud'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                {line.title}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {line.description || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {line.quantity} {line.unit}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(line.lockedSellTotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(baselineTotalCost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(currentBaseCost)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(currentTotalCost)}
                            </TableCell>
                            <TableCell className={`text-right ${
                              varianceKr > 0 ? 'text-red-600' : varianceKr < 0 ? 'text-green-600' : ''
                            }`}>
                              {formatCurrency(varianceKr)}
                            </TableCell>
                            <TableCell className={`text-right ${
                              variancePercent > 0 ? 'text-red-600' : variancePercent < 0 ? 'text-green-600' : ''
                            }`}>
                              {variancePercent.toFixed(1)}%
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              dbKr < 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {formatCurrency(dbKr)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              dbPercent < 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {dbPercent.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded content showing baseline and current items */}
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={11} className="p-0">
                                <div className="bg-muted/30 p-4 space-y-6">
                                  {/* Baseline Items (Read-only) */}
                                  {baselineItems.length > 0 && (
                                    <div>
                                      <h5 className="font-medium mb-3 text-sm text-muted-foreground">
                                        Baseline Items (fra oprindeligt tilbud)
                                      </h5>
                                      <div className="bg-background rounded border">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="text-xs">Produkt Titel</TableHead>
                                              <TableHead className="text-right text-xs">Antal</TableHead>
                                              <TableHead className="text-right text-xs">Cost per Unit</TableHead>
                                              <TableHead className="text-right text-xs">Total Cost</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {baselineItems.map((item) => (
                                              <TableRow key={item.id} className="text-sm">
                                                <TableCell className="font-medium">
                                                  {item.title}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {item.qty} {item.unit}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {formatCurrency(item.snapshotCostTotalPerUnit)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                  {formatCurrency(item.snapshotCostTotalPerUnit * item.qty)}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Current Items (Editable) */}
                                  <div>
                                    <div className="flex justify-between items-center mb-3">
                                      <h5 className="font-medium text-sm text-muted-foreground">
                                        Current Items (nuværende budget)
                                      </h5>
                                      <div className="flex gap-2">
                                        {line.items.filter(item => item.mode === 'current').length > 0 && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleUpdateAllSnapshots(line)}
                                            disabled={savingItem}
                                            className="gap-1 h-7 text-xs"
                                            title="Opdater alle ændrede snapshots"
                                          >
                                            <RefreshCw className="h-3 w-3" />
                                            Opdater alle ({line.items.filter(item => item.mode === 'current' && isProductUpdated(item)).length})
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setSelectedLineForItems(line.id);
                                            setShowAddItemModal(true);
                                          }}
                                          className="gap-1 h-7 text-xs"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Tilføj produkt
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="bg-background rounded border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs">Produkt Titel</TableHead>
                                            <TableHead className="text-right text-xs">Antal</TableHead>
                                            <TableHead className="text-right text-xs">Cost per Unit</TableHead>
                                            <TableHead className="text-right text-xs">Total Cost</TableHead>
                                            <TableHead className="text-right text-xs">Handlinger</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {line.items.filter(item => item.mode === 'current').map((item) => (
                                            <TableRow key={item.id} className="text-sm">
                                              <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                  {item.title}
                                                  {/* Always show badge for testing */}
                                                  {item.projectProductId && (
                                                    <Badge variant="destructive" className="text-xs px-1 py-0 h-4">
                                                      <AlertTriangle className="h-2 w-2 mr-1" />
                                                      Ændret
                                                    </Badge>
                                                  )}
                                                  {/* Debug info */}
                                                  <div className="text-xs text-muted-foreground">
                                                    {(() => {
                                                      const product = products.find(p => p.id === item.projectProductId);
                                                      return `(P: ${product?.updatedAt ? new Date(product.updatedAt).toLocaleString('da-DK') : 'N/A'}, S: ${item.productSnapshotUpdatedAt ? new Date(item.productSnapshotUpdatedAt).toLocaleString('da-DK') : 'N/A'})`;
                                                    })()} 
                                                  </div>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {item.qty} {item.unit}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {formatCurrency(item.snapshotCostTotalPerUnit)}
                                              </TableCell>
                                              <TableCell className="text-right font-medium">
                                                {formatCurrency(item.snapshotCostTotalPerUnit * item.qty)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                  {item.projectProductId && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() => handleUpdateSnapshot(item)}
                                                      disabled={savingItem}
                                                      className="h-6 w-6 p-0"
                                                      title="Opdater snapshot med nye produktpriser"
                                                    >
                                                      <RefreshCw className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEditItemQty(item)}
                                                    className="h-6 w-6 p-0"
                                                    title="Rediger antal"
                                                  >
                                                    <Edit className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    disabled={deletingItem === item.id}
                                                    className="h-6 w-6 p-0"
                                                    title="Slet item"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                          {line.items.filter(item => item.mode === 'current').length === 0 && (
                                            <TableRow>
                                              <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-xs">
                                                Ingen current items - klik "Tilføj produkt" for at tilføje
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {/* Summary */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Budget Totaler</h4>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Locked Salg</p>
                      <p className="font-medium">
                        {formatCurrency(budgetLines.reduce((sum, line) => sum + line.lockedSellTotal, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Baseline</p>
                      <p className="font-medium">
                        {formatCurrency(budgetLines.reduce((sum, line) => sum + calculateLineBaselineTotalCost(line), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Current</p>
                      <p className="font-medium">
                        {formatCurrency(budgetLines.reduce((sum, line) => sum + calculateLineCurrentTotalCost(line), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Variance</p>
                      <p className={`font-medium ${
                        budgetLines.reduce((sum, line) => sum + calculateLineVarianceKr(line), 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(budgetLines.reduce((sum, line) => sum + calculateLineVarianceKr(line), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total DB Kr</p>
                      <p className={`font-medium ${
                        budgetLines.reduce((sum, line) => sum + calculateLineDbKr(line), 0) < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(budgetLines.reduce((sum, line) => sum + calculateLineDbKr(line), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total DB %</p>
                      <p className={`font-medium ${
                        (() => {
                          const totalSell = budgetLines.reduce((sum, line) => sum + line.lockedSellTotal, 0);
                          const totalDbKr = budgetLines.reduce((sum, line) => sum + calculateLineDbKr(line), 0);
                          const totalDbPercent = totalSell > 0 ? (totalDbKr / totalSell) * 100 : 0;
                          return totalDbPercent < 0 ? 'text-red-600' : 'text-green-600';
                        })()
                      }`}>
                        {(() => {
                          const totalSell = budgetLines.reduce((sum, line) => sum + line.lockedSellTotal, 0);
                          const totalDbKr = budgetLines.reduce((sum, line) => sum + calculateLineDbKr(line), 0);
                          const totalDbPercent = totalSell > 0 ? (totalDbKr / totalSell) * 100 : 0;
                          return totalDbPercent.toFixed(1) + '%';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Add Product Item Modal */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tilføj produkt til budget linje</DialogTitle>
            <DialogDescription>
              Vælg et produkt fra projektet at tilføje til budget linjen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Vælg produkt</Label>
              <Select onValueChange={(productId) => {
                if (selectedLineForItems) {
                  handleAddProductItem(productId, selectedLineForItems);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg et produkt..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({formatCurrency(product.costTotalPerUnit || 0)} per {product.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddItemModal(false);
                setSelectedLineForItems(null);
              }}
            >
              Annuller
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Qty Modal */}
      <Dialog open={editingItem !== null} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger antal</DialogTitle>
            <DialogDescription>
              Ændr antallet for {editingItem?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="editQty">Antal</Label>
              <Input
                id="editQty"
                type="number"
                min="0.01"
                step="0.01"
                value={editItemFormData.qty}
                onChange={(e) => setEditItemFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setEditingItem(null)}
            >
              Annuller
            </Button>
            <Button 
              onClick={handleUpdateItemQty}
              disabled={savingItem || editItemFormData.qty <= 0}
            >
              {savingItem ? 'Opdaterer...' : 'Opdater'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ProjectBudgetDetail;