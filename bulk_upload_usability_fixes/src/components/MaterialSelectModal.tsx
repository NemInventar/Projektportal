import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { useTransport } from '@/contexts/TransportContext';
import { ProjectMaterial } from '@/types/projectMaterials';
import { ProjectProductMaterialLine, WASTE_PRESETS } from '@/types/products';
import { Search, Calculator } from 'lucide-react';

interface MaterialSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  editingLine?: ProjectProductMaterialLine | null;
  onSuccess: () => void;
}

const MaterialSelectModal: React.FC<MaterialSelectModalProps> = ({
  open,
  onOpenChange,
  productId,
  editingLine,
  onSuccess,
}) => {
  const { projectMaterials } = useProjectMaterials();
  const { addMaterialLine, updateMaterialLine } = useProjectProducts();
  const { getProjectMaterialTransports } = useTransport();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);
  
  const [formData, setFormData] = useState({
    lineTitle: '',
    lineDescription: '',
    calcEnabled: false,
    calcLengthM: 0,
    calcWidthM: 0,
    calcCount: 1,
    baseQty: 0,
    wastePct: 0,
    unitCostOverride: null as number | null,
    note: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [useOverridePrice, setUseOverridePrice] = useState(false);

  // Get unique categories
  const categories = Array.from(new Set(projectMaterials.map(m => m.category))).filter(Boolean);
  
  // Debug logging
  console.log('MaterialSelectModal: projectMaterials count:', projectMaterials.length);
  console.log('MaterialSelectModal: projectMaterials:', projectMaterials.map(m => ({ id: m.id, name: m.name, category: m.category })));
  console.log('MaterialSelectModal: categories:', categories);

  // Filter materials
  const filteredMaterials = projectMaterials.filter(material => {
    const searchLower = searchTerm.toLowerCase();
    const matchesName = material.name.toLowerCase().includes(searchLower);
    const matchesCategory = material.category.toLowerCase().includes(searchLower);
    const matchesSupplier = (material.supplierName || '').toLowerCase().includes(searchLower);
    const matchesSearch = matchesName || matchesCategory || matchesSupplier;
    const matchesCategoryFilter = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategoryFilter;
  });

  // Calculate derived values
  const calculatedBaseQty = formData.calcEnabled 
    ? formData.calcLengthM * formData.calcWidthM * formData.calcCount 
    : formData.baseQty;
  
  const finalQty = calculatedBaseQty * (1 + formData.wastePct / 100);
  
  const materialCost = selectedMaterial 
    ? finalQty * (formData.unitCostOverride ?? selectedMaterial.unitPrice)
    : 0;

  const transportPerUnit = selectedMaterial 
    ? getProjectMaterialTransports(selectedMaterial.id)
        .filter(t => t.expectedCostModel === 'per_unit')
        .reduce((sum, t) => sum + t.expectedUnitCost, 0)
    : 0;
  
  const transportCost = finalQty * transportPerUnit;
  const lineTotal = materialCost + transportCost;

  // Initialize form data when editing
  useEffect(() => {
    if (editingLine && open) {
      const material = projectMaterials.find(m => m.id === editingLine.projectMaterialId);
      if (material) {
        setSelectedMaterial(material);
        setFormData({
          lineTitle: editingLine.lineTitle,
          lineDescription: editingLine.lineDescription || '',
          calcEnabled: editingLine.calcEnabled,
          calcLengthM: editingLine.calcLengthM || 0,
          calcWidthM: editingLine.calcWidthM || 0,
          calcCount: editingLine.calcCount || 1,
          baseQty: editingLine.baseQty,
          wastePct: editingLine.wastePct,
          unitCostOverride: editingLine.unitCostOverride || null,
          note: editingLine.note || '',
        });
        setUseOverridePrice(!!editingLine.unitCostOverride);
      }
    } else if (open && !editingLine) {
      // Reset for new entry
      setSelectedMaterial(null);
      setFormData({
        lineTitle: '',
        lineDescription: '',
        calcEnabled: false,
        calcLengthM: 0,
        calcWidthM: 0,
        calcCount: 1,
        baseQty: 0,
        wastePct: 0,
        unitCostOverride: null,
        note: '',
      });
      setUseOverridePrice(false);
      setSearchTerm('');
      setSelectedCategory('all');
    }
  }, [editingLine, open, projectMaterials]);

  // Update line title when material is selected
  useEffect(() => {
    if (selectedMaterial && !editingLine) {
      setFormData(prev => ({
        ...prev,
        lineTitle: selectedMaterial.name,
      }));
    }
  }, [selectedMaterial, editingLine]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    console.log('MaterialSelectModal: Validating form...');
    console.log('MaterialSelectModal: selectedMaterial:', !!selectedMaterial);
    console.log('MaterialSelectModal: lineTitle:', formData.lineTitle);
    
    if (!selectedMaterial) {
      newErrors.material = 'Vælg et materiale';
    }
    
    if (!formData.lineTitle.trim()) {
      newErrors.lineTitle = 'Produktdel titel er påkrævet';
    }
    
    if (formData.calcEnabled) {
      if (formData.calcLengthM <= 0) {
        newErrors.calcLengthM = 'Længde skal være større end 0';
      }
      if (formData.calcWidthM <= 0) {
        newErrors.calcWidthM = 'Bredde skal være større end 0';
      }
      if (formData.calcCount <= 0) {
        newErrors.calcCount = 'Antal skal være større end 0';
      }
    } else {
      if (formData.baseQty <= 0) {
        newErrors.baseQty = 'Basismængde skal være større end 0';
      }
    }

    if (useOverridePrice && (formData.unitCostOverride === null || formData.unitCostOverride < 0)) {
      newErrors.unitCostOverride = 'Enhedspris skal være 0 eller større';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('MaterialSelectModal: Form validation result:', isValid);
    console.log('MaterialSelectModal: Validation errors:', newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    console.log('MaterialSelectModal: handleSubmit called!');
    
    if (!validateForm() || !selectedMaterial) {
      console.log('MaterialSelectModal: Validation failed or no material selected');
      return;
    }

    console.log('MaterialSelectModal: Starting submit...');
    console.log('MaterialSelectModal: Selected material:', selectedMaterial);
    console.log('MaterialSelectModal: Form validation passed:', validateForm());
    try {
      const lineData = {
        projectProductId: productId,
        projectMaterialId: selectedMaterial.id,
        lineTitle: formData.lineTitle,
        lineDescription: formData.lineDescription || undefined,
        calcEnabled: formData.calcEnabled,
        calcLengthM: formData.calcEnabled ? formData.calcLengthM : undefined,
        calcWidthM: formData.calcEnabled ? formData.calcWidthM : undefined,
        calcCount: formData.calcEnabled ? formData.calcCount : undefined,
        baseQty: calculatedBaseQty,
        wastePct: formData.wastePct,
        qty: finalQty,
        unit: selectedMaterial.unit,
        unitCostOverride: useOverridePrice ? formData.unitCostOverride : undefined,
        note: formData.note || undefined,
        sortOrder: 0,
      };

      if (editingLine) {
        console.log('MaterialSelectModal: Updating line...');
        await updateMaterialLine(editingLine.id, lineData);
        console.log('MaterialSelectModal: Update completed');
      } else {
        console.log('MaterialSelectModal: Adding new line...');
        await addMaterialLine(lineData);
        console.log('MaterialSelectModal: Add completed');
      }

      console.log('MaterialSelectModal: About to call onSuccess');
      onSuccess();
      console.log('MaterialSelectModal: About to close modal');
      onOpenChange(false);
      console.log('MaterialSelectModal: Success - modal should be closed');
    } catch (error) {
      console.error('MaterialSelectModal: Error saving material line:', error);
      alert('Fejl ved gemning: ' + (error?.message || error));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingLine ? 'Rediger materiale' : 'Tilføj materiale til produkt'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Material Selection */}
          {!editingLine && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Søg materiale</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Søg på materiale, kategori eller leverandør..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="w-48">
                  <Label>Kategori</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle kategorier</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {errors.material && (
                <p className="text-sm text-destructive">{errors.material}</p>
              )}

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Materiale</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Enhed</TableHead>
                      <TableHead>Pris</TableHead>
                      <TableHead>Leverandør</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => (
                      <TableRow
                        key={material.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          selectedMaterial?.id === material.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                        }`}
                        onClick={() => setSelectedMaterial(material)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{material.name}</div>
                            {material.description && (
                              <div className="text-sm text-muted-foreground">{material.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{material.category}</Badge>
                        </TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>{formatCurrency(material.unitPrice)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {material.supplierName || 'Ukendt'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {projectMaterials.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>Ingen materialer tilgængelige</p>
                    <p className="text-sm mt-2">Gå til Projekt Materialer for at tilføje materialer først</p>
                  </div>
                ) : filteredMaterials.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>Ingen materialer matcher dine filtre</p>
                    <p className="text-sm mt-2">Prøv at ændre søgekriterier eller kategori</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Selected Material Info */}
          {selectedMaterial && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Valgt materiale:</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">{selectedMaterial.name}</span>
                  <div className="text-muted-foreground">{selectedMaterial.category}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Enhed:</span> {selectedMaterial.unit}
                </div>
                <div>
                  <span className="text-muted-foreground">Pris:</span> {formatCurrency(selectedMaterial.unitPrice)}
                </div>
                <div>
                  <span className="text-muted-foreground">Leverandør:</span> {selectedMaterial.supplierName || 'Ukendt'}
                </div>
              </div>
            </div>
          )}

          {/* Product Part Details */}
          {selectedMaterial && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="lineTitle">Produktdel titel *</Label>
                <Input
                  id="lineTitle"
                  value={formData.lineTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, lineTitle: e.target.value }))}
                  className={errors.lineTitle ? 'border-destructive' : ''}
                />
                {errors.lineTitle && (
                  <p className="text-sm text-destructive mt-1">{errors.lineTitle}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="lineDescription">Beskrivelse</Label>
                <Input
                  id="lineDescription"
                  value={formData.lineDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, lineDescription: e.target.value }))}
                  placeholder="Valgfri beskrivelse..."
                />
              </div>
            </div>
          )}

          {/* Calculation */}
          {selectedMaterial && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="calcEnabled"
                  checked={formData.calcEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, calcEnabled: !!checked }))}
                />
                <Label htmlFor="calcEnabled" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Brug beregner (L × B × antal)
                </Label>
              </div>

              {formData.calcEnabled ? (
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="calcLengthM">Længde (m) *</Label>
                    <Input
                      id="calcLengthM"
                      type="number"
                      step="0.001"
                      min="0"
                      value={formData.calcLengthM}
                      onChange={(e) => setFormData(prev => ({ ...prev, calcLengthM: parseFloat(e.target.value) || 0 }))}
                      className={errors.calcLengthM ? 'border-destructive' : ''}
                    />
                    {errors.calcLengthM && (
                      <p className="text-sm text-destructive mt-1">{errors.calcLengthM}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="calcWidthM">Bredde (m) *</Label>
                    <Input
                      id="calcWidthM"
                      type="number"
                      step="0.001"
                      min="0"
                      value={formData.calcWidthM}
                      onChange={(e) => setFormData(prev => ({ ...prev, calcWidthM: parseFloat(e.target.value) || 0 }))}
                      className={errors.calcWidthM ? 'border-destructive' : ''}
                    />
                    {errors.calcWidthM && (
                      <p className="text-sm text-destructive mt-1">{errors.calcWidthM}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="calcCount">Antal *</Label>
                    <Input
                      id="calcCount"
                      type="number"
                      min="1"
                      value={formData.calcCount}
                      onChange={(e) => setFormData(prev => ({ ...prev, calcCount: parseInt(e.target.value) || 1 }))}
                      className={errors.calcCount ? 'border-destructive' : ''}
                    />
                    {errors.calcCount && (
                      <p className="text-sm text-destructive mt-1">{errors.calcCount}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label>Beregnet mængde</Label>
                    <div className="p-2 bg-muted rounded text-sm">
                      {calculatedBaseQty.toFixed(3)} {selectedMaterial.unit}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-48">
                  <Label htmlFor="baseQty">Basismængde *</Label>
                  <Input
                    id="baseQty"
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.baseQty}
                    onChange={(e) => setFormData(prev => ({ ...prev, baseQty: parseFloat(e.target.value) || 0 }))}
                    className={errors.baseQty ? 'border-destructive' : ''}
                  />
                  {errors.baseQty && (
                    <p className="text-sm text-destructive mt-1">{errors.baseQty}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Waste */}
          {selectedMaterial && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="wastePct">Spild (%)</Label>
                  <Input
                    id="wastePct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.wastePct}
                    onChange={(e) => setFormData(prev => ({ ...prev, wastePct: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                
                <div>
                  <Label>Hurtigvalg spild</Label>
                  <div className="flex gap-2">
                    {WASTE_PRESETS.map(preset => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, wastePct: preset }))}
                        className={formData.wastePct === preset ? 'bg-primary text-primary-foreground' : ''}
                      >
                        {preset}%
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-muted/50 rounded">
                <div className="text-sm">
                  <span className="font-medium">Final mængde (inkl. spild): </span>
                  {finalQty.toFixed(3)} {selectedMaterial.unit}
                </div>
              </div>
            </div>
          )}

          {/* Price Override */}
          {selectedMaterial && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useOverridePrice"
                  checked={useOverridePrice}
                  onCheckedChange={(checked) => {
                    setUseOverridePrice(!!checked);
                    if (!checked) {
                      setFormData(prev => ({ ...prev, unitCostOverride: null }));
                    }
                  }}
                />
                <Label htmlFor="useOverridePrice">Override pris</Label>
              </div>

              {useOverridePrice && (
                <div className="w-48">
                  <Label htmlFor="unitCostOverride">Enhedspris (DKK)</Label>
                  <Input
                    id="unitCostOverride"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitCostOverride || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitCostOverride: parseFloat(e.target.value) || null }))}
                    className={errors.unitCostOverride ? 'border-destructive' : ''}
                  />
                  {errors.unitCostOverride && (
                    <p className="text-sm text-destructive mt-1">{errors.unitCostOverride}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Note */}
          {selectedMaterial && (
            <div>
              <Label htmlFor="note">Noter</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Valgfrie noter..."
                rows={2}
              />
            </div>
          )}

          {/* Preview */}
          {selectedMaterial && (
            <div className="p-4 bg-primary/5 rounded-lg">
              <h4 className="font-medium mb-3">Forhåndsvisning</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Materialekost:</span>
                    <span className="font-medium">{formatCurrency(materialCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transport pr. enhed:</span>
                    <span>{formatCurrency(transportPerUnit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transport total:</span>
                    <span>{formatCurrency(transportCost)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-background rounded border-l-4 border-l-primary">
                  <span className="font-medium">Linjetotal:</span>
                  <span className="text-lg font-bold">{formatCurrency(lineTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={projectMaterials.length === 0 || !selectedMaterial}
            title={`Materials: ${projectMaterials.length}, Selected: ${!!selectedMaterial}`}
          >
            {editingLine ? 'Gem ændringer' : 'Tilføj materiale'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialSelectModal;