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
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { ProjectProductTransportLine } from '@/types/products';

interface TransportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  editingLine?: ProjectProductTransportLine | null;
  onSuccess: () => void;
}

const TransportModal: React.FC<TransportModalProps> = ({
  open,
  onOpenChange,
  productId,
  editingLine,
  onSuccess,
}) => {
  const { addTransportLine, updateTransportLine } = useProjectProducts();

  const [formData, setFormData] = useState({
    title: 'Transport samlet produkt → DK',
    qty: 1,
    unit: 'shipment',
    unitCost: 0,
    note: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when editing
  useEffect(() => {
    if (editingLine && open) {
      setFormData({
        title: editingLine.title,
        qty: editingLine.qty,
        unit: editingLine.unit,
        unitCost: editingLine.unitCost,
        note: editingLine.note || '',
      });
    } else if (open && !editingLine) {
      // Reset for new entry
      setFormData({
        title: 'Transport samlet produkt → DK',
        qty: 1,
        unit: 'shipment',
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
    if (!validateForm()) return;

    try {
      const lineData = {
        projectProductId: productId,
        title: formData.title,
        qty: formData.qty,
        unit: formData.unit,
        unitCost: formData.unitCost,
        note: formData.note || undefined,
        sortOrder: 0,
      };

      if (editingLine) {
        await updateTransportLine(editingLine.id, lineData);
      } else {
        await addTransportLine(lineData);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving transport line:', error);
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
            {editingLine ? 'Rediger transport' : 'Tilføj transport'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={errors.title ? 'border-destructive' : ''}
              placeholder="Beskriv transporten..."
            />
            {errors.title && (
              <p className="text-sm text-destructive mt-1">{errors.title}</p>
            )}
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
              placeholder="Valgfrie noter om transporten..."
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
            {editingLine ? 'Gem ændringer' : 'Tilføj transport'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransportModal;