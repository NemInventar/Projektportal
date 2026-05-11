import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { 
  ArrowLeft,
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { usePurchaseOrders } from '@/contexts/PurchaseOrdersContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

const PurchaseOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { 
    purchaseOrders, 
    purchaseOrderLines,
    updatePurchaseOrder,
    updatePurchaseOrderLine
  } = usePurchaseOrders();
  const { projectMaterials } = useProjectMaterials();
  const { suppliers } = useStandardSuppliers();
  
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const purchaseOrder = purchaseOrders.find(po => po.id === id);
  const poLines = purchaseOrderLines.filter(line => line.purchaseOrderId === id);
  
  useEffect(() => {
    if (purchaseOrder) {
      setNotes(purchaseOrder.notes || '');
    }
  }, [purchaseOrder]);

  if (!purchaseOrder) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Indkøbsordre ikke fundet</h2>
            <p className="text-muted-foreground mb-4">
              Den ønskede indkøbsordre kunne ikke findes
            </p>
            <Button onClick={() => navigate('/project/purchase-orders')}>
              Tilbage til ordrer
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const supplier = suppliers.find(s => s.id === purchaseOrder.supplierId);
  const hasOverrideLines = poLines.some(line => line.approvalOverride);
  const hasNonApprovedMaterials = poLines.some(line => {
    const material = projectMaterials.find(m => m.id === line.projectMaterialId);
    return material && !isFullyApproved(material.id);
  });

  const isFullyApproved = (materialId: string) => {
    const material = projectMaterials.find(m => m.id === materialId);
    if (!material) return false;
    
    const productionApproval = material.approvals.find(a => a.type === 'production');
    const sustainabilityApproval = material.approvals.find(a => a.type === 'sustainability');
    
    return productionApproval?.status === 'approved' && sustainabilityApproval?.status === 'approved';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Draft</Badge>;
      case 'sent':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Sendt</Badge>;
      case 'confirmed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Bekræftet</Badge>;
      case 'delivered':
        return <Badge variant="default" className="bg-green-600 text-white">Leveret</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulleret</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLineStatusBadge = (status: string) => {
    switch (status) {
      case 'ordered':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Bestilt</Badge>;
      case 'partially_received':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Delvist modtaget</Badge>;
      case 'received':
        return <Badge variant="default" className="bg-green-100 text-green-800">Modtaget</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK'
    }).format(amount);
  };

  const getTotalValue = () => {
    return poLines.reduce((total, line) => {
      return total + (line.orderedQty * (line.unitPrice || 0));
    }, 0);
  };

  const handleStatusChange = (newStatus: string) => {
    updatePurchaseOrder(purchaseOrder.id, { status: newStatus });
    toast({
      title: "Status opdateret",
      description: `Ordrestatus ændret til ${newStatus}`,
    });
  };

  const handleNotesUpdate = () => {
    updatePurchaseOrder(purchaseOrder.id, { notes });
    setEditingNotes(false);
    toast({
      title: "Noter opdateret",
      description: "Ordrenoter er blevet gemt",
    });
  };

  const handleLineUpdate = (lineId: string, field: string, value: any) => {
    updatePurchaseOrderLine(lineId, { [field]: value });
    toast({
      title: "Linje opdateret",
      description: "Ordrelinjen er blevet opdateret",
    });
  };

  const getMaterialName = (materialId: string) => {
    const material = projectMaterials.find(m => m.id === materialId);
    return material?.name || 'Ukendt materiale';
  };

  const navigateToMaterial = (materialId: string) => {
    navigate(`/projects/${activeProject?.id}/materials/${materialId}`);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/project/purchase-orders')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til ordrer
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              PO #{purchaseOrder.id.split('_')[1] || purchaseOrder.id.substring(0, 8)}
            </h1>
            <p className="text-muted-foreground">
              {supplier?.name || 'Ukendt leverandør'} • Oprettet {formatDate(purchaseOrder.createdAt)}
            </p>
          </div>
        </div>

        {/* Compliance Warning */}
        {hasOverrideLines && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800">
              Ordren indeholder linjer bestilt uden fulde godkendelser
            </AlertTitle>
            <AlertDescription className="text-orange-700">
              Nogle materialer i denne ordre blev bestilt før alle godkendelser var på plads. 
              Se ⚠️ markerede linjer nedenfor for detaljer.
            </AlertDescription>
          </Alert>
        )}

        {/* PO Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Ordredetaljer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Leverandør</label>
                <div className="mt-1 text-sm">{supplier?.name || 'Ukendt leverandør'}</div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Select 
                    value={purchaseOrder.status} 
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sendt</SelectItem>
                      <SelectItem value="confirmed">Bekræftet</SelectItem>
                      <SelectItem value="delivered">Leveret</SelectItem>
                      <SelectItem value="cancelled">Annulleret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Totalværdi</label>
                <div className="mt-1 text-lg font-semibold">{formatCurrency(getTotalValue())}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Noter</label>
                {!editingNotes ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingNotes(true)}
                    className="gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Rediger
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleNotesUpdate}>Gem</Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setEditingNotes(false);
                        setNotes(purchaseOrder.notes || '');
                      }}
                    >
                      Annuller
                    </Button>
                  </div>
                )}
              </div>
              {editingNotes ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tilføj noter til ordren..."
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">
                  {purchaseOrder.notes || 'Ingen noter'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PO Lines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Ordrelinjer ({poLines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {poLines.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Materiale</TableHead>
                      <TableHead>Varenr.</TableHead>
                      <TableHead>Mængde</TableHead>
                      <TableHead>Enhed</TableHead>
                      <TableHead>Enhedspris</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Forventet levering</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Noter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poLines.map((line) => {
                      const lineTotal = line.orderedQty * (line.unitPrice || 0);
                      
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="link"
                                className="p-0 h-auto font-medium text-left"
                                onClick={() => navigateToMaterial(line.projectMaterialId)}
                              >
                                {getMaterialName(line.projectMaterialId)}
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                              {line.approvalOverride && (
                                <Badge 
                                  variant="outline" 
                                  className="bg-orange-50 text-orange-700 border-orange-200"
                                  title={`Override: ${line.approvalOverrideReason}\nAf: ${line.approvalOverrideBy}\nDato: ${line.approvalOverrideAt ? formatDate(line.approvalOverrideAt) : 'Ukendt'}`}
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Override
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {line.supplierProductCode || '-'}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={line.orderedQty}
                              onChange={(e) => handleLineUpdate(line.id, 'orderedQty', parseFloat(e.target.value) || 0)}
                              className="w-20"
                              disabled={purchaseOrder.status !== 'draft'}
                            />
                          </TableCell>
                          <TableCell>{line.unit}</TableCell>
                          <TableCell>
                            {line.unitPrice ? formatCurrency(line.unitPrice) : '-'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(lineTotal)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={line.expectedDeliveryDate ? line.expectedDeliveryDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => handleLineUpdate(line.id, 'expectedDeliveryDate', e.target.value ? new Date(e.target.value) : null)}
                              className="w-36"
                              disabled={purchaseOrder.status === 'cancelled'}
                            />
                          </TableCell>
                          <TableCell>
                            {getLineStatusBadge(line.status)}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.notes || ''}
                              onChange={(e) => handleLineUpdate(line.id, 'notes', e.target.value)}
                              placeholder="Noter..."
                              className="w-32"
                              disabled={purchaseOrder.status === 'cancelled'}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Ingen linjer i denne ordre</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {poLines.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Antal linjer</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {poLines.length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Samlet værdi</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(getTotalValue())}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Override linjer</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {poLines.filter(line => line.approvalOverride).length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PurchaseOrderDetail;