// Bemærk: Denne fil er også kopieret til app/supabase/edge_function/generate-quote-pdf/quotePricing.ts
// for headless PDF-generering. Hvis du ændrer her, opdater også kopien.

/**
 * Quote pricing — én helper brugt overalt.
 *
 * Tre pricing-modes:
 *   - 'markup_pct'        (default, fx 25%) — (cost + risk) × (1 + markup/100)
 *   - 'target_unit_price' (fast salgspris pr. enhed)
 *   - 'category_factors'  (02-09-2026) — Σ kost pr. kategori × kategoriens faktor + risk.
 *                         Faktorerne løses i databasen (linje → tilbud → pricing_factor_defaults)
 *                         og ligger materialiseret på linjen som effective_category_factors.
 *                         GUI/PDF LÆSER dem kun — regner dem aldrig selv.
 *
 * Risk lægges altid oveni cost som "risk_per_unit" og trækkes IKKE som margin.
 * (Cost → Risk → Margin-rækkefølgen fra ARCHITECTURE.md §3.4). I faktor-mode går risk igennem ×1.
 *
 * Spejl af DB-funktionen fn_quote_line_sell — ændres formlen ét sted, skal den ændres begge steder.
 */

export type PricingMode = 'markup_pct' | 'target_unit_price' | 'category_factors';

/** Kostkategorier i cost_breakdown_json. labor_korpus = egen Korpus-produktion (allokeret, IKKE vareforbrug). */
export const COST_CATEGORIES = [
  'materials',
  'material_transport',
  'product_transport',
  'labor_production',
  'labor_korpus',
  'labor_dk',
  'other',
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  materials: 'Materialer',
  material_transport: 'Materialetransport',
  product_transport: 'Produkttransport',
  labor_production: 'UE-produktion (Kosovo)',
  labor_korpus: 'Egen produktion (Korpus)',
  labor_dk: 'Montage DK',
  other: 'Andet',
};

export type CategoryFactors = Partial<Record<CostCategory, number>>;

export interface LinePricing {
  pricing_mode: PricingMode;
  markup_pct: number;           // kun brugt hvis pricing_mode = 'markup_pct'
  target_unit_price: number | null;  // kun brugt hvis pricing_mode = 'target_unit_price'
  risk_per_unit: number;
  /** Effektive faktorer (allerede løst mod tilbud + defaults). Kun brugt hvis pricing_mode = 'category_factors'. */
  category_factors?: CategoryFactors | null;
}

export interface CostItem {
  qty: number;
  cost_total_per_unit?: number | null;
  cost_breakdown_json?: {
    materials?: number;
    material_transport?: number;
    product_transport?: number;
    transport?: number;  // legacy fallback
    labor_production?: number;
    labor_korpus?: number;
    labor_dk?: number;
    other?: number;
  } | null;
}

/**
 * Sum af én items VAREFORBRUG pr. enhed. labor_korpus (egen produktion) er bevidst IKKE med —
 * det er en fast udgift på 90002, ikke vareforbrug (canon Projekt-økonomi). Den indgår kun i
 * salgsprisen i faktor-mode via sin egen faktor.
 * Fallback til cost_total_per_unit kun hvis breakdown er helt tom.
 */
export function itemCostPerUnit(item: CostItem): number {
  const b = item.cost_breakdown_json ?? {};
  const breakdownSum =
    (b.materials ?? 0) +
    (b.material_transport ?? 0) +
    (b.product_transport ?? b.transport ?? 0) +
    (b.labor_production ?? 0) +
    (b.labor_dk ?? 0) +
    (b.other ?? 0);
  // Breakdown er sandheden når den er populeret. cost_total_per_unit bruges kun
  // som fallback for items uden breakdown (fx legacy data eller manuelle totaler).
  // VIGTIGT: tidligere brugt Math.max kunne overskygge en korrekt breakdown med
  // en stale cost_total_per_unit-snapshot og inflate salgsprisen — derfor strict fallback.
  return breakdownSum > 0 ? breakdownSum : (item.cost_total_per_unit ?? 0);
}

/** Én items kost pr. enhed fordelt på kategori (inkl. labor_korpus). Tom breakdown → alt i 'other'. */
export function itemCostByCategory(item: CostItem): Record<CostCategory, number> {
  const b = item.cost_breakdown_json ?? {};
  const out: Record<CostCategory, number> = {
    materials: b.materials ?? 0,
    material_transport: b.material_transport ?? 0,
    product_transport: b.product_transport ?? b.transport ?? 0,
    labor_production: b.labor_production ?? 0,
    labor_korpus: b.labor_korpus ?? 0,
    labor_dk: b.labor_dk ?? 0,
    other: b.other ?? 0,
  };
  const sum = COST_CATEGORIES.reduce((a, c) => a + out[c], 0);
  if (sum <= 0 && (item.cost_total_per_unit ?? 0) > 0) {
    out.other = item.cost_total_per_unit ?? 0;
  }
  return out;
}

/** Linjens kost pr. kategori (sum over items × item.qty, delt med linjens quantity). */
export function lineCostByCategoryPerUnit(items: CostItem[], lineQuantity: number): Record<CostCategory, number> {
  const acc: Record<CostCategory, number> = {
    materials: 0, material_transport: 0, product_transport: 0,
    labor_production: 0, labor_korpus: 0, labor_dk: 0, other: 0,
  };
  for (const it of items) {
    const c = itemCostByCategory(it);
    for (const k of COST_CATEGORIES) acc[k] += c[k] * (it.qty ?? 0);
  }
  if (lineQuantity > 0) for (const k of COST_CATEGORIES) acc[k] = acc[k] / lineQuantity;
  else for (const k of COST_CATEGORIES) acc[k] = 0;
  return acc;
}

/** Total cost for én linje (sum over items × item.qty). */
export function lineCost(items: CostItem[]): number {
  return items.reduce((acc, it) => acc + itemCostPerUnit(it) * (it.qty ?? 0), 0);
}

/** Cost pr. unit for en linje (total cost / line quantity). */
export function costPerUnit(items: CostItem[], lineQuantity: number): number {
  if (lineQuantity <= 0) return 0;
  return lineCost(items) / lineQuantity;
}

/**
 * Beregn salgspris pr. unit for én linje.
 * - markup_pct mode: (cost + risk) × (1 + markup/100)
 * - target_unit_price mode: target_unit_price (risk ignoreres — bruger har sat en fast pris)
 * - category_factors mode: Σ_kategori kost_kategori × faktor_kategori + risk
 *   (mangler en faktor for en kategori, regnes den ×1 — så prisen aldrig falder under kost i stilhed)
 */
export function sellingPricePerUnit(
  items: CostItem[],
  lineQuantity: number,
  pricing: LinePricing | null | undefined,
): number {
  const baseCostPerUnit = costPerUnit(items, lineQuantity);
  const risk = pricing?.risk_per_unit ?? 0;
  const totalCostPerUnit = baseCostPerUnit + risk;

  if (!pricing) {
    return totalCostPerUnit; // fallback til cost hvis ingen pricing
  }

  if (pricing.pricing_mode === 'target_unit_price' && pricing.target_unit_price != null) {
    return pricing.target_unit_price;
  }

  if (pricing.pricing_mode === 'category_factors') {
    const byCat = lineCostByCategoryPerUnit(items, lineQuantity);
    const f = pricing.category_factors ?? {};
    let sell = 0;
    for (const k of COST_CATEGORIES) sell += byCat[k] * (f[k] ?? 1);
    return sell + risk;
  }

  // markup_pct default
  const markup = pricing.markup_pct ?? 0;
  return totalCostPerUnit * (1 + markup / 100);
}

export interface LineTotals {
  costPerUnit: number;
  riskPerUnit: number;
  totalCostPerUnit: number;
  sellingPricePerUnit: number;
  totalCost: number;
  totalSellingPrice: number;
  totalProfit: number;
  dbPercent: number;
  /** Egen Korpus-produktion pr. enhed — allokeret i prisen (faktor-mode), men ikke en del af costPerUnit. */
  korpusAllocatedPerUnit: number;
}

/** Samlet beregning for én linje. */
export function calculateLine(
  items: CostItem[],
  lineQuantity: number,
  pricing: LinePricing | null | undefined,
): LineTotals {
  const base = costPerUnit(items, lineQuantity);
  const risk = pricing?.risk_per_unit ?? 0;
  const totalCPU = base + risk;
  const sellPU = sellingPricePerUnit(items, lineQuantity, pricing);
  const profitPU = sellPU - totalCPU;
  const totalCost = totalCPU * lineQuantity;
  const totalSell = sellPU * lineQuantity;
  const totalProfit = profitPU * lineQuantity;
  const dbPercent = totalSell > 0 ? (totalProfit / totalSell) * 100 : 0;
  const korpusAllocatedPerUnit = lineCostByCategoryPerUnit(items, lineQuantity).labor_korpus;
  return {
    costPerUnit: base,
    riskPerUnit: risk,
    totalCostPerUnit: totalCPU,
    sellingPricePerUnit: sellPU,
    totalCost,
    totalSellingPrice: totalSell,
    totalProfit,
    dbPercent,
    korpusAllocatedPerUnit,
  };
}

function toMode(v: unknown): PricingMode {
  if (v === 'target_unit_price' || v === 'category_factors') return v;
  return 'markup_pct';
}

function toFactors(v: unknown): CategoryFactors | null {
  if (!v || typeof v !== 'object') return null;
  const out: CategoryFactors = {};
  for (const k of COST_CATEGORIES) {
    const n = Number((v as any)[k]);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/**
 * Normalisér pricing-data fra en line-række fra Supabase til LinePricing.
 * Håndterer både det nye (flat på line) og det gamle (nested pricing-object) format
 * så UI-kode ikke behøver at skelne under migrationen.
 * Faktor-mode læser effective_category_factors (materialiseret af DB-trigger) — aldrig category_factors alene.
 */
export function pricingFromLine(lineRow: any): LinePricing {
  // Nyt format: kolonner direkte på line
  if (lineRow?.pricing_mode) {
    return {
      pricing_mode: toMode(lineRow.pricing_mode),
      markup_pct: Number(lineRow.markup_pct ?? 25),
      target_unit_price: lineRow.target_unit_price != null ? Number(lineRow.target_unit_price) : null,
      risk_per_unit: Number(lineRow.risk_per_unit ?? 0),
      category_factors: toFactors(lineRow.effective_category_factors ?? lineRow.category_factors),
    };
  }
  // Legacy nested format (array eller object fra PostgREST)
  const nested = lineRow?.project_quote_line_pricing_2026_01_16_23_00 ?? lineRow?.pricing;
  const p = Array.isArray(nested) ? nested[0] : nested;
  return {
    pricing_mode: toMode(p?.pricing_mode),
    markup_pct: Number(p?.markup_pct ?? 25),
    target_unit_price: p?.target_unit_price != null ? Number(p.target_unit_price) : null,
    risk_per_unit: Number(p?.risk_per_unit ?? 0),
    category_factors: toFactors(p?.effective_category_factors ?? p?.category_factors),
  };
}
