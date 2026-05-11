import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTitle
} from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { useStandardMaterials } from '@/contexts/StandardMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { usePurchaseOrders } from '@/contexts/PurchaseOrdersContext';

const ProjectMaterials = () => {
  const { activeProject } = useProject();
  const { 
    projectMaterials, 
    addProjectMaterial, 
    removeProjectMaterial,
    getApprovalStatus,
    getTotalOrderedQuantity,
    getNextExpectedDelivery
  } = useProjectMaterials();
  const {
    getTotalOrderedQty,
    getNextDeliveryDate,
    migrateMaterialOrders
  } = usePurchaseOrders();
  const { materials: standardMaterials } = useStandardMaterials();
  const { suppliers } = useStandardSuppliers();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedStandardMaterials, setSelectedStandardMaterials] = useState<string[]>([]);
  const [materialPrices, setMaterialPrices] = useState<Record<string, {price: number, currency: string, date: string}>>({});

  // Fetch latest prices when import dialog opens
  useEffect(() => {
    if (showImportDialog && standardMaterials.length > 0) {
      const fetchPrices = async () => {
        const prices: Record<string, {price: number, currency: string, date: string}> = {};
        
        for (const material of standardMaterials) {
          try {
            const { data: priceData } = await supabase
              .from('material_prices_2026_01_15_06_45')
              .select('*')
              .eq('product_id', material.id)
              .order('date', { ascending: false })
              .limit(1)
              .single();
            
            if (priceData) {
              prices[material.id] = {
                price: parseFloat(priceData.unit_price),
                currency: priceData.currency,
                date: priceData.date
              };
            }
          } catch (error) {
            // No price found for this material
          }
        }
        
        setMaterialPrices(prices);
      };
      
      fetchPrices();
    }
  }, [showImportDialog, standardMaterials]);

  // Filter project materials for active project
  const currentProjectMaterials = projectMaterials.filter(m => m.projectId === activeProject?.id);

  // Get unique values for filters
  const categories = Array.from(new Set(currentProjectMaterials.map(m => m.category).filter(Boolean)));
  const projectSuppliers = Array.from(new Set(currentProjectMaterials.map(m => m.supplierId).filter(Boolean)));

  const filteredMaterials = currentProjectMaterials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.supplierProductCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSupplier = supplierFilter === 'all' || material.supplierId === supplierFilter;
    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
    
    const approvalStatus = getApprovalStatus(material.id);
    const matchesApproval = approvalFilter === 'all' || approvalStatus === approvalFilter;
    
    const hasOrders = material.orders.length > 0;
    const matchesOrderStatus = orderStatusFilter === 'all' || 
                              (orderStatusFilter === 'ordered' && hasOrders) ||
                              (orderStatusFilter === 'not_ordered' && !hasOrders);

    return matchesSearch && matchesSupplier && matchesCategory && matchesApproval && matchesOrderStatus;
  });

  const handleImportFromStandard = async () => {
    if (selectedStandardMaterials.length === 0) {
      toast({
        title: "Ingen materialer valgt",
        description: "Vælg mindst ét materiale at importere",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const materialId of selectedStandardMaterials) {
        try {
          const standardMaterial = standardMaterials.find(m => m.id === materialId);
          console.log('Processing material:', materialId, standardMaterial);
          
          if (standardMaterial && activeProject) {
            // Get the latest price from Supabase material_prices table
            let latestPrice = null;
            try {
              const { data: priceData } = await supabase
                .from('material_prices_2026_01_15_06_45')
                .select('*')
                .eq('product_id', materialId)
                .order('date', { ascending: false })
                .limit(1)
                .single();
              
              if (priceData) {
                latestPrice = {
                  price: parseFloat(priceData.unit_price),
                  currency: priceData.currency,
                  date: priceData.date
                };
              }
            } catch (error) {
              console.log('No price found for material:', materialId);
            }
            
            const materialData = {
              projectId: activeProject.id,
              standardMaterialId: materialId,
              name: standardMaterial.name,
              category: standardMaterial.category,
              unit: standardMaterial.unit,
              notes: undefined,
              supplierId: standardMaterial.primarySupplierId || undefined,
              supplierProductCode: standardMaterial.supplierProductCode || undefined,
              supplierProductUrl: standardMaterial.supplierProductUrl || undefined,
              unitPrice: latestPrice?.price || undefined,
              currency: latestPrice?.currency || 'DKK',
              priceStatus: latestPrice ? 'confirmed' as const : 'not_confirmed' as const,
              priceNote: latestPrice ? `Importeret fra standard materiale (${new Date(latestPrice.date).toLocaleDateString('da-DK')})` : undefined
            };
            
            console.log('Material data to import:', materialData);
            await addProjectMaterial(materialData);
            console.log('Successfully imported:', standardMaterial.name);
          }
        } catch (materialError) {
          console.error('Failed to import material:', materialId, materialError);
          throw new Error(`Fejl ved import af materiale "${standardMaterials.find(m => m.id === materialId)?.name || materialId}": ${materialError.message}`);
        }
      }

      setSelectedStandardMaterials([]);
      setShowImportDialog(false);
      
      toast({
        title: "Materialer importeret",
        description: `${selectedStandardMaterials.length} materialer blev importeret til projektet`,
      });
    } catch (error) {
      console.error('Error importing materials:', error);
      
      // Show detailed error message
      const errorMessage = error?.message || 'Ukendt fejl';
      const errorDetails = error?.details || '';
      const errorHint = error?.hint || '';
      
      let description = `Fejl: ${errorMessage}`;
      if (errorDetails) description += `\nDetaljer: ${errorDetails}`;
      if (errorHint) description += `\nForslag: ${errorHint}`;
      
      toast({
        title: "Fejl ved import af materialer",
        description: description,
        variant: "destructive",
      });
    }
  };

  const handleEditMaterial = (materialId: string) => {
    navigate(`/projects/${activeProject?.id}/materials/${materialId}`);
  };

  const handleRemoveMaterial = async (materialId: string) => {
    try {
      await removeProjectMaterial(materialId);
      toast({
        title: "Materiale fjernet",
        description: "Materialet er fjernet fra projektet",
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved fjernelse af materialet",
        variant: "destructive",
      });
      console.error('Error removing material:', error);
    }
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
  };

  const getApprovalBadge = (materialId: string) => {
    const status = getApprovalStatus(materialId);
    switch (status) {
      case 'fully_approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Fuldt godkendt</Badge>;
      case 'partially_approved':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Delvist godkendt</Badge>;
      default:
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Ikke godkendt</Badge>;
    }
  };

  const getOrderStatusBadge = (material: any) => {
    const totalOrdered = getTotalOrderedQuantity(material.id);
    if (totalOrdered === 0) {
      return <Badge variant="outline">Ikke bestilt</Badge>;
    }
    
    const hasActiveOrders = material.orders.some((o: any) => o.status === 'ordered');
    if (hasActiveOrders) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Bestilt ({totalOrdered} {material.unit})</Badge>;
    }
    
    return <Badge variant="secondary">Modtaget ({totalOrdered} {material.unit})</Badge>;
  };

  const formatNextDelivery = (materialId: string) => {
    const nextDelivery = getNextExpectedDelivery(materialId);
    if (!nextDelivery) return '-';
    
    return nextDelivery.toLocaleDateString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Intet projekt valgt</h2>
            <p className="text-muted-foreground">Vælg et projekt for at administrere materialer</p>
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
            <h1 className="text-3xl font-bold text-foreground">Projekt Materialer</h1>
            <p className="text-muted-foreground mt-1">
              Administrer materialer for {activeProject.name}
            </p>
          </div>
          
          <Button className="gap-2" onClick={() => setShowImportDialog(true)}>
            <Plus className="h-4 w-4" />
            Tilføj fra Standard
          </Button>
        </div>

        {/* Legacy Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-orange-800 font-medium">LEGACY – denne side udfases. Brug 'Materialer'.</p>
              <p className="text-orange-700 text-sm mt-1">Den nye materiale-side giver bedre overblik og funktionalitet.</p>
            </div>
            <Button 
              onClick={() => navigate('/project/materials')} 
              variant="outline" 
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              Gå til nye Materialer
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtre og søgning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Søg materialer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle kategorier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kategorier</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle leverandører" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle leverandører</SelectItem>
                  {projectSuppliers.map(supplierId => (
                    <SelectItem key={supplierId} value={supplierId}>
                      {getSupplierName(supplierId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Godkendelsesstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle godkendelser</SelectItem>
                  <SelectItem value="fully_approved">Fuldt godkendt</SelectItem>
                  <SelectItem value="partially_approved">Delvist godkendt</SelectItem>
                  <SelectItem value="not_approved">Ikke godkendt</SelectItem>
                </SelectContent>
              </Select>

              <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Bestillingsstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle bestillinger</SelectItem>
                  <SelectItem value="ordered">Bestilt</SelectItem>
                  <SelectItem value="not_ordered">Ikke bestilt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Projektmaterialer ({filteredMaterials.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredMaterials.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Materialenavn</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Leverandør</TableHead>
                      <TableHead>Enhed</TableHead>
                      <TableHead>Enhedspris</TableHead>
                      <TableHead>Godkendelsesstatus</TableHead>
                      <TableHead>Bestillingsstatus</TableHead>
                      <TableHead>Forventet levering</TableHead>
                      <TableHead>Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>{material.category}</TableCell>
                        <TableCell>{getSupplierName(material.supplierId)}</TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>
                          {material.unitPrice ? (
                            <span className={material.priceStatus === 'confirmed' ? 'text-green-600' : 'text-orange-600'}>
                              {material.unitPrice.toFixed(2)} {material.currency}
                              {material.priceStatus === 'not_confirmed' && <span className="text-xs ml-1">(ikke bekræftet)</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getApprovalBadge(material.id)}</TableCell>
                        <TableCell>{getOrderStatusBadge(material)}</TableCell>
                        <TableCell>{formatNextDelivery(material.id)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditMaterial(material.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMaterial(material.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Ingen materialer fundet</h3>
                <p className="text-muted-foreground mb-4">
                  {currentProjectMaterials.length === 0 
                    ? "Dette projekt har ingen materialer endnu"
                    : "Ingen materialer matcher de valgte filtre"
                  }
                </p>
                {currentProjectMaterials.length === 0 && (
                  <Button onClick={() => setShowImportDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tilføj Materialer fra Standard
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Importér Materialer fra Standard</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Vælg</TableHead>
                      <TableHead>Materialenavn</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Enhed</TableHead>
                      <TableHead>Leverandør</TableHead>
                      <TableHead>Seneste Pris</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standardMaterials
                      .map((material) => (
                      <TableRow key={material.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedStandardMaterials.includes(material.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStandardMaterials(prev => [...prev, material.id]);
                              } else {
                                setSelectedStandardMaterials(prev => prev.filter(id => id !== material.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>{material.category}</TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>{getSupplierName(material.primarySupplierId)}</TableCell>
                        <TableCell>
                          {materialPrices[material.id] ? (
                            <span className="text-sm">
                              {materialPrices[material.id].price.toLocaleString('da-DK')} {materialPrices[material.id].currency}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {new Date(materialPrices[material.id].date).toLocaleDateString('da-DK')}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Ingen pris</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleImportFromStandard} className="flex-1">
                  Importér Valgte Materialer ({selectedStandardMaterials.length})
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowImportDialog(false);
                    setSelectedStandardMaterials([]);
                  }}
                >
                  Annuller
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectMaterials;