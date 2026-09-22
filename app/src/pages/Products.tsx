import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectProducts } from '@/contexts/ProjectProductsContext';
import { useProjectMaterials } from '@/contexts/ProjectMaterialsContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProduct, PRODUCT_TYPES } from '@/types/products';
import { supabase } from '@/integrations/supabase/client';
import { ProductImportModal } from '@/components/ProductImportModal';
import {
  Plus,
  Edit,
  Copy,
  Archive,
  Search,
  Package,
  Import,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  Link2,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------------------------------------
 * Produktsiden (22-09-2026): tabel med udfoldelige rækker i stedet for klik-til-ny-side.
 * Klik på en række folder detaljerne ud (billede, stykliste, timer, kost, hvor produktet sidder i
 * tilbuddene). Den gamle produktside findes stadig via ↗-ikonet — legacy beholdes.
 * Kolonnevalg persisteres i localStorage (samme mønster som materialeopsummeringen på tilbudssiden).
 * ---------------------------------------------------------------------------------------------- */

type Oprindelse = 'Egenproduktion' | 'UE-produktion' | 'Indkøb' | 'Montage' | 'Transport' | 'Andet';
type MarginBand = 'Høj (≥55 %)' | 'Mellem (35–55 %)' | 'Lav (<35 %)' | 'Ukendt';

/** DB-værdi (project_products.oprindelse) → visningsnavn. NULL i DB = afledt af kostlinjer og type. */
const OPRINDELSE_DB: Record<string, Oprindelse> = {
  egenproduktion: 'Egenproduktion',
  ue_produktion: 'UE-produktion',
  indkoeb: 'Indkøb',
  montage: 'Montage',
  transport: 'Transport',
  andet: 'Andet',
};

/** Faste kategorier (project_products.category er fri tekst — disse er forslagene og det heuristikken lander i). */
const CATEGORY_SUGGESTIONS = [
  'Skab', 'Bordplade', 'Bænk', 'Garderobe', 'Hylde', 'Tilsætning & sokkel', 'Spejl', 'Sanitet', 'Tilbehør',
  'Polstring', 'Akustik', 'Afskærmning', 'Beklædning', 'Køkken', 'Ydelse & transport', 'Andet',
];

/** Gæt kategori ud fra navnet — bruges KUN når produktet hverken har egen kategori eller skabelon-kategori. Rækkefølgen er vigtig. */
const guessCategory = (name: string, productType: string): string | null => {
  const n = name.toLowerCase();
  const t = (re: RegExp) => re.test(n);
  if (t(/\b(montage|levering|transport|fragt|risiko|regningsarbejde|svendetime|lærlingetime|opmåling)/)) return 'Ydelse & transport';
  if (t(/hynde|polstr/)) return 'Polstring';
  if (t(/garderobe/)) return 'Garderobe';
  if (t(/skab\b|skabe\b|skab,|taskekasse|madrasskab|højskab|underskab|overskab|vaskeskab|skuffeskab/)) return 'Skab';
  if (t(/bordplade|stålbord/)) return 'Bordplade';
  if (t(/bænk/)) return 'Bænk';
  if (t(/tilsætning|sokkel|lysning|dækside|blindfront|fyldning/)) return 'Tilsætning & sokkel';
  if (t(/spejl/)) return 'Spejl';
  if (t(/holder|dispenser|affaldskurv|knage|krog|greb|lås\b|bøjle/)) return 'Tilbehør';
  if (t(/håndvask|udslagsvask|\bvask\b|puslebord|toilet|armatur|bruse/)) return 'Sanitet';
  if (t(/hylde|reol/)) return 'Hylde';
  if (t(/akustik/)) return 'Akustik';
  if (t(/afskærm|skærm/)) return 'Afskærmning';
  if (t(/beklædning|panel/)) return 'Beklædning';
  if (t(/køkken/)) return 'Køkken';
  if (productType === 'installation') return 'Ydelse & transport';
  return null;
};

interface ProductMeta {
  standardProductId: string | null;
  componentType: string | null;
  templateDeviation: string | null;
  templateName: string | null;
  templateCategory: string | null;
  templateProfile: string | null;
  /** Egen kategori sat på produktet (project_products.category) — vinder over skabelon og heuristik */
  category: string | null;
  /** Egen oprindelse sat på produktet (project_products.oprindelse, DB-værdi) — vinder over det afledte */
  oprindelse: string | null;
}

/** Et billede der sidder på en tilbudslinje hvor produktet indgår. */
interface LineImage {
  url: string;
  kind: 'custom' | 'render';
  lineId: string;
  lineTitle: string;
  quoteNumber: string;
  /** Antal items på linjen — 1 = billedet viser kun dette produkt */
  itemsOnLine: number;
}

interface UsageItem {
  itemId: string;
  qty: number;
  factorProfile: string | null;
  itemFactors: Record<string, number> | null;
  breakdown: Record<string, number> | null;
  ctpu: number;
  lineId: string;
  lineTitle: string;
  lineQty: number;
  lineArchived: boolean;
  lineIsOption: boolean;
  pricingMode: string | null;
  markupPct: number | null;
  targetUnitPrice: number | null;
  lineFactors: Record<string, number> | null;
  /** Det billede linjen selv viser (aktiv kilde, ellers custom, ellers render) */
  lineImage: string | null;
  lineImageCustom: string | null;
  lineImageRender: string | null;
  quoteId: string;
  quoteNumber: string;
  quoteStatus: string;
}

/** De to billedslots pr. produkt (produkt_billeder): vores egen reference og kundens. */
type ImageSlot = 'vores' | 'kunde';
interface ProductImages {
  vores?: { url: string; caption: string | null };
  kunde?: { url: string; caption: string | null };
}

interface DerivedProduct {
  product: ProjectProduct;
  meta: ProductMeta;
  images: ProductImages;
  lineImageUrl: string | null;
  /** Alle billeder fra de tilbudslinjer produktet sidder på (dedupleret på URL, "kun dette produkt" først) */
  lineImages: LineImage[];
  imageSource: 'vores' | 'kunde' | 'tilbudslinje' | null;
  // Kost pr. enhed fra kostlinjerne (ekskl. Korpus — samme regel som DB-snapshottet)
  materials: number;
  ue: number;
  korpus: number;
  montage: number;
  transport: number;
  other: number;
  costExKorpus: number;
  oprindelse: Oprindelse;
  usage: UsageItem[];
  quoteNumbers: string[];
  totalQtyInQuotes: number;
  used: boolean;
  profile: string | null;
  estSellPerUnit: number | null;
  dgPct: number | null;
  marginBand: MarginBand;
  imageUrl: string | null;
  category: string;
  categorySource: 'egen' | 'skabelon' | 'afledt' | 'ingen';
  oprindelseSource: 'egen' | 'afledt';
  /** Hvad reglen ville give uden en egen værdi — vises i dropdownens "Afledt"-valg */
  derivedOprindelse: Oprindelse;
}

const COLS = [
  { key: 'image', label: 'Billede' },
  { key: 'category', label: 'Kategori' },
  { key: 'template', label: 'Skabelon' },
  { key: 'origin', label: 'Oprindelse' },
  { key: 'type', label: 'Type' },
  { key: 'qty', label: 'Antal' },
  { key: 'cost', label: 'Kost/stk' },
  { key: 'korpus', label: 'Korpus-timer kr' },
  { key: 'dg', label: 'DG (est.)' },
  { key: 'profile', label: 'Profil' },
  { key: 'quotes', label: 'I tilbud' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Opdateret' },
] as const;
type ColKey = typeof COLS[number]['key'];
const COLS_KEY = 'products.cols.v1';
const DEFAULT_COLS: Record<ColKey, boolean> = {
  image: true, category: true, template: false, origin: true, type: false, qty: true,
  cost: true, korpus: false, dg: true, profile: true, quotes: true, status: false, updated: false,
};

type SortKey = 'name' | 'category' | 'origin' | 'qty' | 'cost' | 'dg' | 'profile' | 'quotes' | 'updated' | 'status';
type GroupKey = 'none' | 'category' | 'origin' | 'used' | 'margin' | 'profile' | 'type' | 'quote';

const PROFILE_LABELS: Record<string, string> = {
  hyldevare: 'Hyldevare',
  special: 'Special',
  indkoebsvare: 'Indkøbsvare',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' kr';
const fmtPct = (n: number | null) => (n == null ? '–' : `${n.toFixed(0)} %`);

const Products = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const {
    products,
    loading,
    addProduct,
    updateProduct,
    copyProduct,
    getProductMaterialLines,
    getProductLaborLines,
    getProductTransportLines,
    getProductOtherCostLines,
  } = useProjectProducts();
  const { projectMaterials } = useProjectMaterials();
  const { user } = useAuth();

  // ── Filtre, sortering, gruppering ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [usedFilter, setUsedFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [quoteFilter, setQuoteFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupKey>('none');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [cols, setCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      if (raw) return { ...DEFAULT_COLS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_COLS;
  });
  useEffect(() => {
    try { localStorage.setItem(COLS_KEY, JSON.stringify(cols)); } catch {}
  }, [cols]);

  // ── Dialoger ──────────────────────────────────────────────────────────────────
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProjectProduct | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    productType: 'other' as 'other' | 'curtain' | 'installation' | 'furniture',
    unit: 'stk',
    quantity: 1,
    description: '',
    notes: '',
    status: 'active' as 'active' | 'archived',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Ekstra data der ikke ligger i konteksten ──────────────────────────────────
  const [metaById, setMetaById] = useState<Record<string, ProductMeta>>({});
  const [usageByProduct, setUsageByProduct] = useState<Record<string, UsageItem[]>>({});
  const [imagesByProduct, setImagesByProduct] = useState<Record<string, ProductImages>>({});
  const [extraLoading, setExtraLoading] = useState(false);
  const [imageBusy, setImageBusy] = useState<string | null>(null); // `${productId}:${slot}`

  const loadImages = async (productIds: string[]) => {
    if (productIds.length === 0) { setImagesByProduct({}); return; }
    const { data, error } = await supabase
      .from('produkt_billeder')
      .select('product_id, image_url, caption, kunde_ref_url, kunde_ref_caption')
      .in('product_id', productIds);
    if (error) { console.error('Products: kunne ikke hente produktbilleder', error); return; }
    const imgs: Record<string, ProductImages> = {};
    for (const r of (data as any[]) ?? []) {
      imgs[r.product_id] = {
        vores: r.image_url ? { url: r.image_url, caption: r.caption ?? null } : undefined,
        kunde: r.kunde_ref_url ? { url: r.kunde_ref_url, caption: r.kunde_ref_caption ?? null } : undefined,
      };
    }
    setImagesByProduct(imgs);
  };

  /** Gem et billede i en slot (upsert på product_id — den anden slot røres ikke). */
  const saveProductImage = async (productId: string, slot: ImageSlot, url: string, sourceRef: string, caption?: string | null) => {
    const payload: any = { product_id: productId, created_by: user?.email ?? 'ukendt', updated_at: new Date().toISOString() };
    if (slot === 'vores') { payload.image_url = url; payload.source_ref = sourceRef; if (caption !== undefined) payload.caption = caption; }
    else { payload.kunde_ref_url = url; payload.kunde_ref_source_ref = sourceRef; if (caption !== undefined) payload.kunde_ref_caption = caption; }
    const { error } = await supabase.from('produkt_billeder').upsert(payload, { onConflict: 'product_id' });
    if (error) throw error;
  };

  const uploadProductImage = async (productId: string, slot: ImageSlot, file: File) => {
    if (!file.type.startsWith('image/')) { toast({ title: 'Fejl', description: 'Kun billed-filer er tilladt', variant: 'destructive' }); return; }
    const key = `${productId}:${slot}`;
    try {
      setImageBusy(key);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${productId}/${slot === 'vores' ? 'vores-ref' : 'kunde-ref'}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-photos').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(path);
      await saveProductImage(productId, slot, publicUrl, `upload:${file.name}`);
      await loadImages(products.map(p => p.id));
      toast({ title: slot === 'vores' ? 'Vores referencebillede gemt' : 'Kundens referencebillede gemt' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Fejl', description: e?.message ?? 'Kunne ikke uploade billedet', variant: 'destructive' });
    } finally { setImageBusy(null); }
  };

  const linkProductImage = async (productId: string, slot: ImageSlot) => {
    const url = window.prompt(slot === 'vores' ? 'Link til vores referencebillede (URL):' : 'Link til kundens referencebillede (URL):');
    if (!url || !/^https?:\/\//i.test(url.trim())) return;
    const caption = window.prompt('Billedtekst (valgfri):') ?? null;
    const key = `${productId}:${slot}`;
    try {
      setImageBusy(key);
      await saveProductImage(productId, slot, url.trim(), 'link', caption || null);
      await loadImages(products.map(p => p.id));
      toast({ title: 'Billedlink gemt' });
    } catch (e: any) {
      toast({ title: 'Fejl', description: e?.message ?? 'Kunne ikke gemme linket', variant: 'destructive' });
    } finally { setImageBusy(null); }
  };

  /** Brug et billede fra en tilbudslinje som produktets reference (kopierer kun URL'en — filen bliver hvor den er). */
  const adoptLineImage = async (productId: string, slot: ImageSlot, url: string, sourceRef: string) => {
    const key = `${productId}:${slot}`;
    try {
      setImageBusy(key);
      await saveProductImage(productId, slot, url, sourceRef, null);
      await loadImages(products.map(p => p.id));
      toast({ title: slot === 'vores' ? 'Sat som vores reference' : 'Sat som kundens reference' });
    } catch (e: any) {
      toast({ title: 'Fejl', description: e?.message ?? 'Kunne ikke gemme billedet', variant: 'destructive' });
    } finally { setImageBusy(null); }
  };

  const removeProductImage = async (productId: string, slot: ImageSlot) => {
    const cur = imagesByProduct[productId];
    if (!cur) return;
    const other = slot === 'vores' ? cur.kunde : cur.vores;
    const key = `${productId}:${slot}`;
    try {
      setImageBusy(key);
      if (!other) {
        // Sidste billede på rækken — rækken fjernes (CHECK kræver mindst ét billede). Filen i storage bevares.
        const { error } = await supabase.from('produkt_billeder').delete().eq('product_id', productId);
        if (error) throw error;
      } else {
        const patch = slot === 'vores'
          ? { image_url: null, caption: null, source_ref: null }
          : { kunde_ref_url: null, kunde_ref_caption: null, kunde_ref_source_ref: null };
        const { error } = await supabase.from('produkt_billeder').update({ ...patch, updated_at: new Date().toISOString() }).eq('product_id', productId);
        if (error) throw error;
      }
      await loadImages(products.map(p => p.id));
      toast({ title: 'Billede fjernet fra produktet' });
    } catch (e: any) {
      toast({ title: 'Fejl', description: e?.message ?? 'Kunne ikke fjerne billedet', variant: 'destructive' });
    } finally { setImageBusy(null); }
  };

  /** Skabelon + egen kategori/oprindelse pr. produkt. Kaldes igen efter inline-redigering. */
  const loadMeta = async (projectId: string) => {
    const { data, error } = await supabase
      .from('project_products_2026_01_15_12_49')
      .select('id, standard_product_id, component_type, template_deviation, category, oprindelse, standard_products_2026_07_11(name, category, factor_profile)')
      .eq('project_id', projectId);
    if (error) throw error;
    const meta: Record<string, ProductMeta> = {};
    for (const r of (data as any[]) ?? []) {
      const sp = Array.isArray(r.standard_products_2026_07_11) ? r.standard_products_2026_07_11[0] : r.standard_products_2026_07_11;
      meta[r.id] = {
        standardProductId: r.standard_product_id ?? null,
        componentType: r.component_type ?? null,
        templateDeviation: r.template_deviation ?? null,
        templateName: sp?.name ?? null,
        templateCategory: sp?.category ?? null,
        templateProfile: sp?.factor_profile ?? null,
        category: r.category ?? null,
        oprindelse: r.oprindelse ?? null,
      };
    }
    setMetaById(meta);
  };

  /** Gem egen kategori eller oprindelse på produktet (NULL = tilbage til afledt). */
  const saveProductField = async (productId: string, patch: { category?: string | null; oprindelse?: string | null }) => {
    if (!activeProject) return;
    const { error } = await supabase
      .from('project_products_2026_01_15_12_49')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', productId);
    if (error) { toast({ title: 'Kunne ikke gemme', description: error.message, variant: 'destructive' }); return; }
    await loadMeta(activeProject.id);
  };

  /** Hent alle items der peger på et produkt i projektets tilbud — i tre trin (tilbud → linjer → items),
   *  så vi ikke afhænger af filtre på dobbelt-indlejrede relationer. Fejl vises i stedet for at give en tom side. */
  const loadUsage = async (projectId: string) => {
    const chunk = <T,>(arr: T[], n = 100): T[][] => { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

    const { data: quotes, error: qErr } = await supabase
      .from('project_quotes_2026_01_16_23_00')
      .select('id, quote_number, status')
      .eq('project_id', projectId);
    if (qErr) throw qErr;
    const quoteById: Record<string, { id: string; quote_number: string; status: string }> = {};
    for (const q of (quotes as any[]) ?? []) quoteById[q.id] = q;
    const quoteIds = Object.keys(quoteById);
    if (quoteIds.length === 0) { setUsageByProduct({}); return; }

    const lines: any[] = [];
    for (const ids of chunk(quoteIds)) {
      const { data, error } = await supabase
        .from('project_quote_lines_2026_01_16_23_00')
        .select('id, project_quote_id, title, archived, quantity, is_option, pricing_mode, markup_pct, target_unit_price, effective_category_factors, custom_image_url, render_image_url, active_image_source')
        .in('project_quote_id', ids);
      if (error) throw error;
      lines.push(...((data as any[]) ?? []));
    }
    const lineById: Record<string, any> = {};
    for (const l of lines) lineById[l.id] = l;
    const lineIds = Object.keys(lineById);
    if (lineIds.length === 0) { setUsageByProduct({}); return; }

    const items: any[] = [];
    for (const ids of chunk(lineIds)) {
      const { data, error } = await supabase
        .from('project_quote_line_items_2026_01_16_23_00')
        .select('id, qty, project_product_id, project_quote_line_id, factor_profile, effective_category_factors, cost_breakdown_json, cost_total_per_unit')
        .in('project_quote_line_id', ids)
        .not('project_product_id', 'is', null);
      if (error) throw error;
      items.push(...((data as any[]) ?? []));
    }

    const usage: Record<string, UsageItem[]> = {};
    for (const r of items) {
      const l = lineById[r.project_quote_line_id];
      const q = l ? quoteById[l.project_quote_id] : null;
      if (!l || !q) continue;
      // Linjens eget billede: den aktive kilde, ellers hvad der findes. 'none' gælder PDF'en — internt vil vi stadig se billedet.
      const img = (l.active_image_source === 'custom' && l.custom_image_url) ? l.custom_image_url
        : (l.active_image_source === 'render' && l.render_image_url) ? l.render_image_url
        : (l.custom_image_url || l.render_image_url || null);
      const item: UsageItem = {
        itemId: r.id,
        qty: Number(r.qty ?? 0),
        factorProfile: r.factor_profile ?? null,
        itemFactors: r.effective_category_factors ?? null,
        breakdown: r.cost_breakdown_json ?? null,
        ctpu: Number(r.cost_total_per_unit ?? 0),
        lineId: l.id,
        lineTitle: l.title,
        lineQty: Number(l.quantity ?? 0),
        lineArchived: l.archived === true,
        lineIsOption: l.is_option === true,
        pricingMode: l.pricing_mode ?? null,
        markupPct: l.markup_pct != null ? Number(l.markup_pct) : null,
        targetUnitPrice: l.target_unit_price != null ? Number(l.target_unit_price) : null,
        lineFactors: l.effective_category_factors ?? null,
        lineImage: img,
        lineImageCustom: l.custom_image_url ?? null,
        lineImageRender: l.render_image_url ?? null,
        quoteId: q.id,
        quoteNumber: q.quote_number,
        quoteStatus: q.status,
      };
      (usage[r.project_product_id] ??= []).push(item);
    }
    setUsageByProduct(usage);
  };

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    const load = async () => {
      setExtraLoading(true);
      try {
        const results = await Promise.allSettled([
          loadMeta(activeProject.id),
          loadUsage(activeProject.id),
          loadImages(products.map(p => p.id)),
        ]);
        if (cancelled) return;
        const failed = results.map((r, i) => (r.status === 'rejected' ? ['skabeloner', 'tilbudsbrug', 'billeder'][i] + ': ' + ((r.reason as any)?.message ?? String(r.reason)) : null)).filter(Boolean);
        if (failed.length) {
          console.error('Products: delvis indlæsning fejlede', failed);
          toast({ title: 'Noget kunne ikke hentes', description: failed.join(' · '), variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setExtraLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeProject?.id, products.length]);

  // ── Afledte værdier pr. produkt ───────────────────────────────────────────────
  const derived: DerivedProduct[] = useMemo(() => {
    // Antal items pr. linje — så vi kan foretrække et linjebillede der KUN viser dette produkt
    const itemsPerLine: Record<string, number> = {};
    for (const list of Object.values(usageByProduct)) for (const u of list) itemsPerLine[u.lineId] = (itemsPerLine[u.lineId] ?? 0) + 1;

    return products.map((product) => {
      const meta: ProductMeta = metaById[product.id] ?? {
        standardProductId: null, componentType: null, templateDeviation: null,
        templateName: null, templateCategory: null, templateProfile: null,
        category: null, oprindelse: null,
      };

      let materials = 0;
      for (const ml of getProductMaterialLines(product.id)) {
        const mat = projectMaterials.find(m => m.id === ml.projectMaterialId);
        const unitCost = ml.unitCostOverride ?? mat?.unitPrice ?? 0;
        materials += (ml.qty ?? 0) * unitCost;
      }
      let ue = 0, korpus = 0, montage = 0, other = 0;
      for (const ll of getProductLaborLines(product.id)) {
        const c = (ll.qty ?? 0) * (ll.unitCost ?? 0);
        const t = ll.laborType as string;
        if (t === 'korpus_production') korpus += c;
        else if (t === 'production') ue += c;
        else if (t === 'dk_installation') montage += c;
        else other += c;
      }
      const transport = getProductTransportLines(product.id).reduce((s, l) => s + (l.qty ?? 0) * (l.unitCost ?? 0), 0);
      other += getProductOtherCostLines(product.id).reduce((s, l) => s + (l.qty ?? 0) * (l.unitCost ?? 0), 0);
      const costExKorpus = materials + ue + montage + transport + other;

      // Oprindelse: egen værdi på produktet vinder. Ellers afledt — timer først, så skabelonens profil, så produkttypen.
      // "Møbel" uden Korpus-timer er STADIG egenproduktion (26027 har ingen timelinjer endnu — det må ikke gøre skabe til indkøb).
      const nameLc = product.name.toLowerCase();
      let derivedOprindelse: Oprindelse;
      if (korpus > 0) derivedOprindelse = 'Egenproduktion';
      else if (ue > 0) derivedOprindelse = 'UE-produktion';
      else if (meta.templateProfile === 'indkoebsvare') derivedOprindelse = 'Indkøb';
      else if (/\b(transport|levering|fragt)\b/.test(nameLc) && materials === 0) derivedOprindelse = 'Transport';
      else if (/\b(montage|montering|svendetime|lærlingetime|regningsarbejde|risiko)\b/.test(nameLc) && materials === 0) derivedOprindelse = 'Montage';
      else if (product.productType === 'furniture') derivedOprindelse = 'Egenproduktion';
      else if (product.productType === 'installation') derivedOprindelse = montage > 0 || materials === 0 ? 'Montage' : 'Indkøb';
      else if (materials > 0) derivedOprindelse = 'Indkøb';
      else if (montage > 0) derivedOprindelse = 'Montage';
      else if (transport > 0) derivedOprindelse = 'Transport';
      else derivedOprindelse = product.productType === 'other' || product.productType === 'curtain' ? 'Indkøb' : 'Andet';
      const egenOprindelse = meta.oprindelse ? OPRINDELSE_DB[meta.oprindelse] : undefined;
      const oprindelse: Oprindelse = egenOprindelse ?? derivedOprindelse;
      const oprindelseSource: 'egen' | 'afledt' = egenOprindelse ? 'egen' : 'afledt';

      // Kategori: egen > skabelonens > gæt fra navnet > Andet
      let category: string;
      let categorySource: DerivedProduct['categorySource'];
      const guessed = guessCategory(product.name, product.productType);
      if (meta.category) { category = meta.category; categorySource = 'egen'; }
      else if (meta.templateCategory) { category = meta.templateCategory; categorySource = 'skabelon'; }
      else if (guessed) { category = guessed; categorySource = 'afledt'; }
      else { category = 'Andet'; categorySource = 'ingen'; }

      const usageAll = usageByProduct[product.id] ?? [];
      const usage = usageAll.filter(u => !u.lineArchived && u.quoteStatus !== 'archived');
      const quoteNumbers = Array.from(new Set(usage.map(u => u.quoteNumber))).sort();
      const totalQtyInQuotes = usage.reduce((s, u) => s + u.qty * (u.lineQty || 1), 0);

      // Estimeret salgspris pr. enhed: første faktor-linje hvor produktet indgår (item-faktorer > linjens)
      let estSellPerUnit: number | null = null;
      let profile: string | null = usage.find(u => u.factorProfile)?.factorProfile ?? meta.templateProfile ?? null;
      const factorItem = usage.find(u => u.pricingMode === 'category_factors' && u.breakdown);
      if (factorItem) {
        const f = factorItem.itemFactors ?? factorItem.lineFactors ?? {};
        const b = factorItem.breakdown ?? {};
        let sell = 0;
        for (const [k, v] of Object.entries(b)) {
          const key = k === 'transport' ? 'product_transport' : k;
          sell += Number(v ?? 0) * Number((f as any)[key] ?? 1);
        }
        estSellPerUnit = sell;
      } else {
        const markupItem = usage.find(u => u.pricingMode === 'markup_pct' && u.ctpu > 0);
        if (markupItem) estSellPerUnit = markupItem.ctpu * (1 + (markupItem.markupPct ?? 0) / 100);
      }
      // DG mod snapshottets kost (ekskl. Korpus) — falder tilbage til kostlinjerne hvis snapshot mangler
      const snapCost = factorItem?.ctpu ?? usage[0]?.ctpu ?? null;
      const dgBase = snapCost != null && snapCost > 0 ? snapCost : costExKorpus;
      const dgPct = estSellPerUnit != null && estSellPerUnit > 0 ? ((estSellPerUnit - dgBase) / estSellPerUnit) * 100 : null;
      const marginBand: MarginBand = dgPct == null ? 'Ukendt' : dgPct >= 55 ? 'Høj (≥55 %)' : dgPct >= 35 ? 'Mellem (35–55 %)' : 'Lav (<35 %)';

      // Billede i rækken: vores reference > kundens reference > et linjebillede (helst en linje der kun har dette produkt)
      // Alle linjebilleder (også fra arkiverede linjer — et billede er et billede), dedupleret på URL,
      // linjer med kun dette produkt først, custom (kundens/vores upload) før render.
      const seen = new Set<string>();
      const lineImages: LineImage[] = [];
      const sortedUsage = [...usageAll].sort((a, b) => (itemsPerLine[a.lineId] ?? 99) - (itemsPerLine[b.lineId] ?? 99));
      for (const u of sortedUsage) {
        for (const [url, kind] of [[u.lineImageCustom, 'custom'], [u.lineImageRender, 'render']] as [string | null, 'custom' | 'render'][]) {
          if (!url || seen.has(url)) continue;
          seen.add(url);
          lineImages.push({ url, kind, lineId: u.lineId, lineTitle: u.lineTitle, quoteNumber: u.quoteNumber, itemsOnLine: itemsPerLine[u.lineId] ?? 1 });
        }
      }
      const lineImg = sortedUsage.find(u => !u.lineArchived && u.lineImage)?.lineImage ?? lineImages[0]?.url ?? null;
      const images = imagesByProduct[product.id] ?? {};
      const imageUrl = images.vores?.url ?? images.kunde?.url ?? lineImg;
      const imageSource = images.vores ? 'vores' : images.kunde ? 'kunde' : lineImg ? 'tilbudslinje' : null;

      return {
        product, meta, images, lineImageUrl: lineImg, lineImages, imageSource,
        materials, ue, korpus, montage, transport, other, costExKorpus, oprindelse, oprindelseSource, derivedOprindelse,
        usage, quoteNumbers, totalQtyInQuotes, used: usage.length > 0, profile, estSellPerUnit, dgPct, marginBand,
        imageUrl, category, categorySource,
      };
    });
  }, [products, metaById, usageByProduct, imagesByProduct, projectMaterials, getProductMaterialLines, getProductLaborLines, getProductTransportLines, getProductOtherCostLines]);

  const allQuoteNumbers = useMemo(() => Array.from(new Set(derived.flatMap(d => d.quoteNumbers))).sort(), [derived]);
  const allCategories = useMemo(() => Array.from(new Set(derived.map(d => d.category))).sort((a, b) => a.localeCompare(b, 'da')), [derived]);
  const categoryOptions = useMemo(() => Array.from(new Set([...CATEGORY_SUGGESTIONS, ...allCategories])).sort((a, b) => a.localeCompare(b, 'da')), [allCategories]);
  const allOrigins = useMemo(() => Array.from(new Set(derived.map(d => d.oprindelse))).sort(), [derived]);

  // ── Filtrering + sortering ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = derived.filter(d => {
      const p = d.product;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (usedFilter === 'used' && !d.used) return false;
      if (usedFilter === 'unused' && d.used) return false;
      if (quoteFilter !== 'all' && !d.quoteNumbers.includes(quoteFilter)) return false;
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (originFilter !== 'all' && d.oprindelse !== originFilter) return false;
      if (q) {
        const hay = [p.name, p.description, p.notes, d.meta.templateName, d.category, d.oprindelse, d.quoteNumbers.join(' '), ...d.usage.map(u => u.lineTitle)]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpStr = (a: string, b: string) => a.localeCompare(b, 'da') * dir;
    const cmpNum = (a: number | null, b: number | null) => ((a ?? -Infinity) - (b ?? -Infinity)) * dir;
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'name': return cmpStr(a.product.name, b.product.name);
        case 'category': return cmpStr(a.category, b.category) || cmpStr(a.product.name, b.product.name);
        case 'origin': return cmpStr(a.oprindelse, b.oprindelse) || cmpStr(a.product.name, b.product.name);
        case 'qty': return cmpNum(a.totalQtyInQuotes, b.totalQtyInQuotes);
        case 'cost': return cmpNum(a.costExKorpus, b.costExKorpus);
        case 'dg': return cmpNum(a.dgPct, b.dgPct);
        case 'profile': return cmpStr(a.profile ?? '', b.profile ?? '');
        case 'quotes': return cmpStr(a.quoteNumbers.join(','), b.quoteNumbers.join(',')) || cmpStr(a.product.name, b.product.name);
        case 'status': return cmpStr(a.product.status, b.product.status);
        case 'updated': return cmpNum(a.product.updatedAt.getTime(), b.product.updatedAt.getTime());
      }
    });
    return rows;
  }, [derived, searchTerm, statusFilter, usedFilter, quoteFilter, categoryFilter, originFilter, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', label: '', rows: filtered }];
    const keyOf = (d: DerivedProduct): string => {
      switch (groupBy) {
        case 'category': return d.category;
        case 'origin': return d.oprindelse;
        case 'used': return d.used ? 'I tilbud' : 'Ikke i tilbud';
        case 'margin': return d.marginBand;
        case 'profile': return d.profile ? (PROFILE_LABELS[d.profile] ?? d.profile) : 'Ingen profil';
        case 'type': return PRODUCT_TYPES[d.product.productType] ?? d.product.productType;
        case 'quote': return d.quoteNumbers.length ? d.quoteNumbers.join(' + ') : 'Ikke i tilbud';
      }
      return '';
    };
    const map = new Map<string, DerivedProduct[]>();
    for (const d of filtered) { const k = keyOf(d); (map.get(k) ?? map.set(k, []).get(k)!).push(d); }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'da')).map(([key, rows]) => ({ key, label: key, rows }));
  }, [filtered, groupBy]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'cost' || key === 'dg' || key === 'qty' || key === 'updated' ? 'desc' : 'asc'); }
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-40" />
      : sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ── Opret/ret/kopiér/arkivér (uændret adfærd) ─────────────────────────────────
  const resetForm = () => {
    setFormData({ name: '', productType: 'other', unit: 'stk', quantity: 1, description: '', notes: '', status: 'active' });
    setErrors({});
  };
  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Produktnavn er påkrævet';
    if (formData.quantity <= 0) e.quantity = 'Antal skal være større end 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!activeProject) { toast({ title: 'Fejl', description: 'Intet aktivt projekt valgt', variant: 'destructive' }); return; }
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        toast({ title: 'Produkt opdateret', description: `${formData.name} er blevet opdateret` });
        setEditingProduct(null);
      } else {
        await addProduct({ ...formData, projectId: activeProject.id });
        toast({ title: 'Produkt oprettet', description: `${formData.name} er blevet oprettet` });
        setIsCreateDialogOpen(false);
      }
      resetForm();
    } catch {
      toast({ title: 'Fejl', description: 'Der opstod en fejl ved gemning af produktet', variant: 'destructive' });
    }
  };
  const handleEdit = (product: ProjectProduct) => {
    setFormData({
      name: product.name,
      productType: product.productType,
      unit: product.unit,
      quantity: product.quantity,
      description: product.description || '',
      notes: product.notes || '',
      status: product.status,
    });
    setEditingProduct(product);
  };
  const handleCopy = async (product: ProjectProduct) => {
    try { await copyProduct(product.id); toast({ title: 'Produkt kopieret', description: `${product.name} er blevet kopieret` }); }
    catch { toast({ title: 'Fejl', description: 'Der opstod en fejl ved kopiering af produktet', variant: 'destructive' }); }
  };
  const handleArchive = async (product: ProjectProduct) => {
    try {
      await updateProduct(product.id, { status: product.status === 'active' ? 'archived' : 'active' });
      toast({ title: product.status === 'active' ? 'Produkt arkiveret' : 'Produkt genaktiveret', description: product.name });
    } catch { toast({ title: 'Fejl', description: 'Der opstod en fejl ved ændring af produktstatus', variant: 'destructive' }); }
  };
  const handleImportComplete = () => {
    toast({ title: 'Produkter opdateret', description: 'Produktlisten opdateres automatisk med importerede produkter' });
    setTimeout(() => window.location.reload(), 1000);
  };

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">Intet aktivt projekt</h3>
            <p className="text-muted-foreground mb-4">Vælg et projekt for at se produkter</p>
            <Button onClick={() => navigate('/')}>Vælg Projekt</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const colCount = 2 + Object.values(cols).filter(Boolean).length; // chevron + navn + valgte + handlinger (−1 fordi navn tæller)
  const usedCount = derived.filter(d => d.used && d.product.status === 'active').length;
  const activeCount = derived.filter(d => d.product.status === 'active').length;

  const th = (label: string, key?: SortKey, align: 'left' | 'right' | 'center' = 'left') => (
    <th
      className={`px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap ${key ? 'cursor-pointer select-none hover:text-foreground' : ''} text-${align}`}
      onClick={key ? () => toggleSort(key) : undefined}
    >
      {label}{key && <SortIcon k={key} />}
    </th>
  );

  return (
    <Layout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Produkter</h1>
            <p className="text-muted-foreground mt-1">
              {activeProject.name} · {activeCount} aktive · {usedCount} i tilbud · {activeCount - usedCount} ikke i tilbud
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2">
              <Import className="h-4 w-4" /> Importér fra projekt
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Opret Produkt
            </Button>
          </div>
        </div>

        {/* Filtre */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input placeholder="Søg navn, skabelon, tilbudslinje…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={usedFilter} onValueChange={(v: any) => setUsedFilter(v)}>
                <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Brugt + ikke brugt</SelectItem>
                  <SelectItem value="used">Kun i tilbud</SelectItem>
                  <SelectItem value="unused">Kun ikke i tilbud</SelectItem>
                </SelectContent>
              </Select>
              <Select value={quoteFilter} onValueChange={setQuoteFilter}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tilbud" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle tilbud</SelectItem>
                  {allQuoteNumbers.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kategorier</SelectItem>
                  {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Oprindelse" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle oprindelser</SelectItem>
                  {allOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktive</SelectItem>
                  <SelectItem value="archived">Arkiverede</SelectItem>
                  <SelectItem value="all">Alle status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Gruppér" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen gruppering</SelectItem>
                  <SelectItem value="category">Gruppér: kategori</SelectItem>
                  <SelectItem value="origin">Gruppér: oprindelse</SelectItem>
                  <SelectItem value="used">Gruppér: brugt / ikke brugt</SelectItem>
                  <SelectItem value="quote">Gruppér: tilbud</SelectItem>
                  <SelectItem value="margin">Gruppér: margin</SelectItem>
                  <SelectItem value="profile">Gruppér: profil</SelectItem>
                  <SelectItem value="type">Gruppér: produkttype</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2"><SlidersHorizontal className="h-4 w-4" /> Kolonner</Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <p className="text-xs text-muted-foreground mb-2">Vælg kolonner (gemmes i browseren)</p>
                  <div className="space-y-2">
                    {COLS.map(c => (
                      <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={cols[c.key]} onCheckedChange={(v) => setCols(prev => ({ ...prev, [c.key]: v === true }))} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Tabel */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Indlæser produkter…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Ingen produkter matcher filtrene</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="w-8" />
                    {cols.image && th('', undefined, 'center')}
                    {th('Produkt', 'name')}
                    {cols.category && th('Kategori', 'category')}
                    {cols.template && th('Skabelon')}
                    {cols.origin && th('Oprindelse', 'origin')}
                    {cols.type && th('Type')}
                    {cols.qty && th('Antal i tilbud', 'qty', 'right')}
                    {cols.cost && th('Kost/stk', 'cost', 'right')}
                    {cols.korpus && th('Korpus kr/stk', undefined, 'right')}
                    {cols.dg && th('DG est.', 'dg', 'right')}
                    {cols.profile && th('Profil', 'profile')}
                    {cols.quotes && th('I tilbud', 'quotes')}
                    {cols.status && th('Status', 'status')}
                    {cols.updated && th('Opdateret', 'updated')}
                    <th className="px-3 py-2 w-36" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <React.Fragment key={g.key || '__all'}>
                      {groupBy !== 'none' && (
                        <tr className="bg-muted/60 border-y">
                          <td colSpan={colCount + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {g.label} <span className="font-normal">· {g.rows.length} produkt{g.rows.length === 1 ? '' : 'er'}</span>
                            {' · '}kost {fmt(g.rows.reduce((s, d) => s + d.costExKorpus * Math.max(1, d.totalQtyInQuotes || 1), 0))}
                          </td>
                        </tr>
                      )}
                      {g.rows.map(d => {
                        const p = d.product;
                        const isOpen = expanded.has(p.id);
                        return (
                          <React.Fragment key={p.id}>
                            <tr
                              className={`border-b cursor-pointer hover:bg-muted/40 ${isOpen ? 'bg-muted/30' : ''} ${p.status === 'archived' ? 'opacity-60' : ''}`}
                              onClick={() => toggleExpand(p.id)}
                            >
                              <td className="px-2 py-2 text-muted-foreground">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </td>
                              {cols.image && (
                                <td className="px-2 py-1 w-14">
                                  {d.imageUrl ? (
                                    <div className="relative h-10 w-10">
                                      <img src={d.imageUrl} alt="" className="h-10 w-10 object-cover rounded border bg-white" loading="lazy" />
                                      <span
                                        className="absolute -bottom-1 -right-1 rounded bg-background border px-0.5 text-[9px] leading-tight text-muted-foreground"
                                        title={d.imageSource === 'vores' ? 'Vores referencebillede' : d.imageSource === 'kunde' ? 'Kundens referencebillede' : 'Billede fra tilbudslinjen'}
                                      >{d.imageSource === 'vores' ? 'V' : d.imageSource === 'kunde' ? 'K' : 'T'}</span>
                                    </div>
                                  ) : (
                                    <div className="h-10 w-10 rounded border bg-muted/40 flex items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                <div className="font-medium leading-tight">{p.name}</div>
                                {cols.template === false && d.meta.templateName && (
                                  <div className="text-xs text-muted-foreground truncate max-w-[360px]">{d.meta.templateName}</div>
                                )}
                                {!d.used && p.status === 'active' && (
                                  <Badge variant="outline" className="text-[10px] mt-0.5 text-amber-700 border-amber-300">Ikke i tilbud</Badge>
                                )}
                              </td>
                              {cols.category && (
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap" title={d.categorySource === 'egen' ? 'Sat på produktet' : d.categorySource === 'skabelon' ? 'Fra skabelonen' : d.categorySource === 'afledt' ? 'Gættet ud fra navnet — ret i detaljepanelet' : 'Ingen kategori — sæt den i detaljepanelet'}>
                                  {d.category}{d.categorySource === 'afledt' || d.categorySource === 'ingen' ? <span className="opacity-50">?</span> : null}
                                </td>
                              )}
                              {cols.template && <td className="px-3 py-2 text-muted-foreground">{d.meta.templateName ?? <span className="italic">uden skabelon</span>}</td>}
                              {cols.origin && (
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <Badge variant="outline" className={
                                    d.oprindelse === 'Egenproduktion' ? 'border-emerald-300 text-emerald-700'
                                    : d.oprindelse === 'Indkøb' ? 'border-sky-300 text-sky-700'
                                    : d.oprindelse === 'UE-produktion' ? 'border-violet-300 text-violet-700'
                                    : 'text-muted-foreground'
                                  } title={d.oprindelseSource === 'egen' ? 'Sat på produktet' : 'Afledt af timer og produkttype — ret i detaljepanelet'}>{d.oprindelse}{d.oprindelseSource === 'afledt' ? <span className="opacity-50 ml-0.5">?</span> : null}</Badge>
                                </td>
                              )}
                              {cols.type && <td className="px-3 py-2 text-muted-foreground">{PRODUCT_TYPES[p.productType]}</td>}
                              {cols.qty && <td className="px-3 py-2 text-right tabular-nums">{d.used ? `${d.totalQtyInQuotes} ${p.unit}` : <span className="text-muted-foreground">–</span>}</td>}
                              {cols.cost && <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(d.costExKorpus)}</td>}
                              {cols.korpus && <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{d.korpus > 0 ? fmt(d.korpus) : '–'}</td>}
                              {cols.dg && (
                                <td className={`px-3 py-2 text-right tabular-nums ${d.dgPct == null ? 'text-muted-foreground' : d.dgPct < 35 ? 'text-red-600' : d.dgPct < 55 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                  {fmtPct(d.dgPct)}
                                </td>
                              )}
                              {cols.profile && (
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {d.profile ? <Badge variant="secondary" className="text-xs">{PROFILE_LABELS[d.profile] ?? d.profile}</Badge> : <span className="text-muted-foreground">–</span>}
                                </td>
                              )}
                              {cols.quotes && (
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {d.quoteNumbers.length ? d.quoteNumbers.map(q => <Badge key={q} variant="outline" className="mr-1 text-xs">{q}</Badge>) : <span className="text-muted-foreground">–</span>}
                                </td>
                              )}
                              {cols.status && <td className="px-3 py-2">{p.status === 'active' ? <Badge>Aktiv</Badge> : <Badge variant="secondary">Arkiveret</Badge>}</td>}
                              {cols.updated && <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.updatedAt.toLocaleDateString('da-DK')}</td>}
                              <td className="px-2 py-1">
                                <div className="flex gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Åbn produktside (fuld redigering)" onClick={() => navigate(`/project/products/${p.id}`)}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Rediger stamdata" onClick={() => handleEdit(p)}><Edit className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Kopiér" onClick={() => handleCopy(p)}><Copy className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={p.status === 'active' ? 'Arkivér' : 'Genaktivér'} onClick={() => handleArchive(p)}><Archive className="h-4 w-4" /></Button>
                                </div>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-b bg-muted/20">
                                <td colSpan={colCount + 1} className="px-6 py-4">
                                  <ProductDetails d={d} projectMaterials={projectMaterials}
                                    materialLines={getProductMaterialLines(p.id)}
                                    laborLines={getProductLaborLines(p.id)}
                                    transportLines={getProductTransportLines(p.id)}
                                    otherLines={getProductOtherCostLines(p.id)}
                                    onOpenLegacy={() => navigate(`/project/products/${p.id}`)}
                                    onOpenQuote={(quoteId) => navigate(`/project/quotes/${quoteId}`)}
                                    imageBusy={imageBusy}
                                    onUploadImage={(slot, file) => uploadProductImage(p.id, slot, file)}
                                    onLinkImage={(slot) => linkProductImage(p.id, slot)}
                                    onRemoveImage={(slot) => removeProductImage(p.id, slot)}
                                    onAdoptImage={(slot, url, sourceRef) => adoptLineImage(p.id, slot, url, sourceRef)}
                                    categoryOptions={categoryOptions}
                                    onSaveField={(patch) => saveProductField(p.id, patch)}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        {extraLoading && <p className="text-xs text-muted-foreground">Henter skabeloner, tilbudsbrug og billeder…</p>}

        {/* Opret/rediger */}
        <Dialog
          open={isCreateDialogOpen || !!editingProduct}
          onOpenChange={(open) => { if (!open) { setIsCreateDialogOpen(false); setEditingProduct(null); resetForm(); } }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Rediger Produkt' : 'Opret Nyt Produkt'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Produktnavn *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className={errors.name ? 'border-destructive' : ''} />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="productType">Produkttype</Label>
                  <Select value={formData.productType} onValueChange={(value: any) => setFormData(prev => ({ ...prev, productType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRODUCT_TYPES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="quantity">Antal *</Label>
                  <Input id="quantity" type="number" step="0.01" min="0" value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                    className={errors.quantity ? 'border-destructive' : ''} />
                  {errors.quantity && <p className="text-sm text-destructive mt-1">{errors.quantity}</p>}
                </div>
                <div>
                  <Label htmlFor="unit">Enhed</Label>
                  <Input id="unit" value={formData.unit} onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="archived">Arkiveret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Beskrivelse (til tilbud)</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Beskrivelse der vises i tilbud..." />
              </div>
              <div>
                <Label htmlFor="notes">Noter</Label>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Interne noter..." />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); setEditingProduct(null); resetForm(); }}>Annuller</Button>
                <Button type="submit">{editingProduct ? 'Gem Ændringer' : 'Opret Produkt'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ProductImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          targetProjectId={activeProject.id}
          onImportComplete={handleImportComplete}
        />
      </div>
    </Layout>
  );
};

/* ── Udfoldet detalje-panel ──────────────────────────────────────────────────────── */
interface DetailsProps {
  d: DerivedProduct;
  projectMaterials: any[];
  materialLines: any[];
  laborLines: any[];
  transportLines: any[];
  otherLines: any[];
  onOpenLegacy: () => void;
  onOpenQuote: (quoteId: string) => void;
  imageBusy: string | null;
  onUploadImage: (slot: ImageSlot, file: File) => void;
  onLinkImage: (slot: ImageSlot) => void;
  onRemoveImage: (slot: ImageSlot) => void;
  onAdoptImage: (slot: ImageSlot, url: string, sourceRef: string) => void;
  categoryOptions: string[];
  onSaveField: (patch: { category?: string | null; oprindelse?: string | null }) => void;
}

/** Én billedslot: viser billedet (eller tom plads) med upload / link / fjern. */
const ImageSlotBox: React.FC<{
  label: string;
  hint: string;
  img?: { url: string; caption: string | null };
  busy: boolean;
  onUpload: (file: File) => void;
  onLink: () => void;
  onRemove: () => void;
}> = ({ label, hint, img, busy, onUpload, onLink, onRemove }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="flex gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Upload billede" disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Indsæt link til billede" disabled={busy} onClick={onLink}><Link2 className="h-3.5 w-3.5" /></Button>
          {img && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" title="Fjern billedet fra produktet" disabled={busy} onClick={onRemove}><X className="h-3.5 w-3.5" /></Button>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ''; }} />
      </div>
      {img ? (
        <a href={img.url} target="_blank" rel="noreferrer" title="Åbn i fuld størrelse">
          <img src={img.url} alt={label} className="w-full max-h-48 object-contain rounded border bg-white" />
        </a>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded border border-dashed bg-muted/30 hover:bg-muted/60 flex flex-col items-center justify-center text-muted-foreground text-xs gap-1"
        >
          <ImageIcon className="h-5 w-5" />
          {busy ? 'Gemmer…' : hint}
        </button>
      )}
      {img?.caption && <p className="text-[11px] text-muted-foreground">{img.caption}</p>}
    </div>
  );
};

const LABOR_LABELS: Record<string, string> = {
  korpus_production: 'Egen produktion (Korpus)',
  production: 'UE-produktion',
  dk_installation: 'Montage DK',
  other: 'Andet',
};

const ProductDetails: React.FC<DetailsProps> = ({ d, projectMaterials, materialLines, laborLines, transportLines, otherLines, onOpenLegacy, onOpenQuote, imageBusy, onUploadImage, onLinkImage, onRemoveImage, onAdoptImage, categoryOptions, onSaveField }) => {
  const p = d.product;
  const matName = (id: string) => projectMaterials.find(m => m.id === id);
  const [catDraft, setCatDraft] = useState<string>(d.meta.category ?? '');
  useEffect(() => { setCatDraft(d.meta.category ?? ''); }, [d.meta.category]);
  const commitCategory = () => {
    const v = catDraft.trim();
    if ((v || null) === (d.meta.category ?? null)) return;
    onSaveField({ category: v || null });
  };
  const listId = `cat-options-${p.id}`;
  const kostRows: { label: string; value: number }[] = [
    { label: 'Materialer', value: d.materials },
    { label: 'UE-produktion', value: d.ue },
    { label: 'Montage DK', value: d.montage },
    { label: 'Transport', value: d.transport },
    { label: 'Andet', value: d.other },
  ].filter(r => r.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Billeder (to slots) + stamdata */}
      <div className="space-y-3">
        <ImageSlotBox
          label="Vores reference"
          hint="Foto eller render af det vi laver"
          img={d.images.vores}
          busy={imageBusy === `${p.id}:vores`}
          onUpload={(f) => onUploadImage('vores', f)}
          onLink={() => onLinkImage('vores')}
          onRemove={() => onRemoveImage('vores')}
        />
        <ImageSlotBox
          label="Kundens reference"
          hint="Tegningsudsnit, udbudsfoto eller inspiration"
          img={d.images.kunde}
          busy={imageBusy === `${p.id}:kunde`}
          onUpload={(f) => onUploadImage('kunde', f)}
          onLink={() => onLinkImage('kunde')}
          onRemove={() => onRemoveImage('kunde')}
        />
        {d.lineImages.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fra tilbudslinjerne ({d.lineImages.length})</span>
            <p className="text-[11px] text-muted-foreground mb-1">Klik V eller K for at bruge et billede som vores / kundens reference.</p>
            <div className="grid grid-cols-3 gap-1.5">
              {d.lineImages.map(li => {
                const busy = imageBusy === `${p.id}:vores` || imageBusy === `${p.id}:kunde`;
                const isVores = d.images.vores?.url === li.url;
                const isKunde = d.images.kunde?.url === li.url;
                return (
                  <div key={li.url} className="relative group">
                    <a href={li.url} target="_blank" rel="noreferrer" title={`${li.quoteNumber} · ${li.lineTitle}${li.itemsOnLine > 1 ? ` (linje med ${li.itemsOnLine} produkter)` : ''} · ${li.kind === 'render' ? 'render' : 'upload'}`}>
                      <img src={li.url} alt="" loading="lazy" className={`h-16 w-full object-cover rounded border bg-white ${isVores || isKunde ? 'ring-2 ring-emerald-400' : ''}`} />
                    </a>
                    <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                      <button type="button" disabled={busy || isVores} title="Brug som vores reference" onClick={() => onAdoptImage('vores', li.url, `quote_line:${li.lineId}`)}
                        className={`rounded px-1 text-[10px] leading-4 border bg-background/90 ${isVores ? 'text-emerald-700 border-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}>V</button>
                      <button type="button" disabled={busy || isKunde} title="Brug som kundens reference" onClick={() => onAdoptImage('kunde', li.url, `quote_line:${li.lineId}`)}
                        className={`rounded px-1 text-[10px] leading-4 border bg-background/90 ${isKunde ? 'text-emerald-700 border-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}>K</button>
                    </div>
                    {li.itemsOnLine > 1 && <span className="absolute top-0.5 left-0.5 rounded bg-background/90 border px-1 text-[9px] text-muted-foreground" title="Linjen har flere produkter — billedet viser måske ikke kun dette">{li.itemsOnLine}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <dl className="text-xs space-y-1">
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Type</dt><dd>{PRODUCT_TYPES[p.productType]}</dd></div>
          <div className="flex justify-between gap-2 items-center">
            <dt className="text-muted-foreground">Kategori</dt>
            <dd className="flex items-center gap-1">
              <input
                list={listId}
                value={catDraft}
                placeholder={d.categorySource === 'egen' ? '' : `${d.category} (${d.categorySource === 'skabelon' ? 'skabelon' : d.categorySource === 'afledt' ? 'gættet' : 'ingen'})`}
                onChange={(e) => setCatDraft(e.target.value)}
                onBlur={commitCategory}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                className="h-6 w-40 rounded border bg-background px-1.5 text-xs"
                title="Skriv eller vælg en kategori. Tom = brug skabelonens / det gættede."
              />
              <datalist id={listId}>{categoryOptions.map(c => <option key={c} value={c} />)}</datalist>
              {d.categorySource !== 'egen' && d.categorySource !== 'ingen' && (
                <button type="button" className="text-[10px] text-muted-foreground underline" title="Gem det viste som produktets egen kategori" onClick={() => onSaveField({ category: d.category })}>bekræft</button>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Skabelon</dt><dd className="text-right">{d.meta.templateName ?? <span className="italic">ingen</span>}</dd></div>
          {d.meta.templateDeviation && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Afvigelse</dt><dd className="text-right">{d.meta.templateDeviation}</dd></div>}
          <div className="flex justify-between gap-2 items-center">
            <dt className="text-muted-foreground">Oprindelse</dt>
            <dd>
              <select
                value={d.meta.oprindelse ?? ''}
                onChange={(e) => onSaveField({ oprindelse: e.target.value || null })}
                className="h-6 rounded border bg-background px-1 text-xs"
                title="Hvem laver produktet. 'Afledt' regner ud fra timer og produkttype."
              >
                <option value="">Afledt: {d.derivedOprindelse}</option>
                {Object.entries(OPRINDELSE_DB).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </dd>
          </div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Profil</dt><dd>{d.profile ? (PROFILE_LABELS[d.profile] ?? d.profile) : '–'}{d.meta.templateProfile && d.profile !== d.meta.templateProfile ? ` (skabelon: ${PROFILE_LABELS[d.meta.templateProfile] ?? d.meta.templateProfile})` : ''}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Enhed</dt><dd>{p.unit}</dd></div>
        </dl>
        {p.description && <p className="text-sm">{p.description}</p>}
        {p.notes && <p className="text-xs text-muted-foreground whitespace-pre-line">{p.notes}</p>}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1" onClick={onOpenLegacy}><ExternalLink className="h-3.5 w-3.5" /> Åbn produktside</Button>
        </div>
      </div>

      {/* Kost, stykliste, timer, tilbudsbrug */}
      <div className="space-y-4 min-w-0">
        {/* Kost-opsummering */}
        <div className="flex flex-wrap gap-4 text-sm">
          {kostRows.map(r => (
            <div key={r.label}><div className="text-xs text-muted-foreground">{r.label}</div><div className="tabular-nums">{fmt(r.value)}</div></div>
          ))}
          <div><div className="text-xs text-muted-foreground">Kost/stk (ekskl. Korpus)</div><div className="tabular-nums font-semibold">{fmt(d.costExKorpus)}</div></div>
          {d.korpus > 0 && <div><div className="text-xs text-muted-foreground">Korpus-timer (allokeres i prisen)</div><div className="tabular-nums">{fmt(d.korpus)}</div></div>}
          {d.estSellPerUnit != null && <div><div className="text-xs text-muted-foreground">Salg/stk (est.)</div><div className="tabular-nums font-semibold text-emerald-700">{fmt(d.estSellPerUnit)}</div></div>}
          {d.dgPct != null && <div><div className="text-xs text-muted-foreground">DG (est.)</div><div className="tabular-nums">{fmtPct(d.dgPct)}</div></div>}
        </div>

        {/* Stykliste */}
        {materialLines.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Stykliste ({materialLines.length})</div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b"><th className="text-left py-1 pr-2">Del</th><th className="text-left py-1 pr-2">Materiale</th><th className="text-right py-1 pr-2">Mængde</th><th className="text-right py-1 pr-2">Enhedspris</th><th className="text-right py-1">I alt</th></tr>
              </thead>
              <tbody>
                {materialLines.map((ml: any) => {
                  const m = matName(ml.projectMaterialId);
                  const unitCost = ml.unitCostOverride ?? m?.unitPrice ?? 0;
                  return (
                    <tr key={ml.id} className="border-b last:border-0">
                      <td className="py-1 pr-2">{ml.lineTitle}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{m?.name ?? '?'}{m?.sourcingDecision ? <span className="ml-1 opacity-70">({m.sourcingDecision === 'kosovo' ? 'KS' : m.sourcingDecision === 'dk_to_kosovo' ? 'DK→KS' : 'DK'})</span> : null}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{Number(ml.qty).toLocaleString('da-DK', { maximumFractionDigits: 2 })} {ml.unit}{ml.wastePct ? <span className="text-muted-foreground"> (+{ml.wastePct} %)</span> : null}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{fmt(unitCost)}</td>
                      <td className="py-1 text-right tabular-nums">{fmt(ml.qty * unitCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Timer, transport, andet */}
        {(laborLines.length > 0 || transportLines.length > 0 || otherLines.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {laborLines.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Timer</div>
                <ul className="text-xs space-y-0.5">
                  {laborLines.map((ll: any) => (
                    <li key={ll.id} className="flex justify-between gap-2 border-b last:border-0 py-1">
                      <span>{ll.title} <span className="text-muted-foreground">· {LABOR_LABELS[ll.laborType] ?? ll.laborType}</span></span>
                      <span className="tabular-nums whitespace-nowrap">{ll.qty} {ll.unit} × {fmt(ll.unitCost)} = {fmt(ll.qty * ll.unitCost)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(transportLines.length > 0 || otherLines.length > 0) && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Transport og andet</div>
                <ul className="text-xs space-y-0.5">
                  {[...transportLines, ...otherLines].map((l: any) => (
                    <li key={l.id} className="flex justify-between gap-2 border-b last:border-0 py-1">
                      <span>{l.title}</span>
                      <span className="tabular-nums whitespace-nowrap">{l.qty} {l.unit} × {fmt(l.unitCost)} = {fmt(l.qty * l.unitCost)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Hvor sidder produktet i tilbuddene */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">I tilbud ({d.usage.length} linje{d.usage.length === 1 ? '' : 'r'})</div>
          {d.usage.length === 0 ? (
            <p className="text-xs text-amber-700">Produktet er ikke på nogen tilbudslinje. Tilføj det på tilbudssiden, eller arkivér det hvis det var en kalkulationsrest.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b"><th className="text-left py-1 pr-2">Tilbud</th><th className="text-left py-1 pr-2">Linje</th><th className="text-right py-1 pr-2">Antal</th><th className="text-left py-1 pr-2">Profil</th><th className="text-right py-1 pr-2">Kost/stk (snapshot)</th><th className="text-right py-1">Salg/stk (est.)</th></tr>
              </thead>
              <tbody>
                {d.usage.map(u => {
                  const f = u.itemFactors ?? u.lineFactors ?? {};
                  let sell: number | null = null;
                  if (u.pricingMode === 'category_factors' && u.breakdown) {
                    sell = 0;
                    for (const [k, v] of Object.entries(u.breakdown)) sell += Number(v ?? 0) * Number((f as any)[k === 'transport' ? 'product_transport' : k] ?? 1);
                  } else if (u.pricingMode === 'markup_pct') sell = u.ctpu * (1 + (u.markupPct ?? 0) / 100);
                  return (
                    <tr key={u.itemId} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => onOpenQuote(u.quoteId)} title="Åbn tilbuddet">
                      <td className="py-1 pr-2 whitespace-nowrap"><Badge variant="outline" className="text-[10px]">{u.quoteNumber}</Badge> <span className="text-muted-foreground">{u.quoteStatus}</span></td>
                      <td className="py-1 pr-2">{u.lineTitle}{u.lineIsOption && <span className="ml-1 text-muted-foreground">(option)</span>}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{u.qty}{u.lineQty !== 1 ? ` × ${u.lineQty}` : ''}</td>
                      <td className="py-1 pr-2">{u.factorProfile ? (PROFILE_LABELS[u.factorProfile] ?? u.factorProfile) : <span className="text-muted-foreground">linjens</span>}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{fmt(u.ctpu)}</td>
                      <td className="py-1 text-right tabular-nums">{sell != null ? fmt(sell) : <span className="text-muted-foreground">fast pris</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
