import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { useStandardMaterials, StandardMaterial } from '@/contexts/StandardMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
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
  DialogTitle 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Archive, Package, TrendingUp, Layers, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const StandardMaterials = () => {
  const { 
    materials, 
    loading,
    addMaterial,
    addPrice,
    getLatestPrice
  } = useStandardMaterials();
  const { suppliers } = useStandardSuppliers();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('Aktiv');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState('');

  // Debug logging
  console.log('StandardMaterials: materials count:', materials.length);
  console.log('StandardMaterials: loading:', loading);
  console.log('StandardMaterials: materials:', materials);

  // Get unique categories and units for filters
  const categories = Array.from(new Set(materials.map(m => m.category).filter(Boolean)));
  const units = Array.from(new Set(materials.map(m => m.unit).filter(Boolean)));

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.supplierProductCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
    const matchesUnit = unitFilter === 'all' || material.unit === unitFilter;
    const matchesSupplier = supplierFilter === 'all' || material.primarySupplierId === supplierFilter;
    const matchesStatus = statusFilter === 'all' || material.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesUnit && matchesSupplier && matchesStatus;
  });

  const handleCreateMaterial = () => {
    console.log('Navigating to new material');
    navigate('/standard/materials/new');
  };

  const handleEditMaterial = (material: StandardMaterial) => {
    console.log('Navigating to material:', material.id);
    navigate(`/standard/materials/${material.id}`);
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
  };

  const getStatusColor = (status: StandardMaterial['status']) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800 border-green-200';
      case 'Arkiveret': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatPrice = (materialId: string) => {
    const latestPrice = getLatestPrice(materialId);
    if (!latestPrice) return '-';
    return `${latestPrice.unitPrice.toFixed(2)} ${latestPrice.currency}`;
  };

  const handleImportMaterials = async () => {
    if (!importData.trim()) {
      toast({
        title: "Fejl",
        description: "Indtast data for at importere materialer",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse CSV-like data (tab or comma separated)
      const lines = importData.trim().split('\n');
      let imported = 0;
      
      for (const [index, line] of lines.entries()) {
        if (line.trim()) {
          // Split by tab or comma
          const parts = line.split(/\t|,/).map(p => p.trim());
          
          if (parts.length >= 3) {
            const [name, category, unit, description, supplierName, unitPrice, ...rest] = parts;
            
            if (name && category && unit) {
              // Generate automatic internal product code
              const internalCode = `MAT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
              
              // Find supplier by name
              let primarySupplierId = '';
              if (supplierName) {
                const supplier = suppliers.find(s => 
                  s.name.toLowerCase().includes(supplierName.toLowerCase()) ||
                  supplierName.toLowerCase().includes(s.name.toLowerCase())
                );
                primarySupplierId = supplier?.id || '';
              }
              
              // Create material with unique ID for price linking
              const materialId = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              
              try {
                await addMaterial({
                  name: name,
                  category: category,
                  unit: unit,
                  description: description || '',
                  status: 'Aktiv',
                  primarySupplierId: primarySupplierId,
                  supplierProductCode: internalCode,
                  supplierProductUrl: '',
                  materialType: '',
                  certifications: [],
                });
                console.log('Successfully added material:', name);
              } catch (error) {
                console.error('Error adding material:', name, error);
                throw error;
              }
              
              // Add price if provided
              if (unitPrice && !isNaN(parseFloat(unitPrice)) && primarySupplierId) {
                setTimeout(() => {
                  addPrice({
                    materialId: materialId,
                    supplierId: primarySupplierId,
                    unitPrice: parseFloat(unitPrice),
                    currency: 'DKK',
                    validFrom: new Date(),
                  });
                }, 100); // Small delay to ensure material is created first
              }
              
              imported++;
            }
          }
        }
      }
      
      setImportData('');
      setShowImportDialog(false);
      
      toast({
        title: "Import fuldført",
        description: `${imported} materialer blev importeret succesfuldt`,
      });
    } catch (error) {
      toast({
        title: "Import fejl",
        description: "Der opstod en fejl under import af materialer",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Indlæser materialer...</p>
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
            <h1 className="text-3xl font-bold text-foreground">Standard Materialer</h1>
            <p className="text-muted-foreground mt-1">
              Administrer standard materialer som masterdata til projekter og produkter
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="h-4 w-4" />
              Import Materialer
            </Button>
            <Button 
              className="gap-2" 
              onClick={() => {
                console.log('Creating new material - navigating to /standard/materials/new');
                navigate('/standard/materials/new');
              }}
            >
              <Plus className="h-4 w-4" />
              Nyt Materiale
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive Materialer</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {materials.filter(m => m.status === 'Aktiv').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kategorier</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Med Priser</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {materials.filter(m => getLatestPrice(m.id)).length}
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
                {materials.filter(m => m.status === 'Arkiveret').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg i materialer (navn, varenr., beskrivelse)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kategorier</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Enhed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle enheder</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Leverandør" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle leverandører</SelectItem>
                  {suppliers.filter(s => s.status === 'Aktiv').map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
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

        {/* Materials Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Materialenavn</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Enhed</TableHead>
                  <TableHead>Primær leverandør</TableHead>
                  <TableHead>Seneste enhedspris</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => (
                  <TableRow 
                    key={material.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEditMaterial(material)}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <p>{material.name}</p>
                        {material.supplierProductCode && (
                          <p className="text-xs text-muted-foreground">
                            Varenr: {material.supplierProductCode}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{material.category}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>{getSupplierName(material.primarySupplierId)}</TableCell>
                    <TableCell>{formatPrice(material.id)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(material.status)}>
                        {material.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditMaterial(material);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredMaterials.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm || categoryFilter !== 'all' || unitFilter !== 'all' || supplierFilter !== 'all' || statusFilter !== 'Aktiv'
                    ? 'Ingen materialer matcher dine filtre' 
                    : 'Ingen standard materialer endnu'
                  }
                </p>
                {!searchTerm && categoryFilter === 'all' && unitFilter === 'all' && supplierFilter === 'all' && statusFilter === 'Aktiv' && (
                  <Button 
                    className="mt-4 gap-2"
                    onClick={handleCreateMaterial}
                  >
                    <Plus className="h-4 w-4" />
                    Opret Dit Første Materiale
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Materialer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="importData">Materiale Data</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Indsæt data i format: Navn, Kategori, Enhed, Beskrivelse, Leverandør, Enhedspris (en linje per materiale)
                </p>
                <Textarea
                  id="importData"
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Krydsfiner Birk 18mm, Plademateriale, m², Højkvalitets krydsfiner, Bygma, 285.50&#10;Skruer 4x50mm rustfri, Beslag & Skruer, stk, Rustfri stålskruer, XL-BYG, 0.85&#10;Lak Transparent Mat, Overfladebehandling, liter, Vandbaseret lak, Stark, 125.00"
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Format eksempel:</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Navn:</strong> Krydsfiner Birk 18mm (påkrævet)</p>
                  <p><strong>Kategori:</strong> Plademateriale (påkrævet)</p>
                  <p><strong>Enhed:</strong> m² (påkrævet)</p>
                  <p><strong>Beskrivelse:</strong> Højkvalitets krydsfiner (valgfri)</p>
                  <p><strong>Leverandør:</strong> Bygma (valgfri - matcher eksisterende leverandører)</p>
                  <p><strong>Enhedspris:</strong> 285.50 (valgfri - i DKK)</p>
                  <p className="mt-2 text-xs"><strong>Noter:</strong></p>
                  <p className="text-xs">• Internt varenummer genereres automatisk (MAT-xxxxx)</p>
                  <p className="text-xs">• Nye kategorier og enheder tilføjes automatisk til systemet</p>
                  <p className="text-xs">• Leverandører matches på navn (skal eksistere i Standard Leverandører)</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleImportMaterials} className="flex-1">
                  Import Materialer
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportData('');
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

export default StandardMaterials;