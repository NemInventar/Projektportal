import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { useStandardMaterials } from '@/contexts/StandardMaterialsContext';
import { useStandardSuppliers } from '@/contexts/StandardSuppliersContext';
import { useProjectMaterials, ProjectMaterial } from '@/contexts/ProjectMaterialsContext';
import { useToast } from '@/hooks/use-toast';
import { Search, PackagePlus } from 'lucide-react';

interface PromoteToCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectMaterial: ProjectMaterial;
  onSuccess?: () => void;
}

// Løfter et ad-hoc project_materials-materiale (uden standard_material_id) ind i
// standardkataloget — enten ved at koble det til et allerede-eksisterende
// standardmateriale, eller ved at oprette et nyt ud fra det ad-hoc materiales data.
const PromoteToCatalogDialog: React.FC<PromoteToCatalogDialogProps> = ({
  open,
  onOpenChange,
  projectMaterial,
  onSuccess,
}) => {
  const { materials: standardMaterials, addMaterial } = useStandardMaterials();
  const { suppliers } = useStandardSuppliers();
  const { updateProjectMaterial } = useProjectMaterials();
  const { toast } = useToast();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStandardMaterialId, setSelectedStandardMaterialId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    name: '',
    category: '',
    unit: '',
    primarySupplierId: '',
  });

  useEffect(() => {
    if (open) {
      setMode('existing');
      setSearchTerm(projectMaterial.name);
      setSelectedStandardMaterialId('');
      setNewForm({
        name: projectMaterial.name,
        category: projectMaterial.category,
        unit: projectMaterial.unit,
        primarySupplierId: projectMaterial.supplierId || '',
      });
    }
  }, [open, projectMaterial]);

  const filteredStandardMaterials = standardMaterials.filter(m => {
    if (m.status === 'Arkiveret') return false;
    const term = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.category.toLowerCase().includes(term)
    );
  });

  const handleLinkExisting = async () => {
    if (!selectedStandardMaterialId) {
      toast({ title: 'Vælg et materiale', description: 'Vælg et standardmateriale at koble til', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateProjectMaterial(projectMaterial.id, { standardMaterialId: selectedStandardMaterialId });
      const linked = standardMaterials.find(m => m.id === selectedStandardMaterialId);
      toast({ title: 'Koblet til katalog', description: `${projectMaterial.name} er nu koblet til "${linked?.name}"` });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Fejl', description: error?.message || 'Kunne ikke koble materialet', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newForm.name.trim() || !newForm.category.trim() || !newForm.unit.trim()) {
      toast({ title: 'Fejl', description: 'Navn, kategori og enhed er påkrævet', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const created = await addMaterial({
        name: newForm.name,
        category: newForm.category,
        unit: newForm.unit,
        status: 'Aktiv',
        primarySupplierId: newForm.primarySupplierId || undefined,
        supplierProductCode: projectMaterial.supplierProductCode,
        supplierProductUrl: projectMaterial.supplierProductUrl,
        certifications: [],
      });
      await updateProjectMaterial(projectMaterial.id, { standardMaterialId: created.id });
      toast({ title: 'Standardmateriale oprettet', description: `"${created.name}" er oprettet i kataloget og koblet til ${projectMaterial.name}` });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Fejl', description: error?.message || 'Kunne ikke oprette standardmaterialet', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Promote to catalog entry
          </DialogTitle>
          <DialogDescription>
            "{projectMaterial.name}" er lige nu et ad-hoc materiale uden kobling til standardkataloget.
            Kobl det til et eksisterende standardmateriale, eller opret det som et nyt.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="existing">Kobl til eksisterende</TabsTrigger>
            <TabsTrigger value="new">Opret nyt standardmateriale</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg i standardkataloget..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="border rounded-lg max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Materiale</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Enhed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStandardMaterials.map((m) => (
                    <TableRow
                      key={m.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedStandardMaterialId === m.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                      onClick={() => setSelectedStandardMaterialId(m.id)}
                    >
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell><Badge variant="outline">{m.category}</Badge></TableCell>
                      <TableCell>{m.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredStandardMaterials.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Ingen match i kataloget — brug "Opret nyt standardmateriale" i stedet
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
              <Button onClick={handleLinkExisting} disabled={saving || !selectedStandardMaterialId}>
                Kobl til valgt materiale
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div>
              <Label>Navn *</Label>
              <Input value={newForm.name} onChange={(e) => setNewForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategori *</Label>
                <Input value={newForm.category} onChange={(e) => setNewForm(prev => ({ ...prev, category: e.target.value }))} />
              </div>
              <div>
                <Label>Enhed *</Label>
                <Input value={newForm.unit} onChange={(e) => setNewForm(prev => ({ ...prev, unit: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Primær leverandør</Label>
              <Select
                value={newForm.primarySupplierId || 'none'}
                onValueChange={(v) => setNewForm(prev => ({ ...prev, primarySupplierId: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
              <Button onClick={handleCreateNew} disabled={saving}>
                Opret og kobl
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PromoteToCatalogDialog;
