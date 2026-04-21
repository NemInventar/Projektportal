import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

interface PriceRequest {
  id: string;
  project_id: string;
  project_material_id?: string;
  title: string;
  description?: string;
  qty?: number;
  unit?: string;
  first_delivery_date?: string;
  last_delivery_date?: string;
  deadline?: string;
  payment_terms?: string;
  budget_hint?: number;
  status: 'open' | 'closed' | 'awarded' | 'cancelled';
  created_at: string;
  updated_at: string;
  project_material?: {
    id: string;
    name: string;
  };
  quotes: PriceQuote[];
}

interface PriceQuote {
  id: string;
  project_price_request_id: string;
  supplier_id: string;
  status: 'offered' | 'declined' | 'expired' | 'selected';
  unit_price?: number;
  currency: string;
  unit?: string;
  min_qty?: number;
  lead_time_days?: number;
  valid_until?: string;
  notes?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
}

interface QuoteFormData {
  supplier_id: string;
  status: 'offered' | 'declined' | 'expired' | 'selected';
  unit_price: number | '';
  currency: string;
  unit: string;
  min_qty: number | '';
  lead_time_days: number | '';
  valid_until: string;
  notes: string;
  received_at: string;
}

const PriceRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { suppliers } = useStandardSuppliers();
  
  // State
  const [request, setRequest] = useState<PriceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<PriceQuote | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [deletingQuote, setDeletingQuote] = useState<string | null>(null);
  
  const [quoteFormData, setQuoteFormData] = useState<QuoteFormData>({
    supplier_id: '',
    status: 'offered',
    unit_price: '',
    currency: 'DKK',
    unit: '',
    min_qty: '',
    lead_time_days: '',
    valid_until: '',
    notes: '',
    received_at: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (id) {
      loadRequestDetail();
    }
  }, [id]);

  const loadRequestDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      const response = await fetch(`https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/detail/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data?.data) {
        setRequest(data.data);
      }
    } catch (error) {
      console.error('Error loading request detail:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse prisforespørgsel",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuote = () => {
    setEditingQuote(null);
    setQuoteFormData({
      supplier_id: '',
      status: 'offered',
      unit_price: '',
      currency: 'DKK',
      unit: request?.unit || '',
      min_qty: '',
      lead_time_days: '',
      valid_until: '',
      notes: '',
      received_at: new Date().toISOString().split('T')[0]
    });
    setShowAddQuoteModal(true);
  };

  const handleEditQuote = (quote: PriceQuote) => {
    setEditingQuote(quote);
    setQuoteFormData({
      supplier_id: quote.supplier_id,
      status: quote.status,
      unit_price: quote.unit_price || '',
      currency: quote.currency,
      unit: quote.unit || '',
      min_qty: quote.min_qty || '',
      lead_time_days: quote.lead_time_days || '',
      valid_until: quote.valid_until ? quote.valid_until.split('T')[0] : '',
      notes: quote.notes || '',
      received_at: quote.received_at ? quote.received_at.split('T')[0] : ''
    });
    setShowAddQuoteModal(true);
  };

  const handleSaveQuote = async () => {
    if (!request || !quoteFormData.supplier_id) {
      toast({
        title: "Validering fejlede",
        description: "Leverandør skal vælges",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingQuote(true);

      const quoteData = {
        project_price_request_id: request.id,
        supplier_id: quoteFormData.supplier_id,
        status: quoteFormData.status,
        unit_price: quoteFormData.status === 'declined' ? null : (quoteFormData.unit_price ? Number(quoteFormData.unit_price) : null),
        currency: quoteFormData.currency,
        unit: quoteFormData.unit || null,
        min_qty: quoteFormData.min_qty ? Number(quoteFormData.min_qty) : null,
        lead_time_days: quoteFormData.lead_time_days ? Number(quoteFormData.lead_time_days) : null,
        valid_until: quoteFormData.valid_until || null,
        notes: quoteFormData.notes || null,
        received_at: quoteFormData.received_at || null
      };

      const url = editingQuote 
        ? `https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/quote/${editingQuote.id}`
        : `https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/quote`;

      const response = await fetch(url, {
        method: editingQuote ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quoteData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast({
        title: editingQuote ? "Tilbud opdateret" : "Tilbud tilføjet",
        description: editingQuote ? "Ændringerne er gemt" : "Leverandørtilbuddet er tilføjet",
      });

      setShowAddQuoteModal(false);
      await loadRequestDetail(); // Reload to get updated data
    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Fejl",
        description: editingQuote ? "Kunne ikke opdatere tilbud" : "Kunne ikke tilføje tilbud",
        variant: "destructive",
      });
    } finally {
      setSavingQuote(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette tilbud?')) return;

    try {
      setDeletingQuote(quoteId);
      
      const response = await fetch(`https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/quote/${quoteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Tilbud slettet",
        description: "Leverandørtilbuddet er slettet",
      });

      await loadRequestDetail(); // Reload to get updated data
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke slette tilbud",
        variant: "destructive",
      });
    } finally {
      setDeletingQuote(null);
    }
  };

  const handleMarkAsSelected = async (quote: PriceQuote) => {
    try {
      // First, mark all other quotes as not selected
      for (const q of request?.quotes || []) {
        if (q.id !== quote.id && q.status === 'selected') {
          await fetch(`https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/quote/${q.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'offered' })
          });
        }
      }

      // Then mark this quote as selected
      const response = await fetch(`https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/quote/${quote.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'selected' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Tilbud valgt",
        description: "Tilbuddet er markeret som valgt",
      });

      await loadRequestDetail(); // Reload to get updated data
    } catch (error) {
      console.error('Error marking quote as selected:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke markere tilbud som valgt",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'awarded': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'offered': return 'bg-blue-100 text-blue-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'selected': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      open: 'Åben',
      closed: 'Lukket',
      awarded: 'Tildelt',
      cancelled: 'Annulleret',
      offered: 'Tilbudt',
      declined: 'Afvist',
      expired: 'Udløbet',
      selected: 'Valgt'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('da-DK', { maximumFractionDigits: 2 })} kr`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK');
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <p>Intet projekt valgt</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <p>Indlæser prisforespørgsel...</p>
        </div>
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout>
        <div className="p-6">
          <p>Prisforespørgsel ikke fundet</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/project/price-requests')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbage til prisindhentning
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              <p className="text-muted-foreground">
                Projekt: {activeProject.name}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/project/price-requests/${request.id}/edit`)}
            variant="outline"
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Rediger forespørgsel
          </Button>
        </div>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle>Prisforespørgsel detaljer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Titel</Label>
                <p className="mt-1">{request.title}</p>
              </div>
              
              {request.description && (
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Beskrivelse</Label>
                  <p className="mt-1">{request.description}</p>
                </div>
              )}

              {(request.qty || request.unit) && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Antal / enhed</Label>
                  <p className="mt-1">
                    {request.qty && request.unit ? `${request.qty} ${request.unit}` : 
                     request.qty ? request.qty : 
                     request.unit ? request.unit : '—'}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge className={getStatusColor(request.status)}>
                    {getStatusLabel(request.status)}
                  </Badge>
                </div>
              </div>

              {request.project_material && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Knyttet materiale</Label>
                  <p className="mt-1">{request.project_material.name}</p>
                </div>
              )}

              {request.first_delivery_date && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Første leveringsdato</Label>
                  <p className="mt-1">{formatDate(request.first_delivery_date)}</p>
                </div>
              )}

              {request.last_delivery_date && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Sidste leveringsdato</Label>
                  <p className="mt-1">{formatDate(request.last_delivery_date)}</p>
                </div>
              )}

              {request.deadline && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Deadline for svar</Label>
                  <p className="mt-1">{formatDate(request.deadline)}</p>
                </div>
              )}

              {request.payment_terms && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Betalingsbetingelser</Label>
                  <p className="mt-1">{request.payment_terms}</p>
                </div>
              )}

              {request.budget_hint && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Budget hint</Label>
                  <p className="mt-1">{formatCurrency(request.budget_hint)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Supplier Quotes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Leverandørsvar ({request.quotes?.length || 0})</CardTitle>
              <Button onClick={handleAddQuote} className="gap-2">
                <Plus className="h-4 w-4" />
                Tilføj leverandør-svar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!request.quotes || request.quotes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Ingen leverandørsvar endnu</p>
                <Button 
                  onClick={handleAddQuote} 
                  className="mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj det første svar
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leverandør</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pris</TableHead>
                    <TableHead className="text-right">Leveringstid</TableHead>
                    <TableHead>Gyldighed</TableHead>
                    <TableHead>Noter</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">
                        {getSupplierName(quote.supplier_id)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(quote.status)}>
                          {getStatusLabel(quote.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {quote.status === 'declined' ? (
                          '—'
                        ) : quote.unit_price ? (
                          <div>
                            <div>{formatCurrency(quote.unit_price)}</div>
                            {quote.unit && <div className="text-sm text-muted-foreground">per {quote.unit}</div>}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {quote.lead_time_days ? `${quote.lead_time_days} dage` : '—'}
                      </TableCell>
                      <TableCell>
                        {quote.valid_until ? formatDate(quote.valid_until) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={quote.notes || ''}>
                          {quote.notes || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {quote.status !== 'selected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsSelected(quote)}
                              className="h-6 w-6 p-0"
                              title="Markér som valgt"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditQuote(quote)}
                            className="h-6 w-6 p-0"
                            title="Rediger"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteQuote(quote.id)}
                            disabled={deletingQuote === quote.id}
                            className="h-6 w-6 p-0"
                            title="Slet"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Quote Modal */}
        <Dialog open={showAddQuoteModal} onOpenChange={setShowAddQuoteModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingQuote ? 'Rediger leverandørsvar' : 'Tilføj leverandørsvar'}
              </DialogTitle>
              <DialogDescription>
                {editingQuote ? 'Opdater leverandørens tilbud' : 'Registrer et nyt tilbud fra en leverandør'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier_id">Leverandør *</Label>
                  <Select 
                    value={quoteFormData.supplier_id} 
                    onValueChange={(value) => setQuoteFormData(prev => ({ ...prev, supplier_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg leverandør" />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers || []).map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={quoteFormData.status} 
                    onValueChange={(value) => {
                      setQuoteFormData(prev => ({ 
                        ...prev, 
                        status: value as any,
                        unit_price: value === 'declined' ? '' : prev.unit_price
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offered">Tilbudt</SelectItem>
                      <SelectItem value="declined">Afvist</SelectItem>
                      <SelectItem value="expired">Udløbet</SelectItem>
                      <SelectItem value="selected">Valgt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="unit_price">Enhedspris</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quoteFormData.unit_price}
                    onChange={(e) => setQuoteFormData(prev => ({ 
                      ...prev, 
                      unit_price: e.target.value ? parseFloat(e.target.value) : '' 
                    }))}
                    placeholder={quoteFormData.status === 'declined' ? 'Ikke relevant for afslag' : 'Pris per enhed'}
                    disabled={quoteFormData.status === 'declined'}
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Valuta</Label>
                  <Select 
                    value={quoteFormData.currency} 
                    onValueChange={(value) => setQuoteFormData(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DKK">DKK</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="unit">Enhed</Label>
                  <Input
                    id="unit"
                    value={quoteFormData.unit}
                    onChange={(e) => setQuoteFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="f.eks. stk, m², kg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_qty">Minimum antal</Label>
                  <Input
                    id="min_qty"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quoteFormData.min_qty}
                    onChange={(e) => setQuoteFormData(prev => ({ 
                      ...prev, 
                      min_qty: e.target.value ? parseFloat(e.target.value) : '' 
                    }))}
                    placeholder="Minimum bestillingsantal"
                  />
                </div>

                <div>
                  <Label htmlFor="lead_time_days">Leveringstid (dage)</Label>
                  <Input
                    id="lead_time_days"
                    type="number"
                    min="0"
                    value={quoteFormData.lead_time_days}
                    onChange={(e) => setQuoteFormData(prev => ({ 
                      ...prev, 
                      lead_time_days: e.target.value ? parseInt(e.target.value) : '' 
                    }))}
                    placeholder="Antal dage"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valid_until">Gyldig til</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={quoteFormData.valid_until}
                    onChange={(e) => setQuoteFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="received_at">Modtaget dato</Label>
                  <Input
                    id="received_at"
                    type="date"
                    value={quoteFormData.received_at}
                    onChange={(e) => setQuoteFormData(prev => ({ ...prev, received_at: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Noter</Label>
                <Textarea
                  id="notes"
                  value={quoteFormData.notes}
                  onChange={(e) => setQuoteFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Yderligere noter om tilbuddet"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowAddQuoteModal(false)}
              >
                Annuller
              </Button>
              <Button 
                onClick={handleSaveQuote}
                disabled={savingQuote || !quoteFormData.supplier_id}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {savingQuote ? 'Gemmer...' : (editingQuote ? 'Opdater' : 'Tilføj')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PriceRequestDetail;