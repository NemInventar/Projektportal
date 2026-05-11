import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { ProjectProduct, PRODUCT_TYPES } from '@/types/products';
import { supabase } from '@/integrations/supabase/client';
import { buildImportPayload } from '@/lib/import/buildImportPayload';
import { importProductsFromProject } from '@/lib/import/importProductsFromProject';
import { ProductImportModal } from '@/components/ProductImportModal';
import { 
  Plus, 
  Edit, 
  Copy, 
  Archive, 
  Search,
  Package,
  DollarSign,
  Download,
  Import
} from 'lucide-react';

const Products = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { 
    products, 
    loading, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    copyProduct,
    calculateProductCost 
  } = useProjectProducts();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProjectProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    productType: 'other' as 'other' | 'curtain' | 'installation' | 'furniture',
    unit: 'stk',
    quantity: 1,
    description: '',
    notes: '',
    status: 'active' as 'active' | 'archived',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      productType: 'other',
      unit: 'stk',
      quantity: 1,
      description: '',
      notes: '',
      status: 'active',
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Produktnavn er påkrævet';
    }
    
    if (formData.quantity <= 0) {
      newErrors.quantity = 'Antal skal være større end 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (!activeProject) {
      toast({
        title: "Fejl",
        description: "Intet aktivt projekt valgt",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        toast({
          title: "Produkt opdateret",
          description: `${formData.name} er blevet opdateret`,
        });
        setEditingProduct(null);
      } else {
        console.log('Creating product with data:', { ...formData, projectId: activeProject.id });
        await addProduct({
          ...formData,
          projectId: activeProject.id,
        });
        toast({
          title: "Produkt oprettet",
          description: `${formData.name} er blevet oprettet`,
        });
        setIsCreateDialogOpen(false);
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved gemning af produktet",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (product: ProjectProduct) => {
    setFormData({
      name: product.name,
      productType: product.productType as 'other' | 'curtain' | 'installation' | 'furniture',
      unit: product.unit,
      quantity: product.quantity,
      description: product.description || '',
      notes: product.notes || '',
      status: product.status as 'active' | 'archived',
    });
    setEditingProduct(product);
  };

  const handleCopy = async (product: ProjectProduct) => {
    try {
      await copyProduct(product.id);
      toast({
        title: "Produkt kopieret",
        description: `${product.name} er blevet kopieret`,
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved kopiering af produktet",
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (product: ProjectProduct) => {
    try {
      await updateProduct(product.id, { 
        status: product.status === 'active' ? 'archived' : 'active' 
      });
      toast({
        title: product.status === 'active' ? "Produkt arkiveret" : "Produkt genaktiveret",
        description: `${product.name} er blevet ${product.status === 'active' ? 'arkiveret' : 'genaktiveret'}`,
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved ændring af produktstatus",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Aktiv</Badge>;
      case 'archived':
        return <Badge variant="secondary">Arkiveret</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // TEST FUNCTION for Step I-01
  const testImportPayload = async () => {
    if (!activeProject || products.length === 0) {
      toast({
        title: "Test ikke mulig",
        description: "Intet aktivt projekt eller ingen produkter at teste med",
        variant: "destructive",
      });
      return;
    }

    try {
      // Test med det første produkt
      const firstProduct = products[0];
      console.log('🧪 Testing buildImportPayload with product:', firstProduct.name);
      
      const payload = await buildImportPayload(
        supabase,
        activeProject.id,
        [firstProduct.id]
      );
      
      console.log('📦 IMPORT PAYLOAD RESULT:');
      console.log('=====================================');
      console.log('Stats:', payload.stats);
      console.log('Products:', payload.productsById);
      console.log('Materials:', payload.projectMaterialsById);
      console.log('Lines by Product:', payload.linesByProductId);
      console.log('=====================================');
      
      toast({
        title: "Test gennemført",
        description: `Import payload bygget for "${firstProduct.name}". Se console for detaljer.`,
      });
    } catch (error) {
      console.error('❌ Test failed:', error);
      toast({
        title: "Test fejlede",
        description: "Se console for fejldetaljer",
        variant: "destructive",
      });
    }
  };

  // TEST FUNCTION for Step I-02
  const testImportProducts = async () => {
    if (!activeProject || products.length === 0) {
      toast({
        title: "Test ikke mulig",
        description: "Intet aktivt projekt eller ingen produkter at teste med",
        variant: "destructive",
      });
      return;
    }

    try {
      // Test med det første produkt - import til samme projekt (for test)
      const firstProduct = products[0];
      console.log('🚀 Testing importProductsFromProject with product:', firstProduct.name);
      
      const result = await importProductsFromProject(
        supabase,
        activeProject.id, // Source project (same as target for test)
        activeProject.id, // Target project (same as source for test)
        [firstProduct.id],
        { includeExtraLines: true }
      );
      
      console.log('📦 IMPORT RESULT:');
      console.log('=====================================');
      console.log('Inserted Counts:', result.insertedCounts);
      console.log('Material ID Map:', result.materialIdMap);
      console.log('Product ID Map:', result.productIdMap);
      console.log('=====================================');
      
      toast({
        title: "Import test gennemført",
        description: `Produkt "${firstProduct.name}" importeret. Se console for detaljer.`,
      });
    } catch (error) {
      console.error('❌ Import test failed:', error);
      toast({
        title: "Import test fejlede",
        description: "Se console for fejldetaljer",
        variant: "destructive",
      });
    }
  };

  // Handle import completion
  const handleImportComplete = () => {
    // Refresh page to show imported products
    // Note: Context will automatically reload when component remounts
    toast({
      title: "Produkter opdateret",
      description: "Produktlisten opdateres automatisk med importerede produkter",
    });
    
    // Force a page refresh to ensure all data is up to date
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Intet aktivt projekt
            </h3>
            <p className="text-muted-foreground mb-4">
              Vælg et projekt for at se produkter
            </p>
            <Button onClick={() => navigate('/')}>
              Vælg Projekt
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Produkter</h1>
            <p className="text-muted-foreground mt-1">
              Administrer produkter for {activeProject.name}
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* TEST BUTTON for Step I-01 */}
            <Button 
              onClick={testImportPayload}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Test Payload
            </Button>
            
            {/* TEST BUTTON for Step I-02 */}
            <Button 
              onClick={testImportProducts}
              variant="outline"
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Test Import
            </Button>
            
            {/* IMPORT BUTTON for Step I-03 */}
            <Button 
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Import className="h-4 w-4" />
              Importér fra projekt
            </Button>
            
            <Button 
              onClick={() => setIsCreateDialogOpen(true)} 
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Opret Produkt
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Søg produkter..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer efter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle status</SelectItem>
                  <SelectItem value="active">Aktive</SelectItem>
                  <SelectItem value="archived">Arkiverede</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Indlæser produkter...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produktnavn</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Antal</TableHead>
                    <TableHead>Total kostpris</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const cost = calculateProductCost(product.id);
                    return (
                      <TableRow 
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/project/products/${product.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-muted-foreground">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PRODUCT_TYPES[product.productType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.quantity} {product.unit}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatCurrency(cost.grandTotal)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(product.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(product);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(product);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(product);
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
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'active' 
                    ? 'Ingen produkter matcher dine filtre' 
                    : 'Ingen produkter endnu'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog 
          open={isCreateDialogOpen || !!editingProduct} 
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingProduct(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Rediger Produkt' : 'Opret Nyt Produkt'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Produktnavn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="productType">Produkttype</Label>
                  <Select 
                    value={formData.productType} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, productType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRODUCT_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="quantity">Antal *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                    className={errors.quantity ? 'border-destructive' : ''}
                  />
                  {errors.quantity && (
                    <p className="text-sm text-destructive mt-1">{errors.quantity}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="unit">Enhed</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="archived">Arkiveret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Beskrivelse (til tilbud)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beskrivelse der vises i tilbud..."
                />
              </div>

              <div>
                <Label htmlFor="notes">Noter</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interne noter..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                >
                  Annuller
                </Button>
                <Button type="submit">
                  {editingProduct ? 'Gem Ændringer' : 'Opret Produkt'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Product Import Modal */}
        <ProductImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          targetProjectId={activeProject.id}
          onImportComplete={handleImportComplete}
        />
      </div>
    </Layout>
  );
};

export default Products;