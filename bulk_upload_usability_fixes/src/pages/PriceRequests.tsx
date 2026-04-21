import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  Plus,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';

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
  budget_hint?: number;
  payment_terms?: string;
  deadline?: string;
  status: 'open' | 'closed' | 'awarded' | 'cancelled';
  created_at: string;
  updated_at: string;
  quote_count: number;
  project_material?: {
    id: string;
    name: string;
  };
}

const PriceRequests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  
  // State
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PriceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [materialFilter, setMaterialFilter] = useState<string>('all');

  useEffect(() => {
    if (activeProject) {
      loadPriceRequests();
    }
  }, [activeProject]);

  // Filter effect
  useEffect(() => {
    applyFilters();
  }, [priceRequests, statusFilter, materialFilter]);

  const loadPriceRequests = async () => {
    if (!activeProject) return;

    try {
      setLoading(true);
      
      const response = await fetch(`https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/list?project_id=${activeProject.id}`, {
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
        setPriceRequests(data.data);
      }
    } catch (error) {
      console.error('Error loading price requests:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse prisforespørgsler",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...priceRequests];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Material filter
    if (materialFilter === 'with_material') {
      filtered = filtered.filter(request => request.project_material_id);
    } else if (materialFilter === 'without_material') {
      filtered = filtered.filter(request => !request.project_material_id);
    }

    setFilteredRequests(filtered);
  };

  const handleCreateRequest = () => {
    navigate(`/project/price-requests/new`);
  };

  const handleRowClick = (requestId: string) => {
    navigate(`/project/price-requests/${requestId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'awarded': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      open: 'Åben',
      closed: 'Lukket',
      awarded: 'Tildelt',
      cancelled: 'Annulleret'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK');
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

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/project')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbage til projekt
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Prisindhentning</h1>
              <p className="text-muted-foreground">
                Projekt: {activeProject.name}
              </p>
            </div>
          </div>
          <Button onClick={handleCreateRequest} className="gap-2">
            <Plus className="h-4 w-4" />
            Opret prisforespørgsel
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-base">Filtre</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statusser</SelectItem>
                    <SelectItem value="open">Åben</SelectItem>
                    <SelectItem value="closed">Lukket</SelectItem>
                    <SelectItem value="awarded">Tildelt</SelectItem>
                    <SelectItem value="cancelled">Annulleret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="material-filter">Knyttet materiale</Label>
                <Select value={materialFilter} onValueChange={setMaterialFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="with_material">Med materiale</SelectItem>
                    <SelectItem value="without_material">Uden materiale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Prisforespørgsler ({filteredRequests.length} af {priceRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p>Indlæser prisforespørgsler...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {priceRequests.length === 0 ? 'Ingen prisforespørgsler endnu' : 'Ingen prisforespørgsler matcher filtrene'}
                </p>
                <Button 
                  onClick={handleCreateRequest} 
                  className="mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Opret den første prisforespørgsel
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Knyttet materiale</TableHead>
                    <TableHead className="text-right">Antal / enhed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Antal svar</TableHead>
                    <TableHead className="text-right">Oprettet dato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow 
                      key={request.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(request.id)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div>{request.title}</div>
                          {request.description && (
                            <div className="text-sm text-muted-foreground">
                              {request.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.project_material?.name || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {request.qty && request.unit ? (
                          `${request.qty} ${request.unit}`
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusLabel(request.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {request.quote_count} svar
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDate(request.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PriceRequests;