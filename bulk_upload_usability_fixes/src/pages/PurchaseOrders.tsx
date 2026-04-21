import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Search, 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Calendar,
  DollarSign,
  Eye,
  Plus
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { usePurchaseOrders } from '@/contexts/PurchaseOrdersContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

const PurchaseOrders = () => {
  const { activeProject } = useProject();
  const { 
    purchaseOrders, 
    purchaseOrderLines,
  } = usePurchaseOrders();
  const { suppliers } = useStandardSuppliers();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter purchase orders for active project
  const currentProjectPOs = purchaseOrders.filter(po => po.projectId === activeProject?.id);

  // Get unique suppliers from current project POs
  const projectSuppliers = Array.from(new Set(currentProjectPOs.map(po => po.supplierId)));

  const filteredPOs = currentProjectPOs.filter(po => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    const supplierName = supplier?.name || 'Ukendt leverandør';
    
    const matchesSearch = po.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSupplier = supplierFilter === 'all' || po.supplierId === supplierFilter;
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;

    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
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

  const getPOLines = (poId: string) => {
    return purchaseOrderLines.filter(line => line.purchaseOrderId === poId);
  };

  const getPOTotal = (poId: string) => {
    const lines = getPOLines(poId);
    return lines.reduce((total, line) => {
      return total + (line.orderedQty * (line.unitPrice || 0));
    }, 0);
  };

  const getNextDelivery = (poId: string) => {
    const lines = getPOLines(poId);
    const upcomingDeliveries = lines
      .filter(line => line.expectedDeliveryDate && line.status === 'ordered')
      .map(line => line.expectedDeliveryDate!)
      .sort((a, b) => a.getTime() - b.getTime());
    
    return upcomingDeliveries.length > 0 ? upcomingDeliveries[0] : null;
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

  const handleViewPO = (poId: string) => {
    navigate(`/project/purchase-orders/${poId}`);
  };

  const handleCreatePO = () => {
    // Placeholder for V1 - redirect to BOM where POs are created
    navigate('/project/bom');
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Intet projekt valgt</h2>
            <p className="text-muted-foreground">Vælg et projekt for at se indkøbsordrer</p>
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
            <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
            <p className="text-muted-foreground mt-1">
              Indkøbsordrer for {activeProject.name}
            </p>
          </div>
          
          <Button className="gap-2" onClick={handleCreatePO}>
            <Plus className="h-4 w-4" />
            Opret Ny Ordre
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtre og søgning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Søg PO ID eller leverandør..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle statusser" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statusser</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sendt</SelectItem>
                  <SelectItem value="confirmed">Bekræftet</SelectItem>
                  <SelectItem value="delivered">Leveret</SelectItem>
                  <SelectItem value="cancelled">Annulleret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Indkøbsordrer ({filteredPOs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPOs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Nr.</TableHead>
                      <TableHead>Leverandør</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Antal linjer</TableHead>
                      <TableHead>Totalværdi</TableHead>
                      <TableHead>Næste levering</TableHead>
                      <TableHead>Oprettet</TableHead>
                      <TableHead>Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOs.map((po) => {
                      const lines = getPOLines(po.id);
                      const total = getPOTotal(po.id);
                      const nextDelivery = getNextDelivery(po.id);
                      
                      return (
                        <TableRow 
                          key={po.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewPO(po.id)}
                        >
                          <TableCell className="font-medium">
                            {po.id.split('_')[1] || po.id.substring(0, 8)}
                          </TableCell>
                          <TableCell>{getSupplierName(po.supplierId)}</TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{lines.length}</span>
                              {lines.some(line => line.approvalOverride) && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Override
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell>
                            {nextDelivery ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {formatDate(nextDelivery)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(po.createdAt)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewPO(po.id)}
                              className="gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              Se detaljer
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Ingen indkøbsordrer fundet</h3>
                <p className="text-muted-foreground mb-4">
                  {currentProjectPOs.length === 0 
                    ? "Dette projekt har ingen indkøbsordrer endnu"
                    : "Ingen ordrer matcher de valgte filtre"
                  }
                </p>
                {currentProjectPOs.length === 0 && (
                  <Button onClick={handleCreatePO} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Opret første ordre
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {currentProjectPOs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total ordrer</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {currentProjectPOs.length}
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
                  {formatCurrency(currentProjectPOs.reduce((total, po) => total + getPOTotal(po.id), 0))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Aktive ordrer</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {currentProjectPOs.filter(po => ['sent', 'confirmed'].includes(po.status)).length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Med override</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {currentProjectPOs.filter(po => 
                    getPOLines(po.id).some(line => line.approvalOverride)
                  ).length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PurchaseOrders;