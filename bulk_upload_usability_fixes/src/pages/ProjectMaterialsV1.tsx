import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Plus, 
  Download, 
  Search, 
  Filter,
  Edit,
  FileText,
  Calendar,
  Trash2,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useStandardMaterials } from '@/contexts/StandardMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';

interface ProjectMaterial {
  id: string;
  projectId: string;
  standardMaterialId?: string;
  name: string;
  category: string;
  unit: string;
  description?: string;
  notes?: string;
  isGeneric: boolean;
  supplierId?: string;
  supplierProductCode?: string;
  supplierProductUrl?: string;
  unitPrice?: number;
  currency: string;
  priceStatus: 'estimated' | 'confirmed';
  priceNote?: string;
  leadTimeDays?: number;
  transportEstimatedCost?: number;
  transportCurrency: string;
  transportNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectMaterialsV1: React.FC = () => {
  const { activeProject } = useProject();
  const { materials: standardMaterials } = useStandardMaterials();
  const { suppliers } = useStandardSuppliers();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [genericFilter, setGenericFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [priceStatusFilter, setPriceStatusFilter] = useState<string>('all');
  const [missingPriceFilter, setMissingPriceFilter] = useState(false);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ProjectMaterial | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Import modal state
  const [importSearchTerm, setImportSearchTerm] = useState('');
  const [importCategoryFilter, setImportCategoryFilter] = useState<string>('all');
  const [selectedStandardMaterial, setSelectedStandardMaterial] = useState<string>('');
  const [materialPrices, setMaterialPrices] = useState<Record<string, {price: number, currency: string, date: string}>>({});
  
  // Bulk upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<{
    valid: any[];
    errors: { row: number; message: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    description: '',
    notes: '',
    isGeneric: false,
    supplierId: '',
    supplierProductCode: '',
    supplierProductUrl: '',
    unitPrice: '',
    currency: 'DKK',
    priceStatus: 'estimated' as const,
    priceNote: '',
    leadTimeDays: '',
    transportEstimatedCost: '',
    transportCurrency: 'DKK',
    transportNote: ''
  });

  // Load materials
  useEffect(() => {
    if (activeProject) {
      loadMaterials();
    }
  }, [activeProject]);

  // Fetch latest prices when import dialog opens
  useEffect(() => {
    if (showImportModal && standardMaterials.length > 0) {
      const fetchPrices = async () => {
        const prices: Record<string, {price: number, currency: string, date: string}> = {};
        
        for (const material of standardMaterials) {
          try {
            const { data: priceData } = await supabase
              .from('standard_material_price_snapshots_2026_01_19_15_00')
              .select('*')
              .eq('material_id', material.id)
              .order('price_date', { ascending: false })
              .limit(1)
              .single();
            
            if (priceData) {
              prices[material.id] = {
                price: parseFloat(priceData.price),
                currency: priceData.currency,
                date: priceData.price_date
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
  }, [showImportModal, standardMaterials]);

  const loadMaterials = async () => {
    if (!activeProject) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .select('*')
        .eq('project_id', activeProject.id)
        .order('name');

      if (!error && data) {
        const formatted = data.map(m => ({
          id: m.id,
          projectId: m.project_id,
          standardMaterialId: m.standard_material_id,
          name: m.name,
          category: m.category,
          unit: m.unit,
          description: m.description,
          notes: m.notes,
          isGeneric: m.is_generic || false,
          supplierId: m.supplier_id,
          supplierProductCode: m.supplier_product_code,
          supplierProductUrl: m.supplier_product_url,
          unitPrice: m.unit_price ? parseFloat(m.unit_price) : undefined,
          currency: m.currency,
          priceStatus: m.price_status,
          priceNote: m.price_note,
          leadTimeDays: m.lead_time_days,
          transportEstimatedCost: m.transport_estimated_cost ? parseFloat(m.transport_estimated_cost) : undefined,
          transportCurrency: m.transport_currency || 'DKK',
          transportNote: m.transport_note,
          createdAt: new Date(m.created_at),
          updatedAt: new Date(m.updated_at)
        }));
        setMaterials(formatted);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const categories = Array.from(new Set(materials.map(m => m.category).filter(cat => cat && cat.trim() !== '')));
  const materialSuppliers = Array.from(new Set(materials.map(m => m.supplierId).filter(Boolean)));
  
  // Common units
  const commonUnits = ['stk', 'm', 'm²', 'm³', 'kg', 'g', 'l', 'ml', 'pak', 'sæt', 'løbende meter', 'timer'];
  const units = Array.from(new Set([...commonUnits, ...materials.map(m => m.unit).filter(unit => unit && unit.trim() !== '')]));

  // Filter materials
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.supplierProductCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
    const matchesGeneric = genericFilter === 'all' || 
                          (genericFilter === 'yes' && material.isGeneric) ||
                          (genericFilter === 'no' && !material.isGeneric);
    const matchesSupplier = supplierFilter === 'all' || material.supplierId === supplierFilter;
    const matchesPriceStatus = priceStatusFilter === 'all' || material.priceStatus === priceStatusFilter;
    const matchesMissingPrice = !missingPriceFilter || material.unitPrice === undefined;

    return matchesSearch && matchesCategory && matchesGeneric && matchesSupplier && matchesPriceStatus && matchesMissingPrice;
  });

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Ukendt leverandør';
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unit: '',
      description: '',
      notes: '',
      isGeneric: false,
      supplierId: '',
      supplierProductCode: '',
      supplierProductUrl: '',
      unitPrice: '',
      currency: 'DKK',
      priceStatus: 'estimated',
      priceNote: '',
      leadTimeDays: '',
      transportEstimatedCost: '',
      transportCurrency: 'DKK',
      transportNote: ''
    });
  };

  const handleCreate = () => {
    resetForm();
    setEditingMaterial(null);
    setShowCreateModal(true);
  };

  const handleEdit = (material: ProjectMaterial) => {
    setFormData({
      name: material.name,
      category: material.category,
      unit: material.unit,
      description: material.description || '',
      notes: material.notes || '',
      isGeneric: material.isGeneric,
      supplierId: material.supplierId || '',
      supplierProductCode: material.supplierProductCode || '',
      supplierProductUrl: material.supplierProductUrl || '',
      unitPrice: material.unitPrice?.toString() || '',
      currency: material.currency,
      priceStatus: material.priceStatus,
      priceNote: material.priceNote || '',
      leadTimeDays: material.leadTimeDays?.toString() || '',
      transportEstimatedCost: material.transportEstimatedCost?.toString() || '',
      transportCurrency: material.transportCurrency,
      transportNote: material.transportNote || ''
    });
    setEditingMaterial(material);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!activeProject || !formData.name || !formData.category || !formData.unit) {
      toast({
        title: "Fejl",
        description: "Navn, kategori og enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      const materialData = {
        project_id: activeProject.id,
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        description: formData.description || null,
        notes: formData.notes || null,
        is_generic: formData.isGeneric,
        supplier_id: formData.supplierId || null,
        supplier_product_code: formData.supplierProductCode || null,
        supplier_product_url: formData.supplierProductUrl || null,
        unit_price: formData.unitPrice ? parseFloat(formData.unitPrice) : null,
        currency: formData.currency,
        price_status: formData.priceStatus,
        price_note: formData.priceNote || null,
        lead_time_days: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : null,
        transport_estimated_cost: formData.transportEstimatedCost ? parseFloat(formData.transportEstimatedCost) : null,
        transport_currency: formData.transportCurrency,
        transport_note: formData.transportNote || null
      };

      if (editingMaterial) {
        // Update existing
        const { error } = await supabase
          .from('project_materials_2026_01_15_06_45')
          .update(materialData)
          .eq('id', editingMaterial.id);

        if (error) throw error;

        toast({
          title: "Materiale opdateret",
          description: "Ændringerne er blevet gemt",
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('project_materials_2026_01_15_06_45')
          .insert(materialData);

        if (error) throw error;

        toast({
          title: "Materiale oprettet",
          description: "Det nye materiale er blevet tilføjet",
        });
      }

      setShowCreateModal(false);
      loadMaterials();
    } catch (error) {
      console.error('Error saving material:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved gemning",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!editingMaterial || !activeProject) return;

    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!editingMaterial || !activeProject) return;
    
    setShowDeleteConfirm(false);

    try {
      // First delete related purchase order lines
      const { error: poLinesError } = await supabase
        .from('purchase_order_lines_2026_01_15_06_45')
        .delete()
        .eq('project_material_id', editingMaterial.id);

      if (poLinesError) {
        console.error('Error deleting purchase order lines:', poLinesError);
        // Don't throw - continue with deletion
      }
      
      // Then delete related approvals
      const { error: approvalsError } = await supabase
        .from('project_material_approvals_2026_01_15_06_45')
        .delete()
        .eq('project_material_id', editingMaterial.id);

      if (approvalsError) {
        console.error('Error deleting approvals:', approvalsError);
        // Don't throw - continue with deletion
      }

      // Finally delete the material
      const { error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .delete()
        .eq('id', editingMaterial.id);

      if (error) {
        // Check if it's a foreign key constraint error
        if (error.code === '23503' && error.details?.includes('purchase_order_lines')) {
          throw new Error('Dette materiale kan ikke slettes da det allerede er bestilt i en indkøbsordre. Slet først indkøbsordren eller fjern materialet fra ordren.');
        }
        throw error;
      }

      toast({
        title: "Materiale slettet",
        description: `${editingMaterial.name} er blevet slettet`,
      });

      setShowCreateModal(false);
      setEditingMaterial(null);
      loadMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved sletning",
        variant: "destructive",
      });
    }
  };

  const handleImportFromStandard = async () => {
    if (!selectedStandardMaterial || !activeProject) {
      toast({
        title: "Fejl",
        description: "Vælg et materiale at importere",
        variant: "destructive",
      });
      return;
    }

    try {
      const standardMaterial = standardMaterials.find(m => m.id === selectedStandardMaterial);
      if (!standardMaterial) return;

      // Get the latest price from Supabase
      let latestPrice = null;
      try {
        const { data: priceData } = await supabase
          .from('standard_material_price_snapshots_2026_01_19_15_00')
          .select('*')
          .eq('material_id', selectedStandardMaterial)
          .order('price_date', { ascending: false })
          .limit(1)
          .single();
        
        if (priceData) {
          latestPrice = {
            price: parseFloat(priceData.price),
            currency: priceData.currency,
            date: priceData.price_date
          };
        }
      } catch (error) {
        console.log('No price found for material:', selectedStandardMaterial);
      }

      const materialData = {
        project_id: activeProject.id,
        standard_material_id: selectedStandardMaterial,
        name: standardMaterial.name,
        category: standardMaterial.category,
        unit: standardMaterial.unit,
        description: standardMaterial.description || null,
        notes: null,
        is_generic: false, // User can change this in edit
        supplier_id: standardMaterial.primarySupplierId || null,
        supplier_product_code: standardMaterial.supplierProductCode || null,
        supplier_product_url: standardMaterial.supplierProductUrl || null,
        unit_price: latestPrice?.price || null,
        currency: latestPrice?.currency || 'DKK',
        price_status: latestPrice ? 'confirmed' : 'estimated',
        price_note: latestPrice ? `Importeret fra standard materiale (${new Date(latestPrice.date).toLocaleDateString('da-DK')})` : null,
        lead_time_days: null
      };

      const { error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .insert(materialData);

      if (error) throw error;

      toast({
        title: "Materiale importeret",
        description: `${standardMaterial.name} er blevet tilføjet til projektet`,
      });

      setShowImportModal(false);
      setSelectedStandardMaterial('');
      setImportSearchTerm('');
      setImportCategoryFilter('all');
      loadMaterials();
    } catch (error) {
      console.error('Error importing material:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved import af materialet",
        variant: "destructive",
      });
    }
  };

  // Bulk upload: Handle file selection and parsing
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file format
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Ugyldigt filformat",
        description: "Kun .csv filer er understøttet",
        variant: "destructive",
      });
      // Reset file input
      event.target.value = '';
      return;
    }

    setUploadedFile(file);

    // Parse CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('Parsed CSV:', results.data);
        setParsedRows(results.data);
        
        // Validate rows
        const validation = validateRows(results.data);
        setValidationResults(validation);
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        toast({
          title: "Fejl",
          description: "Kunne ikke parse CSV filen",
          variant: "destructive",
        });
      }
    });
  };

  // Validate parsed rows
  const validateRows = (rows: any[]) => {
    const valid: any[] = [];
    const errors: { row: number; message: string }[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because of header and 0-index
      const rowErrors: string[] = [];

      // Trim all string values
      const trimmedRow = Object.keys(row).reduce((acc, key) => {
        acc[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
        return acc;
      }, {} as any);

      // Check required fields
      if (!trimmedRow.navn || trimmedRow.navn === '') {
        rowErrors.push('Mangler navn');
      }
      if (!trimmedRow.kategori || trimmedRow.kategori === '') {
        rowErrors.push('Mangler kategori');
      }
      if (!trimmedRow.enhed || trimmedRow.enhed === '') {
        rowErrors.push('Mangler enhed');
      }

      // Validate numeric fields if present
      if (trimmedRow.enhedspris && trimmedRow.enhedspris !== '') {
        const price = parseFloat(trimmedRow.enhedspris);
        if (isNaN(price)) {
          rowErrors.push('Enhedspris skal være et tal');
        }
      }

      if (trimmedRow.leveringstid_dage && trimmedRow.leveringstid_dage !== '') {
        const leadTime = parseInt(trimmedRow.leveringstid_dage);
        if (isNaN(leadTime)) {
          rowErrors.push('Leveringstid skal være et heltal');
        }
      }

      if (trimmedRow.transport_pris && trimmedRow.transport_pris !== '') {
        const transportPrice = parseFloat(trimmedRow.transport_pris);
        if (isNaN(transportPrice)) {
          rowErrors.push('Transport pris skal være et tal');
        }
      }

      // Add to results
      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          message: rowErrors.join(', ')
        });
      } else {
        valid.push(trimmedRow);
      }
    });

    return { valid, errors };
  };

  // Reset bulk upload state
  const resetBulkUpload = () => {
    setUploadedFile(null);
    setParsedRows([]);
    setValidationResults(null);
  };

  // Download CSV template
  const downloadCSVTemplate = () => {
    // Define CSV headers
    const headers = [
      'navn',
      'kategori',
      'enhed',
      'beskrivelse',
      'noter',
      'generisk',
      'enhedspris',
      'valuta',
      'prisstatus',
      'prisnoter',
      'leveringstid_dage',
      'transport_pris',
      'transport_valuta',
      'transport_noter'
    ];

    // Example row
    const exampleRow = [
      '19 mm spånplade',
      'Plademateriale',
      'm²',
      'Melamin belagt',
      '',
      'Nej',
      '70',
      'DKK',
      'estimated',
      '',
      '14',
      '0',
      'DKK',
      ''
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      exampleRow.join(',')
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'materialer_skabelon.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Skabelon downloadet",
      description: "CSV skabelonen er klar til brug",
    });
  };

  // Import valid rows to database
  const handleBulkImport = async () => {
    if (!activeProject || !validationResults || validationResults.valid.length === 0) {
      return;
    }

    try {
      setImporting(true);

      // Map CSV rows to database format
      const materialsToInsert = validationResults.valid.map(row => {
        // Parse is_generic
        const generiskValue = row.generisk?.toLowerCase();
        const isGeneric = generiskValue === 'ja' || generiskValue === 'yes' || generiskValue === 'true' || generiskValue === '1';

        // Parse numeric fields
        const unitPrice = row.enhedspris && row.enhedspris !== '' ? parseFloat(row.enhedspris) : null;
        const leadTimeDays = row.leveringstid_dage && row.leveringstid_dage !== '' ? parseInt(row.leveringstid_dage) : null;
        const transportCost = row.transport_pris && row.transport_pris !== '' ? parseFloat(row.transport_pris) : null;

        // Parse price_status
        const priceStatusValue = row.prisstatus?.toLowerCase();
        const priceStatus = (priceStatusValue === 'confirmed' || priceStatusValue === 'bekræftet') ? 'confirmed' : 'estimated';

        return {
          project_id: activeProject.id,
          name: row.navn,
          category: row.kategori,
          unit: row.enhed,
          description: row.beskrivelse || null,
          notes: row.noter || null,
          is_generic: isGeneric,
          unit_price: unitPrice,
          currency: row.valuta || 'DKK',
          price_status: priceStatus,
          price_note: row.prisnoter || null,
          lead_time_days: leadTimeDays,
          transport_estimated_cost: transportCost,
          transport_currency: row.transport_valuta || 'DKK',
          transport_note: row.transport_noter || null
        };
      });

      console.log('Inserting materials:', materialsToInsert);

      // Insert to database
      const { data, error } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .insert(materialsToInsert)
        .select();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      console.log('Insert success:', data);

      // Success!
      toast({
        title: "Import fuldført",
        description: `${materialsToInsert.length} materialer importeret`,
      });

      // Close modal and reset
      setShowBulkUploadModal(false);
      resetBulkUpload();

      // Reload materials list
      await loadMaterials();
    } catch (error) {
      console.error('Bulk import error:', error);
      toast({
        title: "Fejl ved import",
        description: "Der opstod en fejl ved import af materialer",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Filter standard materials for import
  const filteredStandardMaterials = standardMaterials.filter(material => {
    const searchTerm = importSearchTerm.toLowerCase();
    const matchesName = material.name.toLowerCase().includes(searchTerm);
    const matchesDescription = material.description?.toLowerCase().includes(searchTerm) || false;
    const supplierName = getSupplierName(material.primarySupplierId)?.toLowerCase() || '';
    const matchesSupplier = supplierName.includes(searchTerm);
    const matchesSearch = matchesName || matchesDescription || matchesSupplier;
    const matchesCategory = importCategoryFilter === 'all' || material.category === importCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const standardCategories = Array.from(new Set(standardMaterials.map(m => m.category).filter(cat => cat && cat.trim() !== '')));

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Vælg et projekt</h2>
            <p className="text-muted-foreground">Du skal vælge et projekt for at se materialer.</p>
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
            <h1 className="text-3xl font-bold">Materialer</h1>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/project/materials-legacy')} variant="outline">
              Materialer (LEGACY)
            </Button>
          </div>
        </div>

        {/* Topbar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Actions */}
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Opret materiale
              </Button>
              <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Importér fra standard
              </Button>
              <Button onClick={() => setShowBulkUploadModal(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>

              {/* Filters */}
              <div className="flex gap-2 items-center flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg navn, varenr..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle kategorier</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={genericFilter} onValueChange={setGenericFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Generisk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="yes">Ja</SelectItem>
                    <SelectItem value="no">Nej</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Leverandør" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle leverandører</SelectItem>
                    {materialSuppliers.filter(id => id && id.trim() !== '').map(supplierId => (
                      <SelectItem key={supplierId} value={supplierId}>
                        {getSupplierName(supplierId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priceStatusFilter} onValueChange={setPriceStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Prisstatus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="estimated">Estimeret</SelectItem>
                    <SelectItem value="confirmed">Bekræftet</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="missing-price"
                    checked={missingPriceFilter}
                    onCheckedChange={setMissingPriceFilter}
                  />
                  <Label htmlFor="missing-price" className="text-sm">Mangler pris</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">Indlæser materialer...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Enhed</TableHead>
                    <TableHead>Generisk</TableHead>
                    <TableHead>Leverandør</TableHead>
                    <TableHead>Enhedspris</TableHead>
                    <TableHead>Prisstatus</TableHead>
                    <TableHead>Lead time</TableHead>
                    <TableHead>Noter</TableHead>
                    <TableHead>Sidst opdateret</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((material) => (
                    <TableRow 
                      key={material.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(material)}
                    >
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>{material.category}</TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>
                        <Badge variant={material.isGeneric ? "default" : "secondary"}>
                          {material.isGeneric ? "Ja" : "Nej"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getSupplierName(material.supplierId)}</TableCell>
                      <TableCell>
                        {material.unitPrice ? (
                          `${material.unitPrice.toLocaleString('da-DK')} ${material.currency}`
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={material.priceStatus === 'confirmed' ? "default" : "outline"}>
                          {material.priceStatus === 'confirmed' ? 'Bekræftet' : 'Estimeret'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.leadTimeDays ? `${material.leadTimeDays} dage` : '-'}
                      </TableCell>
                      <TableCell>
                        {material.notes ? (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {material.updatedAt.toLocaleDateString('da-DK')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {!loading && filteredMaterials.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Ingen materialer fundet med de valgte filtre.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            setEditingMaterial(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMaterial ? 'Redigér materiale' : 'Opret nyt materiale'}
              </DialogTitle>
              <DialogDescription>
                {editingMaterial ? 'Redigér materialets oplysninger nedenfor.' : 'Udfyld oplysningerne for det nye materiale.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Stamdata */}
              <div className="space-y-4">
                <h3 className="font-semibold">Stamdata</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Navn *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Materialenavn"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Kategori *</Label>
                    <Select 
                      value={categories.includes(formData.category) ? formData.category : "custom"} 
                      onValueChange={(value) => {
                        if (value === "custom") {
                          // Don't change the category value, just show the input
                          return;
                        }
                        setFormData(prev => ({ ...prev, category: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                        <SelectItem value="custom">Skriv ny kategori...</SelectItem>
                      </SelectContent>
                    </Select>
                    {(!categories.includes(formData.category) || formData.category === '') && (
                      <Input
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        placeholder="Skriv ny kategori..."
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="unit">Enhed *</Label>
                    <Select 
                      value={formData.unit} 
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, unit: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg enhed" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="isGeneric"
                      checked={formData.isGeneric}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isGeneric: !!checked }))}
                    />
                    <Label htmlFor="isGeneric">Generisk materiale</Label>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Beskrivelse</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Beskrivelse af materialet"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Interne noter</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Interne noter"
                  />
                </div>
              </div>

              {/* Leverandør & pris */}
              <div className="space-y-4">
                <h3 className="font-semibold">Leverandør & pris</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplier">Leverandør</Label>
                    <Select value={formData.supplierId || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg leverandør" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ingen leverandør</SelectItem>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="supplierProductCode">Leverandør varenr.</Label>
                    <Input
                      id="supplierProductCode"
                      value={formData.supplierProductCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplierProductCode: e.target.value }))}
                      placeholder="Varenummer"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="supplierProductUrl">Leverandør link</Label>
                    <Input
                      id="supplierProductUrl"
                      value={formData.supplierProductUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplierProductUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="unitPrice">Enhedspris</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      step="0.01"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Valuta</Label>
                    <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
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
                    <Label htmlFor="priceStatus">Prisstatus</Label>
                    <Select value={formData.priceStatus} onValueChange={(value: 'estimated' | 'confirmed') => setFormData(prev => ({ ...prev, priceStatus: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="estimated">Estimeret</SelectItem>
                        <SelectItem value="confirmed">Bekræftet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="leadTimeDays">Lead time (dage)</Label>
                    <Input
                      id="leadTimeDays"
                      type="number"
                      value={formData.leadTimeDays}
                      onChange={(e) => setFormData(prev => ({ ...prev, leadTimeDays: e.target.value }))}
                      placeholder="Antal dage"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="priceNote">Price note</Label>
                    <Textarea
                      id="priceNote"
                      value={formData.priceNote}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceNote: e.target.value }))}
                      placeholder="Noter om prisen"
                    />
                  </div>
                </div>
              </div>

              {/* Transport (estimat) */}
              <div className="space-y-4">
                <h3 className="font-semibold">Transport (estimat)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="transportEstimatedCost">Estimeret transportomkostning</Label>
                    <Input
                      id="transportEstimatedCost"
                      type="number"
                      step="0.01"
                      value={formData.transportEstimatedCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, transportEstimatedCost: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="transportCurrency">Transport valuta</Label>
                    <Select value={formData.transportCurrency} onValueChange={(value) => setFormData(prev => ({ ...prev, transportCurrency: value }))}>
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
                  <div className="col-span-2">
                    <Label htmlFor="transportNote">Transport noter</Label>
                    <Textarea
                      id="transportNote"
                      value={formData.transportNote}
                      onChange={(e) => setFormData(prev => ({ ...prev, transportNote: e.target.value }))}
                      placeholder="Noter om transport (fx til Kosovo, fragil, special håndtering, etc.)"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {editingMaterial && (
                  <Button 
                    onClick={handleDelete} 
                    variant="destructive"
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Slet
                  </Button>
                )}
                <div className="flex-1" />
                <Button onClick={() => setShowCreateModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleSave}>
                  Gem
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Modal */}
        <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Importér fra Standard Materialer</DialogTitle>
              <DialogDescription>
                Vælg et materiale fra standard materialerne nedenfor for at importere det til projektet.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Search and filters */}
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg materialer, beskrivelse eller leverandør..."
                    value={importSearchTerm}
                    onChange={(e) => setImportSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={importCategoryFilter} onValueChange={setImportCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle kategorier</SelectItem>
                    {standardCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Materials table */}
              <div className="max-h-96 overflow-y-auto border rounded-lg">
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
                    {filteredStandardMaterials.map((material) => (
                      <TableRow 
                        key={material.id}
                        className={selectedStandardMaterial === material.id ? "bg-muted" : ""}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="selectedMaterial"
                            checked={selectedStandardMaterial === material.id}
                            onChange={() => setSelectedStandardMaterial(material.id)}
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

              {filteredStandardMaterials.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen materialer fundet med de valgte filtre.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleImportFromStandard} 
                  className="flex-1"
                  disabled={!selectedStandardMaterial}
                >
                  Importér Valgte Materiale
                </Button>
                <Button 
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedStandardMaterial('');
                    setImportSearchTerm('');
                    setImportCategoryFilter('all');
                  }} 
                  variant="outline"
                >
                  Annullér
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bekræft sletning</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Er du sikker på at du vil slette "{editingMaterial?.name}"?</p>
              <p className="text-sm text-muted-foreground mt-2">
                Denne handling kan ikke fortrydes.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Annullér
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
              >
                Slet
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Upload Dialog */}
        <Dialog open={showBulkUploadModal} onOpenChange={(open) => {
          setShowBulkUploadModal(open);
          if (!open) resetBulkUpload();
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk Upload materialer</DialogTitle>
              <DialogDescription>
                Upload flere materialer på én gang fra en CSV fil
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              {/* Download Template */}
              <div className="space-y-2">
                <Label>1. Download skabelon</Label>
                <Button 
                  onClick={downloadCSVTemplate}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV-skabelon
                </Button>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>2. Vælg CSV fil</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
              </div>

              {/* File Info and Validation Results */}
              {uploadedFile && (
                <div className="space-y-4">
                  {/* File name */}
                  <div className="text-sm">
                    <span className="font-medium">Fil:</span> {uploadedFile.name}
                  </div>

                  {/* Parsed rows count */}
                  {parsedRows.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Antal rækker parsed:</span> {parsedRows.length}
                    </div>
                  )}

                  {/* Validation Summary */}
                  {validationResults && (
                    <div className="space-y-3">
                      <div className="font-medium text-sm mb-2">Validering:</div>
                      <div className="grid grid-cols-2 gap-4">
                        <Card className={validationResults.valid.length > 0 ? "border-green-200" : ""}>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold text-green-600">
                              {validationResults.valid.length}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Gyldige rækker
                            </div>
                            {validationResults.valid.length > 0 && (
                              <div className="text-xs text-green-600 mt-1">
                                Klar til import
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        <Card className={validationResults.errors.length > 0 ? "border-red-200" : ""}>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold text-red-600">
                              {validationResults.errors.length}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Fejl
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Error List */}
                      {validationResults.errors.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-medium text-sm">Fejl:</div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {validationResults.errors.map((error, idx) => (
                              <div key={idx} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                <span className="font-medium">Række {error.row}:</span> {error.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* No file selected */}
              {!uploadedFile && (
                <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/20">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium mb-2">
                    Vælg en CSV fil for at komme i gang
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Kun .csv filer er understøttet
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowBulkUploadModal(false);
                  resetBulkUpload();
                }}
                disabled={importing}
              >
                Annullér
              </Button>
              <Button 
                onClick={handleBulkImport}
                disabled={!validationResults || validationResults.valid.length === 0 || importing}
                title={!validationResults || validationResults.valid.length === 0 ? 'Upload en fil med gyldige rækker først' : ''}
              >
                {importing ? 'Importerer...' : `Importér (${validationResults?.valid.length || 0})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectMaterialsV1;