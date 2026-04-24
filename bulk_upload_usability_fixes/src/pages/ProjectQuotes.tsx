import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { calculateLine, pricingFromLine } from '@/lib/quotePricing';
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
  ChevronDown,
  BarChart2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';

interface ProjectQuote {
  id: string;
  projectId: string;
  quoteNumber: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';
  validUntil?: Date;
  notes?: string;
  includeInProjectTotal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectQuotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  
  // Render table for a specific status
  const renderQuoteTable = (statusQuotes: ProjectQuote[], statusKey: string) => {
    if (statusQuotes.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Ingen tilbud i denne kategori
        </div>
      );
    }
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tilbudsnr.</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total salgspris</TableHead>
            <TableHead className="text-right">Total DB</TableHead>
            <TableHead className="text-right">DB %</TableHead>
            <TableHead>Gyldig til</TableHead>
            <TableHead>Oprettet</TableHead>
            <TableHead className="w-10 text-center" title="Tæl med i projektsum">
              <BarChart2 className="h-4 w-4 mx-auto text-muted-foreground" />
            </TableHead>
            <TableHead className="w-32">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statusQuotes.map((quote) => {
            const totals = quoteTotals[quote.id] || { totalSellingPrice: 0, totalCost: 0, totalProfit: 0, dbPercent: 0 };
            return (
              <TableRow 
                key={quote.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/project/quotes/${quote.id}`)}
              >
                <TableCell className="font-mono text-sm">{quote.quoteNumber}</TableCell>
                <TableCell className="font-medium">{quote.title}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(quote.status)}>
                    {getStatusLabel(quote.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(totals.totalSellingPrice)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.totalProfit)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                    {totals.dbPercent.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  {quote.validUntil ? quote.validUntil.toLocaleDateString('da-DK') : '-'}
                </TableCell>
                <TableCell>{quote.createdAt.toLocaleDateString('da-DK')}</TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleInclude(quote.id, quote.includeInProjectTotal); }}
                    title={quote.includeInProjectTotal ? 'Tæller med i projektsum — klik for at fjerne' : 'Tæller ikke med — klik for at tilføje'}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors
                      ${quote.includeInProjectTotal
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 bg-white hover:border-green-400'}`}
                  >
                    {quote.includeInProjectTotal && <span className="text-xs leading-none">✓</span>}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditQuote(quote);
                      }}
                      title="Rediger tilbud"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveQuote(quote.id);
                      }}
                      title="Arkiver tilbud"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuote(quote.id);
                      }}
                      title="Slet tilbud"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };
  
  // State
  const [quotes, setQuotes] = useState<ProjectQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    status: 'draft' as const,
    validUntil: '',
    notes: ''
  });
  
  // Group quotes by status
  const groupedQuotes = {
    draft: quotes.filter(q => q.status === 'draft'),
    sent: quotes.filter(q => q.status === 'sent'),
    accepted: quotes.filter(q => q.status === 'accepted'),
    rejected: quotes.filter(q => q.status === 'rejected')
  };
  
  const statusLabels = {
    draft: 'Kladder',
    sent: 'Sendt',
    accepted: 'Accepteret',
    rejected: 'Afvist'
  };
  
  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusLabel = (status: string) => {
    return statusLabels[status as keyof typeof statusLabels] || status;
  };
  
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr`;
  };
  
  // Calculate section totals
  const calculateSectionTotals = (statusQuotes: ProjectQuote[]) => {
    const count = statusQuotes.length;
    let totalSellingPrice = 0;
    let totalProfit = 0;
    
    statusQuotes.forEach(quote => {
      const totals = quoteTotals[quote.id];
      if (totals) {
        totalSellingPrice += totals.totalSellingPrice;
        totalProfit += totals.totalProfit;
      }
    });
    
    const dbPercent = totalSellingPrice > 0 ? (totalProfit / totalSellingPrice) * 100 : 0;
    
    return {
      count,
      totalSellingPrice,
      totalProfit,
      dbPercent
    };
  };
  
  // State for quote totals
  const [quoteTotals, setQuoteTotals] = useState<{[key: string]: {totalSellingPrice: number, totalCost: number, totalProfit: number, dbPercent: number}}>({});
  
  // Delete/Archive confirmation states
  const [showDeleteQuoteConfirm, setShowDeleteQuoteConfirm] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  
  // Edit quote states
  const [showEditQuoteModal, setShowEditQuoteModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<ProjectQuote | null>(null);
  const [editQuoteFormData, setEditQuoteFormData] = useState({
    title: '',
    status: 'draft' as const,
    validUntil: '',
    notes: ''
  });
  
  // Collapsible sections state with localStorage persistence
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('nem_inventar_expanded_sections');
      return saved ? JSON.parse(saved) : {
        draft: true,
        sent: true,
        accepted: true,
        rejected: true
      };
    } catch {
      return {
        draft: true,
        sent: true,
        accepted: true,
        rejected: true
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
      localStorage.setItem('nem_inventar_expanded_sections', JSON.stringify(newState));
      return newState;
    });
  };

  // Load quotes
  useEffect(() => {
    if (activeProject) {
      loadQuotes();
    }
  }, [activeProject]);

  // Beregn tilbudstotaler via shared helper fra @/lib/quotePricing
  const calculateQuoteTotals = async (quoteId: string) => {
    try {
      const { data: linesData, error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .select(`
          id, quantity, archived,
          pricing_mode, markup_pct, target_unit_price, risk_per_unit,
          project_quote_line_items_2026_01_16_23_00(qty,cost_breakdown_json,cost_total_per_unit)
        `)
        .eq('project_quote_id', quoteId)
        .neq('archived', true);

      if (error || !linesData) {
        return { totalSellingPrice: 0, totalCost: 0, totalProfit: 0, dbPercent: 0 };
      }

      let totalSellingPrice = 0;
      let totalCost = 0;

      linesData.forEach((line: any) => {
        const items = (line.project_quote_line_items_2026_01_16_23_00 || []).map((it: any) => ({
          qty: parseFloat(it.qty) || 0,
          cost_total_per_unit: it.cost_total_per_unit != null ? parseFloat(it.cost_total_per_unit) : null,
          cost_breakdown_json: it.cost_breakdown_json,
        }));
        const t = calculateLine(items, parseFloat(line.quantity) || 0, pricingFromLine(line));
        totalSellingPrice += t.totalSellingPrice;
        totalCost += t.totalCost;
      });

      const totalProfit = totalSellingPrice - totalCost;
      const dbPercent = totalSellingPrice > 0 ? (totalProfit / totalSellingPrice) * 100 : 0;

      return { totalSellingPrice, totalCost, totalProfit, dbPercent };
    } catch (error) {
      console.error('Error calculating quote totals:', error);
      return { totalSellingPrice: 0, totalCost: 0, totalProfit: 0, dbPercent: 0 };
    }
  };

  const loadQuotes = async () => {
    if (!activeProject) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .select('*')
        .eq('project_id', activeProject.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map(q => ({
          id: q.id,
          projectId: q.project_id,
          quoteNumber: q.quote_number,
          title: q.title,
          status: q.status,
          validUntil: q.valid_until ? new Date(q.valid_until) : undefined,
          notes: q.notes,
          includeInProjectTotal: q.include_in_project_total ?? true,
          createdAt: new Date(q.created_at),
          updatedAt: new Date(q.updated_at)
        }));
        setQuotes(formatted);
        
        // Beregn totaler for alle tilbud
        const totalsPromises = formatted.map(async (quote) => {
          const totals = await calculateQuoteTotals(quote.id);
          return { quoteId: quote.id, totals };
        });
        
        const allTotals = await Promise.all(totalsPromises);
        const totalsMap = allTotals.reduce((acc, { quoteId, totals }) => {
          acc[quoteId] = totals;
          return acc;
        }, {} as {[key: string]: any});
        
        setQuoteTotals(totalsMap);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse tilbud",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQuoteNumber = () => {
    const year = new Date().getFullYear();
    const nextNumber = quotes.length + 1;
    return `${year}-${String(nextNumber).padStart(3, '0')}`;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      status: 'draft',
      validUntil: '',
      notes: ''
    });
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!activeProject || !formData.title) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      const quoteData = {
        project_id: activeProject.id,
        quote_number: generateQuoteNumber(),
        title: formData.title,
        status: formData.status,
        valid_until: formData.validUntil || null,
        notes: formData.notes || null
      };

      const { data, error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .insert(quoteData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tilbud oprettet",
        description: "Det nye tilbud er blevet oprettet",
      });

      setShowCreateModal(false);
      loadQuotes();
      
      // Navigate to quote detail
      if (data) {
        navigate(`/project/quotes/${data.id}`);
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved oprettelse",
        variant: "destructive",
      });
    }
  };

  const handleEditQuote = (quote: ProjectQuote) => {
    setEditingQuote(quote);
    setEditQuoteFormData({
      title: quote.title,
      status: quote.status,
      validUntil: quote.validUntil ? quote.validUntil.toISOString().split('T')[0] : '',
      notes: quote.notes || ''
    });
    setShowEditQuoteModal(true);
  };

  const handleUpdateQuote = async () => {
    if (!editingQuote || !editQuoteFormData.title) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: any = {
        title: editQuoteFormData.title,
        status: editQuoteFormData.status,
        notes: editQuoteFormData.notes,
        updated_at: new Date().toISOString()
      };

      if (editQuoteFormData.validUntil) {
        updateData.valid_until = editQuoteFormData.validUntil;
      }

      // Auto-sæt sent_at når status skifter til 'sent' og vi ikke allerede har det.
      // DB-trigger gør det også som backup, men vi sender fra UI så værdien er synlig straks.
      if (editQuoteFormData.status === 'sent' && editingQuote.status !== 'sent') {
        updateData.sent_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .update(updateData)
        .eq('id', editingQuote.id);

      if (error) throw error;

      toast({
        title: "Tilbud opdateret",
        description: "Tilbuddet er blevet opdateret",
      });

      setShowEditQuoteModal(false);
      setEditingQuote(null);
      loadQuotes();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    }
  };

  const handleArchiveQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .update({ status: 'archived' })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: "Tilbud arkiveret",
        description: "Tilbuddet er blevet arkiveret",
      });

      loadQuotes();
    } catch (error) {
      console.error('Error archiving quote:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved arkivering af tilbuddet",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    setQuoteToDelete(quoteId);
    setShowDeleteQuoteConfirm(true);
  };

  const confirmDeleteQuote = async () => {
    if (!quoteToDelete) return;
    
    setShowDeleteQuoteConfirm(false);

    try {
      const { error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .delete()
        .eq('id', quoteToDelete);

      if (error) throw error;

      toast({
        title: "Tilbud slettet",
        description: "Tilbuddet er blevet slettet permanent",
      });

      loadQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved sletning af tilbuddet",
        variant: "destructive",
      });
    } finally {
      setQuoteToDelete(null);
    }
  };

  const handleToggleInclude = async (quoteId: string, current: boolean) => {
    const next = !current;
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, includeInProjectTotal: next } : q));
    await supabase
      .from('project_quotes_2026_01_16_23_00')
      .update({ include_in_project_total: next })
      .eq('id', quoteId);
  };

  const confirmArchiveInstead = async () => {
    if (!quoteToDelete) return;
    
    setShowDeleteQuoteConfirm(false);
    await handleArchiveQuote(quoteToDelete);
    setQuoteToDelete(null);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      sent: 'default',
      accepted: 'default',
      rejected: 'destructive',
      archived: 'outline'
    } as const;

    const labels = {
      draft: 'Kladde',
      sent: 'Sendt',
      accepted: 'Accepteret',
      rejected: 'Afvist',
      archived: 'Arkiveret'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
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

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tilbud</h1>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Opret tilbud
          </Button>
        </div>

        {/* Quotes List */}
        <Card>
          <CardHeader>
            <CardTitle>Tilbudsoversigt</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Indlæser tilbud...</div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Ingen tilbud endnu</h3>
                <p>Opret dit første tilbud for at komme i gang</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Kladder */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedQuotes.draft);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('draft')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.draft ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-gray-700">Kladder</h3>
                        </div>
                        <div className="text-base text-gray-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Salgspris: {formatCurrency(totals.totalSellingPrice)}</span>
                          <span>DB: {formatCurrency(totals.totalProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.draft && renderQuoteTable(groupedQuotes.draft, 'draft')}
                </div>
                
                {/* Sendt */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedQuotes.sent);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('sent')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.sent ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-blue-700">Sendt</h3>
                        </div>
                        <div className="text-base text-blue-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Salgspris: {formatCurrency(totals.totalSellingPrice)}</span>
                          <span>DB: {formatCurrency(totals.totalProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.sent && renderQuoteTable(groupedQuotes.sent, 'sent')}
                </div>
                
                {/* Accepteret */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedQuotes.accepted);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('accepted')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.accepted ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-green-700">Accepteret</h3>
                        </div>
                        <div className="text-base text-green-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Salgspris: {formatCurrency(totals.totalSellingPrice)}</span>
                          <span>DB: {formatCurrency(totals.totalProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.accepted && renderQuoteTable(groupedQuotes.accepted, 'accepted')}
                </div>
                
                {/* Afvist */}
                <div>
                  {(() => {
                    const totals = calculateSectionTotals(groupedQuotes.rejected);
                    return (
                      <div 
                        className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleSection('rejected')}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.rejected ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <h3 className="text-lg font-semibold text-red-700">Afvist</h3>
                        </div>
                        <div className="text-base text-red-600 flex gap-4">
                          <span>Antal: {totals.count}</span>
                          <span>Salgspris: {formatCurrency(totals.totalSellingPrice)}</span>
                          <span>DB: {formatCurrency(totals.totalProfit)}</span>
                          <span className={totals.dbPercent < 0 ? 'text-red-600' : 'text-green-600'}>
                            DB%: {totals.dbPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {expandedSections.rejected && renderQuoteTable(groupedQuotes.rejected, 'rejected')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Opret nyt tilbud</DialogTitle>
              <DialogDescription>
                Udfyld oplysningerne for det nye tilbud.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Tilbudstitel"
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived') => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Kladde</SelectItem>
                    <SelectItem value="sent">Sendt</SelectItem>
                    <SelectItem value="accepted">Accepteret</SelectItem>
                    <SelectItem value="rejected">Afvist</SelectItem>
                    <SelectItem value="archived">Arkiveret</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="validUntil">Gyldig til</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="notes">Noter</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interne noter om tilbuddet"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setShowCreateModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleSave}>
                  Opret tilbud
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Edit Quote Dialog */}
        <Dialog open={showEditQuoteModal} onOpenChange={setShowEditQuoteModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rediger tilbud</DialogTitle>
              <DialogDescription>
                Rediger tilbudsoplysninger
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="editTitle">Titel</Label>
                <Input
                  id="editTitle"
                  value={editQuoteFormData.title}
                  onChange={(e) => setEditQuoteFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Tilbudstitel"
                />
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="editStatus">Status</Label>
                <Select 
                  value={editQuoteFormData.status} 
                  onValueChange={(value: 'draft' | 'sent' | 'accepted' | 'rejected') => 
                    setEditQuoteFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Kladde</SelectItem>
                    <SelectItem value="sent">Sendt</SelectItem>
                    <SelectItem value="accepted">Accepteret</SelectItem>
                    <SelectItem value="rejected">Afvist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Valid Until */}
              <div>
                <Label htmlFor="editValidUntil">Gyldig til</Label>
                <Input
                  id="editValidUntil"
                  type="date"
                  value={editQuoteFormData.validUntil}
                  onChange={(e) => setEditQuoteFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="editNotes">Noter</Label>
                <Textarea
                  id="editNotes"
                  value={editQuoteFormData.notes}
                  onChange={(e) => setEditQuoteFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interne noter om tilbuddet"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setShowEditQuoteModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleUpdateQuote}>
                  Gem ændringer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Delete Quote Confirmation Dialog */}
        <Dialog open={showDeleteQuoteConfirm} onOpenChange={setShowDeleteQuoteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slet tilbud</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">Er du sikker på, at du vil slette dette tilbud?</p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Sletning er permanent.</strong> Du kan i stedet vælge at arkivere tilbuddet.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteQuoteConfirm(false);
                  setQuoteToDelete(null);
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
                onClick={confirmDeleteQuote}
              >
                Slet permanent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectQuotes;