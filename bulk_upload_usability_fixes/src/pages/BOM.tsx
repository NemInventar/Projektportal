import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { usePurchaseOrders } from '@/contexts/PurchaseOrdersContext';

const BOM = () => {
  const { activeProject } = useProject();
  const { 
    projectMaterials, 
    getApprovalStatus,
    validateOrderCreation
  } = useProjectMaterials();
  const { suppliers } = useStandardSuppliers();
  const { 
    getTotalOrderedQty,
    getNextDeliveryDate,
    findOrCreateDraftPO,
    createPurchaseOrderLine
  } = usePurchaseOrders();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<string>('');
  const [orderLines, setOrderLines] = useState<{
    materialId: string;
    orderedQty: number;
    expectedDelivery: string;
    notes: string;
    approvalOverride: boolean;
    approvalOverrideReason: string;
  }[]>([]);

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
    const matchesApproval = approvalFilter === 'all' || 
                           (approvalFilter === 'fully_approved' && approvalStatus === 'fully_approved') ||
                           (approvalFilter === 'not_fully_approved' && approvalStatus !== 'fully_approved');
    
    const totalOrdered = getTotalOrderedQty(material.id);
    const matchesOrderStatus = orderStatusFilter === 'all' || 
                              (orderStatusFilter === 'ordered' && totalOrdered > 0) ||
                              (orderStatusFilter === 'not_ordered' && totalOrdered === 0);

    return matchesSearch && matchesSupplier && matchesCategory && matchesApproval && matchesOrderStatus;
  });

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
      default:
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Ikke fuldt godkendt</Badge>;
    }
  };

  const getOrderStatusBadge = (materialId: string) => {
    const totalOrdered = getTotalOrderedQty(materialId);
    if (totalOrdered === 0) {
      return <Badge variant="outline">Ikke bestilt</Badge>;
    }
    return <Badge variant="default" className="bg-blue-100 text-blue-800">Bestilt</Badge>;
  };

  const hasApprovalOverride = (materialId: string) => {
    // TODO: Check if any PO lines for this material have approval override
    // This would require access to purchase order lines data
    return false; // Placeholder for now
  };

  const formatNextDelivery = (materialId: string) => {
    const nextDelivery = getNextDeliveryDate(materialId);
    if (!nextDelivery) return '-';
    
    return nextDelivery.toLocaleDateString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleMaterialSelect = (materialId: string, checked: boolean) => {
    if (checked) {
      setSelectedMaterials(prev => [...prev, materialId]);
    } else {
      setSelectedMaterials(prev => prev.filter(id => id !== materialId));
    }
  };

  const handleCreateOrders = () => {
    if (selectedMaterials.length === 0) {
      toast({
        title: "Ingen materialer valgt",
        description: "Vælg mindst ét materiale at bestille",
        variant: "destructive",
      });
      return;
    }

    // Group selected materials by supplier
    const materialsBySupplier = new Map<string, typeof currentProjectMaterials>();
    
    selectedMaterials.forEach(materialId => {
      const material = currentProjectMaterials.find(m => m.id === materialId);
      if (material && material.supplierId) {
        if (!materialsBySupplier.has(material.supplierId)) {
          materialsBySupplier.set(material.supplierId, []);
        }
        materialsBySupplier.get(material.supplierId)!.push(material);
      }
    });

    if (materialsBySupplier.size === 0) {
      toast({
        title: "Ingen leverandører",
        description: "De valgte materialer har ingen leverandører tildelt",
        variant: "destructive",
      });
      return;
    }

    // For V1, take the first supplier (later we can iterate through all)
    const firstSupplier = Array.from(materialsBySupplier.keys())[0];
    const materialsForSupplier = materialsBySupplier.get(firstSupplier)!;
    
    setCurrentSupplier(firstSupplier);
    setOrderLines(materialsForSupplier.map(material => ({
      materialId: material.id,
      orderedQty: 1,
      expectedDelivery: '',
      notes: '',
      approvalOverride: false,
      approvalOverrideReason: ''
    })));
    setShowOrderDialog(true);
  };

  const handleSubmitOrder = async () => {
    if (!activeProject || !currentSupplier) return;

    const errors: string[] = [];
    const validLines: typeof orderLines = [];

    // Validate each line
    orderLines.forEach(line => {
      const material = currentProjectMaterials.find(m => m.id === line.materialId);
      if (!material) return;

      // Check approvals (hard-stop unless override)
      const validation = validateOrderCreation(line.materialId);
      if (!validation.canOrder && !line.approvalOverride) {
        errors.push(`${material.name}: ${validation.reason}`);
        return;
      }
      
      // If using approval override, validate reason is provided
      if (line.approvalOverride && !line.approvalOverrideReason.trim()) {
        errors.push(`${material.name}: Begrundelse er påkrævet når godkendelser ignoreres`);
        return;
      }

      // Check quantity
      if (line.orderedQty <= 0) {
        errors.push(`${material.name}: Mængde skal være større end 0`);
        return;
      }

      validLines.push(line);
    });

    if (errors.length > 0) {
      toast({
        title: "Bestillingsfejl",
        description: `${errors.length} fejl fundet:\n${errors.join('\n')}`,
        variant: "destructive",
      });
      return;
    }

    if (validLines.length === 0) {
      toast({
        title: "Ingen gyldige linjer",
        description: "Ingen materialer kan bestilles",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find or create draft PO
      const po = findOrCreateDraftPO(activeProject.id, currentSupplier);

      // Create PO lines
      validLines.forEach(line => {
        const material = currentProjectMaterials.find(m => m.id === line.materialId)!;
        
        createPurchaseOrderLine({
          purchaseOrderId: po.id,
          projectMaterialId: line.materialId,
          supplierId: currentSupplier,
          supplierProductCode: material.supplierProductCode || '',
          supplierProductUrl: material.supplierProductUrl || '',
          orderedQty: line.orderedQty,
          unit: material.unit,
          unitPrice: material.unitPrice,
          currency: material.currency,
          expectedDeliveryDate: line.expectedDelivery ? new Date(line.expectedDelivery) : undefined,
          status: 'ordered',
          notes: line.notes,
          // Approval override fields
          approvalOverride: line.approvalOverride,
          approvalOverrideReason: line.approvalOverride ? line.approvalOverrideReason : undefined,
          approvalOverrideBy: line.approvalOverride ? 'current_user' : undefined, // TODO: Get actual user
          approvalOverrideAt: line.approvalOverride ? new Date() : undefined,
        });
      });

      toast({
        title: "Bestilling oprettet",
        description: `${validLines.length} materialer bestilt fra ${getSupplierName(currentSupplier)}`,
      });

      // Reset state
      setSelectedMaterials([]);
      setShowOrderDialog(false);
      setOrderLines([]);
      setCurrentSupplier('');

    } catch (error) {
      toast({
        title: "Fejl ved bestilling",
        description: "Der opstod en fejl ved oprettelse af bestillingen",
        variant: "destructive",
      });
    }
  };

  const updateOrderLine = (materialId: string, field: string, value: any) => {
    setOrderLines(prev => prev.map(line => 
      line.materialId === materialId 
        ? { ...line, [field]: value }
        : line
    ));
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Intet projekt valgt</h2>
            <p className="text-muted-foreground">Vælg et projekt for at se BOM/Indkøb</p>
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
            <h1 className="text-3xl font-bold text-foreground">BOM / Indkøb</h1>
            <p className="text-muted-foreground mt-1">
              Samlet indkøbsoverblik for {activeProject.name}
            </p>
          </div>
          
          {selectedMaterials.length > 0 && (
            <Button className="gap-2" onClick={handleCreateOrders}>
              <ShoppingCart className="h-4 w-4" />
              Opret Bestilling ({selectedMaterials.length})
            </Button>
          )}
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
                  <SelectItem value="not_fully_approved">Ikke fuldt godkendt</SelectItem>
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

        {/* BOM Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              BOM Oversigt ({filteredMaterials.length} materialer)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredMaterials.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Vælg</TableHead>
                      <TableHead>Materialenavn</TableHead>
                      <TableHead>Leverandør</TableHead>
                      <TableHead>Enhed</TableHead>
                      <TableHead>Enhedspris</TableHead>
                      <TableHead>Godkendelsesstatus</TableHead>
                      <TableHead>Bestilt i alt</TableHead>
                      <TableHead>Næste levering</TableHead>
                      <TableHead>Bestillingsstatus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => (
                      <TableRow 
                        key={material.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/projects/${activeProject.id}/materials/${material.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedMaterials.includes(material.id)}
                            onCheckedChange={(checked) => handleMaterialSelect(material.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>{getSupplierName(material.supplierId)}</TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>
                          {material.unitPrice ? (
                            <span className={material.priceStatus === 'confirmed' ? 'text-green-600' : 'text-orange-600'}>
                              {material.unitPrice.toFixed(2)} {material.currency}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getApprovalBadge(material.id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {getTotalOrderedQty(material.id)} {material.unit}
                            </span>
                            {hasApprovalOverride(material.id) && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Override
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatNextDelivery(material.id)}</TableCell>
                        <TableCell>{getOrderStatusBadge(material.id)}</TableCell>
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
                  <Button onClick={() => navigate('/project/materials')} className="gap-2">
                    <Package className="h-4 w-4" />
                    Gå til Projekt Materialer
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Dialog */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Opret Bestilling - {getSupplierName(currentSupplier)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Materiale</TableHead>
                      <TableHead>Enhed</TableHead>
                      <TableHead>Enhedspris</TableHead>
                      <TableHead>Bestilt mængde *</TableHead>
                      <TableHead>Forventet levering</TableHead>
                      <TableHead>Noter</TableHead>
                      <TableHead>Ignorér godkendelser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderLines.map((line) => {
                      const material = currentProjectMaterials.find(m => m.id === line.materialId);
                      if (!material) return null;
                      
                      const validation = validateOrderCreation(line.materialId);
                      const hasError = !validation.canOrder;
                      
                      return (
                        <TableRow key={line.materialId} className={hasError ? 'bg-red-50' : ''}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{material.name}</div>
                              {hasError && (
                                <div className="text-sm text-red-600 mt-1">
                                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                                  {validation.reason}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{material.unit}</TableCell>
                          <TableCell>
                            {material.unitPrice ? `${material.unitPrice.toFixed(2)} ${material.currency}` : '-'}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={line.orderedQty}
                              onChange={(e) => updateOrderLine(line.materialId, 'orderedQty', parseInt(e.target.value) || 0)}
                              disabled={hasError}
                              className={hasError ? 'bg-gray-100' : ''}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={line.expectedDelivery}
                              onChange={(e) => updateOrderLine(line.materialId, 'expectedDelivery', e.target.value)}
                              disabled={hasError}
                              className={hasError ? 'bg-gray-100' : ''}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.notes}
                              onChange={(e) => updateOrderLine(line.materialId, 'notes', e.target.value)}
                              placeholder="Valgfri noter..."
                              disabled={hasError}
                              className={`min-w-[200px] ${hasError ? 'bg-gray-100' : ''}`}
                            />
                          </TableCell>
                          <TableCell>
                            {hasError && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={line.approvalOverride}
                                    onCheckedChange={(checked) => 
                                      updateOrderLine(line.materialId, 'approvalOverride', checked)
                                    }
                                  />
                                  <Label className="text-sm text-orange-600">
                                    Ignorér godkendelser (kun til test)
                                  </Label>
                                </div>
                                {line.approvalOverride && (
                                  <Input
                                    value={line.approvalOverrideReason}
                                    onChange={(e) => updateOrderLine(line.materialId, 'approvalOverrideReason', e.target.value)}
                                    placeholder="Begrundelse (påkrævet)..."
                                    className="text-sm min-w-[250px]"
                                  />
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmitOrder} className="flex-1">
                  Opret Bestilling
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowOrderDialog(false);
                    setOrderLines([]);
                    setCurrentSupplier('');
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

export default BOM;