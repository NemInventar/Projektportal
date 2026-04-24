/**
 * Quote pricing — én helper brugt overalt.
 *
 * Kun to pricing-modes i V1:
 *   - 'markup_pct'        (default, fx 25%)
 *   - 'target_unit_price' (fast salgspris pr. enhed)
 *
 * Risk lægges altid oveni cost som "risk_per_unit" og trækkes IKKE som margin.
 * (Cost → Risk → Margin-rækkefølgen fra ARCHITECTURE.md §3.4)
 */

export type PricingMode = 'markup_pct' | 'target_unit_price';

export interface LinePricing {
  pricing_mode: PricingMode;
  markup_pct: number;           // kun brugt hvis pricing_mode = 'markup_pct'
  target_unit_price: number | null;  // kun brugt hvis pricing_mode = 'target_unit_price'
  risk_per_unit: number;
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
    labor_dk?: number;
    other?: number;
  } | null;
}

/** Sum af én items cost-breakdown. Fallback til cost_total_per_unit hvis breakdown er tom/null. */
export function itemCostPerUnit(item: CostItem): number {
  const b = item.cost_breakdown_json ?? {};
  const breakdownSum =
    (b.materials ?? 0) +
    (b.material_transport ?? 0) +
    (b.product_transport ?? b.transport ?? 0) +
    (b.labor_production ?? 0) +
    (b.labor_dk ?? 0) +
    (b.other ?? 0);
  // cost_total_per_unit som fallback: bruges når breakdown er tom men total er sat
  return Math.max(breakdownSum, item.cost_total_per_unit ?? 0);
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
  return {
    costPerUnit: base,
    riskPerUnit: risk,
    totalCostPerUnit: totalCPU,
    sellingPricePerUnit: sellPU,
    totalCost,
    totalSellingPrice: totalSell,
    totalProfit,
    dbPercent,
  };
}

/**
 * Normalisér pricing-data fra en line-række fra Supabase til LinePricing.
 * Håndterer både det nye (flat på line) og det gamle (nested pricing-object) format
 * så UI-kode ikke behøver at skelne under migrationen.
 */
export function pricingFromLine(lineRow: any): LinePricing {
  // Nyt format: kolonner direkte på line
  if (lineRow?.pricing_mode) {
    return {
      pricing_mode: (lineRow.pricing_mode as PricingMode) ?? 'markup_pct',
      markup_pct: Number(lineRow.markup_pct ?? 25),
      target_unit_price: lineRow.target_unit_price != null ? Number(lineRow.target_unit_price) : null,
      risk_per_unit: Number(lineRow.risk_per_unit ?? 0),
    };
  }
  // Legacy nested format (array eller object fra PostgREST)
  const nested = lineRow?.project_quote_line_pricing_2026_01_16_23_00 ?? lineRow?.pricing;
  const p = Array.isArray(nested) ? nested[0] : nested;
  return {
    pricing_mode: (p?.pricing_mode === 'target_unit_price' ? 'target_unit_price' : 'markup_pct') as PricingMode,
    markup_pct: Number(p?.markup_pct ?? 25),
    target_unit_price: p?.target_unit_price != null ? Number(p.target_unit_price) : null,
    risk_per_unit: Number(p?.risk_per_unit ?? 0),
  };
}
