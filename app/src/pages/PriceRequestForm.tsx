import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  ArrowLeft,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';

interface PriceRequestFormData {
  title: string;
  description: string;
  project_material_id: string;
  qty: number | '';
  unit: string;
  first_delivery_date: string;
  last_delivery_date: string;
  deadline: string;
  payment_terms: string;
  budget_hint: number | '';
  status: 'open' | 'closed' | 'awarded' | 'cancelled';
}

const PriceRequestForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const { projectMaterials: materials = [] } = useProjectMaterials();
  
  const isEditing = Boolean(id);
  
  // State
  const [formData, setFormData] = useState<PriceRequestFormData>({
    title: '',
    description: '',
    project_material_id: '',
    qty: '',
    unit: '',
    first_delivery_date: '',
    last_delivery_date: '',
    deadline: '',
    payment_terms: '',
    budget_hint: '',
    status: 'open'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      loadPriceRequest();
    }
  }, [id, isEditing]);

  const loadPriceRequest = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      const response = await fetch(`https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/detail/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data?.data) {
        const request = data.data;
        setFormData({
          title: request.title || '',
          description: request.description || '',
          project_material_id: request.project_material_id || '',
          qty: request.qty || '',
          unit: request.unit || '',
          first_delivery_date: request.first_delivery_date ? request.first_delivery_date.split('T')[0] : '',
          last_delivery_date: request.last_delivery_date ? request.last_delivery_date.split('T')[0] : '',
          deadline: request.deadline ? request.deadline.split('T')[0] : '',
          payment_terms: request.payment_terms || '',
          budget_hint: request.budget_hint || '',
          status: request.status || 'open'
        });
      }
    } catch (error) {
      console.error('Error loading price request:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse prisforespørgsel",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PriceRequestFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validering fejlede",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return false;
    }

    const validStatuses = ['open', 'closed', 'awarded', 'cancelled'];
    if (!validStatuses.includes(formData.status)) {
      toast({
        title: "Validering fejlede",
        description: "Ugyldig status værdi",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!activeProject) return;

    try {
      setSaving(true);

      // Prepare data for API
      const requestData = {
        project_id: activeProject.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        project_material_id: formData.project_material_id || null,
        qty: formData.qty ? Number(formData.qty) : null,
        unit: formData.unit.trim() || null,
        first_delivery_date: formData.first_delivery_date || null,
        last_delivery_date: formData.last_delivery_date || null,
        deadline: formData.deadline || null,
        payment_terms: formData.payment_terms.trim() || null,
        budget_hint: formData.budget_hint ? Number(formData.budget_hint) : null,
        status: formData.status
      };

      const url = isEditing 
        ? `https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/request/${id}`
        : `https://guhbrpektblabndqttgp.supabase.co/functions/v1/price_requests_api_2026_01_30_12_00/request`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aGJycGVrdGJsYWJuZHF0dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzgyOTEsImV4cCI6MjA4NDAxNDI5MX0.k2VbP5r3vCCJOsgefavapMFchC1fBerqoUKGDpe0E-M`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data?.data) {
        toast({
          title: isEditing ? "Prisforespørgsel opdateret" : "Prisforespørgsel oprettet",
          description: isEditing ? "Ændringerne er gemt" : "Prisforespørgslen er oprettet succesfuldt",
        });

        navigate('/project/price-requests');
      }
    } catch (error) {
      console.error('Error saving price request:', error);
      toast({
        title: "Fejl",
        description: isEditing ? "Kunne ikke opdatere prisforespørgsel" : "Kunne ikke oprette prisforespørgsel",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      open: 'Åben',
      closed: 'Lukket',
      awarded: 'Tildelt',
      cancelled: 'Annulleret'
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <p>Intet projekt valgt</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/project/price-requests')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til prisindhentning
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditing ? 'Rediger prisforespørgsel' : 'Opret prisforespørgsel'}
            </h1>
            <p className="text-muted-foreground">
              Projekt: {activeProject.name}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isEditing ? 'Rediger prisforespørgsel' : 'Ny prisforespørgsel'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p>Indlæser prisforespørgsel...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label htmlFor="title">Titel *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Indtast titel for prisforespørgslen"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Beskrivelse</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Detaljeret beskrivelse af behovet"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="project_material_id">Knyttet materiale</Label>
                    <Select 
                      value={formData.project_material_id} 
                      onValueChange={(value) => handleInputChange('project_material_id', value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg materiale (valgfrit)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Intet materiale</SelectItem>
                        {(materials || []).map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value) => handleInputChange('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">{getStatusLabel('open')}</SelectItem>
                        <SelectItem value="closed">{getStatusLabel('closed')}</SelectItem>
                        <SelectItem value="awarded">{getStatusLabel('awarded')}</SelectItem>
                        <SelectItem value="cancelled">{getStatusLabel('cancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quantity and Unit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="qty">Antal</Label>
                    <Input
                      id="qty"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.qty}
                      onChange={(e) => handleInputChange('qty', e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="Indtast antal"
                    />
                  </div>

                  <div>
                    <Label htmlFor="unit">Enhed</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                      placeholder="f.eks. stk, m², kg"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="first_delivery_date">Første leveringsdato</Label>
                    <Input
                      id="first_delivery_date"
                      type="date"
                      value={formData.first_delivery_date}
                      onChange={(e) => handleInputChange('first_delivery_date', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="last_delivery_date">Sidste leveringsdato</Label>
                    <Input
                      id="last_delivery_date"
                      type="date"
                      value={formData.last_delivery_date}
                      onChange={(e) => handleInputChange('last_delivery_date', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="deadline">Deadline for svar</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => handleInputChange('deadline', e.target.value)}
                    />
                  </div>
                </div>

                {/* Additional Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="payment_terms">Betalingsbetingelser</Label>
                    <Input
                      id="payment_terms"
                      value={formData.payment_terms}
                      onChange={(e) => handleInputChange('payment_terms', e.target.value)}
                      placeholder="f.eks. Netto 30 dage"
                    />
                  </div>

                  <div>
                    <Label htmlFor="budget_hint">Budget hint (intern)</Label>
                    <Input
                      id="budget_hint"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.budget_hint}
                      onChange={(e) => handleInputChange('budget_hint', e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="Forventet budget i DKK"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/project/price-requests')}
                  >
                    Annuller
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Gemmer...' : (isEditing ? 'Opdater' : 'Opret')}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PriceRequestForm;