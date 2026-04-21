import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Package, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { importProductsFromProject } from '@/lib/import/importProductsFromProject';

interface Project {
  id: string;
  name: string;
  project_number: string;
  customer: string;
}

interface Product {
  id: string;
  name: string;
  product_type: string;
  status: string;
}

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProjectId: string;
  onImportComplete: () => void;
}

export function ProductImportModal({
  isOpen,
  onClose,
  targetProjectId,
  onImportComplete,
}: ProductImportModalProps) {
  const { toast } = useToast();
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load projects on modal open
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // Filter projects based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.customer.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filtered);
    }
  }, [projects, searchTerm]);

  // Load products when source project is selected
  useEffect(() => {
    if (selectedProjectId) {
      loadProducts(selectedProjectId);
    } else {
      setProducts([]);
      setSelectedProductIds(new Set());
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      console.log('🔄 Loading projects...');
      
      const { data, error } = await supabase
        .from('projects_2026_01_15_06_45')
        .select('id, name, project_number, customer')
        .neq('id', targetProjectId) // Exclude target project
        .order('project_number');

      if (error) {
        console.error('❌ Error loading projects:', error);
        throw error;
      }

      console.log(`✅ Loaded ${data?.length || 0} projects`);
      setProjects(data || []);
    } catch (error) {
      console.error('❌ Failed to load projects:', error);
      toast({
        title: "Fejl ved indlæsning",
        description: "Kunne ikke hente projekter",
        variant: "destructive",
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProducts = async (projectId: string) => {
    setLoadingProducts(true);
    try {
      console.log(`🔄 Loading products for project: ${projectId}`);
      
      const { data, error } = await supabase
        .from('project_products_2026_01_15_12_49')
        .select('id, name, product_type, status')
        .eq('project_id', projectId)
        .order('name');

      if (error) {
        console.error('❌ Error loading products:', error);
        throw error;
      }

      console.log(`✅ Loaded ${data?.length || 0} products`);
      setProducts(data || []);
      setSelectedProductIds(new Set()); // Reset selection
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      toast({
        title: "Fejl ved indlæsning",
        description: "Kunne ikke hente produkter",
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSearchTerm(''); // Clear search when project is selected
  };

  const handleProductToggle = (productId: string, checked: boolean) => {
    const newSelection = new Set(selectedProductIds);
    if (checked) {
      newSelection.add(productId);
    } else {
      newSelection.delete(productId);
    }
    setSelectedProductIds(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(new Set(products.map(p => p.id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const handleImport = async () => {
    if (!selectedProjectId || selectedProductIds.size === 0) {
      toast({
        title: "Ingen produkter valgt",
        description: "Vælg mindst ét produkt at importere",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      console.log('🚀 Starting import...', {
        sourceProjectId: selectedProjectId,
        targetProjectId,
        productIds: Array.from(selectedProductIds)
      });

      const result = await importProductsFromProject(
        supabase,
        selectedProjectId,
        targetProjectId,
        Array.from(selectedProductIds),
        { includeExtraLines: true }
      );

      console.log('✅ Import completed:', result);

      // Show success message
      toast({
        title: "Import gennemført",
        description: `Importerede ${result.insertedCounts.products} produkter og ${result.insertedCounts.materials} materialer`,
      });

      // Close modal and refresh parent
      onClose();
      onImportComplete();

    } catch (error) {
      console.error('❌ Import failed:', error);
      toast({
        title: "Import fejlede",
        description: "Se console for fejldetaljer",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      // Reset state
      setSelectedProjectId('');
      setSelectedProductIds(new Set());
      setSearchTerm('');
      setProducts([]);
      onClose();
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Importér produkter fra projekt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Source Project */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">1. Vælg kildeprojekt</Label>
            
            {!selectedProjectId ? (
              <>
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg efter projekt (nummer, navn eller kunde)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    disabled={loadingProjects}
                  />
                </div>

                {/* Projects List */}
                <ScrollArea className="h-48 border rounded-md">
                  {loadingProjects ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Indlæser projekter...</span>
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                      <Building2 className="h-6 w-6 mr-2" />
                      {searchTerm ? 'Ingen projekter fundet' : 'Ingen projekter tilgængelige'}
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleProjectSelect(project.id)}
                          className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="font-medium">{project.project_number} - {project.name}</div>
                          <div className="text-sm text-muted-foreground">Kunde: {project.customer}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div>
                  <div className="font-medium">{selectedProject?.project_number} - {selectedProject?.name}</div>
                  <div className="text-sm text-muted-foreground">Kunde: {selectedProject?.customer}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProjectId('')}
                  disabled={importing}
                >
                  Skift projekt
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Select Products */}
          {selectedProjectId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">2. Vælg produkter at importere</Label>
                {products.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedProductIds.size === products.length && products.length > 0}
                      onCheckedChange={handleSelectAll}
                      disabled={importing}
                    />
                    <Label htmlFor="select-all" className="text-sm">
                      Vælg alle ({products.length})
                    </Label>
                  </div>
                )}
              </div>

              <ScrollArea className="h-48 border rounded-md">
                {loadingProducts ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Indlæser produkter...</span>
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Package className="h-6 w-6 mr-2" />
                    Ingen produkter fundet i dette projekt
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted"
                      >
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={(checked) => 
                            handleProductToggle(product.id, checked as boolean)
                          }
                          disabled={importing}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Type: {product.product_type} • Status: {product.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedProductIds.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedProductIds.size} produkt{selectedProductIds.size !== 1 ? 'er' : ''} valgt
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={importing}
          >
            Annuller
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedProjectId || selectedProductIds.size === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importerer...
              </>
            ) : (
              `Importér ${selectedProductIds.size} produkt${selectedProductIds.size !== 1 ? 'er' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}