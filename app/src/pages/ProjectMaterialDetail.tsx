import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  XCircle,
  Clock,
  Package,
  FileText,
  User,
  Leaf,
  MapPin,
  Truck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMaterials, ProjectMaterial } from '@/contexts/ProjectMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { useStandardMaterials } from '@/contexts/StandardMaterialsContext';
import { usePurchaseOrders } from '@/contexts/PurchaseOrdersContext';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';

const ProjectMaterialDetail = () => {
  const { projectId, materialId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const {
    projectMaterials,
    updateProjectMaterial,
    addApproval,
    getApprovalStatus,
    validateOrderCreation,
    hasKosovoTransportBooked,
    isKosovoTransportDerived,
    setKosovoTransportManualFlag
  } = useProjectMaterials();
  const { suppliers } = useStandardSuppliers();
  const { materials: standardMaterials } = useStandardMaterials();
  const {
    getPOLinesByMaterial,
    findOrCreateDraftPO,
    createPurchaseOrderLine,
    updatePurchaseOrderLine,
    getTotalOrderedQty,
  } = usePurchaseOrders();
  const { user } = useAuth();

  const [material, setMaterial] = useState<ProjectMaterial | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({
    supplierId: '',
    orderedQuantity: 0,
    expectedDelivery: '',
    comment: '',
    approvalOverride: false,
    approvalOverrideReason: '',
  });

  const isNew = materialId === 'new';

  useEffect(() => {
    if (!isNew) {
      const foundMaterial = projectMaterials.find(m => m.id === materialId);
      if (foundMaterial) {
        setMaterial(foundMaterial);
      }
    } else {
      // Initialize new material
      setMaterial({
        id: 'new',
        projectId: projectId || '',
        name: '',
        category: '',
        unit: 'stk',
        currency: 'DKK',
        priceStatus: 'not_confirmed',
        approvals: [
          {
            id: 'prod_new',
            type: 'production',
            status: 'not_approved',
          },
          {
            id: 'sust_new',
            type: 'sustainability',
            status: 'not_approved',
          }
        ],
        orders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }, [materialId, projectMaterials, isNew, projectId]);

  const handleSave = async () => {
    if (!material) return;

    if (!material.name || !material.category) {
      toast({
        title: "Fejl",
        description: "Materialenavn og kategori er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProjectMaterial(material.id, material);
      
      toast({
        title: "Materiale gemt",
        description: "Ændringerne er blevet gemt",
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved gemning af materialet",
        variant: "destructive",
      });
      console.error('Error saving material:', error);
    }
  };

  const handleApprovalChange = async (type: 'production' | 'sustainability', status: 'approved' | 'not_approved', comment?: string) => {
    if (!material) return;

    const approvedBy = user?.email || 'Ukendt bruger';

    try {
      await addApproval(material.id, {
        type,
        status,
        comment,
        approvedBy,
        approvedAt: status === 'approved' ? new Date() : undefined,
      });
    } catch (error) {
      console.error('Error saving approval:', error);
      toast({
        title: "Fejl",
        description: "Godkendelsen kunne ikke gemmes",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: status === 'approved' ? "Godkendt" : "Afvist",
      description: `${type === 'production' ? 'Produktionsgodkendelse' : 'Bæredygtighedsgodkendelse'} er gemt.`,
    });

    // Update local state
    setMaterial(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        approvals: prev.approvals.map(approval =>
          approval.type === type
            ? {
                ...approval,
                status,
                comment,
                approvedBy: status === 'approved' ? approvedBy : undefined,
                approvedAt: status === 'approved' ? new Date() : undefined,
              }
            : approval
        ),
      };
    });
  };

  const openNewOrderDialog = () => {
    if (isNew) {
      toast({
        title: "Gem materialet først",
        description: "Materialet skal gemmes før der kan registreres en bestilling på det.",
        variant: "destructive",
      });
      return;
    }
    if (material?.supplierId) {
      setNewOrder(prev => ({ ...prev, supplierId: material.supplierId! }));
    }
    setShowNewOrderDialog(true);
  };

  const resetNewOrderForm = () => {
    setNewOrder({
      supplierId: '',
      orderedQuantity: 0,
      expectedDelivery: '',
      comment: '',
      approvalOverride: false,
      approvalOverrideReason: '',
    });
  };

  const sourcingLabel = (decision: 'kosovo' | 'dk_to_kosovo' | 'dk_local') => {
    switch (decision) {
      case 'kosovo': return 'Købes i Kosovo';
      case 'dk_to_kosovo': return 'Købes i DK → sendes til Kosovo';
      case 'dk_local': return 'Købes i DK → bliver i DK';
    }
  };

  const handleSourcingDecisionChange = async (decision: 'kosovo' | 'dk_to_kosovo' | 'dk_local') => {
    if (!material || isNew) return;

    const clearsDate = decision !== 'dk_to_kosovo';
    try {
      await updateProjectMaterial(material.id, {
        sourcingDecision: decision,
        ...(clearsDate ? { kosovoTargetDeliveryDate: null as unknown as undefined } : {}),
      });
      setMaterial(prev => prev ? {
        ...prev,
        sourcingDecision: decision,
        kosovoTargetDeliveryDate: clearsDate ? undefined : prev.kosovoTargetDeliveryDate,
      } : prev);
      toast({ title: "Beslutning gemt", description: sourcingLabel(decision) });
    } catch (error) {
      console.error('Error saving sourcing decision:', error);
      toast({ title: "Fejl", description: "Beslutningen kunne ikke gemmes", variant: "destructive" });
    }
  };

  const handleToggleKosovoTransport = async (checked: boolean) => {
    if (!material) return;
    try {
      await setKosovoTransportManualFlag(material.id, checked);
      toast({ title: checked ? "Transport markeret bestilt" : "Markering fjernet" });
    } catch (error) {
      console.error('Error updating Kosovo transport flag:', error);
      toast({ title: "Fejl", description: "Kunne ikke gemme markeringen", variant: "destructive" });
    }
  };

  const handleKosovoDateChange = async (dateStr: string) => {
    if (!material || isNew) return;

    const date = dateStr ? new Date(dateStr) : null;
    try {
      await updateProjectMaterial(material.id, { kosovoTargetDeliveryDate: date as unknown as undefined });
      setMaterial(prev => prev ? { ...prev, kosovoTargetDeliveryDate: date ?? undefined } : prev);
    } catch (error) {
      console.error('Error saving Kosovo target date:', error);
      toast({ title: "Fejl", description: "Dato kunne ikke gemmes", variant: "destructive" });
    }
  };

  const handleAddOrder = async () => {
    if (isNew) {
      toast({
        title: "Gem materialet først",
        description: "Materialet skal gemmes før der kan registreres en bestilling på det.",
        variant: "destructive",
      });
      return;
    }
    if (!material || !activeProject) {
      toast({
        title: "Fejl",
        description: "Kunne ikke finde materialet eller det aktive projekt — prøv at genindlæse siden.",
        variant: "destructive",
      });
      return;
    }

    if (!newOrder.supplierId || newOrder.orderedQuantity <= 0) {
      toast({
        title: "Fejl",
        description: "Leverandør og mængde er påkrævet",
        variant: "destructive",
      });
      return;
    }

    const validation = validateOrderCreation(material.id);
    if (!validation.canOrder && !newOrder.approvalOverride) {
      toast({
        title: "Kan ikke bestille endnu",
        description: validation.reason,
        variant: "destructive",
      });
      return;
    }

    if (newOrder.approvalOverride && !newOrder.approvalOverrideReason.trim()) {
      toast({
        title: "Begrundelse mangler",
        description: "Skriv en begrundelse for at bestille uden fuld godkendelse",
        variant: "destructive",
      });
      return;
    }

    setSubmittingOrder(true);
    try {
      const po = await findOrCreateDraftPO(activeProject.id, newOrder.supplierId);

      await createPurchaseOrderLine({
        purchaseOrderId: po.id,
        projectMaterialId: material.id,
        supplierId: newOrder.supplierId,
        supplierProductCode: material.supplierProductCode,
        supplierProductUrl: material.supplierProductUrl,
        orderedQty: newOrder.orderedQuantity,
        unit: material.unit,
        unitPrice: material.unitPrice,
        currency: material.currency,
        expectedDeliveryDate: newOrder.expectedDelivery ? new Date(newOrder.expectedDelivery) : undefined,
        status: 'ordered',
        notes: newOrder.comment || undefined,
        approvalOverride: newOrder.approvalOverride,
        approvalOverrideReason: newOrder.approvalOverride ? newOrder.approvalOverrideReason : undefined,
        approvalOverrideBy: newOrder.approvalOverride ? (user?.email || 'ukendt') : undefined,
        approvalOverrideAt: newOrder.approvalOverride ? new Date() : undefined,
      });

      // Ingen leverandør valgt på materialet endnu -> sæt den nu, så "ingen leverandør"-flaget rydder sig
      if (!material.supplierId) {
        await updateProjectMaterial(material.id, { supplierId: newOrder.supplierId });
        setMaterial(prev => (prev ? { ...prev, supplierId: newOrder.supplierId } : prev));
      }

      resetNewOrderForm();
      setShowNewOrderDialog(false);

      toast({
        title: "Bestilling registreret",
        description: "Materialet er nu markeret som bestilt",
      });
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Fejl",
        description: "Bestillingen kunne ikke registreres",
        variant: "destructive",
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleMarkDelivered = async (lineId: string, dateStr: string) => {
    try {
      await updatePurchaseOrderLine(lineId, {
        status: dateStr ? 'delivered' : 'ordered',
        deliveredDate: dateStr ? new Date(dateStr) : undefined,
      });
      toast({
        title: dateStr ? "Markeret leveret" : "Leveret-dato fjernet",
        description: dateStr ? `Leveringsdato sat til ${dateStr}` : undefined,
      });
    } catch (error) {
      console.error('Error marking line delivered:', error);
      toast({ title: "Fejl", description: "Kunne ikke opdatere leveringsstatus", variant: "destructive" });
    }
  };

  const handleSetDeliveredLocation = async (lineId: string, location: 'dk' | 'kosovo') => {
    if (!material) return;
    try {
      await updatePurchaseOrderLine(lineId, { deliveredLocation: location });
      // Ankommet til Kosovo beviser at transporten er sket — ryd "ikke bestilt"-advarslen automatisk.
      if (location === 'kosovo') {
        await setKosovoTransportManualFlag(material.id, true);
      }
      toast({ title: `Markeret leveret i ${location === 'dk' ? 'DK' : 'Kosovo'}` });
    } catch (error) {
      console.error('Error setting delivered location:', error);
      toast({ title: "Fejl", description: "Kunne ikke gemme leveringssted", variant: "destructive" });
    }
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
  };

  const getLineStatusLabel = (status: string) => {
    switch (status) {
      case 'ordered': return 'Bestilt';
      case 'confirmed': return 'Bekræftet';
      case 'delivered': return 'Leveret';
      case 'cancelled': return 'Annulleret';
      default: return status;
    }
  };

  const getApprovalIcon = (status: 'approved' | 'not_approved') => {
    return status === 'approved' ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStandardMaterialDocuments = () => {
    if (!material?.standardMaterialId) return [];
    const standardMaterial = standardMaterials.find(m => m.id === material.standardMaterialId);
    return standardMaterial?.documents || [];
  };

  if (!material) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Materiale ikke fundet</h2>
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage
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
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isNew ? 'Nyt Projektmateriale' : material.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {activeProject?.name} • {material.category}
              </p>
            </div>
          </div>
          
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Gem
          </Button>
        </div>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Stamdata</TabsTrigger>
            <TabsTrigger value="supplier">Leverandør & Pris</TabsTrigger>
            <TabsTrigger value="approvals">Godkendelser</TabsTrigger>
            <TabsTrigger value="orders">Bestillinger</TabsTrigger>
            <TabsTrigger value="documents">Dokumenter</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>Grundlæggende oplysninger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Materialenavn *</Label>
                    <Input
                      id="name"
                      value={material.name}
                      onChange={(e) => setMaterial(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="Indtast materialenavn"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Kategori *</Label>
                    <Input
                      id="category"
                      value={material.category}
                      onChange={(e) => setMaterial(prev => prev ? { ...prev, category: e.target.value } : null)}
                      placeholder="Indtast kategori"
                    />
                  </div>

                  <div>
                    <Label htmlFor="unit">Enhed</Label>
                    <Input
                      id="unit"
                      value={material.unit}
                      onChange={(e) => setMaterial(prev => prev ? { ...prev, unit: e.target.value } : null)}
                      placeholder="stk, m, m², kg..."
                      disabled={!isNew}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Projektspecifikke noter</Label>
                  <Textarea
                    id="notes"
                    value={material.notes || ''}
                    onChange={(e) => setMaterial(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    placeholder="Tilføj noter specifikt for dette projekt..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Kosovo/DK — hvor købes materialet?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isNew ? (
                  <p className="text-sm text-muted-foreground">Gem materialet først, før oprindelses-beslutningen kan tages.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Button
                        variant={material.sourcingDecision === 'kosovo' ? 'default' : 'outline'}
                        onClick={() => handleSourcingDecisionChange('kosovo')}
                      >
                        Købes i Kosovo
                      </Button>
                      <Button
                        variant={material.sourcingDecision === 'dk_to_kosovo' ? 'default' : 'outline'}
                        onClick={() => handleSourcingDecisionChange('dk_to_kosovo')}
                      >
                        Købes i DK → sendes til Kosovo
                      </Button>
                      <Button
                        variant={material.sourcingDecision === 'dk_local' ? 'default' : 'outline'}
                        onClick={() => handleSourcingDecisionChange('dk_local')}
                      >
                        Købes i DK → bliver i DK
                      </Button>
                    </div>

                    {!material.sourcingDecision && (
                      <p className="text-sm text-muted-foreground">
                        Ingen beslutning taget endnu — vælg en af mulighederne ovenfor.
                      </p>
                    )}

                    {material.sourcingDecision === 'dk_to_kosovo' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <Label htmlFor="kosovoTargetDate">Ønsket leveringsdato i Kosovo</Label>
                          <Input
                            id="kosovoTargetDate"
                            type="date"
                            value={material.kosovoTargetDeliveryDate ? material.kosovoTargetDeliveryDate.toISOString().split('T')[0] : ''}
                            onChange={(e) => handleKosovoDateChange(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Transportstatus</Label>
                          <div className="mt-1">
                            {isKosovoTransportDerived(material.id) ? (
                              <Badge
                                variant="default"
                                className="bg-green-600 text-white"
                                title="Koblet til en oprettet Kosovo-forsendelse"
                              >
                                <Truck className="h-3 w-3 mr-1" />
                                Transport bestilt
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={hasKosovoTransportBooked(material.id)}
                                  onCheckedChange={(checked) => handleToggleKosovoTransport(checked as boolean)}
                                />
                                <span className={hasKosovoTransportBooked(material.id) ? 'text-green-700' : 'text-red-700'}>
                                  {hasKosovoTransportBooked(material.id) ? 'Transport bestilt' : 'Transport ikke bestilt'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Supplier & Price Tab */}
          <TabsContent value="supplier">
            <Card>
              <CardHeader>
                <CardTitle>Leverandør & Pris</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="supplier">Leverandør</Label>
                    <Select 
                      value={material.supplierId || "none"} 
                      onValueChange={(value) => setMaterial(prev => prev ? { ...prev, supplierId: value === "none" ? "" : value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg leverandør" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ingen leverandør</SelectItem>
                        {suppliers.filter(s => s.status === 'Aktiv').map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="supplierProductCode">Leverandørens varenr.</Label>
                    <Input
                      id="supplierProductCode"
                      value={material.supplierProductCode || ''}
                      onChange={(e) => setMaterial(prev => prev ? { ...prev, supplierProductCode: e.target.value } : null)}
                      placeholder="Leverandørens produktkode"
                    />
                  </div>

                  <div>
                    <Label htmlFor="supplierProductUrl">Produktlink</Label>
                    <Input
                      id="supplierProductUrl"
                      value={material.supplierProductUrl || ''}
                      onChange={(e) => setMaterial(prev => prev ? { ...prev, supplierProductUrl: e.target.value } : null)}
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="unitPrice">Enhedspris</Label>
                    <div className="flex gap-2">
                      <Input
                        id="unitPrice"
                        type="number"
                        step="0.01"
                        value={material.unitPrice || ''}
                        onChange={(e) => setMaterial(prev => prev ? { ...prev, unitPrice: parseFloat(e.target.value) || undefined } : null)}
                        placeholder="0.00"
                      />
                      <Select 
                        value={material.currency} 
                        onValueChange={(value) => setMaterial(prev => prev ? { ...prev, currency: value } : null)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DKK">DKK</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="priceStatus">Prisstatus</Label>
                    <Select 
                      value={material.priceStatus} 
                      onValueChange={(value: 'not_confirmed' | 'confirmed') => setMaterial(prev => prev ? { ...prev, priceStatus: value } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_confirmed">Ikke bekræftet</SelectItem>
                        <SelectItem value="confirmed">Bekræftet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="priceNote">Prisnote</Label>
                  <Textarea
                    id="priceNote"
                    value={material.priceNote || ''}
                    onChange={(e) => setMaterial(prev => prev ? { ...prev, priceNote: e.target.value } : null)}
                    placeholder="Noter om pris, bekræftelse, gyldighedsperiode..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approvals Tab */}
          <TabsContent value="approvals">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Production Approval */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Produktionsgodkendelse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const approval = material.approvals.find(a => a.type === 'production');
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          {getApprovalIcon(approval?.status || 'not_approved')}
                          <Badge variant={approval?.status === 'approved' ? 'default' : 'destructive'}>
                            {approval?.status === 'approved' ? 'Godkendt' : 'Ikke godkendt'}
                          </Badge>
                        </div>
                        
                        {approval?.approvedBy && (
                          <div>
                            <Label>Godkendt af</Label>
                            <p className="text-sm text-muted-foreground">{approval.approvedBy}</p>
                          </div>
                        )}
                        
                        {approval?.approvedAt && (
                          <div>
                            <Label>Godkendt dato</Label>
                            <p className="text-sm text-muted-foreground">
                              {approval.approvedAt.toLocaleDateString('da-DK')}
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <Label htmlFor="prodComment">Kommentar</Label>
                          <Textarea
                            id="prodComment"
                            value={approval?.comment || ''}
                            onChange={(e) => {
                              const newComment = e.target.value;
                              setMaterial(prev => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  approvals: prev.approvals.map(a =>
                                    a.type === 'production' ? { ...a, comment: newComment } : a
                                  ),
                                };
                              });
                            }}
                            placeholder="Tilføj kommentar..."
                            rows={3}
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleApprovalChange('production', 'approved', approval?.comment)}
                            variant={approval?.status === 'approved' ? 'default' : 'outline'}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Godkend
                          </Button>
                          <Button 
                            onClick={() => handleApprovalChange('production', 'not_approved', approval?.comment)}
                            variant={approval?.status === 'not_approved' ? 'destructive' : 'outline'}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Afvis
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Sustainability Approval */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5" />
                    Projekt/DGNB/Bæredygtighedsgodkendelse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const approval = material.approvals.find(a => a.type === 'sustainability');
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          {getApprovalIcon(approval?.status || 'not_approved')}
                          <Badge variant={approval?.status === 'approved' ? 'default' : 'destructive'}>
                            {approval?.status === 'approved' ? 'Godkendt' : 'Ikke godkendt'}
                          </Badge>
                        </div>
                        
                        {approval?.approvedBy && (
                          <div>
                            <Label>Godkendt af</Label>
                            <p className="text-sm text-muted-foreground">{approval.approvedBy}</p>
                          </div>
                        )}
                        
                        {approval?.approvedAt && (
                          <div>
                            <Label>Godkendt dato</Label>
                            <p className="text-sm text-muted-foreground">
                              {approval.approvedAt.toLocaleDateString('da-DK')}
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <Label htmlFor="sustComment">Kommentar</Label>
                          <Textarea
                            id="sustComment"
                            value={approval?.comment || ''}
                            onChange={(e) => {
                              const newComment = e.target.value;
                              setMaterial(prev => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  approvals: prev.approvals.map(a =>
                                    a.type === 'sustainability' ? { ...a, comment: newComment } : a
                                  ),
                                };
                              });
                            }}
                            placeholder="Tilføj kommentar..."
                            rows={3}
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleApprovalChange('sustainability', 'approved', approval?.comment)}
                            variant={approval?.status === 'approved' ? 'default' : 'outline'}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Godkend
                          </Button>
                          <Button 
                            onClick={() => handleApprovalChange('sustainability', 'not_approved', approval?.comment)}
                            variant={approval?.status === 'not_approved' ? 'destructive' : 'outline'}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Afvis
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Bestillinger
                  </CardTitle>
                  <Button onClick={openNewOrderDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ny Bestilling
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  const poLines = isNew ? [] : getPOLinesByMaterial(material.id).filter(l => l.status !== 'cancelled');
                  const totalOrdered = isNew ? 0 : getTotalOrderedQty(material.id);
                  const allDelivered = poLines.length > 0 && poLines.every(l => l.status === 'delivered');

                  return (
                    <>
                      {/* Flags */}
                      <div className="flex flex-wrap gap-2">
                        {!material.supplierId && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            Ingen leverandør valgt
                          </Badge>
                        )}
                        {poLines.length === 0 ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            Ikke bestilt
                          </Badge>
                        ) : allDelivered ? (
                          <Badge variant="default" className="bg-green-600 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Leveret
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-blue-100 text-blue-800">Bestilt</Badge>
                        )}
                      </div>

                      {/* Summary */}
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Sammenfatning</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label>Samlet bestilt mængde</Label>
                            <p className="font-medium">{totalOrdered} {material.unit}</p>
                          </div>
                          <div>
                            <Label>Antal bestillinger</Label>
                            <p className="font-medium">{poLines.length}</p>
                          </div>
                        </div>
                      </div>

                      {/* Orders List */}
                      {poLines.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Leverandør</TableHead>
                                <TableHead>Bestilt mængde</TableHead>
                                <TableHead>Forventet levering</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Leveret dato</TableHead>
                                {material.sourcingDecision === 'dk_to_kosovo' && (
                                  <TableHead>Leveret hvor?</TableHead>
                                )}
                                <TableHead>Noter</TableHead>
                                <TableHead>Handlinger</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {poLines.map((line) => (
                                <TableRow key={line.id}>
                                  <TableCell>{getSupplierName(line.supplierId)}</TableCell>
                                  <TableCell>{line.orderedQty} {material.unit}</TableCell>
                                  <TableCell>
                                    {line.expectedDeliveryDate?.toLocaleDateString('da-DK') || '-'}
                                  </TableCell>
                                  <TableCell>{getApprovalIcon(line.status === 'delivered' ? 'approved' : 'not_approved')} {getLineStatusLabel(line.status)}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="date"
                                      value={line.deliveredDate ? line.deliveredDate.toISOString().split('T')[0] : ''}
                                      onChange={(e) => handleMarkDelivered(line.id, e.target.value)}
                                      className="w-36"
                                    />
                                  </TableCell>
                                  {material.sourcingDecision === 'dk_to_kosovo' && (
                                    <TableCell>
                                      {line.status === 'delivered' ? (
                                        <Select
                                          value={line.deliveredLocation || ''}
                                          onValueChange={(value) => handleSetDeliveredLocation(line.id, value as 'dk' | 'kosovo')}
                                        >
                                          <SelectTrigger className={`w-32 ${!line.deliveredLocation ? 'border-red-300 text-red-700' : ''}`}>
                                            <SelectValue placeholder="Vælg..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="dk">DK</SelectItem>
                                            <SelectItem value="kosovo">Kosovo</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  )}
                                  <TableCell className="max-w-xs truncate">
                                    {line.notes || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/project/purchase-orders/${line.purchaseOrderId}`)}
                                    >
                                      Se ordre
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <h3 className="text-lg font-medium mb-2">Ingen bestillinger endnu</h3>
                          <p className="text-muted-foreground mb-4">
                            Registrér den første bestilling for dette materiale
                          </p>
                          <Button onClick={openNewOrderDialog} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Registrér Bestilling
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dokumenter fra Standard Materiale
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const documents = getStandardMaterialDocuments();
                  return documents.length > 0 ? (
                    <div className="space-y-4">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.fileName}</p>
                              <p className="text-sm text-muted-foreground">{doc.documentType}</p>
                              {doc.notes && (
                                <p className="text-sm text-muted-foreground mt-1">{doc.notes}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">Read-only</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">Ingen dokumenter</h3>
                      <p className="text-muted-foreground">
                        Dette materiale har ingen dokumenter fra standard materialet
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Order Dialog */}
        <Dialog open={showNewOrderDialog} onOpenChange={setShowNewOrderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ny Bestilling</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="orderSupplier">Leverandør *</Label>
                <Select 
                  value={newOrder.supplierId} 
                  onValueChange={(value) => setNewOrder(prev => ({ ...prev, supplierId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg leverandør" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.status === 'Aktiv').map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="orderQuantity">Bestilt mængde *</Label>
                <div className="flex gap-2">
                  <Input
                    id="orderQuantity"
                    type="number"
                    value={newOrder.orderedQuantity || ''}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, orderedQuantity: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                  <div className="flex items-center px-3 border rounded-md bg-muted">
                    <span className="text-sm text-muted-foreground">{material.unit}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="expectedDelivery">Forventet levering</Label>
                <Input
                  id="expectedDelivery"
                  type="date"
                  value={newOrder.expectedDelivery}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="orderComment">Kommentar</Label>
                <Textarea
                  id="orderComment"
                  value={newOrder.comment}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Tilføj kommentar til bestillingen..."
                  rows={3}
                />
              </div>

              {material && !validateOrderCreation(material.id).canOrder && (
                <div className="space-y-2 border border-orange-200 bg-orange-50 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="approvalOverride"
                      checked={newOrder.approvalOverride}
                      onCheckedChange={(checked) => setNewOrder(prev => ({ ...prev, approvalOverride: checked as boolean }))}
                    />
                    <Label htmlFor="approvalOverride" className="text-sm text-orange-800">
                      Bestil alligevel — materialet er ikke fuldt godkendt endnu
                    </Label>
                  </div>
                  {newOrder.approvalOverride && (
                    <Textarea
                      value={newOrder.approvalOverrideReason}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, approvalOverrideReason: e.target.value }))}
                      placeholder="Begrundelse (påkrævet)..."
                      rows={2}
                    />
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddOrder} className="flex-1" disabled={submittingOrder}>
                  {submittingOrder ? 'Registrerer...' : 'Registrér Bestilling'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewOrderDialog(false);
                    resetNewOrderForm();
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

export default ProjectMaterialDetail;