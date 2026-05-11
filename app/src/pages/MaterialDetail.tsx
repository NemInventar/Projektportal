import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useStandardMaterials, StandardMaterial, MaterialPrice, MaterialDocument } from '@/contexts/StandardMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Download, 
  Upload,
  Calendar,
  DollarSign,
  FileText,
  Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MaterialDetail = () => {
  try {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
  
  // Debug log
  console.log('MaterialDetail loaded with id:', id);
  
  const { 
    materials, 
    prices, 
    documents,
    addMaterial, 
    updateMaterial, 
    addPrice, 
    addDocument, 
    removeDocument,
    getMaterialDocuments 
  } = useStandardMaterials();
  const { suppliers } = useStandardSuppliers();

  const isNew = id === 'new';
  const material = isNew ? null : materials.find(m => m.id === id);
  const materialPrices = isNew ? [] : prices.filter(p => p.materialId === id);
  const materialDocuments = isNew ? [] : getMaterialDocuments(id || '');
  
  // Debug log after hooks
  console.log('Materials available:', materials.length);
  console.log('Material found:', material);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    unit: '',
    status: 'Aktiv' as const,
    primarySupplierId: '',
    supplierProductCode: '',
    supplierProductUrl: '',
    materialType: '',
    certifications: [] as string[],
  });

  const [newPrice, setNewPrice] = useState({
    supplierId: '',
    unitPrice: '',
    currency: 'DKK',
    validFrom: new Date().toISOString().split('T')[0],
  });

  const [newDocument, setNewDocument] = useState({
    fileName: '',
    documentType: 'Datablad' as const,
    notes: '',
    file: null as File | null,
  });

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    cvr: '',
    contactPerson: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Categories and units options - dynamic from existing materials plus common defaults
  const existingCategories = Array.from(new Set(materials.map(m => m.category).filter(Boolean)));
  const defaultCategories = [
    'Plademateriale',
    'Beslag & Skruer',
    'Overfladebehandling',
    'Lim & Klæber',
    'Tekstiler',
    'Isolering',
    'Andet'
  ];
  const categories = Array.from(new Set([...defaultCategories, ...existingCategories])).sort();

  const existingUnits = Array.from(new Set(materials.map(m => m.unit).filter(Boolean)));
  const defaultUnits = [
    'stk',
    'm',
    'm²',
    'm³',
    'kg',
    'liter',
    'pakke',
    'rulle'
  ];
  const units = Array.from(new Set([...defaultUnits, ...existingUnits])).sort();

  const materialTypes = [
    'Plade',
    'Beslag',
    'Overflade',
    'Tekstil',
    'Isolering',
    'Andet'
  ];

  const certificationOptions = [
    'FSC',
    'PEFC',
    'EPD',
    'Svanemærket',
    'EU Ecolabel',
    'GREENGUARD',
    'Cradle to Cradle'
  ];

  const documentTypes = [
    'Sikkerhedsdatablad',
    'Certifikat',
    'Datablad',
    'Andet'
  ] as const;

  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name,
        description: material.description || '',
        category: material.category,
        unit: material.unit,
        status: material.status,
        primarySupplierId: material.primarySupplierId || '',
        supplierProductCode: material.supplierProductCode || '',
        supplierProductUrl: material.supplierProductUrl || '',
        materialType: material.materialType || '',
        certifications: material.certifications,
      });
    }
  }, [material]);

  // If material not found and not creating new
  if (!isNew && !material) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Materiale ikke fundet</h2>
            <p className="text-muted-foreground mb-4">
              Det ønskede materiale kunne ikke findes
            </p>
            <Button onClick={() => navigate('/standard/materials')}>
              Tilbage til materialer
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Materialenavn er påkrævet';
    }
    if (!formData.category) {
      newErrors.category = 'Kategori er påkrævet';
    }
    if (!formData.unit) {
      newErrors.unit = 'Enhed er påkrævet';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (isNew) {
        await addMaterial(formData);
        toast({
          title: "Materiale oprettet",
          description: `${formData.name} er blevet oprettet som standard materiale`,
        });
      } else {
        await updateMaterial(id!, formData);
        toast({
          title: "Materiale opdateret",
          description: `${formData.name} er blevet opdateret`,
        });
      }
      
      navigate('/standard/materials');
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved gemning af materialet",
        variant: "destructive",
      });
      console.error('Error saving material:', error);
    }
  };

  const handleAddPrice = async () => {
    if (!newPrice.supplierId || !newPrice.unitPrice) {
      toast({
        title: "Fejl",
        description: "Leverandør og enhedspris er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      await addPrice({
        materialId: id!,
        supplierId: newPrice.supplierId,
        unitPrice: parseFloat(newPrice.unitPrice),
        currency: newPrice.currency,
        validFrom: new Date(newPrice.validFrom),
      });

      setNewPrice({
        supplierId: '',
        unitPrice: '',
        currency: 'DKK',
        validFrom: new Date().toISOString().split('T')[0],
      });

      toast({
        title: "Pris tilføjet",
        description: "Prisen er blevet tilføjet til materialet",
      });
    } catch (error) {
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved tilføjelse af prisen",
        variant: "destructive",
      });
      console.error('Error adding price:', error);
    }

    toast({
      title: "Pris tilføjet",
      description: "Ny pris er blevet tilføjet til materialet",
    });
  };

  const handleAddDocument = () => {
    if (!newDocument.fileName || !newDocument.file) {
      toast({
        title: "Fejl",
        description: "Filnavn og fil er påkrævet",
        variant: "destructive",
      });
      return;
    }

    // Simulate file upload - in real app, upload to server first
    const fileUrl = `/documents/${newDocument.file.name}`;
    
    addDocument({
      materialId: id!,
      fileName: newDocument.fileName,
      fileUrl: fileUrl,
      documentType: newDocument.documentType,
      notes: newDocument.notes,
    });

    setNewDocument({
      fileName: '',
      documentType: 'Datablad',
      notes: '',
      file: null,
    });
    
    setShowUploadForm(false);

    toast({
      title: "Dokument tilføjet",
      description: "Nyt dokument er blevet uploadet til materialet",
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewDocument(prev => ({
        ...prev,
        file: file,
        fileName: prev.fileName || file.name,
      }));
    }
  };

  const handleCertificationToggle = (certification: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(certification)
        ? prev.certifications.filter(c => c !== certification)
        : [...prev.certifications, certification]
    }));
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Fejl",
        description: "Kategorinavn er påkrævet",
        variant: "destructive",
      });
      return;
    }

    // Add to form data and close dialog
    setFormData(prev => ({ ...prev, category: newCategoryName.trim() }));
    setNewCategoryName('');
    setShowNewCategoryDialog(false);
    
    toast({
      title: "Kategori oprettet",
      description: `Kategorien "${newCategoryName.trim()}" er blevet tilføjet`,
    });
  };

  const handleCreateSupplier = () => {
    if (!newSupplierData.name.trim()) {
      toast({
        title: "Fejl",
        description: "Leverandørnavn er påkrævet",
        variant: "destructive",
      });
      return;
    }

    // In a real app, this would call addSupplier from StandardSuppliersContext
    // For now, we'll simulate it by creating a temporary supplier
    const tempSupplierId = `temp_${Date.now()}`;
    
    // Add to form data and close dialog
    setFormData(prev => ({ ...prev, primarySupplierId: tempSupplierId }));
    
    // Reset form
    setNewSupplierData({
      name: '',
      cvr: '',
      contactPerson: '',
      email: '',
      phone: '',
    });
    setShowNewSupplierDialog(false);
    
    toast({
      title: "Leverandør oprettet",
      description: `Leverandøren "${newSupplierData.name.trim()}" er blevet tilføjet`,
    });
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/standard/materials')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage til materialer
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isNew ? 'Nyt Standard Materiale' : `Rediger: ${material?.name}`}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isNew ? 'Opret et nyt standard materiale' : 'Rediger materiale detaljer og priser'}
              </p>
            </div>
          </div>
          
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            {isNew ? 'Opret Materiale' : 'Gem Ændringer'}
          </Button>
        </div>

        <Tabs defaultValue="stamdata" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stamdata" className="gap-2">
              <Tag className="h-4 w-4" />
              Stamdata
            </TabsTrigger>
            <TabsTrigger value="priser" disabled={isNew} className="gap-2">
              <DollarSign className="h-4 w-4" />
              Priser
            </TabsTrigger>
            <TabsTrigger value="transport" disabled={isNew} className="gap-2">
              <Calendar className="h-4 w-4" />
              Transport
            </TabsTrigger>
            <TabsTrigger value="dokumenter" disabled={isNew} className="gap-2">
              <FileText className="h-4 w-4" />
              Dokumenter
            </TabsTrigger>
            <TabsTrigger value="metadata" className="gap-2">
              <Tag className="h-4 w-4" />
              Metadata
            </TabsTrigger>
          </TabsList>

          {/* Stamdata Tab */}
          <TabsContent value="stamdata">
            <Card>
              <CardHeader>
                <CardTitle>Grundlæggende oplysninger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Materialenavn *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Indtast materialenavn"
                        className={errors.name ? 'border-destructive' : ''}
                      />
                      {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <Label htmlFor="category">Kategori *</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(value) => {
                          if (value === 'create_new') {
                            setShowNewCategoryDialog(true);
                          } else {
                            setFormData(prev => ({ ...prev, category: value }));
                          }
                        }}
                      >
                        <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Vælg kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                          <SelectItem value="create_new" className="text-primary font-medium">
                            + Opret ny kategori
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.category && <p className="text-sm text-destructive mt-1">{errors.category}</p>}
                    </div>

                    <div>
                      <Label htmlFor="unit">Enhed *</Label>
                      <Select 
                        value={formData.unit} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                      >
                        <SelectTrigger className={errors.unit ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Vælg enhed" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map(unit => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.unit && <p className="text-sm text-destructive mt-1">{errors.unit}</p>}
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(value: 'Aktiv' | 'Arkiveret') => setFormData(prev => ({ ...prev, status: value }))}
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
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description">Beskrivelse</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Detaljeret beskrivelse af materialet..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Leverandørinfo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primarySupplier">Primær leverandør</Label>
                      <Select 
                        value={formData.primarySupplierId || "none"} 
                        onValueChange={(value) => {
                          if (value === 'create_new') {
                            setShowNewSupplierDialog(true);
                          } else {
                            setFormData(prev => ({ ...prev, primarySupplierId: value === "none" ? "" : value }));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vælg leverandør" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ingen leverandør</SelectItem>
                          {suppliers.filter(s => s.status === 'Aktiv').map(supplier => (
                            <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                          ))}
                          <SelectItem value="create_new" className="text-primary font-medium">
                            + Opret ny leverandør
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="supplierProductCode">Leverandørens varenr.</Label>
                      <Input
                        id="supplierProductCode"
                        value={formData.supplierProductCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierProductCode: e.target.value }))}
                        placeholder="Ekstern produktkode"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="supplierProductUrl">Link til leverandørens produkt</Label>
                      <Input
                        id="supplierProductUrl"
                        type="url"
                        value={formData.supplierProductUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierProductUrl: e.target.value }))}
                        placeholder="https://leverandør.dk/produkt"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Priser Tab */}
          <TabsContent value="priser">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Tilføj ny pris
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <Label>Leverandør</Label>
                      <Select 
                        value={newPrice.supplierId} 
                        onValueChange={(value) => setNewPrice(prev => ({ ...prev, supplierId: value }))}
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
                      <Label>Enhedspris</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPrice.unitPrice}
                        onChange={(e) => setNewPrice(prev => ({ ...prev, unitPrice: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Label>Valuta</Label>
                      <Select 
                        value={newPrice.currency} 
                        onValueChange={(value) => setNewPrice(prev => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DKK">DKK</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Gyldig fra</Label>
                      <Input
                        type="date"
                        value={newPrice.validFrom}
                        onChange={(e) => setNewPrice(prev => ({ ...prev, validFrom: e.target.value }))}
                      />
                    </div>

                    <Button onClick={handleAddPrice} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Tilføj
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Prishistorik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {materialPrices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Leverandør</TableHead>
                          <TableHead>Enhedspris</TableHead>
                          <TableHead>Valuta</TableHead>
                          <TableHead>Gyldig fra</TableHead>
                          <TableHead>Oprettet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialPrices
                          .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())
                          .map((price) => (
                          <TableRow key={price.id}>
                            <TableCell>{getSupplierName(price.supplierId)}</TableCell>
                            <TableCell className="font-medium">
                              {price.unitPrice.toFixed(2)}
                            </TableCell>
                            <TableCell>{price.currency}</TableCell>
                            <TableCell>{price.validFrom.toLocaleDateString('da-DK')}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {price.createdAt.toLocaleDateString('da-DK')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Ingen priser registreret endnu</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Dokumenter Tab */}
          <TabsContent value="dokumenter">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Dokumenter
                  </CardTitle>
                  {!isNew && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => setShowUploadForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Upload dokument
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload Form */}
                {showUploadForm && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Upload nyt dokument</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="documentFile">Vælg fil</Label>
                          <Input
                            id="documentFile"
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="documentType">Dokumenttype</Label>
                          <Select 
                            value={newDocument.documentType} 
                            onValueChange={(value: typeof newDocument.documentType) => 
                              setNewDocument(prev => ({ ...prev, documentType: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {documentTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="documentFileName">Filnavn</Label>
                          <Input
                            id="documentFileName"
                            value={newDocument.fileName}
                            onChange={(e) => setNewDocument(prev => ({ ...prev, fileName: e.target.value }))}
                            placeholder="Indtast filnavn"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="documentNotes">Noter (valgfri)</Label>
                          <Input
                            id="documentNotes"
                            value={newDocument.notes}
                            onChange={(e) => setNewDocument(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Interne noter om dokumentet"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleAddDocument} className="gap-2">
                          <Upload className="h-4 w-4" />
                          Upload dokument
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowUploadForm(false)}
                        >
                          Annuller
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {materialDocuments.length > 0 ? (
                  <div className="space-y-4">
                    {materialDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{doc.fileName}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{doc.documentType}</Badge>
                                <span>•</span>
                                <span>{doc.uploadedAt.toLocaleDateString('da-DK')}</span>
                              </div>
                              {doc.notes && (
                                <p className="text-sm text-muted-foreground mt-1">{doc.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Ingen dokumenter uploadet endnu</p>
                    <Button 
                      variant="outline" 
                      className="mt-4 gap-2"
                      onClick={() => setShowUploadForm(true)}
                    >
                      <Upload className="h-4 w-4" />
                      Upload dokument
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata">
            <Card>
              <CardHeader>
                <CardTitle>Metadata og certificeringer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="materialType">Materialetype</Label>
                  <Select 
                    value={formData.materialType || "none"} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, materialType: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg materialetype" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen type</SelectItem>
                      {materialTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Certificeringer</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {certificationOptions.map(certification => (
                      <div key={certification} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={certification}
                          checked={formData.certifications.includes(certification)}
                          onChange={() => handleCertificationToggle(certification)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={certification} className="text-sm font-normal">
                          {certification}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.certifications.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.certifications.map(cert => (
                        <Badge key={cert} variant="secondary">{cert}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Category Dialog */}
        <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret Ny Kategori</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newCategoryName">Kategorinavn</Label>
                <Input
                  id="newCategoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Indtast kategorinavn"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateCategory();
                    }
                  }}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateCategory} className="flex-1">
                  Opret Kategori
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowNewCategoryDialog(false);
                    setNewCategoryName('');
                  }}
                >
                  Annuller
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Supplier Dialog */}
        <Dialog open={showNewSupplierDialog} onOpenChange={setShowNewSupplierDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Opret Ny Leverandør</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newSupplierName">Leverandørnavn *</Label>
                  <Input
                    id="newSupplierName"
                    value={newSupplierData.name}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Indtast leverandørnavn"
                  />
                </div>
                
                <div>
                  <Label htmlFor="newSupplierCvr">CVR</Label>
                  <Input
                    id="newSupplierCvr"
                    value={newSupplierData.cvr}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, cvr: e.target.value }))}
                    placeholder="12345678"
                  />
                </div>
                
                <div>
                  <Label htmlFor="newSupplierContact">Kontaktperson</Label>
                  <Input
                    id="newSupplierContact"
                    value={newSupplierData.contactPerson}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    placeholder="Navn på kontaktperson"
                  />
                </div>
                
                <div>
                  <Label htmlFor="newSupplierEmail">Email</Label>
                  <Input
                    id="newSupplierEmail"
                    type="email"
                    value={newSupplierData.email}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@leverandør.dk"
                  />
                </div>
                
                <div>
                  <Label htmlFor="newSupplierPhone">Telefon</Label>
                  <Input
                    id="newSupplierPhone"
                    value={newSupplierData.phone}
                    onChange={(e) => setNewSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+45 12 34 56 78"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateSupplier} className="flex-1">
                  Opret Leverandør
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowNewSupplierDialog(false);
                    setNewSupplierData({
                      name: '',
                      cvr: '',
                      contactPerson: '',
                      email: '',
                      phone: '',
                    });
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
  } catch (error) {
    console.error('Error in MaterialDetail:', error);
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Der opstod en fejl</h2>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Ukendt fejl'}
            </p>
            <Button onClick={() => navigate('/standard/materials')}>
              Tilbage til materialer
            </Button>
          </div>
        </div>
      </Layout>
    );
  }
};

export default MaterialDetail;