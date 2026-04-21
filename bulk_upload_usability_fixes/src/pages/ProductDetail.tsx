import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { ProjectProduct, PRODUCT_TYPES } from '@/types/products';
import { 
  ArrowLeft, 
  Save, 
  Package,
  Tag,
  DollarSign,
  Wrench,
  Users,
  Truck,
  Plus,
  BarChart3,
  Edit,
  Trash2
} from 'lucide-react';
import MaterialSelectModal from '@/components/MaterialSelectModal';
import LaborModal from '@/components/LaborModal';
import TransportModal from '@/components/TransportModal';
import OtherCostModal from '@/components/OtherCostModal';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { 
    products, 
    updateProduct, 
    calculateProductCost,
    loading,
    getProductMaterialLines,
    getProductLaborLines,
    getProductTransportLines,
    getProductOtherCostLines,
    deleteMaterialLine,
    deleteLaborLine,
    deleteTransportLine,
    deleteOtherCostLine
  } = useProjectProducts();
  const { projectMaterials } = useProjectMaterials();

  const [product, setProduct] = useState<ProjectProduct | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    productType: 'other' as const,
    unit: 'stk',
    quantity: 1,
    description: '',
    notes: '',
    status: 'active' as const,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Dialog states
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showLaborDialog, setShowLaborDialog] = useState(false);
  const [showTransportDialog, setShowTransportDialog] = useState(false);
  const [showOtherCostDialog, setShowOtherCostDialog] = useState(false);
  
  // Editing states
  const [editingMaterialLine, setEditingMaterialLine] = useState(null);
  const [editingLaborLine, setEditingLaborLine] = useState(null);
  const [editingTransportLine, setEditingTransportLine] = useState(null);
  const [editingOtherCostLine, setEditingOtherCostLine] = useState(null);
  
  // Delete confirmation states
  const [showDeleteLaborConfirm, setShowDeleteLaborConfirm] = useState(false);
  const [laborLineToDelete, setLaborLineToDelete] = useState<string | null>(null);
  const [showDeleteMaterialConfirm, setShowDeleteMaterialConfirm] = useState(false);
  const [materialLineToDelete, setMaterialLineToDelete] = useState<string | null>(null);

  // Load product data
  useEffect(() => {
    console.log('ProductDetail: URL id:', id);
    console.log('ProductDetail: Available products:', products.map(p => ({ id: p.id, name: p.name })));
    if (id && products.length > 0) {
      const foundProduct = products.find(p => p.id === id);
      console.log('ProductDetail: Found product:', foundProduct);
      if (foundProduct) {
        setProduct(foundProduct);
        setFormData({
          name: foundProduct.name,
          productType: foundProduct.productType,
          unit: foundProduct.unit,
          quantity: foundProduct.quantity,
          description: foundProduct.description || '',
          notes: foundProduct.notes || '',
          status: foundProduct.status,
        });
      }
    }
  }, [id, products]);

  // Track changes
  useEffect(() => {
    if (product) {
      const hasChanged = 
        formData.name !== product.name ||
        formData.productType !== product.productType ||
        formData.unit !== product.unit ||
        formData.quantity !== product.quantity ||
        formData.description !== (product.description || '') ||
        formData.notes !== (product.notes || '') ||
        formData.status !== product.status;
      
      setHasChanges(hasChanged);
    }
  }, [formData, product]);

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

  const handleSave = async () => {
    if (!validateForm() || !product) return;

    try {
      await updateProduct(product.id, formData);
      setHasChanges(false);
      toast({
        title: "Produkt opdateret",
        description: `${formData.name} er blevet opdateret`,
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved gemning af produktet",
        variant: "destructive",
      });
    }
  };

  // Handler functions for dialogs
  const handleAddMaterial = () => {
    setEditingMaterialLine(null);
    setShowMaterialDialog(true);
  };

  const handleAddLabor = () => {
    setEditingLaborLine(null);
    setShowLaborDialog(true);
  };

  const handleAddTransport = () => {
    setEditingTransportLine(null);
    setShowTransportDialog(true);
  };

  const handleAddOtherCost = () => {
    setEditingOtherCostLine(null);
    setShowOtherCostDialog(true);
  };

  const handleRefresh = () => {
    // Force re-render to update totals
    setHasChanges(false);
  };

  const handleDeleteMaterialLine = async (lineId: string) => {
    setMaterialLineToDelete(lineId);
    setShowDeleteMaterialConfirm(true);
  };

  const confirmDeleteMaterialLine = async () => {
    if (!materialLineToDelete) return;
    
    setShowDeleteMaterialConfirm(false);
    
    try {
      await deleteMaterialLine(materialLineToDelete);
      handleRefresh();
    } catch (error) {
      console.error('Error deleting material line:', error);
    } finally {
      setMaterialLineToDelete(null);
    }
  };

  const handleDeleteLaborLine = async (lineId: string) => {
    console.log('handleDeleteLaborLine called with ID:', lineId);
    setLaborLineToDelete(lineId);
    setShowDeleteLaborConfirm(true);
  };

  const confirmDeleteLaborLine = async () => {
    if (!laborLineToDelete) return;
    
    setShowDeleteLaborConfirm(false);
    
    try {
      console.log('About to delete labor line:', laborLineToDelete);
      await deleteLaborLine(laborLineToDelete);
      console.log('Labor line deleted, calling refresh');
      handleRefresh();
      console.log('Refresh completed');
      
      toast({
        title: "Labor linje slettet",
        description: "Labor linjen er blevet slettet succesfuldt",
      });
    } catch (error) {
      console.error('Error deleting labor line:', error);
      toast({
        title: "Fejl ved sletning",
        description: error?.message || 'Der opstod en fejl ved sletning af labor linjen',
        variant: "destructive",
      });
    } finally {
      setLaborLineToDelete(null);
    }
  };

  const handleDeleteTransportLine = async (lineId: string) => {
    if (confirm('Er du sikker på at du vil slette denne transport-linje?')) {
      try {
        await deleteTransportLine(lineId);
        handleRefresh();
      } catch (error) {
        console.error('Error deleting transport line:', error);
      }
    }
  };

  const handleDeleteOtherCostLine = async (lineId: string) => {
    if (confirm('Er du sikker på at du vil slette denne omkostnings-linje?')) {
      try {
        await deleteOtherCostLine(lineId);
        handleRefresh();
      } catch (error) {
        console.error('Error deleting other cost line:', error);
      }
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

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Indlæser produkt...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Produkt ikke fundet
            </h3>
            <p className="text-muted-foreground mb-4">
              Det ønskede produkt kunne ikke findes
            </p>
            <Button onClick={() => navigate('/project/products')}>
              Tilbage til produkter
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const cost = calculateProductCost(product.id);

  return (
    <>
      <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/project/products')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
              <p className="text-muted-foreground mt-1">
                {activeProject?.name} • {PRODUCT_TYPES[product.productType]}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Gem Ændringer
          </Button>
        </div>

        <Tabs defaultValue="stamdata" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="stamdata" className="gap-2">
              <Tag className="h-4 w-4" />
              Stamdata
            </TabsTrigger>
            <TabsTrigger value="materialer" className="gap-2">
              <Wrench className="h-4 w-4" />
              Materialer
            </TabsTrigger>
            <TabsTrigger value="labor" className="gap-2">
              <Users className="h-4 w-4" />
              Labor/Montage
            </TabsTrigger>
            <TabsTrigger value="transport" className="gap-2">
              <Truck className="h-4 w-4" />
              Transport
            </TabsTrigger>
            <TabsTrigger value="oevrige" className="gap-2">
              <Plus className="h-4 w-4" />
              Øvrige
            </TabsTrigger>
          </TabsList>

          {/* Stamdata Tab */}
          <TabsContent value="stamdata">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Produktstamdata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
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

                <div className="grid grid-cols-3 gap-6">
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
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Noter</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Interne noter..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Overblik sektion */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Overblik
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600">Materialer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(cost.materialCosts.total)}</div>
                      <p className="text-xs text-muted-foreground">{getProductMaterialLines(product.id).length} materialer</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600">Labor</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(cost.laborCosts.total)}</div>
                      <p className="text-xs text-muted-foreground">{getProductLaborLines(product.id).length} linjer</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600">Transport</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(cost.transportCosts.total)}</div>
                      <p className="text-xs text-muted-foreground">{getProductTransportLines(product.id).length} linjer</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Materialer</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(cost.materialCosts.total)}</span>
                      <span className="text-sm text-muted-foreground">({cost.grandTotal > 0 ? ((cost.materialCosts.total / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between text-sm">
                      <span>- Produkt</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(cost.materialCosts.productCost)}</span>
                        <span className="text-xs text-muted-foreground">({cost.grandTotal > 0 ? ((cost.materialCosts.productCost / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>- Spild</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(cost.materialCosts.wasteCost)}</span>
                        <span className="text-xs text-muted-foreground">({cost.grandTotal > 0 ? ((cost.materialCosts.wasteCost / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>- Transport til DK</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(cost.materialCosts.transportCost)}</span>
                        <span className="text-xs text-muted-foreground">({cost.grandTotal > 0 ? ((cost.materialCosts.transportCost / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Labor</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(cost.laborCosts.total)}</span>
                      <span className="text-sm text-muted-foreground">({cost.grandTotal > 0 ? ((cost.laborCosts.total / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between text-sm">
                      <span>- Produktion</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(cost.laborCosts.production)}</span>
                        <span className="text-xs text-muted-foreground">({cost.grandTotal > 0 ? ((cost.laborCosts.production / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>- Montage i DK</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(cost.laborCosts.dkInstallation)}</span>
                        <span className="text-xs text-muted-foreground">({cost.grandTotal > 0 ? ((cost.laborCosts.dkInstallation / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>- Øvrigt</span>
                      <div className="flex items-center gap-3">
                        <span>{formatCurrency(cost.laborCosts.other)}</span>
                        <span className="text-xs text-muted-foreground">({cost.grandTotal > 0 ? ((cost.laborCosts.other / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Transport til DK</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(cost.transportCosts.total)}</span>
                      <span className="text-sm text-muted-foreground">({cost.grandTotal > 0 ? ((cost.transportCosts.total / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Øvrige omkostninger</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(cost.otherCosts.total)}</span>
                      <span className="text-sm text-muted-foreground">({cost.grandTotal > 0 ? ((cost.otherCosts.total / cost.grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                    <span className="text-lg font-bold">Total Landed Cost (DK)</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(cost.grandTotal)}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong>Landed Cost</strong> inkluderer alle omkostninger for at få produktet 
                    leveret og klar til brug i Danmark, inklusiv materialer, transport, labor og øvrige omkostninger.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Materialer Tab */}
          <TabsContent value="materialer">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Produktdele (Materialer)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Tilføj materialer til dette produkt. Samme materiale kan bruges flere gange.
                  </p>
                  <Button size="sm" className="gap-2" onClick={handleAddMaterial}>
                    <Plus className="h-4 w-4" />
                    Tilføj Materiale
                  </Button>
                </div>
                
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium">
                      <div className="col-span-3">Produktdel</div>
                      <div className="col-span-2">Beregning</div>
                      <div className="col-span-2">Mængde</div>
                      <div className="col-span-1">Spild</div>
                      <div className="col-span-2">Enhedspris</div>
                      <div className="col-span-1">Total</div>
                      <div className="col-span-1">Handlinger</div>
                    </div>
                  </div>
                  
                  {product && getProductMaterialLines(product.id).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ingen materialer tilføjet endnu</p>
                      <p className="text-sm">Klik på "Tilføj Materiale" for at komme i gang</p>
                    </div>
                  ) : (
                    product && getProductMaterialLines(product.id).map((line) => {
                      const material = projectMaterials.find(m => m.id === line.projectMaterialId);
                      const lineTotal = line.qty * (line.unitCostOverride ?? material?.unitPrice ?? 0);
                      
                      return (
                        <div key={line.id} className="p-4 border-b hover:bg-muted/50">
                          <div className="grid grid-cols-12 gap-4 items-center text-sm">
                            <div className="col-span-3">
                              <div className="font-medium">{line.lineTitle}</div>
                              {line.lineDescription && (
                                <div className="text-muted-foreground text-xs">{line.lineDescription}</div>
                              )}
                              <div className="text-muted-foreground text-xs">{material?.name}</div>
                            </div>
                            <div className="col-span-2">
                              {line.calcEnabled ? (
                                <div className="text-xs">
                                  {line.calcLengthM} × {line.calcWidthM} × {line.calcCount}
                                </div>
                              ) : (
                                <div className="text-xs">Manuel</div>
                              )}
                            </div>
                            <div className="col-span-2">
                              <div>{line.qty.toFixed(3)} {line.unit}</div>
                              <div className="text-xs text-muted-foreground">Base: {line.baseQty.toFixed(3)}</div>
                            </div>
                            <div className="col-span-1">
                              {line.wastePct}%
                            </div>
                            <div className="col-span-2">
                              <div>{formatCurrency(line.unitCostOverride ?? material?.unitPrice ?? 0)}</div>
                              {line.unitCostOverride && (
                                <div className="text-xs text-orange-600">Override</div>
                              )}
                            </div>
                            <div className="col-span-1">
                              <div className="font-medium">{formatCurrency(lineTotal)}</div>
                            </div>
                            <div className="col-span-1">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingMaterialLine(line);
                                    setShowMaterialDialog(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteMaterialLine(line.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Labor Tab */}
          <TabsContent value="labor">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Labor og Montage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Administrer labor og montageomkostninger for dette produkt.
                  </p>
                  <Button size="sm" className="gap-2" onClick={handleAddLabor}>
                    <Plus className="h-4 w-4" />
                    Tilføj Labor
                  </Button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-blue-600">Produktion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">0 kr</div>
                      <p className="text-xs text-muted-foreground">0 timer</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-green-600">Montage i DK</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">0 kr</div>
                      <p className="text-xs text-muted-foreground">0 timer</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600">Øvrigt</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">0 kr</div>
                      <p className="text-xs text-muted-foreground">0 timer</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <div className="grid grid-cols-8 gap-4 text-sm font-medium">
                      <div className="col-span-1">Type</div>
                      <div className="col-span-2">Titel</div>
                      <div className="col-span-1">Timer</div>
                      <div className="col-span-1">Timepris</div>
                      <div className="col-span-1">Total</div>
                      <div className="col-span-1">Noter</div>
                      <div className="col-span-1">Handlinger</div>
                    </div>
                  </div>
                  
                  {product && getProductLaborLines(product.id).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ingen labor tilføjet endnu</p>
                      <p className="text-sm">Klik på "Tilføj Labor" for at komme i gang</p>
                    </div>
                  ) : (
                    product && getProductLaborLines(product.id).map((line) => {
                      const lineTotal = line.qty * line.unitCost;
                      
                      return (
                        <div key={line.id} className="p-4 border-b hover:bg-muted/50">
                          <div className="grid grid-cols-8 gap-4 items-center text-sm">
                            <div className="col-span-1">
                              <Badge variant="outline">
                                {line.laborType === 'production' ? 'Produktion' : 
                                 line.laborType === 'dk_installation' ? 'Montage DK' : 'Øvrigt'}
                              </Badge>
                            </div>
                            <div className="col-span-2">
                              <div className="font-medium">{line.title}</div>
                            </div>
                            <div className="col-span-1">
                              {line.qty} {line.unit}
                            </div>
                            <div className="col-span-1">
                              {formatCurrency(line.unitCost)}
                            </div>
                            <div className="col-span-1">
                              <div className="font-medium">{formatCurrency(lineTotal)}</div>
                            </div>
                            <div className="col-span-1">
                              <div className="text-xs text-muted-foreground">{line.note}</div>
                            </div>
                            <div className="col-span-1">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingLaborLine(line);
                                    setShowLaborDialog(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteLaborLine(line.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transport Tab */}
          <TabsContent value="transport">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Produkttransport
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Transport af det samlede produkt til Danmark (shipment-baseret).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Materialetransport håndteres automatisk under materialer.
                    </p>
                  </div>
                  <Button size="sm" className="gap-2" onClick={handleAddTransport}>
                    <Plus className="h-4 w-4" />
                    Tilføj Transport
                  </Button>
                </div>
                
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <div className="grid grid-cols-7 gap-4 text-sm font-medium">
                      <div className="col-span-2">Titel</div>
                      <div className="col-span-1">Antal</div>
                      <div className="col-span-1">Enhed</div>
                      <div className="col-span-1">Enhedspris</div>
                      <div className="col-span-1">Total</div>
                      <div className="col-span-1">Handlinger</div>
                    </div>
                  </div>
                  
                  {product && getProductTransportLines(product.id).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ingen transport tilføjet endnu</p>
                      <p className="text-sm">Klik på "Tilføj Transport" for at komme i gang</p>
                    </div>
                  ) : (
                    product && getProductTransportLines(product.id).map((line) => {
                      const lineTotal = line.qty * line.unitCost;
                      
                      return (
                        <div key={line.id} className="p-4 border-b hover:bg-muted/50">
                          <div className="grid grid-cols-7 gap-4 items-center text-sm">
                            <div className="col-span-2">
                              <div className="font-medium">{line.title}</div>
                              {line.note && (
                                <div className="text-xs text-muted-foreground">{line.note}</div>
                              )}
                            </div>
                            <div className="col-span-1">
                              {line.qty}
                            </div>
                            <div className="col-span-1">
                              {line.unit}
                            </div>
                            <div className="col-span-1">
                              {formatCurrency(line.unitCost)}
                            </div>
                            <div className="col-span-1">
                              <div className="font-medium">{formatCurrency(lineTotal)}</div>
                            </div>
                            <div className="col-span-1">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingTransportLine(line);
                                    setShowTransportDialog(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteTransportLine(line.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Øvrige Tab */}
          <TabsContent value="oevrige">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Øvrige Omkostninger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Tilføj andre omkostninger som ikke passer i de andre kategorier.
                  </p>
                  <Button size="sm" className="gap-2" onClick={handleAddOtherCost}>
                    <Plus className="h-4 w-4" />
                    Tilføj Omkostning
                  </Button>
                </div>
                
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-muted/50">
                    <div className="grid grid-cols-7 gap-4 text-sm font-medium">
                      <div className="col-span-2">Titel</div>
                      <div className="col-span-1">Antal</div>
                      <div className="col-span-1">Enhed</div>
                      <div className="col-span-1">Enhedspris</div>
                      <div className="col-span-1">Total</div>
                      <div className="col-span-1">Handlinger</div>
                    </div>
                  </div>
                  
                  {product && getProductOtherCostLines(product.id).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ingen øvrige omkostninger tilføjet endnu</p>
                      <p className="text-sm">Klik på "Tilføj Omkostning" for at komme i gang</p>
                    </div>
                  ) : (
                    product && getProductOtherCostLines(product.id).map((line) => {
                      const lineTotal = line.qty * line.unitCost;
                      
                      return (
                        <div key={line.id} className="p-4 border-b hover:bg-muted/50">
                          <div className="grid grid-cols-7 gap-4 items-center text-sm">
                            <div className="col-span-2">
                              <div className="font-medium">{line.title}</div>
                              {line.note && (
                                <div className="text-xs text-muted-foreground">{line.note}</div>
                              )}
                            </div>
                            <div className="col-span-1">
                              {line.qty}
                            </div>
                            <div className="col-span-1">
                              {line.unit}
                            </div>
                            <div className="col-span-1">
                              {formatCurrency(line.unitCost)}
                            </div>
                            <div className="col-span-1">
                              <div className="font-medium">{formatCurrency(lineTotal)}</div>
                            </div>
                            <div className="col-span-1">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingOtherCostLine(line);
                                    setShowOtherCostDialog(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteOtherCostLine(line.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
            
          </TabsContent>

        </Tabs>
      </div>
      </Layout>
    
    {/* Modals */}
    {product && (
      <>
        <MaterialSelectModal
          open={showMaterialDialog}
          onOpenChange={setShowMaterialDialog}
          productId={product.id}
          editingLine={editingMaterialLine}
          onSuccess={handleRefresh}
        />
        
        <LaborModal
          open={showLaborDialog}
          onOpenChange={setShowLaborDialog}
          productId={product.id}
          editingLine={editingLaborLine}
          onSuccess={handleRefresh}
        />
        
        <TransportModal
          open={showTransportDialog}
          onOpenChange={setShowTransportDialog}
          productId={product.id}
          editingLine={editingTransportLine}
          onSuccess={handleRefresh}
        />
        
        <OtherCostModal
          open={showOtherCostDialog}
          onOpenChange={setShowOtherCostDialog}
          productId={product.id}
          editingLine={editingOtherCostLine}
          onSuccess={handleRefresh}
        />
      </>
    )}
    
    {/* Delete Labor Line Confirmation Dialog */}
    <Dialog open={showDeleteLaborConfirm} onOpenChange={setShowDeleteLaborConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bekræft sletning</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Er du sikker på at du vil slette denne labor-linje?</p>
          <p className="text-sm text-muted-foreground mt-2">
            Denne handling kan ikke fortrydes.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => {
              setShowDeleteLaborConfirm(false);
              setLaborLineToDelete(null);
            }}
          >
            Annullér
          </Button>
          <Button 
            variant="destructive" 
            onClick={confirmDeleteLaborLine}
          >
            Slet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Delete Material Line Confirmation Dialog */}
    <Dialog open={showDeleteMaterialConfirm} onOpenChange={setShowDeleteMaterialConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bekræft sletning</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Er du sikker på at du vil slette denne material-linje?</p>
          <p className="text-sm text-muted-foreground mt-2">
            Denne handling kan ikke fortrydes.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => {
              setShowDeleteMaterialConfirm(false);
              setMaterialLineToDelete(null);
            }}
          >
            Annullér
          </Button>
          <Button 
            variant="destructive" 
            onClick={confirmDeleteMaterialLine}
          >
            Slet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default ProductDetail;