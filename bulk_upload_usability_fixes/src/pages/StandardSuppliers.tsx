import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useStandardSuppliers, StandardSupplier } from '@/contexts/StandardSuppliersContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Archive, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SupplierForm: React.FC<{
  supplier?: StandardSupplier;
  onSubmit: (data: Omit<StandardSupplier, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => void;
  onCancel: () => void;
}> = ({ supplier, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    cvr: supplier?.cvr || '',
    contactPerson: supplier?.contactPerson || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    postalCode: supplier?.postalCode || '',
    city: supplier?.city || '',
    country: supplier?.country || 'Danmark',
    notes: supplier?.notes || '',
    status: supplier?.status || 'Aktiv' as const,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Leverandørnavn er påkrævet';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ugyldig email-format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    onSubmit(formData);
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Leverandørnavn *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Indtast leverandørnavn"
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
        </div>
        
        <div>
          <Label htmlFor="cvr">CVR</Label>
          <Input
            id="cvr"
            value={formData.cvr}
            onChange={(e) => setFormData(prev => ({ ...prev, cvr: e.target.value }))}
            placeholder="12345678"
          />
        </div>
        
        <div>
          <Label htmlFor="contactPerson">Kontaktperson</Label>
          <Input
            id="contactPerson"
            value={formData.contactPerson}
            onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
            placeholder="Navn på kontaktperson"
          />
        </div>
        
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="email@leverandør.dk"
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
        </div>
        
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+45 12 34 56 78"
          />
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Gadenavn og nummer"
          />
        </div>
        
        <div>
          <Label htmlFor="postalCode">Postnr.</Label>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
            placeholder="2000"
          />
        </div>
        
        <div>
          <Label htmlFor="city">By</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            placeholder="København"
          />
        </div>
        
        <div>
          <Label htmlFor="country">Land</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            placeholder="Danmark"
          />
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select 
            value={formData.status} 
            onValueChange={(value: StandardSupplier['status']) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Aktiv">Aktiv</SelectItem>
              <SelectItem value="Arkiveret">Arkiveret</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="notes">Noter</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Interne noter om leverandøren..."
            rows={3}
          />
        </div>
      </div>
      
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {supplier ? 'Opdater' : 'Opret'} Leverandør
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuller
        </Button>
      </div>
    </form>
  );
};

interface SupplierStats {
  quote_count: number;
  rfq_count: number;
  selected_quote_count: number;
  last_contact_at: string | null;
}

const StandardSuppliers = () => {
  const {
    suppliers,
    addSupplier,
    updateSupplier,
    archiveSupplier
  } = useStandardSuppliers();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Aktiv');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<StandardSupplier | null>(null);
  const [stats, setStats] = useState<Record<string, SupplierStats>>({});

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    const match = suppliers.find((s: StandardSupplier) => s.id === editId);
    if (match) {
      setEditingSupplier(match);
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, suppliers, setSearchParams]);

  useEffect(() => {
    const loadStats = async () => {
      const { data, error } = await supabase
        .from('v_supplier_quote_stats_2026_04_23')
        .select('*');
      if (!error && data) {
        const map: Record<string, SupplierStats> = {};
        data.forEach((row: any) => {
          map[row.supplier_id] = {
            quote_count: Number(row.quote_count) || 0,
            rfq_count: Number(row.rfq_count) || 0,
            selected_quote_count: Number(row.selected_quote_count) || 0,
            last_contact_at: row.last_contact_at,
          };
        });
        setStats(map);
      }
    };
    loadStats();
  }, []);

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.cvr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateSupplier = (supplierData: Omit<StandardSupplier, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => {
    addSupplier(supplierData);
    toast({
      title: "Leverandør oprettet",
      description: `${supplierData.name} er blevet oprettet som standard leverandør`,
    });
  };

  const handleUpdateSupplier = (supplierData: Omit<StandardSupplier, 'id' | 'createdAt' | 'updatedAt' | 'isStandard'>) => {
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, supplierData);
      toast({
        title: "Leverandør opdateret",
        description: `${supplierData.name} er blevet opdateret`,
      });
      setEditingSupplier(null);
    }
  };

  const handleArchiveSupplier = (supplier: StandardSupplier) => {
    if (supplier.status === 'Arkiveret') {
      updateSupplier(supplier.id, { status: 'Aktiv' });
      toast({
        title: "Leverandør aktiveret",
        description: `${supplier.name} er blevet aktiveret igen`,
      });
    } else {
      if (confirm(`Er du sikker på, at du vil arkivere leverandøren "${supplier.name}"?`)) {
        archiveSupplier(supplier.id);
        toast({
          title: "Leverandør arkiveret",
          description: `${supplier.name} er blevet arkiveret`,
        });
      }
    }
  };

  const getStatusColor = (status: StandardSupplier['status']) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800 border-green-200';
      case 'Arkiveret': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Standard Leverandører</h1>
            <p className="text-muted-foreground mt-1">
              Administrer standard leverandører som kan kopieres til projekter
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ny Leverandør
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Opret Ny Standard Leverandør</DialogTitle>
              </DialogHeader>
              <SupplierForm
                onSubmit={handleCreateSupplier}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive Leverandører</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {suppliers.filter(s => s.status === 'Aktiv').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Arkiverede</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {suppliers.filter(s => s.status === 'Arkiveret').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suppliers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg i leverandører (navn, CVR, email, telefon)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer på status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statuser</SelectItem>
                  <SelectItem value="Aktiv">Aktiv</SelectItem>
                  <SelectItem value="Arkiveret">Arkiveret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leverandørnavn</TableHead>
                  <TableHead>CVR</TableHead>
                  <TableHead>Kontaktperson</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Tilbud</TableHead>
                  <TableHead className="text-right">RFQ'er</TableHead>
                  <TableHead>Sidste kontakt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => {
                  const s = stats[supplier.id];
                  const quoteCount = s?.quote_count ?? 0;
                  const rfqCount = s?.rfq_count ?? 0;
                  const selectedCount = s?.selected_quote_count ?? 0;
                  const lastContact = s?.last_contact_at
                    ? new Date(s.last_contact_at).toLocaleDateString('da-DK')
                    : '-';
                  return (
                    <TableRow
                      key={supplier.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/standard/suppliers/${supplier.id}`)}
                    >
                      <TableCell className="font-medium text-primary hover:underline">
                        {supplier.name}
                      </TableCell>
                      <TableCell>{supplier.cvr || '-'}</TableCell>
                      <TableCell>{supplier.contactPerson || '-'}</TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        {quoteCount > 0 ? (
                          <span>
                            {quoteCount}
                            {selectedCount > 0 && (
                              <span className="text-xs text-green-700 ml-1">
                                ({selectedCount} valgt)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {rfqCount > 0 ? rfqCount : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lastContact}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(supplier.status)}>
                          {supplier.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setEditingSupplier(supplier);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleArchiveSupplier(supplier);
                            }}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {filteredSuppliers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'Aktiv' 
                    ? 'Ingen leverandører matcher dine filtre' 
                    : 'Ingen standard leverandører endnu'
                  }
                </p>
                {!searchTerm && statusFilter === 'Aktiv' && (
                  <Button 
                    className="mt-4 gap-2"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Opret Din Første Leverandør
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Rediger Standard Leverandør</DialogTitle>
            </DialogHeader>
            {editingSupplier && (
              <SupplierForm
                supplier={editingSupplier}
                onSubmit={handleUpdateSupplier}
                onCancel={() => setEditingSupplier(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default StandardSuppliers;