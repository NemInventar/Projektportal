import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
  Plus, 
  FileText,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Archive,
  ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';

interface ProjectBudget {
  id: string;
  projectId: string;
  sourceQuoteId?: string;
  budgetNumber: string;
  title: string;
  status: 'active' | 'locked' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  totals?: {
    lineCount: number;
    lockedSellTotal: number;
    currentCostTotal: number;
    realizedProfit: number;
    dbPercent: number;
  };
}

const ProjectBudgets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  
  // State
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [budgetTotals, setBudgetTotals] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ProjectBudget | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    status: 'active' as const,
    notes: ''
  });
  
  const [editBudgetFormData, setEditBudgetFormData] = useState({
    title: '',
    status: 'active' as const,
    notes: ''
  });

  // Group budgets by status
  const groupedBudgets = {
    active: budgets.filter(b => b.status === 'active'),
    locked: budgets.filter(b => b.status === 'locked'),
    archived: budgets.filter(b => b.status === 'archived')
  };
  
  const statusLabels = {
    active: 'Aktive',
    locked: 'Låste',
    archived: 'Arkiverede'
  };
  
  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'locked': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusLabel = (status: string) => {
    return statusLabels[status as keyof typeof statusLabels] || status;
  };
  
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr`;
  };
  
  // Beregn sektions totaler
  const calculateSectionTotals = (budgets: ProjectBudget[]) => {
    const totals = budgets.reduce((acc, budget) => {
      const budgetTotal = budgetTotals[budget.id];
      if (budgetTotal) {
        acc.count += 1;
        acc.lockedSellTotal += budgetTotal.lockedSellTotal || 0;
        acc.currentCostTotal += budgetTotal.currentCostTotal || 0;
        acc.realizedProfit += budgetTotal.realizedProfit || 0;
      }
      return acc;
    }, { count: 0, lockedSellTotal: 0, currentCostTotal: 0, realizedProfit: 0 });
    
    const dbPercent = totals.lockedSellTotal > 0 ? (totals.realizedProfit / totals.lockedSellTotal) * 100 : 0;
    
    return { ...totals, dbPercent };
  };
  
  // Collapsible sections state with localStorage persistence
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('nem_inventar_expanded_budget_sections');
      return saved ? JSON.parse(saved) : {
        active: true,
        locked: true,
        archived: true
      };
    } catch {
      return {
        active: true,
        locked: true,
        archived: true
      };
    }
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => {
      const newState = {
        ...prev,
        [section]: !prev[section]
      };
      // Save to localStorage
      localStorage.setItem('nem_inventar_expanded_budget_sections', JSON.stringify(newState));
      return newState;
    });
  };

  // Load budgets
  useEffect(() => {
    if (activeProject) {
      loadBudgets();
    }
  }, [activeProject]);

  // Beregn budget totaler
  const calculateBudgetTotals = async (budgetId: string) => {
    try {
      const { data: linesData, error } = await supabase
        .from('project_budget_lines_2026_01_22_00_00')
        .select(`
          *,
          project_budget_line_items_2026_01_22_00_00(*)
        `)
        .eq('project_budget_id', budgetId);

      if (error || !linesData) {
        return { lineCount: 0, lockedSellTotal: 0, currentCostTotal: 0, realizedProfit: 0, dbPercent: 0 };
      }

      let lockedSellTotal = 0;
      let currentCostTotal = 0;
      const lineCount = linesData.length;

      linesData.forEach(line => {
        const quantity = parseFloat(line.quantity);
        
        // Locked sell total fra budget line
        lockedSellTotal += parseFloat(line.locked_sell_total || 0);
        
        // Current cost fra current mode items
        const currentItems = (line.project_budget_line_items_2026_01_22_00_00 || [])
          .filter(item => item.mode === 'current');
        
        const lineCost = currentItems.reduce((sum, item) => {
          const itemCost = item.snapshot_cost_total_per_unit || 0;
          return sum + (itemCost * (item.qty || 0));
        }, 0);

        currentCostTotal += lineCost;
      });

      const realizedProfit = lockedSellTotal - currentCostTotal;
      const dbPercent = lockedSellTotal > 0 ? (realizedProfit / lockedSellTotal) * 100 : 0;

      return { lineCount, lockedSellTotal, currentCostTotal, realizedProfit, dbPercent };
    } catch (error) {
      console.error('Error calculating budget totals:', error);
      return { lineCount: 0, lockedSellTotal: 0, currentCostTotal: 0, realizedProfit: 0, dbPercent: 0 };
    }
  };

  const loadBudgets = async () => {
    if (!activeProject) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .select('*')
        .eq('project_id', activeProject.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBudgets: ProjectBudget[] = data.map(budget => ({
        id: budget.id,
        projectId: budget.project_id,
        sourceQuoteId: budget.source_quote_id,
        budgetNumber: budget.budget_number,
        title: budget.title,
        status: budget.status,
        createdAt: new Date(budget.created_at),
        updatedAt: new Date(budget.updated_at)
      }));

      setBudgets(formattedBudgets);
      
      // Beregn totaler for alle budgetter
      const totalsPromises = formattedBudgets.map(async (budget) => {
        const totals = await calculateBudgetTotals(budget.id);
        return { budgetId: budget.id, totals };
      });
      
      const totalsResults = await Promise.all(totalsPromises);
      const totalsMap = totalsResults.reduce((acc, { budgetId, totals }) => {
        acc[budgetId] = totals;
        return acc;
      }, {} as {[key: string]: any});
      
      setBudgetTotals(totalsMap);
    } catch (error) {
      console.error('Error loading budgets:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse budgetter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    if (!activeProject || !formData.title.trim()) return;

    try {
      setSavingBudget(true);
      
      const { data, error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .insert({
          project_id: activeProject.id,
          budget_number: `B-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
          title: formData.title.trim(),
          status: formData.status
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Budget oprettet",
        description: `Budget "${formData.title}" er blevet oprettet`,
      });

      setShowCreateModal(false);
      setFormData({ title: '', status: 'active', notes: '' });
      loadBudgets();
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke oprette budget",
        variant: "destructive",
      });
    } finally {
      setSavingBudget(false);
    }
  };

  const handleEditBudget = (budget: ProjectBudget) => {
    setEditingBudget(budget);
    setEditBudgetFormData({
      title: budget.title,
      status: budget.status,
      notes: ''
    });
    setShowEditModal(true);
  };

  const handleUpdateBudget = async () => {
    if (!editingBudget || !editBudgetFormData.title.trim()) return;

    try {
      setSavingBudget(true);
      
      const { error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .update({
          title: editBudgetFormData.title.trim(),
          status: editBudgetFormData.status
        })
        .eq('id', editingBudget.id);

      if (error) throw error;

      toast({
        title: "Budget opdateret",
        description: "Budgettet er blevet opdateret",
      });

      setShowEditModal(false);
      setEditingBudget(null);
      loadBudgets();
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere budget",
        variant: "destructive",
      });
    } finally {
      setSavingBudget(false);
    }
  };

  const handleArchiveBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .update({ status: 'archived' })
        .eq('id', budgetId);

      if (error) throw error;

      toast({
        title: "Budget arkiveret",
        description: "Budgettet er blevet arkiveret",
      });

      loadBudgets();
    } catch (error) {
      console.error('Error archiving budget:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke arkivere budget",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette budget? Dette kan ikke fortrydes.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .delete()
        .eq('id', budgetId);

      if (error) throw error;

      toast({
        title: "Budget slettet",
        description: "Budgettet er blevet slettet permanent",
      });

      loadBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke slette budget",
        variant: "destructive",
      });
    }
  };

  const renderBudgetTable = (budgets: ProjectBudget[], status: string) => {
    if (budgets.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Ingen budgetter i denne kategori</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nr.</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Kilde</TableHead>
            <TableHead className="text-right">#Linjer</TableHead>
            <TableHead className="text-right">Locked Salg</TableHead>
            <TableHead className="text-right">Current Cost</TableHead>
            <TableHead className="text-right">Realiseret DB</TableHead>
            <TableHead className="text-right">DB %</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Oprettet</TableHead>
            <TableHead>Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((budget) => (
            <TableRow 
              key={budget.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/project/budgets/${budget.id}`)}
            >
              <TableCell className="font-medium">{budget.budgetNumber}</TableCell>
              <TableCell>{budget.title}</TableCell>
              <TableCell>
                {budget.sourceQuoteId ? (
                  <Badge variant="outline">Fra tilbud</Badge>
                ) : (
                  <span className="text-muted-foreground">Manuel</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {budgetTotals[budget.id]?.lineCount || 0}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(budgetTotals[budget.id]?.lockedSellTotal || 0)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(budgetTotals[budget.id]?.currentCostTotal || 0)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(budgetTotals[budget.id]?.realizedProfit || 0)}
              </TableCell>
              <TableCell className="text-right">
                <span className={(budgetTotals[budget.id]?.dbPercent || 0) < 0 ? 'text-red-600' : 'text-green-600'}>
                  {(budgetTotals[budget.id]?.dbPercent || 0).toFixed(1)}%
                </span>
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(budget.status)}>
                  {getStatusLabel(budget.status)}
                </Badge>
              </TableCell>
              <TableCell>{budget.createdAt.toLocaleDateString('da-DK')}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/project/budgets/${budget.id}`);
                    }}
                    title="Åbn budget"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBudget(budget);
                    }}
                    title="Rediger budget"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveBudget(budget.id);
                    }}
                    title="Arkiver budget"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBudget(budget.id);
                    }}
                    title="Slet budget"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Vælg et projekt</h2>
            <p className="text-muted-foreground">Du skal vælge et projekt for at se budgetter.</p>
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
            <p>Indlæser budgetter...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Budgetter</h1>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nyt budget
          </Button>
        </div>

        {/* Budgets */}
        <Card>
          <CardHeader>
            <CardTitle>Budgetoversigt</CardTitle>
          </CardHeader>
          <CardContent>
            {budgets.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Ingen budgetter endnu</h3>
                <p>Opret dit første budget for at komme i gang</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Aktive */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedBudgets.active);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('active')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.active ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-green-700">Aktive</h3>
                        </div>
                        <div className="text-base text-green-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Locked Salg: {formatCurrency(totals.lockedSellTotal)}</span>
                          <span>Current Cost: {formatCurrency(totals.currentCostTotal)}</span>
                          <span>DB: {formatCurrency(totals.realizedProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.active && renderBudgetTable(groupedBudgets.active, 'active')}
                </div>
                
                {/* Låste */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedBudgets.locked);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('locked')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.locked ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-blue-700">Låste</h3>
                        </div>
                        <div className="text-base text-blue-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Locked Salg: {formatCurrency(totals.lockedSellTotal)}</span>
                          <span>Current Cost: {formatCurrency(totals.currentCostTotal)}</span>
                          <span>DB: {formatCurrency(totals.realizedProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.locked && renderBudgetTable(groupedBudgets.locked, 'locked')}
                </div>
                
                {/* Arkiverede */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedBudgets.archived);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('archived')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.archived ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-gray-700">Arkiverede</h3>
                        </div>
                        <div className="text-base text-gray-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Locked Salg: {formatCurrency(totals.lockedSellTotal)}</span>
                          <span>Current Cost: {formatCurrency(totals.currentCostTotal)}</span>
                          <span>DB: {formatCurrency(totals.realizedProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.archived && renderBudgetTable(groupedBudgets.archived, 'archived')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret nyt budget</DialogTitle>
              <DialogDescription>
                Udfyld informationerne for det nye budget
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Budget titel"
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="locked">Låst</SelectItem>
                    <SelectItem value="archived">Arkiveret</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Noter</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Valgfrie noter"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Annuller
              </Button>
              <Button onClick={handleCreateBudget} disabled={savingBudget || !formData.title.trim()}>
                {savingBudget ? 'Opretter...' : 'Opret budget'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rediger budget</DialogTitle>
              <DialogDescription>
                Opdater budget informationer
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="editTitle">Titel</Label>
                <Input
                  id="editTitle"
                  value={editBudgetFormData.title}
                  onChange={(e) => setEditBudgetFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Budget titel"
                />
              </div>

              <div>
                <Label htmlFor="editStatus">Status</Label>
                <Select value={editBudgetFormData.status} onValueChange={(value: any) => setEditBudgetFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="locked">Låst</SelectItem>
                    <SelectItem value="archived">Arkiveret</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editNotes">Noter</Label>
                <Textarea
                  id="editNotes"
                  value={editBudgetFormData.notes}
                  onChange={(e) => setEditBudgetFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Valgfrie noter"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Annuller
              </Button>
              <Button onClick={handleUpdateBudget} disabled={savingBudget || !editBudgetFormData.title.trim()}>
                {savingBudget ? 'Opdaterer...' : 'Opdater budget'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectBudgets;