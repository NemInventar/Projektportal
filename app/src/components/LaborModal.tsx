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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { ProjectProductLaborLine, LABOR_TYPES } from '@/types/products';

interface LaborModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  editingLine?: ProjectProductLaborLine | null;
  onSuccess: () => void;
}

const LaborModal: React.FC<LaborModalProps> = ({
  open,
  onOpenChange,
  productId,
  editingLine,
  onSuccess,
}) => {
  const { addLaborLine, updateLaborLine } = useProjectProducts();

  const [formData, setFormData] = useState({
    laborType: 'production' as const,
    title: '',
    qty: 1,
    unit: 'timer',
    unitCost: 0,
    note: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when editing
  useEffect(() => {
    if (editingLine && open) {
      setFormData({
        laborType: editingLine.laborType,
        title: editingLine.title,
        qty: editingLine.qty,
        unit: editingLine.unit,
        unitCost: editingLine.unitCost,
        note: editingLine.note || '',
      });
    } else if (open && !editingLine) {
      // Reset for new entry
      setFormData({
        laborType: 'production',
        title: '',
        qty: 1,
        unit: 'timer',
        unitCost: 0,
        note: '',
      });
    }
  }, [editingLine, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Titel er påkrævet';
    }
    
    if (formData.qty <= 0) {
      newErrors.qty = 'Antal skal være større end 0';
    }

    if (formData.unitCost < 0) {
      newErrors.unitCost = 'Enhedspris skal være 0 eller større';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    alert('LaborModal: handleSubmit called!');
    console.log('LaborModal: handleSubmit called!');
    
    if (!validateForm()) {
      console.log('LaborModal: Validation failed');
      return;
    }

    console.log('LaborModal: Starting submit...');
    try {
      const lineData = {
        projectProductId: productId,
        laborType: formData.laborType,
        title: formData.title,
        qty: formData.qty,
        unit: formData.unit,
        unitCost: formData.unitCost,
        note: formData.note || undefined,
        sortOrder: 0,
      };

      console.log('LaborModal: Line data:', lineData);
      
      if (editingLine) {
        console.log('LaborModal: Updating line...');
        await updateLaborLine(editingLine.id, lineData);
      } else {
        console.log('LaborModal: Adding new line...');
        await addLaborLine(lineData);
      }

      console.log('LaborModal: Success!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('LaborModal: Error saving labor line:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const lineTotal = formData.qty * formData.unitCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingLine ? 'Rediger labor' : 'Tilføj labor'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="laborType">Type *</Label>
              <Select 
                value={formData.laborType} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, laborType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LABOR_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={errors.title ? 'border-destructive' : ''}
                placeholder="Beskriv arbejdet..."
              />
              {errors.title && (
                <p className="text-sm text-destructive mt-1">{errors.title}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label htmlFor="qty">Antal *</Label>
              <Input
                id="qty"
                type="number"
                step="0.01"
                min="0"
                value={formData.qty}
                onChange={(e) => setFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 0 }))}
                className={errors.qty ? 'border-destructive' : ''}
              />
              {errors.qty && (
                <p className="text-sm text-destructive mt-1">{errors.qty}</p>
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
              <Label htmlFor="unitCost">Enhedspris (DKK) *</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                min="0"
                value={formData.unitCost}
                onChange={(e) => setFormData(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
                className={errors.unitCost ? 'border-destructive' : ''}
              />
              {errors.unitCost && (
                <p className="text-sm text-destructive mt-1">{errors.unitCost}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="note">Noter</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Valgfrie noter..."
              rows={3}
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-primary/5 rounded-lg">
            <h4 className="font-medium mb-3">Forhåndsvisning</h4>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {formData.qty} {formData.unit} × {formatCurrency(formData.unitCost)}
              </div>
              <div className="text-lg font-bold">
                {formatCurrency(lineTotal)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSubmit}>
            {editingLine ? 'Gem ændringer' : 'Tilføj labor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LaborModal;