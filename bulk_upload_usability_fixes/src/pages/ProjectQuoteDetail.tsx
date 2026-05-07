import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { QuotePDF } from '@/components/QuotePDF';
import { QuoteAppendixPDF } from '@/components/QuoteAppendixPDF';
import { supabase } from '@/integrations/supabase/client';
import { calculateLine } from '@/lib/quotePricing';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Calculator,
  Package,
  Trash2,
  Edit,
  GripVertical,
  Archive,
  FileText,
  ExternalLink,
  RefreshCw,
  Loader2,
  Download,
  MoreHorizontal,
  Lock,
  Unlock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { useCompanies, type Company } from '@/contexts/CompaniesContext';
import { useCompanySettings } from '@/contexts/CompanySettingsContext';
import { useAuth } from '@/contexts/AuthContext';

// Quick-add cost-kategorier (mapper til cost_breakdown_json slot)
type QuickCategory = 'material' | 'transport' | 'production' | 'montage' | 'intern';

const QUICK_DEFAULTS: Record<QuickCategory, {
  title: string;
  unit: string;
  pricePerUnit: number;
  costSlot: 'materials' | 'product_transport' | 'labor_production' | 'labor_dk' | 'other';
  label: string;
}> = {
  material:   { title: 'Materialer',     unit: 'stk',   pricePerUnit: 0,    costSlot: 'materials',         label: 'Materiale' },
  transport:  { title: 'Transport',      unit: 'palle', pricePerUnit: 1000, costSlot: 'product_transport', label: 'Transport' },
  production: { title: 'Produktion KS',  unit: 'time',  pricePerUnit: 200,  costSlot: 'labor_production',  label: 'Produktion' },
  montage:    { title: 'Montage DK',     unit: 'time',  pricePerUnit: 550,  costSlot: 'labor_dk',          label: 'Montage DK' },
  intern:     { title: 'Intern',         unit: 'time',  pricePerUnit: 450,  costSlot: 'other',             label: 'Intern' },
};

// Find primær cost-slot ud fra breakdown — bruges til compact rendering
const COST_SLOT_LABELS: Record<string, string> = {
  materials: 'Materiale',
  material_transport: 'Mat. transport',
  product_transport: 'Transport',
  labor_production: 'Produktion',
  labor_dk: 'Montage DK',
  other: 'Øvrigt',
};

const COST_SLOT_BADGE_CLASSES: Record<string, string> = {
  materials: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  material_transport: 'bg-sky-100 text-sky-800 hover:bg-sky-100',
  product_transport: 'bg-sky-100 text-sky-800 hover:bg-sky-100',
  labor_production: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  labor_dk: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  other: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

const getActiveCostSlots = (breakdown: any): string[] => {
  if (!breakdown) return [];
  return Object.keys(breakdown).filter(k => (breakdown[k] || 0) > 0);
};

// Lille indikator + reset/override-knap pr. tekstfelt der kan trække live mod company_settings.
// Tre states:
//   - isLocked: grå badge "Låst", ingen knap (banner ovenfor håndterer oplåsning)
//   - !isLocked && isNull: grøn badge "Live", knap "Override"
//   - !isLocked && !isNull: amber badge "Override", knap "Reset til standard"
const FieldIndicator: React.FC<{
  isNull: boolean;
  isLocked: boolean;
  lockedAt?: string | null;
  onReset: () => void;
  onOverride: () => void;
}> = ({ isNull, isLocked, lockedAt, onReset, onOverride }) => {
  if (isLocked) {
    return (
      <Badge variant="secondary" className="text-xs font-normal">
        Låst{lockedAt ? ` d. ${new Date(lockedAt).toLocaleDateString('da-DK')}` : ''}
      </Badge>
    );
  }
  if (isNull) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-normal bg-emerald-50 text-emerald-800 border-emerald-200">
          Live fra firma-indstillinger
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={onOverride}
          title="Lav et override for dette tilbud — kopierer standardteksten ind så du kan redigere"
        >
          Override
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs font-normal bg-amber-50 text-amber-800 border-amber-200">
        Override (bundet til tilbud)
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs px-2"
        onClick={onReset}
        title="Reset til standard — feltet trækker derefter live fra firma-indstillinger"
      >
        Reset til standard
      </Button>
    </div>
  );
};

type RenderStatus = 'none' | 'pending' | 'generating' | 'ready' | 'failed';
type ImageSource = 'render' | 'custom' | 'none';

interface QuoteLine {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  displayOrder?: number;
  createdAt: string;
  pricing?: QuoteLinePricing;
  items: QuoteLineItem[];
  // Billed/render-felter
  renderContext?: string | null;
  renderPrompt?: string | null;
  renderImageUrl?: string | null;
  renderStatus?: RenderStatus;
  renderError?: string | null;
  renderGeneratedAt?: string | null;
  renderModel?: string | null;
  customImageUrl?: string | null;
  customImageUploadedAt?: string | null;
  customImageCaption?: string | null;
  activeImageSource?: ImageSource;
  // Levende beskrivelse
  livingDescription?: string | null;
  livingDescriptionGeneratedAt?: string | null;
  livingDescriptionEdited?: boolean;
}

interface QuoteLineItem {
  id: string;
  sourceType: 'project_product' | 'custom';
  projectProductId?: string;
  title: string;
  qty: number;
  unit: string;
  costBreakdown: CostBreakdown;
  costTotalPerUnit: number;
}

interface CostBreakdown {
  materials: number;
  transport: number;
  labor_production: number;
  labor_dk: number;
  other: number;
}

interface QuoteLinePricing {
  pricingMode: 'markup_pct' | 'gross_margin_pct' | 'target_unit_price' | 'profit_by_category';
  markupPct?: number;
  grossMarginPct?: number;
  targetUnitPrice?: number;
  riskPerUnit: number;
  profitByCategory?: {
    materials?: number;
    material_transport?: number;
    product_transport?: number;
    labor_production?: number;
    labor_dk?: number;
    other?: number;
  };
}

const ProjectQuoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject, projects, setActiveProject } = useProject();
  const { products, calculateProductCost } = useProjectProducts();
  const { companies, addCompany, updateCompany } = useCompanies();
  const { settings: companySettings } = useCompanySettings();
  const { user } = useAuth();
  
  // Utility function for currency formatting
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // State
  const [quote, setQuote] = useState<any>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  // Sandheden for redigerbarhed: lås-state. Når true er hele tilbuddet read-only.
  const isReadOnly = !!quote?.is_locked;
  // Employees + crm_contacts til FK-dropdowns
  const [employees, setEmployees] = useState<Array<{id: string; full_name: string; email: string | null; phone: string | null}>>([]);
  const [companyContacts, setCompanyContacts] = useState<Array<{id: string; name: string; email: string | null; phone: string | null; role: string | null}>>([]);
  const [transferringToBudget, setTransferringToBudget] = useState(false);
  const [relatedBudgets, setRelatedBudgets] = useState<any[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [deletingLine, setDeletingLine] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [productUpdates, setProductUpdates] = useState<{[key: string]: any}>({});
  
  // Delete/Archive confirmation states
  const [showDeleteLineConfirm, setShowDeleteLineConfirm] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<string | null>(null);
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showUpdateWarnings, setShowUpdateWarnings] = useState(true);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [showAddLineModal, setShowAddLineModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  // Quick-add state — én cost-kategori med defaults pr. type
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSavingItem, setQuickAddSavingItem] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<QuickCategory | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({ title: '', qty: 1, unit: 'stk', pricePerUnit: 0 });
  // Hvilke items er foldet ud (compact rendering)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  // Hvilke linjer har billede- og levende-beskrivelse-sektioner foldet ud (default collapsed)
  const [expandedImageLines, setExpandedImageLines] = useState<Set<string>>(new Set());
  const [expandedDescLines, setExpandedDescLines] = useState<Set<string>>(new Set());
  const toggleSetItem = (s: Set<string>, id: string): Set<string> => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };
  // Lokal state for inline qty-edit
  const [itemQtyEdits, setItemQtyEdits] = useState<Record<string, number>>({});
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [savingNewCompany, setSavingNewCompany] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    cvr: '',
    addressLine1: '',
    addressZip: '',
    addressCity: '',
    defaultContactName: '',
    defaultContactEmail: '',
    defaultContactPhone: '',
  });
  // Collapse-state for sekundære cards (default collapsed for fokus på linjeposterne)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  // Lokal state for tekstfelter i Tilbudsdetaljer — gemmes ved blur,
  // så vi ikke skyder en Supabase-update + toast på hver keystroke.
  const [detailsForm, setDetailsForm] = useState({
    customer_contact_name: '',
    payment_terms: '',
    delivery_period: '',
    reservations: '',
    special_reservations: '',
    created_by_name: '',
    created_by_email: '',
    created_by_phone: '',
    recipient_notes: '',
    intro_text: '',
    notes: '',
  });
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [selectedLineForItems, setSelectedLineForItems] = useState<string | null>(null);
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<string | null>(null);
  const [productQuantity, setProductQuantity] = useState<number>(1);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  
  // Drag and drop state
  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  
  // Product search and filter state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  
  // Material summary data (Q-V1-10)
  const [productMaterialLines, setProductMaterialLines] = useState<any[]>([]);
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
  
  // Update all prices state
  const [updatingAllPrices, setUpdatingAllPrices] = useState(false);
  const [showUpdateAllConfirm, setShowUpdateAllConfirm] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  
  // Form data for new line
  const [lineFormData, setLineFormData] = useState({
    title: '',
    description: '',
    quantity: 1,
    unit: 'stk'
  });

  // Form data for pricing
  const [pricingFormData, setPricingFormData] = useState({
    pricingMode: 'markup_pct' as const,
    markupPct: 25,
    grossMarginPct: 20,
    targetUnitPrice: 0,
    riskPerUnit: 0,
    profitByCategory: {
      materials: 30,
      material_transport: 30,
      product_transport: 30,
      labor_production: 30,
      labor_dk: 30,
      other: 30
    }
  });

  // Form data for custom item
  const [customItemFormData, setCustomItemFormData] = useState({
    title: '',
    qty: 1,
    unit: 'stk',
    totalCostPerUnit: 0
  });

  // Form data for editing line
  const [editLineFormData, setEditLineFormData] = useState({
    title: '',
    description: '',
    quantity: 1,
    unit: 'stk'
  });

  // Form data for editing item
  const [editItemFormData, setEditItemFormData] = useState({
    title: '',
    qty: 1,
    unit: 'stk',
    totalCostPerUnit: 0
  });

  useEffect(() => {
    if (id) {
      loadQuoteData();
    }
  }, [id]);

  // Sync activeProject til tilbuddets faktiske projekt.
  // Forhindrer bug hvor PDF/header viser et andet projekt end det tilbuddet hører til.
  useEffect(() => {
    if (!quote?.project_id || !projects.length) return;
    if (activeProject?.id === quote.project_id) return;
    const target = projects.find(p => p.id === quote.project_id);
    if (target) setActiveProject(target);
  }, [quote?.project_id, projects, activeProject?.id, setActiveProject]);

  // Tjek for produktopdateringer når data er indlæst
  useEffect(() => {
    if (lines.length > 0) {
      checkForProductUpdates();
    }
  }, [lines]);

  // Skriv cached_sell_total tilbage til databasen når lines ændres
  useEffect(() => {
    if (!id || lines.length === 0) return;
    const total = lines.reduce((acc, line) => acc + calculateLineTotals(line).totalSellingPrice, 0);
    supabase
      .from('project_quotes_2026_01_16_23_00')
      .update({ cached_sell_total: total })
      .eq('id', id)
      .then(() => {});
  }, [lines, id]);

  // Load material data for material summary (Q-V1-10)
  useEffect(() => {
    if (lines.length > 0) {
      loadMaterialData(lines);
    }
  }, [lines]);

  // Load aktive medarbejdere én gang
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, email, phone')
        .eq('active', true)
        .order('full_name');
      if (!error && data) setEmployees(data);
    })();
  }, []);

  // Load crm_contacts for tilbuddets company. Genindlæs når company_id ændres.
  useEffect(() => {
    if (!quote?.company_id) {
      setCompanyContacts([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('crm_contacts_2026_04_12')
        .select('id, name, email, phone, role')
        .eq('company_id', quote.company_id)
        .order('name');
      if (!error && data) setCompanyContacts(data as any);
    })();
  }, [quote?.company_id]);

  // Auto-prefill tilbudsgiver fra indlogget bruger ved første load (kun hvis FK ikke er sat)
  useEffect(() => {
    if (!quote?.id || !user?.email || employees.length === 0) return;
    if (quote.created_by_employee_id) return;
    const emp = employees.find(e => e.email && e.email.toLowerCase() === user.email!.toLowerCase());
    if (!emp) return;
    updateQuoteMetadata({
      created_by_employee_id: emp.id,
      created_by_name: emp.full_name,
      created_by_email: emp.email,
      created_by_phone: emp.phone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id, user?.email, employees.length]);

  // Synkronisér lokal detailsForm når quote ændres (id-skift eller eksternt save)
  useEffect(() => {
    if (!quote) return;
    setDetailsForm({
      customer_contact_name: quote.customer_contact_name ?? '',
      payment_terms: quote.payment_terms ?? '',
      delivery_period: quote.delivery_period ?? '',
      reservations: quote.reservations ?? '',
      special_reservations: quote.special_reservations ?? '',
      created_by_name: quote.created_by_name ?? '',
      created_by_email: quote.created_by_email ?? '',
      created_by_phone: quote.created_by_phone ?? '',
      recipient_notes: quote.recipient_notes ?? '',
      intro_text: quote.intro_text ?? '',
      notes: quote.notes ?? '',
    });
  }, [
    quote?.id,
    quote?.customer_contact_name,
    quote?.payment_terms,
    quote?.delivery_period,
    quote?.reservations,
    quote?.special_reservations,
    quote?.created_by_name,
    quote?.created_by_email,
    quote?.created_by_phone,
    quote?.recipient_notes,
    quote?.intro_text,
    quote?.notes,
  ]);

  // Gem ét tekstfelt hvis det har ændret sig (kaldes onBlur)
  const saveDetailField = (key: keyof typeof detailsForm) => {
    if (!quote) return;
    const localVal = detailsForm[key];
    const storedVal = (quote[key] ?? '') as string;
    if (localVal === storedVal) return;
    updateQuoteMetadata({ [key]: localVal || null });
  };

  const loadQuoteData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Load quote — fra v_quotes_resolved for at få resolved_* tekster.
      // INSERT/UPDATE går stadig mod project_quotes_2026_01_16_23_00 direkte.
      const { data: quoteData, error: quoteError } = await supabase
        .from('v_quotes_resolved')
        .select('*')
        .eq('id', id)
        .single();

      if (quoteError) throw quoteError;
      setQuote(quoteData);

      // Pricing er nu kolonner direkte på line — ingen separat pricing-tabel-join
      const { data: linesData, error: linesError } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .select(`
          *,
          project_quote_line_items_2026_01_16_23_00(*)
        `)
        .eq('project_quote_id', id)
        .neq('archived', true)
        .order('display_order', { nullsLast: true })
        .order('created_at');

      if (linesError) throw linesError;

      if (linesData) {
        const hasUpdatedOrders = await assignMissingDisplayOrders(linesData);

        let finalLinesData = linesData;
        if (hasUpdatedOrders) {
          const { data: refreshedData } = await supabase
            .from('project_quote_lines_2026_01_16_23_00')
            .select(`
              *,
              project_quote_line_items_2026_01_16_23_00(*)
            `)
            .eq('project_quote_id', id)
            .neq('archived', true)
            .order('display_order', { nullsLast: true })
            .order('created_at');
          finalLinesData = refreshedData || linesData;
        }

        const formattedLines = finalLinesData.map((line: any) => {
          return {
          id: line.id,
          title: line.title,
          description: line.description,
          quantity: parseFloat(line.quantity),
          unit: line.unit,
          sortOrder: line.sort_order,
          displayOrder: line.display_order,
          createdAt: line.created_at,
          pricing: {
            pricingMode: (line.pricing_mode === 'target_unit_price' ? 'target_unit_price' : 'markup_pct'),
            markupPct: line.markup_pct != null ? parseFloat(line.markup_pct) : 25,
            grossMarginPct: null, // Deprecated — bevares i type for kompatibilitet men altid null
            targetUnitPrice: line.target_unit_price != null ? parseFloat(line.target_unit_price) : null,
            riskPerUnit: line.risk_per_unit != null ? parseFloat(line.risk_per_unit) : 0,
            profitByCategory: {}, // Deprecated — bevares i type
          },
          items: line.project_quote_line_items_2026_01_16_23_00?.map((item: any) => ({
            id: item.id,
            sourceType: item.source_type,
            projectProductId: item.project_product_id,
            title: item.title,
            qty: parseFloat(item.qty),
            unit: item.unit,
            costBreakdown: item.cost_breakdown_json || { materials: 0, transport: 0, labor_production: 0, labor_dk: 0, other: 0 },
            costTotalPerUnit: parseFloat(item.cost_total_per_unit || 0)
          })) || [],
          // Billed/render-felter
          renderContext: line.render_context ?? null,
          renderPrompt: line.render_prompt ?? null,
          renderImageUrl: line.render_image_url ?? null,
          renderStatus: (line.render_status ?? 'none') as RenderStatus,
          renderError: line.render_error ?? null,
          renderGeneratedAt: line.render_generated_at ?? null,
          renderModel: line.render_model ?? null,
          customImageUrl: line.custom_image_url ?? null,
          customImageUploadedAt: line.custom_image_uploaded_at ?? null,
          customImageCaption: line.custom_image_caption ?? null,
          activeImageSource: (line.active_image_source ?? 'render') as ImageSource,
          // Levende beskrivelse
          livingDescription: line.living_description ?? null,
          livingDescriptionGeneratedAt: line.living_description_generated_at ?? null,
          livingDescriptionEdited: !!line.living_description_edited,
          };
        });
        setLines(formattedLines);
      }
      
      // Load related budgets
      await loadRelatedBudgets(id);
    } catch (error) {
      console.error('Error loading quote data:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke indlæse tilbudsdata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load related budgets
  const loadRelatedBudgets = async (quoteId: string) => {
    try {
      const { data: budgetsData, error } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .select('id, budget_number, title, status')
        .eq('source_quote_id', quoteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRelatedBudgets(budgetsData || []);
    } catch (error) {
      console.error('Error loading related budgets:', error);
      setRelatedBudgets([]);
    }
  };

  // Load material data for material summary (Q-V1-10)
  const loadMaterialData = async (quoteLines: QuoteLine[]) => {
    try {
      // Get all product IDs from quote line items
      const productIds = new Set<string>();
      quoteLines.forEach(line => {
        line.items?.forEach(item => {
          if (item.sourceType === 'project_product' && item.projectProductId) {
            productIds.add(item.projectProductId);
          }
        });
      });

      if (productIds.size === 0) {
        setProductMaterialLines([]);
        setProjectMaterials([]);
        return;
      }

      // Fetch product material lines for these products
      const { data: materialLinesData, error: materialLinesError } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .select('*')
        .in('project_product_id', Array.from(productIds));

      if (materialLinesError) throw materialLinesError;

      // Get unique material IDs
      const materialIds = new Set<string>();
      materialLinesData?.forEach(line => {
        if (line.project_material_id) {
          materialIds.add(line.project_material_id);
        }
      });

      // Fetch project materials
      if (materialIds.size > 0) {
        const { data: materialsData, error: materialsError } = await supabase
          .from('project_materials_2026_01_15_06_45')
          .select('*')
          .in('id', Array.from(materialIds));

        if (materialsError) throw materialsError;
        setProjectMaterials(materialsData || []);
      } else {
        setProjectMaterials([]);
      }

      setProductMaterialLines(materialLinesData || []);
    } catch (error) {
      console.error('Error loading material data:', error);
      setProductMaterialLines([]);
      setProjectMaterials([]);
    }
  };


  // Update quote metadata
  const updateQuoteMetadata = async (updates: any) => {
    if (!quote?.id) return;

    try {
      setSavingMetadata(true);

      const { error } = await supabase
        .from('project_quotes_2026_01_16_23_00')
        .update(updates)
        .eq('id', quote.id);

      if (error) throw error;

      // Hvis et af felterne triggerer DB-side ændringer eller joins, reload fra view'et
      // så vi fanger trigger-output (sent_at, locked_at, snapshot) og opdaterede joins
      // (company_*, recipient_*, created_by_*_resolved).
      const triggerKeys = ['status', 'is_locked', 'payment_terms', 'delivery_period', 'reservations', 'special_reservations', 'company_id', 'recipient_contact_id', 'created_by_employee_id', 'quote_date', 'payment_terms_template'];
      const needsReload = Object.keys(updates).some(k => triggerKeys.includes(k));
      if (needsReload) {
        const { data: fresh } = await supabase
          .from('v_quotes_resolved')
          .select('*')
          .eq('id', quote.id)
          .single();
        if (fresh) setQuote(fresh);
      } else {
        setQuote((prev: any) => ({ ...prev, ...updates }));
      }

      toast({
        title: "Metadata opdateret",
        description: "Tilbuddets metadata er blevet gemt",
      });
    } catch (error) {
      console.error('Error updating quote metadata:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering af metadata",
        variant: "destructive",
      });
    } finally {
      setSavingMetadata(false);
    }
  };

  // Åbn dialog i edit-mode for det valgte firma
  const openEditCompanyDialog = () => {
    if (!quote?.company_id) return;
    const c = companies.find(co => co.id === quote.company_id);
    if (!c) return;
    setEditingCompanyId(c.id);
    setNewCompanyForm({
      name: c.name,
      cvr: c.cvr ?? '',
      addressLine1: c.addressLine1 ?? '',
      addressZip: c.addressZip ?? '',
      addressCity: c.addressCity ?? '',
      defaultContactName: c.defaultContactName ?? '',
      defaultContactEmail: c.defaultContactEmail ?? '',
      defaultContactPhone: c.defaultContactPhone ?? '',
    });
    setShowNewCompanyDialog(true);
  };

  const openNewCompanyDialog = () => {
    setEditingCompanyId(null);
    setNewCompanyForm({
      name: '', cvr: '', addressLine1: '', addressZip: '', addressCity: '',
      defaultContactName: '', defaultContactEmail: '', defaultContactPhone: '',
    });
    setShowNewCompanyDialog(true);
  };

  // Opret eller opdater firma — link til tilbud hvis det er en oprettelse
  const handleSaveCompany = async () => {
    if (!newCompanyForm.name.trim()) {
      toast({ title: "Fejl", description: "Firmanavn er påkrævet", variant: "destructive" });
      return;
    }
    try {
      setSavingNewCompany(true);
      const payload = {
        name: newCompanyForm.name.trim(),
        cvr: newCompanyForm.cvr.trim() || undefined,
        addressLine1: newCompanyForm.addressLine1.trim() || undefined,
        addressZip: newCompanyForm.addressZip.trim() || undefined,
        addressCity: newCompanyForm.addressCity.trim() || undefined,
        defaultContactName: newCompanyForm.defaultContactName.trim() || undefined,
        defaultContactEmail: newCompanyForm.defaultContactEmail.trim() || undefined,
        defaultContactPhone: newCompanyForm.defaultContactPhone.trim() || undefined,
      };
      if (editingCompanyId) {
        await updateCompany(editingCompanyId, payload);
        toast({ title: "Firma opdateret", description: payload.name });
      } else {
        const company = await addCompany({
          ...payload,
          isCustomer: true,
          isSupplier: false,
          isPartner: false,
        });
        await updateQuoteMetadata({
          company_id: company.id,
          customer_contact_name: company.defaultContactName ?? null,
        });
        toast({ title: "Kunde oprettet", description: `${company.name} er tilføjet og linket til tilbuddet` });
      }
      setShowNewCompanyDialog(false);
      setEditingCompanyId(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Fejl", description: editingCompanyId ? "Kunne ikke opdatere firma" : "Kunne ikke oprette kunde", variant: "destructive" });
    } finally {
      setSavingNewCompany(false);
    }
  };

  // Transfer accepted quote to budget
  const transferToBudget = async () => {
    if (!quote?.id || !activeProject?.id || quote.status !== 'accepted') {
      toast({
        title: "Fejl",
        description: "Kun accepterede tilbud kan overføres til budget",
        variant: "destructive",
      });
      return;
    }

    try {
      setTransferringToBudget(true);

      // 1. Opret project_budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('project_budgets_2026_01_22_00_00')
        .insert({
          project_id: activeProject.id,
          source_quote_id: quote.id,
          budget_number: `B-${quote.quote_number || new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
          title: `Budget fra ${quote.title}`,
          status: 'active'
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      const budgetId = budgetData.id;

      // 2. Opret project_budget_lines for hver quote line
      for (const line of lines) {
        const lineTotals = calculateLineTotals(line);
        
        // Opret budget line
        const { data: budgetLineData, error: budgetLineError } = await supabase
          .from('project_budget_lines_2026_01_22_00_00')
          .insert({
            project_budget_id: budgetId,
            source_quote_line_id: line.id,
            title: line.title,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            sort_order: line.sortOrder || 0,
            locked_sell_total: lineTotals.totalSellingPrice,
            baseline_cost_total: 0, // Will be calculated from baseline items
            baseline_cost_breakdown_json: {},
            baseline_risk_total: lineTotals.riskPerUnit * line.quantity || 0
          })
          .select()
          .single();

        if (budgetLineError) throw budgetLineError;

        const budgetLineId = budgetLineData.id;
        let baselineCostTotal = 0;
        const baselineCostBreakdown: any = {};

        // 3. For hver quote line item: opret baseline og current budget line items
        for (const item of line.items) {
          // Hent produktdata hvis det er et projektprodukt
          let productData = null;
          if (item.sourceType === 'project_product' && item.projectProductId) {
            const { data } = await supabase
              .from('project_products_2026_01_15_06_45')
              .select('updated_at')
              .eq('id', item.projectProductId)
              .single();
            productData = data;
          }

          const snapshotUpdatedAt = productData?.updated_at || new Date().toISOString();
          const snapshotCostBreakdown = item.costBreakdown || {};
          const snapshotCostTotal = item.costTotalPerUnit || 0;

          // Opret baseline item
          const { error: baselineError } = await supabase
            .from('project_budget_line_items_2026_01_22_00_00')
            .insert({
              project_budget_line_id: budgetLineId,
              source_quote_line_item_id: item.id,
              source_type: item.sourceType,
              project_product_id: item.projectProductId,
              title: item.title,
              qty: item.qty,
              unit: item.unit,
              mode: 'baseline',
              baseline_cost_breakdown_json: snapshotCostBreakdown,
              baseline_cost_total_per_unit: snapshotCostTotal,
              product_snapshot_updated_at: snapshotUpdatedAt,
              snapshot_cost_breakdown_json: snapshotCostBreakdown,
              snapshot_cost_total_per_unit: snapshotCostTotal
            });

          if (baselineError) throw baselineError;

          // Opret current item (kopi af baseline)
          const { error: currentError } = await supabase
            .from('project_budget_line_items_2026_01_22_00_00')
            .insert({
              project_budget_line_id: budgetLineId,
              source_quote_line_item_id: item.id,
              source_type: item.sourceType,
              project_product_id: item.projectProductId,
              title: item.title,
              qty: item.qty,
              unit: item.unit,
              mode: 'current',
              baseline_cost_breakdown_json: snapshotCostBreakdown,
              baseline_cost_total_per_unit: snapshotCostTotal,
              product_snapshot_updated_at: snapshotUpdatedAt,
              snapshot_cost_breakdown_json: snapshotCostBreakdown,
              snapshot_cost_total_per_unit: snapshotCostTotal
            });

          if (currentError) throw currentError;

          // Akkumuler baseline totals
          baselineCostTotal += snapshotCostTotal * item.qty;
          
          // Akkumuler breakdown
          Object.keys(snapshotCostBreakdown).forEach(key => {
            baselineCostBreakdown[key] = (baselineCostBreakdown[key] || 0) + 
              (snapshotCostBreakdown[key] * item.qty);
          });
        }

        // 4. Opdater budget line med korrekte baseline totals
        const { error: updateLineError } = await supabase
          .from('project_budget_lines_2026_01_22_00_00')
          .update({
            baseline_cost_total: baselineCostTotal,
            baseline_cost_breakdown_json: baselineCostBreakdown
          })
          .eq('id', budgetLineId);

        if (updateLineError) throw updateLineError;
      }

      toast({
        title: "Budget oprettet",
        description: `Tilbuddet er overført til budget: ${budgetData.title}`,
      });

      // Reload related budgets to show the new one
      await loadRelatedBudgets(quote.id);
      
      // Navigate til budget
      navigate(`/project/budgets/${budgetId}`);
      
    } catch (error) {
      console.error('Error transferring to budget:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved overførsel til budget",
        variant: "destructive",
      });
    } finally {
      setTransferringToBudget(false);
    }
  };

  // Automatisk tildeling af display_order for linjer der mangler det
  const assignMissingDisplayOrders = async (quoteLinesData: any[]) => {
    const linesWithoutDisplayOrder = quoteLinesData.filter(line => line.display_order === null || line.display_order === undefined);
    
    if (linesWithoutDisplayOrder.length === 0) return false;

    try {
      // Find højeste eksisterende display_order
      const maxDisplayOrder = Math.max(
        ...quoteLinesData
          .filter(line => line.display_order !== null && line.display_order !== undefined)
          .map(line => line.display_order),
        0
      );

      // Sorter linjer uden display_order efter created_at
      const sortedLinesWithoutOrder = linesWithoutDisplayOrder.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Tildel display_order værdier
      const updates = sortedLinesWithoutOrder.map((line, index) => ({
        id: line.id,
        display_order: maxDisplayOrder + index + 1
      }));

      // Opdater database
      for (const update of updates) {
        await supabase
          .from('project_quote_lines_2026_01_16_23_00')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      console.log(`Tildelt display_order til ${updates.length} tilbudslinjer`);
      return true;
    } catch (error) {
      console.error('Fejl ved tildeling af display_order:', error);
      return false;
    }
  };

  // Filtrer og sorter produkter
  const getFilteredProducts = () => {
    return products
      .filter(product => {
        // Filtrer arkiverede produkter ud
        if (product.status === 'archived') return false;
        
        // Tekstsøgning
        const matchesSearch = productSearchTerm === '' || 
          product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(productSearchTerm.toLowerCase()));
        
        // Type filter
        const matchesType = productTypeFilter === 'all' || product.type === productTypeFilter;
        
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        // Sorter efter navn
        return a.name.localeCompare(b.name, 'da-DK');
      });
  };

  const toggleLineExpansion = (lineId: string) => {
    const newExpanded = new Set(expandedLines);
    if (newExpanded.has(lineId)) {
      newExpanded.delete(lineId);
    } else {
      newExpanded.add(lineId);
    }
    setExpandedLines(newExpanded);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, lineId: string) => {
    setDraggedLineId(lineId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, lineId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLineId(lineId);
  };

  const handleDragLeave = () => {
    setDragOverLineId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    
    if (!draggedLineId || draggedLineId === targetLineId) {
      setDraggedLineId(null);
      setDragOverLineId(null);
      return;
    }

    try {
      // Find the dragged and target lines
      const draggedLine = lines.find(line => line.id === draggedLineId);
      const targetLine = lines.find(line => line.id === targetLineId);
      
      if (!draggedLine || !targetLine) return;

      // Create new order for all lines using display_order
      const sortedLines = [...lines].sort((a, b) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const draggedIndex = sortedLines.findIndex(line => line.id === draggedLineId);
      const targetIndex = sortedLines.findIndex(line => line.id === targetLineId);
      
      // Remove dragged line and insert at target position
      const reorderedLines = [...sortedLines];
      const [removed] = reorderedLines.splice(draggedIndex, 1);
      reorderedLines.splice(targetIndex, 0, removed);
      
      // Update display_order for all affected lines
      const updates = reorderedLines.map((line, index) => ({
        id: line.id,
        displayOrder: index + 1
      }));

      // Update database
      for (const update of updates) {
        await supabase
          .from('project_quote_lines_2026_01_16_23_00')
          .update({ display_order: update.displayOrder })
          .eq('id', update.id);
      }

      // Reload data to reflect changes
      await loadQuoteData();
      
      toast({
        title: "Rækkefølge opdateret",
        description: "Tilbudslinjernes rækkefølge er blevet gemt."
      });
      
    } catch (error) {
      console.error('Error reordering lines:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere rækkefølgen.",
        variant: "destructive"
      });
    } finally {
      setDraggedLineId(null);
      setDragOverLineId(null);
    }
  };

  const calculateLineTotals = (line: QuoteLine) => {
    // Calculate cost breakdown per unit (til visning + % af salgspris i UI)
    const totalCostBreakdown = line.items.reduce((acc, item) => {
      const itemCost = item.costBreakdown || { materials: 0, material_transport: 0, product_transport: 0, labor_production: 0, labor_dk: 0, other: 0 };
      const materials = itemCost.materials || 0;
      const materialTransport = itemCost.material_transport || 0;
      const productTransport = itemCost.product_transport || itemCost.transport || 0;
      const laborProduction = itemCost.labor_production || 0;
      const laborDk = itemCost.labor_dk || 0;
      const other = itemCost.other || 0;
      return {
        materials: acc.materials + (materials * item.qty),
        material_transport: acc.material_transport + (materialTransport * item.qty),
        product_transport: acc.product_transport + (productTransport * item.qty),
        labor_production: acc.labor_production + (laborProduction * item.qty),
        labor_dk: acc.labor_dk + (laborDk * item.qty),
        other: acc.other + (other * item.qty)
      };
    }, { materials: 0, material_transport: 0, product_transport: 0, labor_production: 0, labor_dk: 0, other: 0 });

    const costBreakdownPerUnit = line.quantity > 0 ? {
      materials: totalCostBreakdown.materials / line.quantity,
      material_transport: totalCostBreakdown.material_transport / line.quantity,
      product_transport: totalCostBreakdown.product_transport / line.quantity,
      labor_production: totalCostBreakdown.labor_production / line.quantity,
      labor_dk: totalCostBreakdown.labor_dk / line.quantity,
      other: totalCostBreakdown.other / line.quantity
    } : { materials: 0, material_transport: 0, product_transport: 0, labor_production: 0, labor_dk: 0, other: 0 };

    // Delegér sell/cost/profit-beregning til shared helper for konsistens med lister + dashboard
    const sharedItems = line.items.map(it => ({
      qty: it.qty,
      cost_total_per_unit: it.costTotalPerUnit ?? null,
      cost_breakdown_json: it.costBreakdown,
    }));
    const sharedPricing = line.pricing ? {
      pricing_mode: (line.pricing.pricingMode === 'target_unit_price' ? 'target_unit_price' : 'markup_pct') as 'markup_pct' | 'target_unit_price',
      markup_pct: line.pricing.markupPct ?? 25,
      target_unit_price: line.pricing.targetUnitPrice ?? null,
      risk_per_unit: line.pricing.riskPerUnit ?? 0,
    } : null;
    const t = calculateLine(sharedItems, line.quantity, sharedPricing);

    const baseCostPerUnit = t.costPerUnit;
    const riskPerUnit = t.riskPerUnit;
    const totalCostPerUnit = t.totalCostPerUnit;
    const sellingPricePerUnit = t.sellingPricePerUnit;
    const profitPerUnit = t.sellingPricePerUnit - t.totalCostPerUnit;
    const dbPercent = t.dbPercent;
    
    return {
      baseCostPerUnit,
      riskPerUnit,
      totalCostPerUnit,
      sellingPricePerUnit,
      profitPerUnit,
      dbPercent,
      totalCost: totalCostPerUnit * line.quantity,
      totalSellingPrice: sellingPricePerUnit * line.quantity,
      totalProfit: profitPerUnit * line.quantity,
      costBreakdown: costBreakdownPerUnit,
      costPercentages: {
        materials: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.materials / sellingPricePerUnit) * 100 : 0,
        material_transport: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.material_transport / sellingPricePerUnit) * 100 : 0,
        product_transport: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.product_transport / sellingPricePerUnit) * 100 : 0,
        labor_production: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.labor_production / sellingPricePerUnit) * 100 : 0,
        labor_dk: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.labor_dk / sellingPricePerUnit) * 100 : 0,
        other: sellingPricePerUnit > 0 ? (costBreakdownPerUnit.other / sellingPricePerUnit) * 100 : 0,
        risk: sellingPricePerUnit > 0 ? (riskPerUnit / sellingPricePerUnit) * 100 : 0,
        profit: sellingPricePerUnit > 0 ? (profitPerUnit / sellingPricePerUnit) * 100 : 0
      }
    };
  };

  const handleAddLine = async () => {
    if (!quote || !lineFormData.title) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      const maxDisplayOrder = Math.max(...lines.map(l => l.displayOrder || 0), 0);

      // Pricing er nu defaults på line-kolonner (markup_pct=25, risk_per_unit=0 automatisk via schema)
      const lineData = {
        project_quote_id: quote.id,
        title: lineFormData.title,
        description: lineFormData.description || null,
        quantity: lineFormData.quantity,
        unit: lineFormData.unit,
        sort_order: lines.length,
        display_order: maxDisplayOrder + 1
      };

      const { error: lineError } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .insert(lineData);

      if (lineError) throw lineError;

      toast({
        title: "Linje tilføjet",
        description: "Tilbudslinjen er blevet oprettet",
      });

      setShowAddLineModal(false);
      setLineFormData({ title: '', description: '', quantity: 1, unit: 'stk' });
      loadQuoteData();
    } catch (error) {
      console.error('Error adding line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved oprettelse",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePricing = async (lineId: string) => {
    // V2: Kun 2 modes — markup_pct (default) og target_unit_price (fast pris)
    // gross_margin_pct og profit_by_category er fjernet
    const mode = pricingFormData.pricingMode === 'target_unit_price' ? 'target_unit_price' : 'markup_pct';

    if (mode === 'markup_pct' && (pricingFormData.markupPct < 0 || pricingFormData.markupPct > 1000)) {
      toast({
        title: "Ugyldig markup",
        description: "Markup skal være mellem 0% og 1000%",
        variant: "destructive",
      });
      return;
    }

    if (mode === 'target_unit_price' && pricingFormData.targetUnitPrice <= 0) {
      toast({
        title: "Ugyldig salgspris",
        description: "Salgspris skal være større end 0",
        variant: "destructive",
      });
      return;
    }

    if (pricingFormData.riskPerUnit < 0) {
      toast({
        title: "Ugyldig risk",
        description: "Risk kan ikke være negativ",
        variant: "destructive",
      });
      return;
    }

    setSavingPricing(true);
    try {
      // Pricing er nu kolonner direkte på line — simple UPDATE
      const updateData: any = {
        pricing_mode: mode,
        risk_per_unit: pricingFormData.riskPerUnit,
      };
      if (mode === 'markup_pct') {
        updateData.markup_pct = pricingFormData.markupPct;
        // target_unit_price bevares men bruges ikke i denne mode
      } else {
        updateData.target_unit_price = pricingFormData.targetUnitPrice;
        // markup_pct bevares men bruges ikke i denne mode
      }

      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .update(updateData)
        .eq('id', lineId);

      if (error) throw error;

      toast({
        title: "Prisfastsættelse opdateret",
        description: "Prisindstillingerne er blevet gemt",
      });

      setEditingPricing(null);
      loadQuoteData();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    } finally {
      setSavingPricing(false);
    }
  };

  const handleAddProductItem = async (productId: string, quantity: number = 1) => {
    if (!selectedLineForItems) return;

    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      // KORREKT COST SNAPSHOT BEREGNING - Step Q-V1-02
      console.log('Beregner cost snapshot for produkt:', product.name);
      
      // 2.1 Materialer (fra product material lines)
      const { data: materialLines, error: materialError } = await supabase
        .from('project_product_material_lines_2026_01_15_12_49')
        .select(`
          qty,
          unit_cost_override,
          project_material_id,
          project_materials_2026_01_15_06_45(
            unit_price,
            transport_estimated_cost
          )
        `)
        .eq('project_product_id', productId);
      
      if (materialError) {
        console.error('Fejl ved hentning af material lines:', materialError);
      }
      
      let materials = 0;
      let materialTransport = 0;
      
      if (materialLines) {
        for (const line of materialLines) {
          const qty = line.qty || 0;
          let unitCost = 0;
          
          // Brug unit_cost_override hvis ikke null, ellers unit_price fra material
          if (line.unit_cost_override !== null) {
            unitCost = line.unit_cost_override;
          } else if (line.project_materials_2026_01_15_06_45?.unit_price) {
            unitCost = line.project_materials_2026_01_15_06_45.unit_price;
          }
          
          const lineCost = qty * unitCost;
          materials += lineCost;
          
          // Material transport (én gang pr material-line)
          const transportCost = line.project_materials_2026_01_15_06_45?.transport_estimated_cost || 0;
          materialTransport += transportCost;
        }
      }
      
      // 2.2 Labor (fra labor lines)
      const { data: laborLines, error: laborError } = await supabase
        .from('project_product_labor_lines_2026_01_15_12_49')
        .select('qty, unit_cost, labor_type')
        .eq('project_product_id', productId);
      
      if (laborError) {
        console.error('Fejl ved hentning af labor lines:', laborError);
      }
      
      let laborProduction = 0;
      let laborDk = 0;
      let otherLabor = 0;
      
      if (laborLines) {
        for (const line of laborLines) {
          const lineCost = (line.qty || 0) * (line.unit_cost || 0);
          
          if (line.labor_type === 'production') {
            laborProduction += lineCost;
          } else if (line.labor_type === 'dk_installation') {
            laborDk += lineCost;
          } else if (line.labor_type === 'other') {
            otherLabor += lineCost;
          }
        }
      }
      
      // 2.3 Produkttransport
      const { data: transportLines, error: transportError } = await supabase
        .from('project_product_transport_lines_2026_01_15_12_49')
        .select('qty, unit_cost')
        .eq('project_product_id', productId);
      
      if (transportError) {
        console.error('Fejl ved hentning af transport lines:', transportError);
      }
      
      let productTransport = 0;
      if (transportLines) {
        productTransport = transportLines.reduce((sum, line) => {
          return sum + ((line.qty || 0) * (line.unit_cost || 0));
        }, 0);
      }
      
      // 2.4 Øvrigt
      const { data: otherLines, error: otherError } = await supabase
        .from('project_product_other_cost_lines_2026_01_15_12_49')
        .select('qty, unit_cost')
        .eq('project_product_id', productId);
      
      if (otherError) {
        console.error('Fejl ved hentning af other cost lines:', otherError);
      }
      
      let otherCosts = 0;
      if (otherLines) {
        otherCosts = otherLines.reduce((sum, line) => {
          return sum + ((line.qty || 0) * (line.unit_cost || 0));
        }, 0);
      }
      
      // 2.6 Samlet transport og other
      const transport = materialTransport + productTransport;
      const other = otherCosts + otherLabor;
      
      // 2.7 Standardiseret cost_breakdown_json struktur (Step Q-V1-02b)
      const costBreakdown = {
        materials: materials,
        material_transport: materialTransport,
        product_transport: productTransport,
        labor_production: laborProduction,
        labor_dk: laborDk,
        other: other
      };
      
      console.log('Beregnet cost breakdown:', costBreakdown);
      
      const totalCost = Object.values(costBreakdown).reduce((sum, cost) => sum + cost, 0);
      console.log('Total cost per unit:', totalCost);
      
      // 4) Fejlhåndtering - vis advarsel hvis cost er 0
      if (totalCost === 0) {
        console.warn('Cost snapshot er 0 - mangler priser eller qty');
      }

      const itemData = {
        project_quote_line_id: selectedLineForItems,
        source_type: 'project_product',
        project_product_id: productId,
        title: product.name,
        qty: quantity,
        unit: product.unit || 'stk',
        cost_breakdown_json: costBreakdown,
        cost_total_per_unit: totalCost
      };

      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .insert(itemData);

      if (error) throw error;

      toast({
        title: "Produkt tilføjet",
        description: `${product.name} er tilføjet til linjen`,
      });

      setShowAddItemModal(false);
      setSelectedLineForItems(null);
      setSelectedProductForAdd(null);
      setProductQuantity(1);
      loadQuoteData();
    } catch (error) {
      console.error('Error adding product item:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved tilføjelse",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomItem = async () => {
    if (!selectedLineForItems || !customItemFormData.title.trim()) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    if (customItemFormData.qty <= 0) {
      toast({
        title: "Ugyldig antal",
        description: "Antal skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    
    if (customItemFormData.totalCostPerUnit < 0) {
      toast({
        title: "Ugyldig total cost",
        description: "Total cost kan ikke være negativ",
        variant: "destructive",
      });
      return;
    }
    
    if (!customItemFormData.unit.trim()) {
      toast({
        title: "Fejl",
        description: "Enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }

    try {
      // For custom costs, always place cost under 'other' category
      const costBreakdown = {
        materials: 0,
        material_transport: 0,
        product_transport: 0,
        labor_production: 0,
        labor_dk: 0,
        other: customItemFormData.totalCostPerUnit
      };

      const itemData = {
        project_quote_line_id: selectedLineForItems,
        source_type: 'custom',
        title: customItemFormData.title,
        qty: customItemFormData.qty,
        unit: customItemFormData.unit,
        cost_breakdown_json: costBreakdown,
        cost_total_per_unit: customItemFormData.totalCostPerUnit
      };

      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .insert(itemData);

      if (error) throw error;

      toast({
        title: "Custom item tilføjet",
        description: `${customItemFormData.title} er tilføjet til linjen`,
      });

      setShowCustomItemModal(false);
      setSelectedLineForItems(null);
      setCustomItemFormData({ title: '', qty: 1, unit: 'stk', totalCostPerUnit: 0 });
      loadQuoteData();
    } catch (error) {
      console.error('Error adding custom item:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved tilføjelse",
        variant: "destructive",
      });
    }
  };

  const openQuickAdd = (lineId: string, cat: QuickCategory) => {
    const def = QUICK_DEFAULTS[cat];
    setSelectedLineForItems(lineId);
    setQuickAddCategory(cat);
    setQuickAddForm({
      title: def.title,
      qty: 1,
      unit: def.unit,
      pricePerUnit: def.pricePerUnit,
    });
    setQuickAddOpen(true);
  };

  const handleQuickAddSubmit = async () => {
    if (!selectedLineForItems || !quickAddCategory) return;
    if (!quickAddForm.title.trim()) {
      toast({ title: 'Fejl', description: 'Beskrivelse er påkrævet', variant: 'destructive' });
      return;
    }
    if (quickAddForm.qty <= 0) {
      toast({ title: 'Ugyldigt antal', description: 'Antal skal være > 0', variant: 'destructive' });
      return;
    }
    if (quickAddForm.pricePerUnit < 0) {
      toast({ title: 'Ugyldig pris', description: 'Pris kan ikke være negativ', variant: 'destructive' });
      return;
    }
    const def = QUICK_DEFAULTS[quickAddCategory];
    const breakdown = {
      materials: 0,
      material_transport: 0,
      product_transport: 0,
      labor_production: 0,
      labor_dk: 0,
      other: 0,
      [def.costSlot]: quickAddForm.pricePerUnit,
    };
    try {
      setQuickAddSavingItem(true);
      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .insert({
          project_quote_line_id: selectedLineForItems,
          source_type: 'custom',
          title: quickAddForm.title.trim(),
          qty: quickAddForm.qty,
          unit: quickAddForm.unit.trim() || def.unit,
          cost_breakdown_json: breakdown,
          cost_total_per_unit: quickAddForm.pricePerUnit,
        });
      if (error) throw error;
      toast({ title: `${def.label} tilføjet`, description: quickAddForm.title.trim() });
      setQuickAddOpen(false);
      setQuickAddCategory(null);
      setSelectedLineForItems(null);
      loadQuoteData();
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke tilføje item', variant: 'destructive' });
    } finally {
      setQuickAddSavingItem(false);
    }
  };

  // ── Image / render helpers ───────────────────────────────────────────────
  const lineEffectiveImageUrl = (line: QuoteLine): string | null => {
    if (line.activeImageSource === 'custom') return line.customImageUrl ?? null;
    if (line.activeImageSource === 'render') return line.renderImageUrl ?? null;
    if (line.activeImageSource === 'none') return null;
    // Fallback: foretræk custom > render
    return line.customImageUrl || line.renderImageUrl || null;
  };

  const updateLineFields = async (lineId: string, updates: Record<string, any>) => {
    const { error } = await supabase
      .from('project_quote_lines_2026_01_16_23_00')
      .update(updates)
      .eq('id', lineId);
    if (error) throw error;
  };

  const setLineImageSource = async (lineId: string, source: ImageSource) => {
    try {
      await updateLineFields(lineId, { active_image_source: source });
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, activeImageSource: source } : l));
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke skifte billede-kilde', variant: 'destructive' });
    }
  };

  // Lokal state for tekstfelter på linje (save-on-blur)
  const [lineFieldEdits, setLineFieldEdits] = useState<Record<string, Record<string, string>>>({});
  const setLineFieldLocal = (lineId: string, field: string, value: string) => {
    setLineFieldEdits(prev => ({ ...prev, [lineId]: { ...(prev[lineId] || {}), [field]: value } }));
  };
  const saveLineTextField = async (lineId: string, field: string, dbColumn: string, extraUpdates: Record<string, any> = {}) => {
    const localVal = lineFieldEdits[lineId]?.[field];
    if (localVal === undefined) return;
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    const stored = (line as any)[field] ?? '';
    if (localVal === stored) return;
    try {
      await updateLineFields(lineId, { [dbColumn]: localVal || null, ...extraUpdates });
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: localVal || null, ...Object.fromEntries(Object.entries(extraUpdates).map(([k, v]) => [
        k === 'living_description_edited' ? 'livingDescriptionEdited' : k,
        v,
      ])) } as any : l));
      setLineFieldEdits(prev => {
        const next = { ...prev };
        if (next[lineId]) {
          const lineEdits = { ...next[lineId] };
          delete lineEdits[field];
          if (Object.keys(lineEdits).length === 0) delete next[lineId];
          else next[lineId] = lineEdits;
        }
        return next;
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: `Kunne ikke gemme ${field}`, variant: 'destructive' });
    }
  };

  // Custom-billede upload
  const [uploadingImageLineId, setUploadingImageLineId] = useState<string | null>(null);
  const uploadCustomImage = async (lineId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Fejl', description: 'Kun billed-filer er tilladt', variant: 'destructive' });
      return;
    }
    if (!quote?.id) return;
    try {
      setUploadingImageLineId(lineId);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${quote.id}/${lineId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('quote-custom-images').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('quote-custom-images').getPublicUrl(path);
      await updateLineFields(lineId, { custom_image_url: publicUrl });
      // DB-trigger sætter automatisk active_image_source = 'custom' + custom_image_uploaded_at
      toast({ title: 'Billede uploadet' });
      loadQuoteData();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Fejl', description: err?.message || 'Upload fejlede', variant: 'destructive' });
    } finally {
      setUploadingImageLineId(null);
    }
  };

  const deleteCustomImage = async (lineId: string) => {
    try {
      await updateLineFields(lineId, { custom_image_url: null, custom_image_caption: null });
      // Skift kilde tilbage til render hvis muligt, ellers none
      const line = lines.find(l => l.id === lineId);
      const newSource: ImageSource = line?.renderImageUrl ? 'render' : 'none';
      await updateLineFields(lineId, { active_image_source: newSource });
      toast({ title: 'Eget billede fjernet' });
      loadQuoteData();
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke fjerne billede', variant: 'destructive' });
    }
  };

  // Living description AI-generation
  const [generatingLivingDesc, setGeneratingLivingDesc] = useState<string | null>(null);
  const generateLivingDescription = async (lineId: string) => {
    try {
      setGeneratingLivingDesc(lineId);
      const { data, error } = await supabase.functions.invoke('generate-living-description', {
        body: { quote_line_id: lineId },
      });
      if (error) throw error;
      const generated = (data as any)?.living_description;
      if (!generated) throw new Error('Tomt svar fra edge function');
      setLines(prev => prev.map(l => l.id === lineId ? {
        ...l,
        livingDescription: generated,
        livingDescriptionGeneratedAt: (data as any)?.generated_at ?? new Date().toISOString(),
        livingDescriptionEdited: false,
      } : l));
      // Ryd lokal edit-state så den nye værdi bliver vist
      setLineFieldEdits(prev => {
        const next = { ...prev };
        if (next[lineId]) {
          const lineEdits = { ...next[lineId] };
          delete lineEdits.livingDescription;
          if (Object.keys(lineEdits).length === 0) delete next[lineId];
          else next[lineId] = lineEdits;
        }
        return next;
      });
      toast({ title: 'Levende beskrivelse genereret' });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Fejl',
        description: err?.message || 'Kunne ikke generere beskrivelse — er edge function deployet og GEMINI_API_KEY sat?',
        variant: 'destructive',
      });
    } finally {
      setGeneratingLivingDesc(null);
    }
  };

  const triggerRenderGeneration = async (lineId: string) => {
    try {
      await updateLineFields(lineId, { render_status: 'pending', render_error: null });
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, renderStatus: 'pending', renderError: null } : l));
      toast({ title: 'Render-generering startet', description: 'Tjekker status hvert 5. sekund' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke starte generering', variant: 'destructive' });
    }
  };

  // Polling: refetch quote-data hvert 5. sekund så længe der er linjer i pending/generating
  useEffect(() => {
    const inFlight = lines.some(l => l.renderStatus === 'pending' || l.renderStatus === 'generating');
    if (!inFlight) return;
    const t = setInterval(() => loadQuoteData(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map(l => `${l.id}:${l.renderStatus}`).join('|')]);

  // ── Inline qty-save (onBlur fra qty-input) ───────────────────────────────
  const saveItemQty = async (itemId: string) => {
    const newQty = itemQtyEdits[itemId];
    if (newQty === undefined) return;
    if (newQty <= 0) {
      toast({ title: 'Ugyldigt antal', description: 'Antal skal være > 0', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update({ qty: newQty })
        .eq('id', itemId);
      if (error) throw error;
      // Fjern fra local edit-state og genindlæs
      setItemQtyEdits(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      loadQuoteData();
    } catch (err) {
      console.error(err);
      toast({ title: 'Fejl', description: 'Kunne ikke opdatere antal', variant: 'destructive' });
    }
  };

  const checkForProductUpdates = async () => {
    if (!lines.length) return;
    
    setCheckingUpdates(true);
    try {
      const productItems = lines.flatMap(line => 
        line.items.filter(item => item.sourceType === 'project_product' && item.projectProductId)
      );
      
      if (productItems.length === 0) return;
      
      const productIds = productItems.map(item => item.projectProductId).filter(Boolean);
      
      const { data: currentProducts, error } = await supabase
        .from('project_products_2026_01_15_12_49')
        .select('*')
        .in('id', productIds);
        
      if (error) throw error;
      
      const updates: {[key: string]: any} = {};
      
      // Sammenlign snapshot med aktuelle priser fra produktdata
      for (const item of productItems) {
        const currentProduct = currentProducts?.find(p => p.id === item.projectProductId);
        if (currentProduct) {
          // Beregn aktuelle costs fra produktets lines (samme logik som i opdater pris)
          let currentMaterialCost = 0;
          let currentMaterialTransport = 0;
          let currentProductTransport = 0;
          let currentLaborProduction = 0;
          let currentLaborDk = 0;
          let currentOther = 0;
          
          // Hent detaljerede data for produktet
          const { data: detailedProduct } = await supabase
            .from('project_products_2026_01_15_12_49')
            .select(`
              project_product_material_lines_2026_01_15_12_49(
                qty, unit_cost_override,
                project_materials_2026_01_15_06_45(unit_price, transport_estimated_cost)
              ),
              project_product_labor_lines_2026_01_15_12_49(qty, unit_cost, labor_type),
              project_product_transport_lines_2026_01_15_12_49(qty, unit_cost),
              project_product_other_cost_lines_2026_01_15_12_49(qty, unit_cost)
            `)
            .eq('id', item.projectProductId)
            .single();
          
          if (detailedProduct) {
            // Beregn materialer
            detailedProduct.project_product_material_lines_2026_01_15_12_49?.forEach(line => {
              const qty = line.qty || 0;
              const unitCost = line.unit_cost_override || line.project_materials_2026_01_15_06_45?.unit_price || 0;
              currentMaterialCost += qty * unitCost;
              currentMaterialTransport += line.project_materials_2026_01_15_06_45?.transport_estimated_cost || 0;
            });
            
            // Beregn labor
            detailedProduct.project_product_labor_lines_2026_01_15_12_49?.forEach(line => {
              const lineCost = (line.qty || 0) * (line.unit_cost || 0);
              if (line.labor_type === 'production') currentLaborProduction += lineCost;
              else if (line.labor_type === 'dk_installation') currentLaborDk += lineCost;
              else currentOther += lineCost;
            });
            
            // Beregn transport
            currentProductTransport = detailedProduct.project_product_transport_lines_2026_01_15_12_49?.reduce((sum, line) => 
              sum + ((line.qty || 0) * (line.unit_cost || 0)), 0) || 0;
            
            // Beregn other costs
            currentOther += detailedProduct.project_product_other_cost_lines_2026_01_15_12_49?.reduce((sum, line) => 
              sum + ((line.qty || 0) * (line.unit_cost || 0)), 0) || 0;
          }
          
          const currentTotalCost = currentMaterialCost + currentMaterialTransport + currentProductTransport + 
                                 currentLaborProduction + currentLaborDk + currentOther;
          
          // Sammenlign med snapshot
          if (Math.abs(currentTotalCost - item.costTotalPerUnit) > 0.01) {
            updates[item.id] = {
              oldCost: item.costTotalPerUnit,
              newCost: currentTotalCost,
              product: currentProduct,
              currentBreakdown: {
                materials: currentMaterialCost,
                material_transport: currentMaterialTransport,
                product_transport: currentProductTransport,
                labor_production: currentLaborProduction,
                labor_dk: currentLaborDk,
                other: currentOther
              }
            };
          }
        }
      }
      
      setProductUpdates(updates);
      
      if (Object.keys(updates).length > 0 && showUpdateWarnings) {
        toast({
          title: "Produktpriser er ændret",
          description: `${Object.keys(updates).length} produkter har ændrede priser. Tjek for opdateringer.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking product updates:', error);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const updateProductItem = async (itemId: string) => {
    const update = productUpdates[itemId];
    if (!update) return;
    
    try {
      const newCostBreakdown = {
        materials: update.product.total_material_cost || 0,
        transport: update.product.total_transport_cost || 0,
        labor_production: update.product.total_labor_production_cost || 0,
        labor_dk: update.product.total_labor_dk_cost || 0,
        other: update.product.total_other_cost || 0
      };
      
      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update({
          cost_breakdown_json: newCostBreakdown,
          cost_total_per_unit: update.newCost
        })
        .eq('id', itemId);
        
      if (error) throw error;
      
      toast({
        title: "Produkt opdateret",
        description: "Produktprisen er blevet opdateret til den nyeste version",
      });
      
      // Fjern fra updates
      const newUpdates = { ...productUpdates };
      delete newUpdates[itemId];
      setProductUpdates(newUpdates);
      
      loadQuoteData();
    } catch (error) {
      console.error('Error updating product item:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere produktet",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    console.log('handleDeleteItem called with itemId:', itemId);
    setItemToDelete(itemId);
    setShowDeleteItemConfirm(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    
    console.log('User confirmed delete, proceeding with itemId:', itemToDelete);
    setShowDeleteItemConfirm(false);
    setDeletingItem(itemToDelete);
    try {
      console.log('Calling supabase delete...');
      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .delete()
        .eq('id', itemToDelete);
        
      console.log('Supabase delete response:', { error });
      if (error) throw error;
      
      console.log('Delete successful, showing toast...');
      toast({
        title: "Item slettet",
        description: "Item er blevet fjernet fra linjen",
      });
      
      console.log('Reloading quote data...');
      loadQuoteData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke slette item",
        variant: "destructive",
      });
    } finally {
      console.log('Setting deletingItem to null');
      setDeletingItem(null);
      setItemToDelete(null);
    }
  };

  const startEditPricing = (line: QuoteLine) => {
    // Hvis pricing mangler (fx linje oprettet via AI uden default pricing),
    // initialiser form med husets default (markup 25%) så brugeren kan gemme
    // og få en pricing-række oprettet via upsert.
    if (line.pricing) {
      setPricingFormData({
        pricingMode: line.pricing.pricingMode,
        markupPct: line.pricing.markupPct || 25,
        grossMarginPct: line.pricing.grossMarginPct || 20,
        targetUnitPrice: line.pricing.targetUnitPrice || 0,
        riskPerUnit: line.pricing.riskPerUnit,
        profitByCategory: line.pricing.profitByCategory || {
          materials: 30,
          material_transport: 30,
          product_transport: 30,
          labor_production: 30,
          labor_dk: 30,
          other: 30
        }
      });
    } else {
      setPricingFormData({
        pricingMode: 'markup_pct',
        markupPct: 25,
        grossMarginPct: 20,
        targetUnitPrice: 0,
        riskPerUnit: 0,
        profitByCategory: {
          materials: 30,
          material_transport: 30,
          product_transport: 30,
          labor_production: 30,
          labor_dk: 30,
          other: 30
        }
      });
    }
    setEditingPricing(line.id);
  };

  const startEditLine = (line: QuoteLine) => {
    setEditLineFormData({
      title: line.title,
      description: line.description || '',
      quantity: line.quantity,
      unit: line.unit
    });
    setEditingLine(line.id);
  };

  const handleUpdateLine = async (lineId: string) => {
    if (!editLineFormData.title.trim()) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    if (editLineFormData.quantity <= 0) {
      toast({
        title: "Ugyldig antal",
        description: "Antal skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    if (!editLineFormData.unit.trim()) {
      toast({
        title: "Fejl",
        description: "Enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }

    setSavingLine(true);
    try {
      const updateData = {
        title: editLineFormData.title,
        description: editLineFormData.description || null,
        quantity: editLineFormData.quantity,
        unit: editLineFormData.unit
      };

      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .update(updateData)
        .eq('id', lineId);

      if (error) throw error;

      toast({
        title: "Linje opdateret",
        description: "Tilbudslinjen er blevet opdateret",
      });

      setEditingLine(null);
      loadQuoteData();
    } catch (error) {
      console.error('Error updating line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    } finally {
      setSavingLine(false);
    }
  };

  const startEditItem = (item: QuoteLineItem) => {
    setEditItemFormData({
      title: item.title,
      qty: item.qty,
      unit: item.unit,
      totalCostPerUnit: item.costTotalPerUnit || 0
    });
    setEditingItem(item.id);
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!editItemFormData.title.trim()) {
      toast({
        title: "Fejl",
        description: "Titel er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    if (editItemFormData.qty <= 0) {
      toast({
        title: "Ugyldig antal",
        description: "Antal skal være større end 0",
        variant: "destructive",
      });
      return;
    }
    
    if (!editItemFormData.unit.trim()) {
      toast({
        title: "Fejl",
        description: "Enhed er påkrævet",
        variant: "destructive",
      });
      return;
    }
    
    // Additional validation for custom items
    const item = lines.flatMap(line => line.items).find(item => item.id === itemId);
    if (item?.sourceType === 'custom' && editItemFormData.totalCostPerUnit < 0) {
      toast({
        title: "Ugyldig cost",
        description: "Total cost kan ikke være negativ",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the item to check if it's custom
      const item = lines.flatMap(line => line.items).find(item => item.id === itemId);
      
      const updateData: any = {
        title: editItemFormData.title,
        qty: editItemFormData.qty,
        unit: editItemFormData.unit
      };
      
      // If it's a custom item, also update cost_total_per_unit and cost_breakdown_json
      if (item?.sourceType === 'custom') {
        updateData.cost_total_per_unit = editItemFormData.totalCostPerUnit;
        // Bevar single-purpose kategorien hvis itemet havde én aktiv slot.
        // Ellers fall back til 'other' (legacy custom-cost adfærd).
        const existingSlots = getActiveCostSlots(item.costBreakdown);
        const targetSlot = existingSlots.length === 1 ? existingSlots[0] : 'other';
        updateData.cost_breakdown_json = {
          materials: 0,
          material_transport: 0,
          product_transport: 0,
          labor_production: 0,
          labor_dk: 0,
          other: 0,
          [targetSlot]: editItemFormData.totalCostPerUnit,
        };
      }

      const { error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Item opdateret",
        description: "Item er blevet opdateret",
      });

      setEditingItem(null);
      loadQuoteData();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering",
        variant: "destructive",
      });
    }
  };

  const handleArchiveLine = async (lineId: string) => {
    try {
      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .update({ archived: true })
        .eq('id', lineId);

      if (error) throw error;

      toast({
        title: "Linje arkiveret",
        description: "Tilbudslinjen er blevet arkiveret",
      });

      loadQuoteData();
    } catch (error) {
      console.error('Error archiving line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved arkivering af linjen",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    setLineToDelete(lineId);
    setShowDeleteLineConfirm(true);
  };

  const confirmDeleteLine = async () => {
    if (!lineToDelete) return;
    
    setShowDeleteLineConfirm(false);

    try {
      const { error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .delete()
        .eq('id', lineToDelete);

      if (error) throw error;

      toast({
        title: "Linje slettet",
        description: "Tilbudslinjen er blevet slettet permanent",
      });

      loadQuoteData();
    } catch (error) {
      console.error('Error deleting line:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved sletning af linjen",
        variant: "destructive",
      });
    } finally {
      setLineToDelete(null);
    }
  };

  const confirmArchiveInstead = async () => {
    if (!lineToDelete) return;
    
    setShowDeleteLineConfirm(false);
    await handleArchiveLine(lineToDelete);
    setLineToDelete(null);
  };

  // Helper function to update cost snapshot for a single item
  const updateItemCostSnapshot = async (itemId: string, projectProductId: string) => {
    try {
      console.log('Updating cost snapshot for item:', itemId, 'product:', projectProductId);
      
      // Fetch current product data with all cost lines
      const { data: currentProduct, error: productError } = await supabase
        .from('project_products_2026_01_15_12_49')
        .select(`
          *,
          project_product_material_lines_2026_01_15_12_49(
            qty,
            unit_cost_override,
            project_materials_2026_01_15_06_45(unit_price, transport_estimated_cost)
          ),
          project_product_labor_lines_2026_01_15_12_49(qty, unit_cost, labor_type),
          project_product_transport_lines_2026_01_15_12_49(qty, unit_cost),
          project_product_other_cost_lines_2026_01_15_12_49(qty, unit_cost)
        `)
        .eq('id', projectProductId)
        .single();
      
      if (productError) {
        console.error('Product fetch error:', productError);
        throw productError;
      }
      
      if (!currentProduct) {
        throw new Error('Product not found');
      }
      
      console.log('Product data fetched:', currentProduct.name);
      
      // Calculate current costs
      let materialCost = 0;
      let materialTransport = 0;
      let laborProductionCost = 0;
      let laborDkCost = 0;
      let transportCost = 0;
      let otherCost = 0;
      
      // Materials
      if (currentProduct.project_product_material_lines_2026_01_15_12_49) {
        currentProduct.project_product_material_lines_2026_01_15_12_49.forEach(line => {
          const qty = line.qty || 0;
          const unitCost = line.unit_cost_override || line.project_materials_2026_01_15_06_45?.unit_price || 0;
          materialCost += qty * unitCost;
          materialTransport += line.project_materials_2026_01_15_06_45?.transport_estimated_cost || 0;
        });
      }
      
      // Labor
      if (currentProduct.project_product_labor_lines_2026_01_15_12_49) {
        currentProduct.project_product_labor_lines_2026_01_15_12_49.forEach(line => {
          const lineCost = (line.qty || 0) * (line.unit_cost || 0);
          if (line.labor_type === 'production') laborProductionCost += lineCost;
          else if (line.labor_type === 'dk_installation') laborDkCost += lineCost;
          else otherCost += lineCost;
        });
      }
      
      // Transport
      if (currentProduct.project_product_transport_lines_2026_01_15_12_49) {
        transportCost = currentProduct.project_product_transport_lines_2026_01_15_12_49.reduce((sum, line) => 
          sum + ((line.qty || 0) * (line.unit_cost || 0)), 0);
      }
      
      // Other costs
      if (currentProduct.project_product_other_cost_lines_2026_01_15_12_49) {
        otherCost += currentProduct.project_product_other_cost_lines_2026_01_15_12_49.reduce((sum, line) => 
          sum + ((line.qty || 0) * (line.unit_cost || 0)), 0);
      }
      
      const newCostBreakdown = {
        materials: materialCost,
        material_transport: materialTransport,
        product_transport: transportCost,
        labor_production: laborProductionCost,
        labor_dk: laborDkCost,
        other: otherCost
      };
      
      const newTotalCost = Object.values(newCostBreakdown).reduce((sum, cost) => sum + cost, 0);
      
      console.log('Calculated new cost:', newTotalCost, 'breakdown:', newCostBreakdown);
      
      // Update item in database
      const { error: updateError } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .update({
          cost_breakdown_json: newCostBreakdown,
          cost_total_per_unit: newTotalCost
        })
        .eq('id', itemId);
        
      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
      
      console.log('Successfully updated item:', itemId);
      return { success: true, newTotalCost };
    } catch (error) {
      console.error('Error updating item cost snapshot:', error);
      return { success: false, error };
    }
  };

  // Update all items with 0 kr cost in a line
  const updateAllZeroCostItemsInLine = async (lineId: string) => {
    try {
      const line = lines.find(l => l.id === lineId);
      if (!line) return;
      
      // Find all product items with 0 or null cost
      const zeroCostItems = line.items.filter(
        item => item.sourceType === 'project_product' && 
                (item.costTotalPerUnit === 0 || item.costTotalPerUnit === null || !item.costTotalPerUnit) && 
                item.projectProductId
      );
      
      console.log('Found zero cost items:', zeroCostItems.length, zeroCostItems.map(i => ({ title: i.title, cost: i.costTotalPerUnit })));
      
      if (zeroCostItems.length === 0) {
        toast({
          title: "Ingen items at opdatere",
          description: "Alle items har allerede priser",
        });
        return;
      }
      let successCount = 0;
      let failCount = 0;
      
      // Update each item
      for (const item of zeroCostItems) {
        const result = await updateItemCostSnapshot(item.id, item.projectProductId!);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      toast({
        title: "Opdatering fuldført",
        description: `${successCount} items opdateret${failCount > 0 ? `, ${failCount} fejlede` : ''}`,
      });
      
      // Reload data to show updated prices
      loadQuoteData();
    } catch (error) {
      console.error('Error updating zero cost items:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering af items",
        variant: "destructive",
      });
    }
  };

  // Update ALL product prices in the entire quote
  const updateAllProductPrices = async () => {
    try {
      setUpdatingAllPrices(true);
      setShowUpdateAllConfirm(false);
      
      // Find all product items across all lines
      const allProductItems = lines.flatMap(line => 
        line.items.filter(item => 
          item.sourceType === 'project_product' && item.projectProductId
        )
      );
      
      console.log('Updating all product prices. Total items:', allProductItems.length);
      
      if (allProductItems.length === 0) {
        toast({
          title: "Ingen produkter at opdatere",
          description: "Der er ingen produkter i tilbuddet",
        });
        setUpdatingAllPrices(false);
        return;
      }
      
      setUpdateProgress({ current: 0, total: allProductItems.length });
      
      let successCount = 0;
      let failCount = 0;
      
      // Update each item with progress tracking
      for (let i = 0; i < allProductItems.length; i++) {
        const item = allProductItems[i];
        setUpdateProgress({ current: i + 1, total: allProductItems.length });
        
        const result = await updateItemCostSnapshot(item.id, item.projectProductId!);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      toast({
        title: "Opdatering fuldført",
        description: `${successCount} produkter opdateret${failCount > 0 ? `, ${failCount} fejlede` : ''}`,
      });
      
      // Reload data to show updated prices
      await loadQuoteData();
    } catch (error) {
      console.error('Error updating all product prices:', error);
      toast({
        title: "Fejl",
        description: "Der opstod en fejl ved opdatering af produktpriser",
        variant: "destructive",
      });
    } finally {
      setUpdatingAllPrices(false);
      setUpdateProgress({ current: 0, total: 0 });
    }
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Vælg et projekt</h2>
            <p className="text-muted-foreground">Du skal vælge et projekt for at se tilbud.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">Indlæser tilbud...</div>
        </div>
      </Layout>
    );
  }

  if (!quote) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Tilbud ikke fundet</h2>
            <Button onClick={() => navigate('/project/quotes')}>
              Tilbage til tilbud
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const buildQuotePdfBlob = async (): Promise<Blob | null> => {
    if (!quote || !activeProject) return null;
    const pdfLines = lines.map(line => {
      const totals = calculateLineTotals(line);
      return {
        title: line.title,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        sellingPricePerUnit: totals.sellingPricePerUnit,
        totalSellingPrice: totals.totalSellingPrice,
      };
    });
    const formatDk = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleDateString('da-DK') : '';
    const date = formatDk(quote.created_at);
    const validUntil = quote.valid_until ? formatDk(quote.valid_until) : null;
    const linkedCompany = quote.company_id ? companies.find(c => c.id === quote.company_id) : undefined;
    const recipientName = quote.recipient_name ?? quote.customer_contact_name ?? linkedCompany?.defaultContactName ?? null;
    const customer = linkedCompany
      ? {
          name: linkedCompany.name,
          cvr: linkedCompany.cvr ?? null,
          addressLine1: linkedCompany.addressLine1 ?? null,
          addressZip: linkedCompany.addressZip ?? null,
          addressCity: linkedCompany.addressCity ?? null,
          contactName: recipientName,
        }
      : activeProject.customer
        ? { name: activeProject.customer, contactName: recipientName }
        : { contactName: recipientName };
    const quoteDateStr = quote.resolved_quote_date ? formatDk(quote.resolved_quote_date) : date;
    return await pdf(
      <QuotePDF
        projectName={activeProject.name}
        quoteTitle={quote.title}
        quoteNumber={quote.quote_number}
        quoteDate={quoteDateStr}
        validUntil={validUntil}
        lines={pdfLines}
        customer={customer}
        paymentTerms={quote.resolved_payment_terms ?? null}
        deliveryPeriod={quote.resolved_delivery_period ?? null}
        deliveryNote={quote.delivery_note ?? null}
        reservations={quote.resolved_reservations ?? null}
        paymentTermsTemplate={quote.resolved_payment_terms_template ?? '50_50_levering'}
        introText={quote.intro_text ?? null}
        notes={quote.notes ?? null}
        createdBy={{
          name: quote.created_by_name_resolved ?? quote.created_by_name ?? null,
          email: quote.created_by_email_resolved ?? quote.created_by_email ?? null,
          phone: quote.created_by_phone_resolved ?? quote.created_by_phone ?? null,
        }}
      />
    ).toBlob();
  };

  const handlePreviewPDF = async () => {
    const blob = await buildQuotePdfBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Fri object-URL'en efter et minut — browseren har den indlæst i tab'en på det tidspunkt.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleDownloadPDF = async () => {
    if (!quote || !activeProject) return;
    const blob = await buildQuotePdfBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tilbud-${activeProject.name}-${quote.quote_number}.pdf`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download bilags-PDF (kundevendt med billeder + levende beskrivelser)
  const handleDownloadAppendix = async () => {
    if (!quote || !activeProject) return;
    const formatDk = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('da-DK') : '';
    const date = formatDk(quote.created_at);
    const linkedCompany = quote.company_id ? companies.find(c => c.id === quote.company_id) : undefined;
    const customer = linkedCompany
      ? {
          name: linkedCompany.name,
          cvr: linkedCompany.cvr ?? null,
          contactName: quote.customer_contact_name ?? linkedCompany.defaultContactName ?? null,
        }
      : activeProject.customer
        ? { name: activeProject.customer, contactName: quote.customer_contact_name ?? null }
        : { contactName: quote.customer_contact_name ?? null };

    const sortedLines = [...lines].sort((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) return a.displayOrder - b.displayOrder;
      if (a.displayOrder !== undefined) return -1;
      if (b.displayOrder !== undefined) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const appendixLines = sortedLines.map(line => ({
      title: line.title,
      description: line.description ?? null,
      livingDescription: line.livingDescription ?? null,
      imageUrl: lineEffectiveImageUrl(line),
      imageCaption: line.activeImageSource === 'custom' ? (line.customImageCaption ?? null) : null,
    }));

    const blob = await pdf(
      <QuoteAppendixPDF
        projectName={activeProject.name}
        quoteTitle={quote.title}
        quoteNumber={quote.quote_number}
        quoteDate={date}
        customer={customer}
        lines={appendixLines}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilag-${activeProject.name}-${quote.quote_number}.pdf`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate totals for entire quote
  const quoteTotals = lines.reduce((acc, line) => {
    const lineTotals = calculateLineTotals(line);
    const qty = line.quantity;
    
    return {
      totalSellingPrice: acc.totalSellingPrice + lineTotals.totalSellingPrice,
      totalProfit: acc.totalProfit + lineTotals.totalProfit,
      totalCost: acc.totalCost + (lineTotals.totalCostPerUnit * qty),
      // Cost breakdown totals
      costBreakdown: {
        materials: acc.costBreakdown.materials + (lineTotals.costBreakdown.materials * qty),
        material_transport: acc.costBreakdown.material_transport + (lineTotals.costBreakdown.material_transport * qty),
        product_transport: acc.costBreakdown.product_transport + (lineTotals.costBreakdown.product_transport * qty),
        labor_production: acc.costBreakdown.labor_production + (lineTotals.costBreakdown.labor_production * qty),
        labor_dk: acc.costBreakdown.labor_dk + (lineTotals.costBreakdown.labor_dk * qty),
        other: acc.costBreakdown.other + (lineTotals.costBreakdown.other * qty)
      }
    };
  }, { 
    totalSellingPrice: 0, 
    totalProfit: 0, 
    totalCost: 0,
    costBreakdown: {
      materials: 0,
      material_transport: 0,
      product_transport: 0,
      labor_production: 0,
      labor_dk: 0,
      other: 0
    }
  });

  const averageDbPercent = quoteTotals.totalSellingPrice > 0 ? 
    (quoteTotals.totalProfit / quoteTotals.totalSellingPrice) * 100 : 0;
  
  // Calculate custom costs total (sum of all cost breakdown items)
  const customCostsTotal = Object.values(quoteTotals.costBreakdown).reduce((sum, cost) => sum + cost, 0);

  // Calculate risk total (Q-V1-11)
  const riskTotal = lines.reduce((sum, line) => {
    const lineTotals = calculateLineTotals(line);
    return sum + (lineTotals.riskPerUnit * line.quantity);
  }, 0);

  // Calculate base cost total (Q-V1-11)
  const baseCostTotal = customCostsTotal;
  const totalCostInclRisk = baseCostTotal + riskTotal;

  // Build product summary (Q-V1-09)
  const buildProductSummary = (allLines: typeof lines) => {
    // Collect all items from all lines
    const allItems = allLines.flatMap(line => line.items || []);
    
    // Filter only project_product items
    const productItems = allItems.filter(item => item.sourceType === 'project_product');
    
    // Group by project_product_id (fallback to title)
    const grouped = productItems.reduce((acc, item) => {
      const key = item.projectProductId || item.title;
      if (!acc[key]) {
        acc[key] = {
          title: item.title,
          projectProductId: item.projectProductId,
          unit: item.unit,
          totalQty: 0,
          totalCost: 0
        };
      }
      acc[key].totalQty += item.qty;
      acc[key].totalCost += item.costTotalPerUnit * item.qty;
      return acc;
    }, {} as Record<string, { title: string; projectProductId: string | null; unit: string; totalQty: number; totalCost: number }>);
    
    // Convert to array and sort by total cost DESC
    return Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost);
  };


  const productSummary = buildProductSummary(lines);

  // Build material summary (Q-V1-10)
  const buildMaterialSummary = (
    quoteLines: typeof lines,
    materialLines: typeof productMaterialLines,
    materials: typeof projectMaterials
  ) => {
    // Step 1: Find relevant quote items (project_product only)
    const allItems = quoteLines.flatMap(line => line.items || []);
    const productItems = allItems.filter(
      item => item.sourceType === 'project_product' && item.projectProductId
    );

    if (productItems.length === 0) return [];

    // Step 2 & 3: Calculate material quantities for each quote item
    const materialTotals: Record<string, {
      materialId: string;
      name: string;
      category: string;
      unit: string;
      totalQty: number;
      totalCost: number;
    }> = {};

    productItems.forEach(quoteItem => {
      // Find material lines for this product
      const productMaterialLines = materialLines.filter(
        ml => ml.project_product_id === quoteItem.projectProductId
      );

      productMaterialLines.forEach(materialLine => {
        const material = materials.find(m => m.id === materialLine.project_material_id);
        if (!material) return;

        // Calculate quantities
        const materialQtyPerProduct = materialLine.qty || 0;
        const quoteItemQty = quoteItem.qty || 0;
        const materialTotalQtyForItem = materialQtyPerProduct * quoteItemQty;

        // Calculate cost
        const materialUnitCost = materialLine.unit_cost_override ?? material.unit_price ?? 0;
        const materialTotalCostForItem = materialTotalQtyForItem * materialUnitCost;

        // Group by material ID
        const key = material.id;
        if (!materialTotals[key]) {
          materialTotals[key] = {
            materialId: material.id,
            name: material.name || 'Unavngivet materiale',
            category: material.category || 'Ingen kategori',
            unit: material.unit || 'stk',
            totalQty: 0,
            totalCost: 0
          };
        }

        materialTotals[key].totalQty += materialTotalQtyForItem;
        materialTotals[key].totalCost += materialTotalCostForItem;
      });
    });

    // Convert to array and sort by total cost DESC
    return Object.values(materialTotals).sort((a, b) => b.totalCost - a.totalCost);
  };

  const materialSummary = buildMaterialSummary(lines, productMaterialLines, projectMaterials);

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/project/quotes')}
              >
                ← Tilbage
              </Button>
              <h1 className="text-3xl font-bold">{quote.title}</h1>
              <Badge variant="secondary">{quote.quote_number}</Badge>
            </div>
            <p className="text-muted-foreground">Projekt: {activeProject.name}</p>
            
            {/* Related Budgets */}
            {relatedBudgets.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Relaterede budgetter:</span>
                  {relatedBudgets.map((budget) => (
                    <Button
                      key={budget.id}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/project/budgets/${budget.id}`)}
                      className="gap-2 h-7 text-xs"
                    >
                      <FileText className="h-3 w-3" />
                      {budget.budget_number}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {/* Kontekstuelle primære knapper */}
            {Object.keys(productUpdates).length > 0 && (
              <Button
                onClick={async () => {
                  for (const itemId of Object.keys(productUpdates)) {
                    await updateProductItem(itemId);
                  }
                }}
                variant="default"
                size="sm"
                className="gap-2"
              >
                Opdater alle priser ({Object.keys(productUpdates).length})
              </Button>
            )}
            {updatingAllPrices && (
              <Button variant="default" size="sm" disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opdaterer {updateProgress.current}/{updateProgress.total}...
              </Button>
            )}
            {quote?.status === 'accepted' && (
              <Button
                onClick={transferToBudget}
                disabled={transferringToBudget}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {transferringToBudget ? 'Overfører...' : 'Overfør til budget'}
              </Button>
            )}

            {/* Faste primære knapper */}
            <Button
              onClick={handlePreviewPDF}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={lines.length === 0}
              title="Åbn tilbuds-PDF i ny fane uden at downloade"
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={lines.length === 0}
            >
              <Download className="h-4 w-4" />
              Tilbuds-PDF
            </Button>
            <Button
              onClick={handleDownloadAppendix}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={lines.length === 0}
              title="Kundevendt bilag med billeder og levende beskrivelser"
            >
              <Download className="h-4 w-4" />
              Bilag
            </Button>
            <Button onClick={() => setShowAddLineModal(true)} className="gap-2" disabled={isReadOnly}>
              <Plus className="h-4 w-4" />
              Tilføj linje
            </Button>

            {/* Mere-dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <MoreHorizontal className="h-4 w-4" />
                  Mere
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={checkForProductUpdates} disabled={checkingUpdates}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {checkingUpdates ? 'Tjekker opdateringer…' : 'Tjek opdateringer'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowUpdateAllConfirm(true)}
                  disabled={updatingAllPrices || lines.length === 0}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Opdater alle produktpriser
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowUpdateWarnings(!showUpdateWarnings)}>
                  {showUpdateWarnings ? '✓ Advarsler vises' : 'Vis advarsler'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Låst-banner */}
        {isReadOnly && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <Lock className="h-4 w-4" />
              <span className="font-medium">Tilbuddet er låst</span>
              {quote?.locked_at && (
                <span className="text-amber-700">
                  · {new Date(quote.locked_at).toLocaleDateString('da-DK')}
                </span>
              )}
              <span className="text-amber-700">— alle felter er read-only.</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm('Lås tilbuddet op? Tekstfelter forbliver som de er — brug "Reset til standard" pr. felt hvis du vil have dem live igen.')) {
                  updateQuoteMetadata({ is_locked: false });
                }
              }}
              disabled={savingMetadata}
            >
              <Unlock className="h-3 w-3 mr-1" /> Lås op
            </Button>
          </div>
        )}

        {/* Sticky totals-bar */}
        <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-b">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">{quote.quote_number || '—'}</span>
              <Badge variant={quote?.status === 'sent' ? 'default' : 'secondary'}>
                {quote?.status === 'draft' ? 'Kladde' :
                 quote?.status === 'sent' ? 'Sendt' :
                 quote?.status === 'accepted' ? 'Accepteret' :
                 quote?.status === 'rejected' ? 'Afvist' : quote?.status}
              </Badge>
              {quote?.is_locked && (
                <Badge variant="destructive" className="gap-1">
                  <Lock className="h-3 w-3" /> Låst
                </Badge>
              )}
              {(() => {
                const linkedCo = quote?.company_id ? companies.find(c => c.id === quote.company_id) : null;
                const customerName = linkedCo?.name || activeProject?.customer;
                return customerName ? <span className="text-muted-foreground">· {customerName}</span> : null;
              })()}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Ekskl. moms</div>
                <div className="font-medium">{formatCurrency(quoteTotals.totalSellingPrice)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Inkl. moms</div>
                <div className="font-semibold">{formatCurrency(Math.round(quoteTotals.totalSellingPrice * 1.25))}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Bruttomargin</div>
                <div className={`font-medium ${averageDbPercent >= 25 ? 'text-emerald-600' : averageDbPercent >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                  {averageDbPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tilbudsdetaljer Section — vises på PDF */}
        <Card>
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {detailsOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <CardTitle className="text-lg shrink-0">Tilbudsdetaljer</CardTitle>
                    {!detailsOpen && (() => {
                      const co = quote?.company_id ? companies.find(c => c.id === quote.company_id) : null;
                      const fmtDk = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('da-DK') : '';
                      const parts = [
                        co?.name,
                        quote?.resolved_payment_terms,
                        quote?.valid_until ? `Gyldig til ${fmtDk(quote.valid_until)}` : null,
                        quote?.created_by_name,
                      ].filter(Boolean);
                      return parts.length > 0 ? (
                        <span className="text-sm text-muted-foreground truncate">▸ {parts.join(' · ')}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">▸ Klik for at udfylde</span>
                      );
                    })()}
                  </div>
                  {!detailsOpen && (
                    <span className="text-xs text-muted-foreground hidden md:inline shrink-0">Kunde · Vilkår · Tilbudsgiver</span>
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Kunde */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kunde</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_id">Firma</Label>
                  <div className="flex gap-2">
                    <Select
                      value={quote?.company_id || ''}
                      onValueChange={(v) => {
                        const company = companies.find(c => c.id === v);
                        const newCompanyId = v || null;
                        // Skift firma → ryd recipient_contact_id (kontakten tilhørte gammelt firma).
                        const updates: Record<string, any> = {
                          company_id: newCompanyId,
                          customer_contact_name: quote?.customer_contact_name || company?.defaultContactName || null,
                        };
                        if (newCompanyId !== quote?.company_id) {
                          updates.recipient_contact_id = null;
                        }
                        updateQuoteMetadata(updates);
                      }}
                      disabled={savingMetadata || isReadOnly}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Vælg kunde" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies
                          .filter((c: Company) => c.isCustomer)
                          .map((c: Company) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}{c.cvr ? ` · CVR ${c.cvr}` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {quote?.company_id && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={openEditCompanyDialog}
                        disabled={savingMetadata || isReadOnly}
                        title="Rediger valgte kunde"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={openNewCompanyDialog}
                      disabled={savingMetadata || isReadOnly}
                      title="Opret ny kunde"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {quote?.company_id && (() => {
                    const c = companies.find(co => co.id === quote.company_id);
                    if (!c) return null;
                    const lines = [
                      c.cvr ? `CVR ${c.cvr}` : null,
                      [c.addressLine1, c.addressZip && c.addressCity ? `${c.addressZip} ${c.addressCity}` : c.addressCity]
                        .filter(Boolean).join(', ') || null,
                    ].filter(Boolean);
                    return lines.length ? (
                      <div className="text-xs text-muted-foreground">{lines.join(' · ')}</div>
                    ) : null;
                  })()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient_contact_id">Modtager-kontakt</Label>
                  <Select
                    value={quote?.recipient_contact_id ?? ''}
                    onValueChange={(contactId) => {
                      const contact = companyContacts.find(c => c.id === contactId);
                      if (!contact) return;
                      updateQuoteMetadata({
                        recipient_contact_id: contact.id,
                        customer_contact_name: contact.name,
                      });
                    }}
                    disabled={savingMetadata || isReadOnly || !quote?.company_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={quote?.company_id ? 'Vælg kontaktperson' : 'Vælg firma først'} />
                    </SelectTrigger>
                    <SelectContent>
                      {companyContacts.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Ingen kontakter på dette firma endnu
                        </div>
                      ) : (
                        companyContacts.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{c.role ? ` · ${c.role}` : ''}{c.email ? ` · ${c.email}` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="customer_contact_name" className="text-xs text-muted-foreground">
                      Eller skriv ad-hoc att.-tekst (override)
                    </Label>
                    <Input
                      id="customer_contact_name"
                      placeholder="Fx Lena Andersen"
                      value={detailsForm.customer_contact_name}
                      onChange={(e) => setDetailsForm(p => ({ ...p, customer_contact_name: e.target.value }))}
                      onBlur={() => saveDetailField('customer_contact_name')}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Indledning og bemærkninger */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Indledning og bemærkninger</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="intro_text">Tilbudsindledning</Label>
                  <Textarea
                    id="intro_text"
                    placeholder={'Hermed vores tilbud på de beskrevne poster. Tilbuddet er udarbejdet på baggrund af det modtagne projektmateriale og forudsætninger angivet under vilkår.'}
                    value={detailsForm.intro_text}
                    onChange={(e) => setDetailsForm(p => ({ ...p, intro_text: e.target.value }))}
                    onBlur={() => saveDetailField('intro_text')}
                    disabled={isReadOnly}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Vises øverst på PDF'en lige under metablokken. Tom = brug standardteksten ovenfor.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Bemærkninger</Label>
                  <Textarea
                    id="notes"
                    placeholder="Fx ekstra information til kunden, projekt-specifikke detaljer der ikke passer som forbehold."
                    value={detailsForm.notes}
                    onChange={(e) => setDetailsForm(p => ({ ...p, notes: e.target.value }))}
                    onBlur={() => saveDetailField('notes')}
                    disabled={isReadOnly}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Vises på PDF'en som "Bemærkninger"-sektion efter Vilkår. Skjules hvis tom.
                  </p>
                </div>
              </div>
            </div>

            {/* Vilkår */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vilkår</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quote_date">Tilbudsdato</Label>
                  <Input
                    id="quote_date"
                    type="date"
                    value={quote?.quote_date || (quote?.created_at ? new Date(quote.created_at).toISOString().split('T')[0] : '')}
                    onChange={(e) => updateQuoteMetadata({ quote_date: e.target.value || null })}
                    disabled={savingMetadata || isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Vises på PDF'en. Default = oprettelsesdato. Kan overstyres her.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Gyldig til</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={quote?.valid_until || ''}
                    onChange={(e) => updateQuoteMetadata({ valid_until: e.target.value || null })}
                    disabled={savingMetadata || isReadOnly}
                  />
                </div>
                {/* Betalingsplan-template — fakturering-skema (separat fra payment_terms-tekst) */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="payment_terms_template">Betalingsplan</Label>
                    <FieldIndicator
                      isNull={quote?.payment_terms_template === null || quote?.payment_terms_template === undefined}
                      isLocked={isReadOnly}
                      lockedAt={quote?.locked_at}
                      onReset={() => updateQuoteMetadata({ payment_terms_template: null })}
                      onOverride={() => {
                        // Override = lås den nuværende resolved-værdi ind på tilbuddet.
                        const seed = quote?.resolved_payment_terms_template ?? '50_50_levering';
                        updateQuoteMetadata({ payment_terms_template: seed });
                      }}
                    />
                  </div>
                  <Select
                    value={quote?.resolved_payment_terms_template ?? '50_50_levering'}
                    onValueChange={(v) => updateQuoteMetadata({ payment_terms_template: v })}
                    disabled={savingMetadata || isReadOnly}
                  >
                    <SelectTrigger id="payment_terms_template">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50_50_levering">50% ved accept, 50% ved levering</SelectItem>
                      <SelectItem value="40_60">40% ved accept, 60% ved levering</SelectItem>
                      <SelectItem value="30_70">30% ved accept, 70% ved levering</SelectItem>
                      <SelectItem value="20_80">20% ved accept, 80% ved levering</SelectItem>
                      <SelectItem value="per_levering">Faktureres pr. delleverance</SelectItem>
                      <SelectItem value="custom">Aftales individuelt</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Styrer Betalingsplan-tabellen i tilbuds-PDF'en. Adskilt fra "Betalingsbetingelser" nedenfor (der angiver fakturafrist).
                  </p>
                </div>
                {/* Betalingsbetingelser */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="payment_terms">Betalingsbetingelser</Label>
                    <FieldIndicator
                      isNull={quote?.payment_terms === null || quote?.payment_terms === undefined || quote?.payment_terms === ''}
                      isLocked={isReadOnly}
                      lockedAt={quote?.locked_at}
                      onReset={() => updateQuoteMetadata({ payment_terms: null })}
                      onOverride={() => {
                        const seed = quote?.resolved_payment_terms ?? '';
                        setDetailsForm(p => ({ ...p, payment_terms: seed }));
                        updateQuoteMetadata({ payment_terms: seed });
                      }}
                    />
                  </div>
                  <Input
                    id="payment_terms"
                    placeholder={quote?.resolved_payment_terms ?? 'Fx Netto 14 dage fra fakturadato'}
                    value={detailsForm.payment_terms}
                    onChange={(e) => setDetailsForm(p => ({ ...p, payment_terms: e.target.value }))}
                    onBlur={() => saveDetailField('payment_terms')}
                    disabled={isReadOnly || quote?.payment_terms === null || quote?.payment_terms === undefined || quote?.payment_terms === ''}
                  />
                </div>

                {/* Leveringstid */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="delivery_period">Leveringstid / udførelsesperiode</Label>
                    <FieldIndicator
                      isNull={quote?.delivery_period === null || quote?.delivery_period === undefined || quote?.delivery_period === ''}
                      isLocked={isReadOnly}
                      lockedAt={quote?.locked_at}
                      onReset={() => updateQuoteMetadata({ delivery_period: null })}
                      onOverride={() => {
                        const seed = quote?.resolved_delivery_period ?? '';
                        setDetailsForm(p => ({ ...p, delivery_period: seed }));
                        updateQuoteMetadata({ delivery_period: seed });
                      }}
                    />
                  </div>
                  <Textarea
                    id="delivery_period"
                    placeholder={quote?.resolved_delivery_period ?? 'Fx "Uge 32-34, 2026" eller "6 uger efter ordrebekræftelse"'}
                    value={detailsForm.delivery_period}
                    onChange={(e) => setDetailsForm(p => ({ ...p, delivery_period: e.target.value }))}
                    onBlur={() => saveDetailField('delivery_period')}
                    rows={4}
                    disabled={isReadOnly || quote?.delivery_period === null || quote?.delivery_period === undefined || quote?.delivery_period === ''}
                  />
                </div>

                {/* Standardforbehold */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor="reservations">Standardforbehold</Label>
                    <FieldIndicator
                      isNull={quote?.reservations === null || quote?.reservations === undefined || quote?.reservations === ''}
                      isLocked={isReadOnly}
                      lockedAt={quote?.locked_at}
                      onReset={() => updateQuoteMetadata({ reservations: null })}
                      onOverride={() => {
                        const seed = companySettings?.defaultReservations ?? '';
                        setDetailsForm(p => ({ ...p, reservations: seed }));
                        updateQuoteMetadata({ reservations: seed });
                      }}
                    />
                  </div>
                  <Textarea
                    id="reservations"
                    placeholder={companySettings?.defaultReservations ?? 'Fx prisregulering ved materialestigning >5%, forudsætter uhindret adgang...'}
                    value={detailsForm.reservations}
                    onChange={(e) => setDetailsForm(p => ({ ...p, reservations: e.target.value }))}
                    onBlur={() => saveDetailField('reservations')}
                    rows={4}
                    disabled={isReadOnly || quote?.reservations === null || quote?.reservations === undefined || quote?.reservations === ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    Override af standardforbeholdet er en ekstrem case. De fleste projektspecifikke ting hører hjemme i feltet nedenfor.
                  </p>
                </div>

                {/* Projektspecifikke forbehold — altid brugerens, røres aldrig automatisk */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="special_reservations">
                    Projektspecifikke forbehold <span className="text-muted-foreground font-normal">(valgfri)</span>
                  </Label>
                  <Textarea
                    id="special_reservations"
                    placeholder="Fx farveforbehold, særlige montageforhold, asbest osv."
                    value={detailsForm.special_reservations}
                    onChange={(e) => setDetailsForm(p => ({ ...p, special_reservations: e.target.value }))}
                    onBlur={() => saveDetailField('special_reservations')}
                    disabled={isReadOnly}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Vises i tilbuddet under standardforbeholdet. Forbliver brugerens — røres aldrig automatisk af systemet.
                  </p>
                </div>
              </div>
            </div>

            {/* Tilbudsgiver */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tilbudsgiver</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label>Hurtigvalg medarbejder</Label>
                    {quote?.created_by_employee_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => navigate(`/medarbejdere?edit=${quote.created_by_employee_id}`)}
                      >
                        <Edit className="h-3 w-3 mr-1" /> Rediger medarbejder
                      </Button>
                    )}
                  </div>
                  <Select
                    value={quote?.created_by_employee_id ?? ''}
                    onValueChange={(empId) => {
                      const emp = employees.find(e => e.id === empId);
                      if (!emp) return;
                      updateQuoteMetadata({
                        created_by_employee_id: emp.id,
                        created_by_name: emp.full_name,
                        created_by_email: emp.email,
                        created_by_phone: emp.phone,
                      });
                    }}
                    disabled={savingMetadata || isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg medarbejder for at autoudfylde felterne nedenfor" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}{emp.email ? ` · ${emp.email}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="created_by_name">Navn</Label>
                  <Input
                    id="created_by_name"
                    value={detailsForm.created_by_name}
                    onChange={(e) => setDetailsForm(p => ({ ...p, created_by_name: e.target.value }))}
                    onBlur={() => saveDetailField('created_by_name')}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="created_by_email">Email</Label>
                  <Input
                    id="created_by_email"
                    type="email"
                    value={detailsForm.created_by_email}
                    onChange={(e) => setDetailsForm(p => ({ ...p, created_by_email: e.target.value }))}
                    onBlur={() => saveDetailField('created_by_email')}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="created_by_phone">Telefon</Label>
                  <Input
                    id="created_by_phone"
                    value={detailsForm.created_by_phone}
                    onChange={(e) => setDetailsForm(p => ({ ...p, created_by_phone: e.target.value }))}
                    onBlur={() => saveDetailField('created_by_phone')}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Modtager — styrer tone i AI-genererede levende beskrivelser */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Modtager</h3>
              <p className="text-xs text-muted-foreground">Styrer tone i AI-genererede levende beskrivelser på tilbuddets linjer.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient_profile">Modtager-profil</Label>
                  <Select
                    value={quote?.recipient_profile || 'mixed'}
                    onValueChange={(v) => updateQuoteMetadata({ recipient_profile: v })}
                    disabled={savingMetadata || isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="architect">Arkitekt</SelectItem>
                      <SelectItem value="contractor">Hovedentreprenør</SelectItem>
                      <SelectItem value="enduser">Slutkunde</SelectItem>
                      <SelectItem value="mixed">Blandet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient_notes">Noter om modtager</Label>
                  <Input
                    id="recipient_notes"
                    placeholder="Fx tone, sprogniveau, særlige hensyn"
                    value={detailsForm.recipient_notes}
                    onChange={(e) => setDetailsForm(p => ({ ...p, recipient_notes: e.target.value }))}
                    onBlur={() => saveDetailField('recipient_notes')}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Ny kunde dialog */}
        <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCompanyId ? 'Rediger kunde' : 'Opret ny kunde'}</DialogTitle>
              <DialogDescription>
                {editingCompanyId
                  ? 'Ændringer slår igennem på tilbuds-PDF (firmanavn, CVR, adresse hentes live).'
                  : 'Tilføjes som kunde og linkes til dette tilbud.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="new_co_name">Firmanavn *</Label>
                <Input
                  id="new_co_name"
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new_co_cvr">CVR</Label>
                <Input
                  id="new_co_cvr"
                  value={newCompanyForm.cvr}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, cvr: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new_co_addr">Adresse</Label>
                <Input
                  id="new_co_addr"
                  value={newCompanyForm.addressLine1}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, addressLine1: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new_co_zip">Postnr.</Label>
                <Input
                  id="new_co_zip"
                  value={newCompanyForm.addressZip}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, addressZip: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new_co_city">By</Label>
                <Input
                  id="new_co_city"
                  value={newCompanyForm.addressCity}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, addressCity: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="new_co_contact">Kontaktperson</Label>
                <Input
                  id="new_co_contact"
                  value={newCompanyForm.defaultContactName}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, defaultContactName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new_co_email">Email</Label>
                <Input
                  id="new_co_email"
                  type="email"
                  value={newCompanyForm.defaultContactEmail}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, defaultContactEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new_co_phone">Telefon</Label>
                <Input
                  id="new_co_phone"
                  value={newCompanyForm.defaultContactPhone}
                  onChange={(e) => setNewCompanyForm(p => ({ ...p, defaultContactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewCompanyDialog(false)} disabled={savingNewCompany}>
                Annullér
              </Button>
              <Button onClick={handleSaveCompany} disabled={savingNewCompany || !newCompanyForm.name.trim()}>
                {savingNewCompany
                  ? (editingCompanyId ? 'Gemmer…' : 'Opretter…')
                  : (editingCompanyId ? 'Gem ændringer' : 'Opret og link')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Metadata Section */}
        <Card>
          <Collapsible open={metaOpen} onOpenChange={setMetaOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {metaOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <CardTitle className="text-lg shrink-0">Metadata</CardTitle>
                    {!metaOpen && (() => {
                      const fmtDk = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('da-DK') : '';
                      const prio = quote?.priority === 1 ? 'Høj' : quote?.priority === 3 ? 'Lav' : 'Normal';
                      const parts = [
                        `Prioritet: ${prio}`,
                        quote?.next_action ? `Handling: ${quote.next_action}` : null,
                        quote?.next_delivery_date ? `Levering: ${fmtDk(quote.next_delivery_date)}` : null,
                      ].filter(Boolean);
                      return <span className="text-sm text-muted-foreground truncate">▸ {parts.join(' · ')}</span>;
                    })()}
                  </div>
                  {!metaOpen && (
                    <span className="text-xs text-muted-foreground hidden md:inline shrink-0">Intern arbejdskø</span>
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Redigerbare felter */}
              <div className="space-y-2">
                <Label htmlFor="next_delivery_date">Næste leveringsdato</Label>
                <Input
                  id="next_delivery_date"
                  type="date"
                  value={quote?.next_delivery_date || ''}
                  onChange={(e) => updateQuoteMetadata({ next_delivery_date: e.target.value || null })}
                  disabled={savingMetadata || isReadOnly}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priority">Prioritet</Label>
                <Select 
                  value={quote?.priority?.toString() || '2'} 
                  onValueChange={(value) => updateQuoteMetadata({ priority: parseInt(value) })}
                  disabled={savingMetadata || isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Høj</SelectItem>
                    <SelectItem value="2">2 - Normal</SelectItem>
                    <SelectItem value="3">3 - Lav</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="owner_user_id">Ansvarlig</Label>
                <Input
                  id="owner_user_id"
                  placeholder="Bruger ID (placeholder)"
                  value={quote?.owner_user_id || ''}
                  onChange={(e) => updateQuoteMetadata({ owner_user_id: e.target.value || null })}
                  disabled={savingMetadata || isReadOnly}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="next_action">Næste handling</Label>
                <Input
                  id="next_action"
                  placeholder="Beskriv næste handling"
                  value={quote?.next_action || ''}
                  onChange={(e) => updateQuoteMetadata({ next_action: e.target.value || null })}
                  disabled={savingMetadata || isReadOnly}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="delivery_note">Leveringsnoter</Label>
                <Textarea
                  id="delivery_note"
                  placeholder="Noter om levering"
                  value={quote?.delivery_note || ''}
                  onChange={(e) => updateQuoteMetadata({ delivery_note: e.target.value || null })}
                  disabled={savingMetadata || isReadOnly}
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={quote?.status ?? 'draft'}
                  onValueChange={(v) => updateQuoteMetadata({ status: v })}
                  disabled={savingMetadata || isReadOnly}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Kladde</SelectItem>
                    <SelectItem value="sent">Sendt</SelectItem>
                    <SelectItem value="accepted">Accepteret</SelectItem>
                    <SelectItem value="rejected">Afvist</SelectItem>
                    <SelectItem value="archived">Arkiveret</SelectItem>
                  </SelectContent>
                </Select>
                {quote?.status === 'sent' && !quote?.is_locked && (
                  <p className="text-xs text-muted-foreground">
                    Bemærk: Status='sent' låser normalt automatisk. Tilbuddet er aktuelt ulåst — ændringer kan stadig foretages.
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Sendt dato</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  {quote?.sent_at ? new Date(quote.sent_at).toLocaleDateString('da-DK') : 'Ikke sendt'}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Version</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  v{quote?.version_no || 1}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Lås</Label>
                <div className="p-2 bg-muted rounded flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {quote?.is_locked ? (
                      <Lock className="h-4 w-4 text-destructive" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <Badge variant={quote?.is_locked ? 'destructive' : 'secondary'}>
                        {quote?.is_locked ? 'Låst' : 'Ulåst'}
                      </Badge>
                      {quote?.locked_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(quote.locked_at).toLocaleDateString('da-DK')}
                        </div>
                      )}
                    </div>
                  </div>
                  {quote?.is_locked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Lås tilbuddet op? Tekstfelter forbliver som de er — brug "Reset til standard" pr. felt hvis du vil have dem live mod firma-indstillinger igen.')) {
                          updateQuoteMetadata({ is_locked: false });
                        }
                      }}
                      disabled={savingMetadata}
                    >
                      <Unlock className="h-3 w-3 mr-1" /> Lås op
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => updateQuoteMetadata({ is_locked: true })}
                      disabled={savingMetadata}
                    >
                      <Lock className="h-3 w-3 mr-1" /> Lås tilbud
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Quote Lines */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tilbudslinjer · {lines.length}</h2>
        </div>
        <div className="space-y-4">
          {lines
            .sort((a, b) => {
              // Primær sortering: display_order
              if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
              }
              // Fallback til created_at hvis display_order mangler
              if (a.displayOrder !== undefined) return -1;
              if (b.displayOrder !== undefined) return 1;
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            })
            .map((line) => {
            const totals = calculateLineTotals(line);
            const isExpanded = expandedLines.has(line.id);
            
            return (
              <Card
                key={line.id}
                className={`transition-all duration-200 ${
                  dragOverLineId === line.id ? 'border-primary border-2 bg-primary/5' : ''
                } ${
                  draggedLineId === line.id ? 'opacity-50' : ''
                }`}
                draggable={!isReadOnly}
                onDragStart={(e) => !isReadOnly && handleDragStart(e, line.id)}
                onDragOver={(e) => !isReadOnly && handleDragOver(e, line.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => !isReadOnly && handleDrop(e, line.id)}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleLineExpansion(line.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GripVertical 
                            className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" 
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <CardTitle className="text-lg">{line.title}</CardTitle>
                            {!isExpanded && (
                              <div className="text-sm font-medium text-foreground mt-1">
                                {line.quantity} {line.unit} • {formatCurrency(totals.sellingPricePerUnit)} kr/{line.unit}
                              </div>
                            )}
                            {isExpanded && line.description && (
                              <p className="text-sm text-muted-foreground mt-1">{line.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          {!isExpanded ? (
                            // Summary-sektion med 4 nøgletal
                            <div className="grid grid-cols-6 gap-3 text-right pointer-events-none">
                              <div>
                                <div className="font-semibold text-base">
                                  {line.quantity}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Antal
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.sellingPricePerUnit)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Enhedspris (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.totalSellingPrice)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Total salgspris (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.totalCost)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Total cost (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {formatCurrency(totals.totalProfit)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  Total DB (kr)
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {totals.dbPercent.toFixed(0)}%
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  DB %
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Udvidet visning - alle detaljer
                            <>
              <div>
                <div className="font-semibold text-lg">
                  Salgspris i alt: {formatCurrency(totals.totalSellingPrice)} kr
                </div>
                <div className="text-base font-medium">
                  Antal: {line.quantity} {line.unit}
                </div>
              </div>
                              <div className="text-right">
                                <Badge variant={totals.dbPercent > 20 ? "default" : "secondary"}>
                                  DB: {totals.dbPercent.toFixed(0)}%
                                </Badge>
                              </div>
                            </>
                          )}
                          {isExpanded && (
                            <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditLine(line);
                              }}
                              title="Redigér linje"
                              disabled={isReadOnly}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveLine(line.id);
                              }}
                              title="Arkivér linje"
                              disabled={isReadOnly}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLine(line.id);
                              }}
                              title="Slet linje"
                              disabled={isReadOnly}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLineExpansion(line.id);
                              }}
                            >
                              {isExpanded ? 'Skjul kalkulation' : 'Vis kalkulation'}
                            </Button>
                            </div>
                          )}
                          
                          {/* Vis kalkulation knap er altid synlig */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLineExpansion(line.id);
                            }}
                          >
                            {isExpanded ? 'Skjul' : 'Vis'}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Rækkebaseret Kalkulation */}
                      <div className="mb-6">
                        <h4 className="font-semibold mb-3">Kalkulation</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-gray-300 px-3 py-2 text-left font-medium">Type</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Beløb (kr)</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Enhedspris (kr)</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Profit %</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-medium">Andel af salgspris %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* A. COST (grundomkostninger) */}
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Materialer</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.materials * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.materials)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.materials.toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Materialetransport</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(((totals.costBreakdown.material_transport || 0) * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.material_transport || 0))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{((totals.costBreakdown.material_transport || 0) / totals.sellingPricePerUnit * 100).toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Produktion</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.labor_production * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.labor_production)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.labor_production.toFixed(0)}%</td>
                              </tr>
                              {/* Vis kun produkttransport hvis den findes */}
                              {(totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) > 0 && (
                                <tr>
                                  <td className="border border-gray-300 px-3 py-2">Produkttransport</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * line.quantity))}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0))}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                  <td className="border border-gray-300 px-3 py-2 text-right">{((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) / totals.sellingPricePerUnit * 100).toFixed(0)}%</td>
                                </tr>
                              )}
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">DK montage</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.labor_dk * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.labor_dk)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.labor_dk.toFixed(0)}%</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 px-3 py-2">Øvrigt</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.costBreakdown.other * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.costBreakdown.other)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.other.toFixed(0)}%</td>
                              </tr>
                              
                              {/* B. Base cost – i alt */}
                              <tr className="border-t-2 bg-gray-100 font-semibold">
                                <td className="border border-gray-300 px-3 py-2">Base cost i alt</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                  {(() => {
                                    const totalBaseCost = ((totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0)) * line.quantity;
                                    return formatCurrency(totalBaseCost);
                                  })()}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                  {(() => {
                                    const totalBaseCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0);
                                    return formatCurrency(totalBaseCostPerUnit);
                                  })()}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-muted-foreground">–</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                  {(() => {
                                    const baseCostTotal = ((totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0)) * line.quantity;
                                    const baseCostShare = totals.totalSellingPrice > 0 ? (baseCostTotal / totals.totalSellingPrice) * 100 : 0;
                                    return baseCostShare.toFixed(0) + '%';
                                  })()}
                                </td>
                              </tr>
                              
                              {/* D. Profit-række */}
                              <tr className="border-t bg-blue-50">
                                <td className="border border-gray-300 px-3 py-2 font-semibold text-blue-700">
                                  Profit ({(() => {
                                    if (line.pricing?.pricingMode === 'target_unit_price') return 'Fast salgspris';
                                    return 'Markup %';
                                  })()})
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {formatCurrency(totals.totalProfit)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {formatCurrency((totals.totalProfit / line.quantity))}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {(() => {
                                    const baseCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                      (totals.costBreakdown.material_transport || 0) + 
                                      (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                      (totals.costBreakdown.labor_production || 0) + 
                                      (totals.costBreakdown.labor_dk || 0) + 
                                      (totals.costBreakdown.other || 0);
                                    const markupPercent = baseCostPerUnit > 0 ? ((totals.totalProfit / line.quantity) / baseCostPerUnit) * 100 : 0;
                                    return '+' + markupPercent.toFixed(0) + '%';
                                  })()} 
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-blue-700">
                                  {(() => {
                                    const profitShare = totals.totalSellingPrice > 0 ? (totals.totalProfit / totals.totalSellingPrice) * 100 : 0;
                                    return profitShare.toFixed(0) + '%';
                                  })()}
                                </td>
                              </tr>
                              
                              {/* E. Risikotillæg */}
                              <tr className="border-t">
                                <td className="border border-gray-300 px-3 py-2">Risikotillæg</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency((totals.riskPerUnit * line.quantity))}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(totals.riskPerUnit)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">0%</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{totals.costPercentages.risk.toFixed(0)}%</td>
                              </tr>
                              
                              {/* G. Salgspris – total */}
                              <tr className="border-t-2 bg-green-50 font-bold">
                                <td className="border border-gray-300 px-3 py-2 text-green-700">Salgspris i alt</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{formatCurrency(totals.totalSellingPrice)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{formatCurrency(totals.sellingPricePerUnit)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{totals.costPercentages.profit.toFixed(0)}%</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">100.0%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pricing Settings */}
                      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold">Prisfastsættelse</h4>
                          {editingPricing === line.id ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleUpdatePricing(line.id)}>Gem</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingPricing(null)}>Annullér</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => startEditPricing(line)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {editingPricing === line.id ? (
                          <div className="space-y-4">
                            <div>
                              <Label>Prisfastsættelse</Label>
                              <Select
                                value={pricingFormData.pricingMode === 'target_unit_price' ? 'target_unit_price' : 'markup_pct'}
                                onValueChange={(value: 'markup_pct' | 'target_unit_price') =>
                                  setPricingFormData(prev => ({ ...prev, pricingMode: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="markup_pct">Markup % på (cost + risk)</SelectItem>
                                  <SelectItem value="target_unit_price">Jeg sætter salgspris</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              {pricingFormData.pricingMode === 'markup_pct' && (
                                <div>
                                  <Label>Markup %</Label>
                                  <Input
                                    type="number"
                                    value={pricingFormData.markupPct}
                                    onChange={(e) => setPricingFormData(prev => ({ ...prev, markupPct: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              )}
                              
                              {pricingFormData.pricingMode === 'gross_margin_pct' && (
                                <div>
                                  <Label>DB %</Label>
                                  <Input
                                    type="number"
                                    value={pricingFormData.grossMarginPct}
                                    onChange={(e) => setPricingFormData(prev => ({ ...prev, grossMarginPct: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              )}
                              
                              {pricingFormData.pricingMode === 'target_unit_price' && (
                                <div>
                                  <Label>Salgspris kr/{line.unit}</Label>
                                  <Input
                                    type="number"
                                    value={pricingFormData.targetUnitPrice}
                                    onChange={(e) => setPricingFormData(prev => ({ ...prev, targetUnitPrice: parseFloat(e.target.value) || 0 }))}
                                  />
                                </div>
                              )}
                              
                              <div>
                                <Label>Risk kr/{line.unit}</Label>
                                <Input
                                  type="number"
                                  value={pricingFormData.riskPerUnit}
                                  onChange={(e) => setPricingFormData(prev => ({ ...prev, riskPerUnit: parseFloat(e.target.value) || 0 }))}
                                />
                              </div>
                            </div>
                            
                            {/* Profit by Category UI */}
                            {pricingFormData.pricingMode === 'profit_by_category' && (
                              <div className="mt-4">
                                <Label className="text-sm font-medium mb-2 block">Profit % pr. kategori</Label>
                                <div className="border rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">Kategori</th>
                                        <th className="px-3 py-2 text-right font-medium">Cost pr enhed (kr)</th>
                                        <th className="px-3 py-2 text-right font-medium">Profit %</th>
                                        <th className="px-3 py-2 text-right font-medium">Profit pr enhed (kr)</th>
                                        <th className="px-3 py-2 text-right font-medium">Total pr enhed (kr)</th>
                                        <th className="px-3 py-2 text-right font-medium">Total (kr)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Materialer</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.materials.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.materials || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                materials: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.materials * (1 + (pricingFormData.profitByCategory?.materials || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.materials * (1 + (pricingFormData.profitByCategory?.materials || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Materialetransport</td>
                                        <td className="px-3 py-2 text-right">{(totals.costBreakdown.material_transport || 0).toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.material_transport || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                material_transport: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.material_transport || 0) * (1 + (pricingFormData.profitByCategory?.material_transport || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(((totals.costBreakdown.material_transport || 0) * (1 + (pricingFormData.profitByCategory?.material_transport || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Produkttransport</td>
                                        <td className="px-3 py-2 text-right">{(totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0).toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.product_transport || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                product_transport: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (1 + (pricingFormData.profitByCategory?.product_transport || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (1 + (pricingFormData.profitByCategory?.product_transport || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Labor (produktion)</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.labor_production.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.labor_production || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                labor_production: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.labor_production * (1 + (pricingFormData.profitByCategory?.labor_production || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.labor_production * (1 + (pricingFormData.profitByCategory?.labor_production || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Labor (DK montage)</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.labor_dk.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.labor_dk || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                labor_dk: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.labor_dk * (1 + (pricingFormData.profitByCategory?.labor_dk || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.labor_dk * (1 + (pricingFormData.profitByCategory?.labor_dk || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t">
                                        <td className="px-3 py-2">Øvrigt</td>
                                        <td className="px-3 py-2 text-right">{totals.costBreakdown.other.toLocaleString('da-DK')}</td>
                                        <td className="px-3 py-2">
                                          <Input
                                            type="number"
                                            step="0.1"
                                            className="w-20 text-right"
                                            value={pricingFormData.profitByCategory?.other || 30}
                                            onChange={(e) => setPricingFormData(prev => ({
                                              ...prev,
                                              profitByCategory: {
                                                ...prev.profitByCategory,
                                                other: parseFloat(e.target.value) || 0
                                              }
                                            }))}
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {(totals.costBreakdown.other * (1 + (pricingFormData.profitByCategory?.other || 30) / 100)).toLocaleString('da-DK')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {((totals.costBreakdown.other * (1 + (pricingFormData.profitByCategory?.other || 30) / 100)) * line.quantity).toLocaleString('da-DK')}
                                        </td>
                                      </tr>
                                      <tr className="border-t-2 bg-gray-50 font-semibold">
                                        <td className="px-3 py-2">I alt (excl. risk)</td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            return totalCostPerUnit.toLocaleString('da-DK');
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            return totalProfitPerUnit.toLocaleString('da-DK');
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            const totalSellingPricePerUnit = totalCostPerUnit + totalProfitPerUnit;
                                            return totalSellingPricePerUnit.toLocaleString('da-DK');
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            const totalSellingPricePerUnit = totalCostPerUnit + totalProfitPerUnit;
                                            return (totalSellingPricePerUnit * line.quantity).toLocaleString('da-DK');
                                          })()}
                                        </td>
                                      </tr>
                                      <tr className="border-t bg-blue-50">
                                        <td className="px-3 py-2 font-semibold">Resulterende DB%</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right">-</td>
                                        <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                          {(() => {
                                            const totalCostPerUnit = (totals.costBreakdown.materials || 0) + 
                                              (totals.costBreakdown.material_transport || 0) + 
                                              (totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) + 
                                              (totals.costBreakdown.labor_production || 0) + 
                                              (totals.costBreakdown.labor_dk || 0) + 
                                              (totals.costBreakdown.other || 0);
                                            const totalProfitPerUnit = 
                                              (totals.costBreakdown.materials * (pricingFormData.profitByCategory?.materials || 30) / 100) +
                                              ((totals.costBreakdown.material_transport || 0) * (pricingFormData.profitByCategory?.material_transport || 30) / 100) +
                                              ((totals.costBreakdown.product_transport || totals.costBreakdown.transport || 0) * (pricingFormData.profitByCategory?.product_transport || 30) / 100) +
                                              (totals.costBreakdown.labor_production * (pricingFormData.profitByCategory?.labor_production || 30) / 100) +
                                              (totals.costBreakdown.labor_dk * (pricingFormData.profitByCategory?.labor_dk || 30) / 100) +
                                              (totals.costBreakdown.other * (pricingFormData.profitByCategory?.other || 30) / 100);
                                            const totalSellingPricePerUnit = totalCostPerUnit + totalProfitPerUnit;
                                            const dbPercent = totalSellingPricePerUnit > 0 ? (totalProfitPerUnit / totalSellingPricePerUnit) * 100 : 0;
                                            return dbPercent.toFixed(0) + '%';
                                          })()}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2 pt-4">
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdatePricing(line.id)}
                                disabled={savingPricing}
                              >
                                {savingPricing ? 'Gemmer...' : 'Gem pricing'}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setEditingPricing(null)}
                              >
                                Annullér
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <div className="text-sm space-y-1">
                              <div>Mode: {line.pricing?.pricingMode === 'markup_pct' ? 'Markup %' : line.pricing?.pricingMode === 'gross_margin_pct' ? 'DB %' : 'Target pris'}</div>
                              <div>Risk: {line.pricing?.riskPerUnit || 0} kr/{line.unit}</div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => startEditPricing(line)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Redigér pricing
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Billede + AI-render */}
                      {(() => {
                        const effectiveUrl = lineEffectiveImageUrl(line);
                        const hasRender = !!line.renderImageUrl;
                        const hasCustom = !!line.customImageUrl;
                        const renderStatus = line.renderStatus || 'none';
                        const isInFlight = renderStatus === 'pending' || renderStatus === 'generating';
                        const ctxLocal = lineFieldEdits[line.id]?.renderContext;
                        const ctxValue = ctxLocal !== undefined ? ctxLocal : (line.renderContext ?? '');
                        const promptLocal = lineFieldEdits[line.id]?.renderPrompt;
                        const promptValue = promptLocal !== undefined ? promptLocal : (line.renderPrompt ?? '');
                        const captionLocal = lineFieldEdits[line.id]?.customImageCaption;
                        const captionValue = captionLocal !== undefined ? captionLocal : (line.customImageCaption ?? '');
                        const isUploading = uploadingImageLineId === line.id;
                        const imageOpen = expandedImageLines.has(line.id);
                        const imageSummary = (() => {
                          const parts = [];
                          if (line.activeImageSource === 'custom' && hasCustom) parts.push('Eget billede');
                          else if (line.activeImageSource === 'render' && hasRender) parts.push('Render');
                          else if (line.activeImageSource === 'none') parts.push('Skjult på bilag');
                          else parts.push('Intet billede');
                          if (renderStatus === 'pending' || renderStatus === 'generating') parts.push('genererer…');
                          if (renderStatus === 'failed') parts.push('render fejlede');
                          return parts.join(' · ');
                        })();
                        return (
                          <Collapsible
                            open={imageOpen}
                            onOpenChange={() => setExpandedImageLines(prev => toggleSetItem(prev, line.id))}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="mt-6 rounded-lg border bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {imageOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                  <h4 className="font-semibold shrink-0">Billede</h4>
                                  {!imageOpen && (
                                    <span className="text-sm text-muted-foreground truncate">▸ {imageSummary}</span>
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                          <div className="mt-2 rounded-lg border bg-muted/20 p-4 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">Vælg kilde</span>
                              <div className="flex rounded-md border overflow-hidden text-xs">
                                <button
                                  type="button"
                                  disabled={!hasRender}
                                  onClick={() => setLineImageSource(line.id, 'render')}
                                  className={`px-3 py-1.5 transition-colors ${line.activeImageSource === 'render' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-gray-50'} ${!hasRender ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  title={hasRender ? `Render genereret ${line.renderGeneratedAt ? new Date(line.renderGeneratedAt).toLocaleDateString('da-DK') : ''}` : 'Endnu ikke genereret'}
                                >
                                  Render
                                </button>
                                <button
                                  type="button"
                                  disabled={!hasCustom}
                                  onClick={() => setLineImageSource(line.id, 'custom')}
                                  className={`px-3 py-1.5 transition-colors border-l ${line.activeImageSource === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-gray-50'} ${!hasCustom ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  title={hasCustom ? `Uploadet ${line.customImageUploadedAt ? new Date(line.customImageUploadedAt).toLocaleDateString('da-DK') : ''}` : 'Intet uploadet'}
                                >
                                  Eget billede
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLineImageSource(line.id, 'none')}
                                  className={`px-3 py-1.5 transition-colors border-l ${line.activeImageSource === 'none' ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-gray-50'}`}
                                  title="Skjul billede på bilag"
                                >
                                  Intet
                                </button>
                              </div>
                            </div>

                            {/* Aktivt billede */}
                            <div className="aspect-video rounded-md border bg-white overflow-hidden flex items-center justify-center">
                              {effectiveUrl ? (
                                <img src={effectiveUrl} alt={line.title} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-center text-muted-foreground text-sm">
                                  <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                  Intet billede valgt
                                </div>
                              )}
                            </div>

                            {/* Upload eget billede */}
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Eget billede</Label>
                              <div className="flex gap-2 flex-wrap">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`upload_${line.id}`}
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadCustomImage(line.id, f);
                                    e.target.value = '';
                                  }}
                                />
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  disabled={isUploading}
                                >
                                  <label htmlFor={`upload_${line.id}`} className="cursor-pointer">
                                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                    {hasCustom ? 'Erstat eget billede' : 'Upload eget billede'}
                                  </label>
                                </Button>
                                {hasCustom && (
                                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => deleteCustomImage(line.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Slet
                                  </Button>
                                )}
                              </div>
                              {hasCustom && (
                                <Input
                                  placeholder="Caption (valgfri)"
                                  value={captionValue}
                                  onChange={(e) => setLineFieldLocal(line.id, 'customImageCaption', e.target.value)}
                                  onBlur={() => saveLineTextField(line.id, 'customImageCaption', 'custom_image_caption')}
                                />
                              )}
                            </div>

                            {/* Generér AI-render */}
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Generér AI-render</Label>
                              <Textarea
                                placeholder='Fx "Privat bolig, lyst stuerum, egetræsgulv, sydvendte vinduer"'
                                rows={2}
                                value={ctxValue}
                                onChange={(e) => setLineFieldLocal(line.id, 'renderContext', e.target.value)}
                                onBlur={() => saveLineTextField(line.id, 'renderContext', 'render_context')}
                              />
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="text-xs text-muted-foreground">
                                  {renderStatus === 'none' && 'Ingen render endnu'}
                                  {isInFlight && (
                                    <span className="inline-flex items-center gap-1 text-blue-600">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      {renderStatus === 'pending' ? 'I kø…' : 'Genererer…'}
                                    </span>
                                  )}
                                  {renderStatus === 'ready' && (
                                    <span>
                                      Genereret {line.renderGeneratedAt ? new Date(line.renderGeneratedAt).toLocaleString('da-DK') : ''}
                                      {line.renderModel ? ` · ${line.renderModel}` : ''}
                                    </span>
                                  )}
                                  {renderStatus === 'failed' && (
                                    <span className="text-red-600">Fejlede: {line.renderError || 'ukendt fejl'}</span>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => triggerRenderGeneration(line.id)}
                                  disabled={isInFlight}
                                  className="gap-1"
                                >
                                  {isInFlight ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                  {renderStatus === 'ready' ? 'Generér igen' : renderStatus === 'failed' ? 'Prøv igen' : 'Generér'}
                                </Button>
                              </div>
                              {/* Power-user: redigér prompt direkte */}
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                                    Vis/redigér prompt (avanceret)
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <Textarea
                                    rows={3}
                                    placeholder="Auto-genereres fra titel + beskrivelse + kontekst"
                                    value={promptValue}
                                    onChange={(e) => setLineFieldLocal(line.id, 'renderPrompt', e.target.value)}
                                    onBlur={() => saveLineTextField(line.id, 'renderPrompt', 'render_prompt')}
                                    className="mt-2 font-mono text-xs"
                                  />
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })()}

                      {/* Levende beskrivelse */}
                      {(() => {
                        const ldLocal = lineFieldEdits[line.id]?.livingDescription;
                        const ldValue = ldLocal !== undefined ? ldLocal : (line.livingDescription ?? '');
                        const isEdited = !!line.livingDescriptionEdited;
                        const wasGenerated = !!line.livingDescriptionGeneratedAt;
                        const descOpen = expandedDescLines.has(line.id);
                        const summaryText = ldValue
                          ? (ldValue.length > 80 ? ldValue.slice(0, 80).trim() + '…' : ldValue)
                          : 'Ingen tekst endnu';
                        return (
                          <Collapsible
                            open={descOpen}
                            onOpenChange={() => setExpandedDescLines(prev => toggleSetItem(prev, line.id))}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="mt-4 rounded-lg border bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {descOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                  <h4 className="font-semibold shrink-0">Levende beskrivelse</h4>
                                  {isEdited && <Badge variant="secondary" className="text-xs shrink-0">Redigeret</Badge>}
                                  {!isEdited && wasGenerated && <Badge className="text-xs shrink-0 bg-blue-100 text-blue-800 hover:bg-blue-100">Auto-genereret</Badge>}
                                  {!descOpen && (
                                    <span className="text-sm text-muted-foreground truncate italic">▸ {summaryText}</span>
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 rounded-lg border bg-muted/20 p-4 space-y-2">
                                <div className="flex items-center justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={generatingLivingDesc === line.id}
                                    title="Genererer sælgende tekst med Gemini ud fra titel + beskrivelse + modtagerprofil"
                                    onClick={() => generateLivingDescription(line.id)}
                                    className="gap-1"
                                  >
                                    {generatingLivingDesc === line.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <RefreshCw className="h-3.5 w-3.5" />}
                                    {generatingLivingDesc === line.id ? 'Genererer…' : (wasGenerated ? 'Generér igen' : 'Generér')}
                                  </Button>
                                </div>
                                <Textarea
                                  rows={5}
                                  placeholder="Sælgende beskrivelse til kundebilag — fx 'Skræddersyede omklædningsbænke i lyst birk skaber et roligt, indbydende rum, hvor materialernes naturlige struktur understreger…'"
                                  value={ldValue}
                                  onChange={(e) => setLineFieldLocal(line.id, 'livingDescription', e.target.value)}
                                  onBlur={() => saveLineTextField(line.id, 'livingDescription', 'living_description', { living_description_edited: true })}
                                />
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })()}

                      {/* Line Items */}
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                          <h4 className="font-semibold">Line Items</h4>
                          <div className="flex gap-2 flex-wrap">
                            {(Object.keys(QUICK_DEFAULTS) as QuickCategory[]).map(cat => {
                              const def = QUICK_DEFAULTS[cat];
                              return (
                                <Button
                                  key={cat}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openQuickAdd(line.id, cat)}
                                  className="gap-1"
                                  title={`Tilføj ${def.label.toLowerCase()} (${def.pricePerUnit > 0 ? def.pricePerUnit + ' kr/' + def.unit : 'pris ej sat'})`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  {def.label}
                                </Button>
                              );
                            })}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLineForItems(line.id);
                                setProductSearchTerm('');
                                setProductTypeFilter('all');
                                setShowAddItemModal(true);
                              }}
                              className="gap-1"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Produkt
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedLineForItems(line.id);
                                setShowCustomItemModal(true);
                              }}
                              className="gap-1"
                              title="Avanceret custom cost"
                            >
                              Andet…
                            </Button>
                          </div>
                        </div>
                        
                        {line.items.length > 0 ? (
                          <div className="space-y-2">
                            {line.items.map((item) => (
                              <div key={item.id} className="p-3 bg-muted/50 rounded border">
                                {editingItem === item.id ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                      <div>
                                        <Label>Titel</Label>
                                        <Input
                                          value={editItemFormData.title}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Antal</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editItemFormData.qty}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 1 }))}
                                        />
                                      </div>
                                      <div>
                                        <Label>Enhed</Label>
                                        <Input
                                          value={editItemFormData.unit}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, unit: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                    {item.sourceType === 'custom' && (
                                      <div>
                                        <Label>Total cost pr. unit</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={editItemFormData.totalCostPerUnit}
                                          onChange={(e) => setEditItemFormData(prev => ({ ...prev, totalCostPerUnit: parseFloat(e.target.value) || 0 }))}
                                          placeholder="0.00"
                                        />
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleUpdateItem(item.id)}>Gem</Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Annullér</Button>
                                    </div>
                                  </div>
                                ) : (() => {
                                  const activeSlots = getActiveCostSlots(item.costBreakdown);
                                  const isSinglePurpose = activeSlots.length === 1;
                                  const primarySlot = isSinglePurpose ? activeSlots[0] : null;
                                  const isExpanded = expandedItemIds.has(item.id);
                                  const localQty = itemQtyEdits[item.id] ?? item.qty;
                                  const toggleExpand = () => setExpandedItemIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                    return next;
                                  });
                                  return (
                                    <div className="space-y-2">
                                      {/* Compact line — grid med faste kolonner så rækkerne flugter */}
                                      <div className="grid grid-cols-[24px_minmax(0,1fr)_140px_140px_140px_180px] items-center gap-3">
                                        {/* 1. Chevron */}
                                        <button
                                          type="button"
                                          onClick={toggleExpand}
                                          className="text-muted-foreground hover:text-foreground"
                                          title={isExpanded ? 'Skjul detaljer' : 'Vis detaljer'}
                                        >
                                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                        {/* 2. Titel + badge */}
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-medium truncate">{item.title}</span>
                                          {primarySlot ? (
                                            <Badge className={`text-xs shrink-0 ${COST_SLOT_BADGE_CLASSES[primarySlot] || ''}`}>
                                              {COST_SLOT_LABELS[primarySlot]}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs shrink-0">
                                              {item.sourceType === 'project_product' ? 'Produkt' : 'Custom'}
                                            </Badge>
                                          )}
                                          {item.costTotalPerUnit === 0 && (
                                            <Badge variant="destructive" className="text-xs shrink-0">Mangler pris</Badge>
                                          )}
                                        </div>
                                        {/* 3. Antal + enhed */}
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className="h-7 w-20 text-sm"
                                            value={localQty}
                                            onChange={(e) => setItemQtyEdits(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                            onBlur={() => saveItemQty(item.id)}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <span className="text-sm text-muted-foreground">{item.unit}</span>
                                        </div>
                                        {/* 4. Pris pr. enhed */}
                                        <span className="text-sm text-right tabular-nums">
                                          {formatCurrency(item.costTotalPerUnit)} / {item.unit}
                                        </span>
                                        {/* 5. Total */}
                                        <span className="text-sm font-semibold text-right tabular-nums">
                                          {formatCurrency(item.costTotalPerUnit * item.qty)}
                                        </span>
                                        {/* 6. Actions */}
                                        <div className="flex gap-1 justify-end">
                                          {item.sourceType === 'project_product' && item.projectProductId && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7"
                                              onClick={async () => {
                                                try {
                                                  const result = await updateItemCostSnapshot(item.id, item.projectProductId!);
                                                  if (result.success) {
                                                    toast({ title: 'Pris opdateret', description: `Ny pris: ${formatCurrency(result.newTotalCost!)}` });
                                                    loadQuoteData();
                                                  } else {
                                                    throw result.error;
                                                  }
                                                } catch (error) {
                                                  console.error('Error updating product price:', error);
                                                  toast({ title: 'Fejl', description: 'Kunne ikke opdatere produktprisen', variant: 'destructive' });
                                                }
                                              }}
                                              title="Opdater til nyeste produktpris"
                                            >
                                              Opdater pris
                                            </Button>
                                          )}
                                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditItem(item)}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            disabled={deletingItem === item.id}
                                            onClick={() => handleDeleteItem(item.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      {/* Expanded breakdown — aligned med parent-kolonnerne */}
                                      {isExpanded && item.costBreakdown && (
                                        <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                                          {(['materials','material_transport','product_transport','labor_production','labor_dk','other'] as const).map(slot => {
                                            const val = (item.costBreakdown as any)?.[slot] ?? 0;
                                            const total = val * localQty;
                                            const isActive = val > 0;
                                            return (
                                              <div
                                                key={slot}
                                                className={`grid grid-cols-[24px_minmax(0,1fr)_140px_140px_140px_180px] gap-3 ${isActive ? 'text-foreground' : ''}`}
                                              >
                                                <span />
                                                <span>{COST_SLOT_LABELS[slot]}</span>
                                                <span />
                                                <span className="text-right tabular-nums">{val.toLocaleString('da-DK')} kr / {item.unit}</span>
                                                <span className="text-right tabular-nums">{total.toLocaleString('da-DK')} kr</span>
                                                <span />
                                              </div>
                                            );
                                          })}
                                          <div className="grid grid-cols-[24px_minmax(0,1fr)_140px_140px_140px_180px] gap-3 font-medium text-emerald-600 pt-1 border-t">
                                            <span />
                                            <span>Total cost</span>
                                            <span />
                                            <span className="text-right tabular-nums">{formatCurrency(item.costTotalPerUnit)} / {item.unit}</span>
                                            <span className="text-right tabular-nums">{formatCurrency(item.costTotalPerUnit * localQty)}</span>
                                            <span />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Ingen items tilføjet endnu</p>
                            <p className="text-sm">Tilføj produkter eller custom costs for at beregne priser</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        {/* Cost Breakdown - Nøgletal */}
        <Card>
          <CardHeader>
            <CardTitle>Nøgletal - Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-4">
              {/* Materialekost */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.materials)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Materialekost</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.materials / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Materialetransport */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.material_transport)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Materialetransport</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.material_transport / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Produkttransport */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.product_transport)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Produkttransport</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.product_transport / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Labor produktion */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.labor_production)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Labor produktion</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.labor_production / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Labor montage DK */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.labor_dk)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Labor montage DK</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.labor_dk / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>

              {/* Øvrige omkostninger */}
              <div className="text-center p-3 border rounded">
                <div className="text-lg font-bold">
                  {formatCurrency(quoteTotals.costBreakdown.other)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Øvrige omkostninger</div>
                <div className="text-sm font-medium text-blue-600">
                  {quoteTotals.totalSellingPrice > 0 ? ((quoteTotals.costBreakdown.other / quoteTotals.totalSellingPrice) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">af salgspris</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Tilbud totaler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(quoteTotals.totalSellingPrice)}
                </div>
                <div className="text-sm text-muted-foreground">Total salgspris</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(quoteTotals.totalProfit)}
                </div>
                <div className="text-sm text-muted-foreground">Total fortjeneste</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {averageDbPercent.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Gennemsnitlig DB</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Summary (Q-V1-09) - Internal use only */}
        {productSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Produktopsummering (intern)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Samlet oversigt over alle produkter på tværs af tilbudslinjer
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Produkt</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Antal</th>
                      <th className="border border-gray-300 px-4 py-2 text-center font-medium">Enhed</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Samlet cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSummary.map((product, index) => (
                      <tr key={product.projectProductId || product.title || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{product.title}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                          {product.totalQty.toLocaleString('da-DK')}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{product.unit}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {product.totalCost.toLocaleString('da-DK')} kr
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gray-100 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2">Total</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                        {productSummary.reduce((sum, p) => sum + p.totalCost, 0).toLocaleString('da-DK')} kr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Material Summary (Q-V1-10) - Internal use only */}
        {materialSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Materialeopsummering (intern)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Samlet oversigt over alle materialer fra produkter på tværs af tilbudslinjer
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Materiale</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Kategori</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Samlet mængde</th>
                      <th className="border border-gray-300 px-4 py-2 text-center font-medium">Enhed</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Samlet cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialSummary.map((material, index) => (
                      <tr key={material.materialId || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{material.name}</td>
                        <td className="border border-gray-300 px-4 py-2 text-muted-foreground">{material.category}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                          {material.totalQty.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">{material.unit}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {material.totalCost.toLocaleString('da-DK')} kr
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gray-100 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2">Total</td>
                      <td className="border border-gray-300 px-4 py-2 text-muted-foreground">
                        {/* Empty - category */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {/* Empty - different units */}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                        {materialSummary.reduce((sum, m) => sum + m.totalCost, 0).toLocaleString('da-DK')} kr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Internal Calculation Summary (Q-V1-11) */}
        {lines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Samlet intern kalkulation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Økonomisk overblik for hele tilbuddet
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Type</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Beløb</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-medium">Andel af salgspris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* COST - Individual categories */}
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Materialer</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.materials.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.materials / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Materialetransport</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.material_transport.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.material_transport / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Produkttransport</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.product_transport.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.product_transport / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Produktion</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.labor_production.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.labor_production / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">DK montage</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.labor_dk.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.labor_dk / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Øvrigt</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.costBreakdown.other.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.costBreakdown.other / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    
                    {/* SUM - Base cost total */}
                    <tr className="bg-blue-50 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2">Base cost i alt</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {baseCostTotal.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((baseCostTotal / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    
                    {/* RISK / RESULT */}
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Risikotillæg</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {riskTotal.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((riskTotal / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">Profit</td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-600 font-semibold">
                        {quoteTotals.totalProfit.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-600 font-semibold">
                        {quoteTotals.totalSellingPrice > 0 
                          ? ((quoteTotals.totalProfit / quoteTotals.totalSellingPrice) * 100).toFixed(0) 
                          : 0}%
                      </td>
                    </tr>
                    
                    {/* Total selling price */}
                    <tr className="bg-green-50 font-bold border-t-2">
                      <td className="border border-gray-300 px-4 py-2 text-green-700">Salgspris i alt</td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-700">
                        {quoteTotals.totalSellingPrice.toLocaleString('da-DK')} kr
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-green-700">
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Line Modal */}
        <Dialog open={showAddLineModal} onOpenChange={setShowAddLineModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj tilbudslinje</DialogTitle>
              <DialogDescription>
                Opret en ny linje i tilbuddet.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="lineTitle">Titel *</Label>
                <Input
                  id="lineTitle"
                  value={lineFormData.title}
                  onChange={(e) => setLineFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Linjetitel"
                />
              </div>

              <div>
                <Label htmlFor="lineDescription">Beskrivelse</Label>
                <Textarea
                  id="lineDescription"
                  value={lineFormData.description}
                  onChange={(e) => setLineFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beskrivelse af linjen"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lineQuantity">Antal</Label>
                  <Input
                    id="lineQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lineFormData.quantity}
                    onChange={(e) => setLineFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lineUnit">Enhed</Label>
                  <Input
                    id="lineUnit"
                    value={lineFormData.unit}
                    onChange={(e) => setLineFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="stk, m², etc."
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setShowAddLineModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleAddLine}>
                  Tilføj linje
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Quick-add cost dialog */}
        <Dialog open={quickAddOpen} onOpenChange={(o) => { if (!o) { setQuickAddOpen(false); setQuickAddCategory(null); setSelectedLineForItems(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Tilføj {quickAddCategory ? QUICK_DEFAULTS[quickAddCategory].label : ''}
              </DialogTitle>
              <DialogDescription>
                Tilføjes som single-purpose cost-item på linjen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="qa_title">Beskrivelse</Label>
                <Input
                  id="qa_title"
                  value={quickAddForm.title}
                  onChange={(e) => setQuickAddForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="qa_qty">Antal</Label>
                  <Input
                    id="qa_qty"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quickAddForm.qty}
                    onChange={(e) => setQuickAddForm(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="qa_unit">Enhed</Label>
                  <Input
                    id="qa_unit"
                    value={quickAddForm.unit}
                    onChange={(e) => setQuickAddForm(p => ({ ...p, unit: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="qa_price">Pris pr. enhed</Label>
                  <Input
                    id="qa_price"
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={quickAddForm.pricePerUnit}
                    onChange={(e) => setQuickAddForm(p => ({ ...p, pricePerUnit: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatCurrency(quickAddForm.qty * quickAddForm.pricePerUnit)} kr</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setQuickAddOpen(false); setQuickAddCategory(null); }} disabled={quickAddSavingItem}>
                Annullér
              </Button>
              <Button onClick={handleQuickAddSubmit} disabled={quickAddSavingItem || !quickAddForm.title.trim()}>
                {quickAddSavingItem ? 'Tilføjer…' : 'Tilføj'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Product Item Modal */}
        <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj produkt</DialogTitle>
              <DialogDescription>
                Vælg et produkt fra projektet at tilføje til linjen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Søge- og filtersektion */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="product-search">Søg produkter</Label>
                  <Input
                    id="product-search"
                    placeholder="Søg efter navn eller beskrivelse..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="product-type-filter">Filtrer efter type</Label>
                  <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle typer</SelectItem>
                      <SelectItem value="gardin">Gardin</SelectItem>
                      <SelectItem value="køkken">Køkken</SelectItem>
                      <SelectItem value="møbel">Møbel</SelectItem>
                      <SelectItem value="andet">Andet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const filteredProducts = getFilteredProducts();
                return filteredProducts.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredProducts.map((product) => {
                      // Beregn total cost korrekt ved at bruge calculateProductCost
                      const costCalculation = calculateProductCost(product.id);
                      const totalCost = costCalculation.grandTotal;
                      
                      return (
                        <div 
                          key={product.id} 
                          className={`p-3 border rounded ${selectedProductForAdd === product.id ? 'border-primary bg-primary/5' : 'cursor-pointer hover:bg-muted/50'}`}
                          onClick={() => {
                            if (selectedProductForAdd !== product.id) {
                              setSelectedProductForAdd(product.id);
                              setProductQuantity(1);
                            }
                          }}
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Cost: {formatCurrency(totalCost)}
                            {product.type && (
                              <span className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                                {product.type}
                              </span>
                            )}
                          </div>
                          
                          {selectedProductForAdd === product.id && (
                            <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <Label htmlFor="product-quantity">Antal</Label>
                                <Input
                                  id="product-quantity"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={productQuantity}
                                  onChange={(e) => setProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleAddProductItem(product.id, productQuantity)}
                                  className="flex-1"
                                >
                                  Tilføj {productQuantity > 1 ? `(${productQuantity} stk)` : ''}
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedProductForAdd(null);
                                    setProductQuantity(1);
                                  }}
                                >
                                  Annullér
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ingen produkter matcher søgningen</p>
                  <p className="text-sm">
                    {products.length === 0 
                      ? "Opret produkter først for at kunne tilføje dem"
                      : "Prøv at ændre søgekriterier eller filter"
                    }
                  </p>
                </div>
                );
              })()}
              
              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => {
                  setShowAddItemModal(false);
                  setSelectedProductForAdd(null);
                  setProductQuantity(1);
                }} variant="outline">
                  Luk
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Custom Item Modal */}
        <Dialog open={showCustomItemModal} onOpenChange={setShowCustomItemModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tilføj custom cost</DialogTitle>
              <DialogDescription>
                Opret en custom cost item til linjen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="customTitle">Titel *</Label>
                <Input
                  id="customTitle"
                  value={customItemFormData.title}
                  onChange={(e) => setCustomItemFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Item titel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customQty">Antal</Label>
                  <Input
                    id="customQty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={customItemFormData.qty}
                    onChange={(e) => setCustomItemFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="customUnit">Enhed</Label>
                  <Input
                    id="customUnit"
                    value={customItemFormData.unit}
                    onChange={(e) => setCustomItemFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="stk, m², etc."
                  />
                </div>
              </div>


              <div>
                <Label htmlFor="totalCostPerUnit">Total cost pr. unit</Label>
                <Input
                  id="totalCostPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customItemFormData.totalCostPerUnit}
                  onChange={(e) => setCustomItemFormData(prev => ({ ...prev, totalCostPerUnit: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setShowCustomItemModal(false)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={handleAddCustomItem}>
                  Tilføj item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Line Modal */}
        <Dialog open={editingLine !== null} onOpenChange={() => setEditingLine(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redigér tilbudslinje</DialogTitle>
              <DialogDescription>
                Redigér oplysningerne for tilbudslinjen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="editLineTitle">Titel *</Label>
                <Input
                  id="editLineTitle"
                  value={editLineFormData.title}
                  onChange={(e) => setEditLineFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Linjetitel"
                />
              </div>

              <div>
                <Label htmlFor="editLineDescription">Beskrivelse</Label>
                <Textarea
                  id="editLineDescription"
                  value={editLineFormData.description}
                  onChange={(e) => setEditLineFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beskrivelse af linjen"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editLineQuantity">Antal</Label>
                  <Input
                    id="editLineQuantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editLineFormData.quantity}
                    onChange={(e) => setEditLineFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="editLineUnit">Enhed</Label>
                  <Input
                    id="editLineUnit"
                    value={editLineFormData.unit}
                    onChange={(e) => setEditLineFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="stk, m², etc."
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <div className="flex-1" />
                <Button onClick={() => setEditingLine(null)} variant="outline">
                  Annullér
                </Button>
                <Button onClick={() => editingLine && handleUpdateLine(editingLine)}>
                  Gem ændringer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Delete Line Confirmation Dialog */}
        <Dialog open={showDeleteLineConfirm} onOpenChange={setShowDeleteLineConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slet tilbudslinje</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">Er du sikker på, at du vil slette denne tilbudslinje?</p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Sletning er permanent.</strong> Du kan i stedet vælge at arkivere linjen.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteLineConfirm(false);
                  setLineToDelete(null);
                }}
              >
                Annullér
              </Button>
              <Button 
                variant="secondary" 
                onClick={confirmArchiveInstead}
              >
                Arkivér i stedet
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteLine}
              >
                Slet permanent
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Item Confirmation Dialog */}
        <Dialog open={showDeleteItemConfirm} onOpenChange={setShowDeleteItemConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slet item</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">Er du sikker på, at du vil slette dette item?</p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Sletning er permanent.</strong> Itemet vil blive fjernet fra tilbudslinjen.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteItemConfirm(false);
                  setItemToDelete(null);
                }}
              >
                Annullér
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteItem}
                disabled={deletingItem !== null}
              >
                Slet permanent
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Update All Prices Confirmation Dialog */}
        <Dialog open={showUpdateAllConfirm} onOpenChange={setShowUpdateAllConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opdater alle produktpriser?</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="mb-4">
                Dette vil opdatere ALLE {lines.flatMap(line => line.items.filter(item => item.sourceType === 'project_product' && item.projectProductId)).length} produkter i tilbuddet til deres nyeste priser fra produktdatabasen.
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Eksisterende priser vil blive overskrevet.</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Dette kan tage et øjeblik afhængigt af antallet af produkter.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowUpdateAllConfirm(false)}
                disabled={updatingAllPrices}
              >
                Annullér
              </Button>
              <Button 
                onClick={updateAllProductPrices}
                disabled={updatingAllPrices}
              >
                Opdater alle priser
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectQuoteDetail;