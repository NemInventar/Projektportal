// Edge function: generate-quote-pdf
// BUNDLED for deploy — source lives split in app/supabase/edge_function/generate-quote-pdf/.
// This single-file bundle was constructed at deploy time so we don't need the Supabase CLI's
// multi-file deploy path. Local maintainer: keep editing the split source; redeploy regenerates this.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2';
import React from 'npm:react@^18.3.1';
import { pdf, Document, Page, Text, View, Image, StyleSheet } from 'npm:@react-pdf/renderer@^4.0.0';
import { PDFDocument } from 'npm:pdf-lib@^1.17.1';

// ============================================================
// company.ts (inlined)
// ============================================================
const COMPANY_INFO = {
  name: 'Nem Inventar ApS',
  cvr: '45085473',
  address: {
    line1: 'Mågevej 73, st. tv.',
    line2: '',
    zip: '2400',
    city: 'København NV',
  },
  phone: '+45 20 54 14 88',
  email: 'js@neminventar.dk',
  defaultPaymentTerms: 'Netto 14 dage fra fakturadato',
  defaultQuoteValidityDays: 30,
} as const;

// ============================================================
// quotePricing.ts (inlined)
// ============================================================
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

type PricingMode = 'markup_pct' | 'target_unit_price' | 'category_factors';

/** Kostkategorier i cost_breakdown_json. labor_korpus = egen Korpus-produktion (allokeret, IKKE vareforbrug). */
const COST_CATEGORIES = [
  'materials',
  'material_transport',
  'product_transport',
  'labor_production',
  'labor_korpus',
  'labor_dk',
  'other',
] as const;
type CostCategory = (typeof COST_CATEGORIES)[number];

const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  materials: 'Materialer',
  material_transport: 'Materialetransport',
  product_transport: 'Produkttransport',
  labor_production: 'UE-produktion (Kosovo)',
  labor_korpus: 'Egen produktion (Korpus)',
  labor_dk: 'Montage DK',
  other: 'Andet',
};

type CategoryFactors = Partial<Record<CostCategory, number>>;

interface LinePricing {
  pricing_mode: PricingMode;
  markup_pct: number;           // kun brugt hvis pricing_mode = 'markup_pct'
  target_unit_price: number | null;  // kun brugt hvis pricing_mode = 'target_unit_price'
  risk_per_unit: number;
  /** Effektive faktorer (allerede løst mod tilbud + defaults). Kun brugt hvis pricing_mode = 'category_factors'. */
  category_factors?: CategoryFactors | null;
  /** Linjejustering i % (rabat < 0, tillæg > 0). Ganges på færdig linjepris i kost-baserede modes. Default 0. */
  adjust_pct?: number | null;
}

interface CostItem {
  qty: number;
  cost_total_per_unit?: number | null;
  /** Produktets eget faktorsæt (materialiseret af DB). NULL/undefined = arv linjens category_factors. */
  effective_category_factors?: CategoryFactors | null;
  /** L3 (28-09-2026): produktets godkendte salgspris pr. enhed (project_products.salgspris). */
  salgspris?: number | null;
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
function itemCostPerUnit(item: CostItem): number {
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
function itemCostByCategory(item: CostItem): Record<CostCategory, number> {
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
function lineCostByCategoryPerUnit(items: CostItem[], lineQuantity: number): Record<CostCategory, number> {
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
function lineCost(items: CostItem[]): number {
  return items.reduce((acc, it) => acc + itemCostPerUnit(it) * (it.qty ?? 0), 0);
}

/** Cost pr. unit for en linje (total cost / line quantity). */
function costPerUnit(items: CostItem[], lineQuantity: number): number {
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
function sellingPricePerUnit(
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

  const adj = 1 + (pricing.adjust_pct ?? 0) / 100;
  // L3: varer hvis produkt har salgspris sælges til antal × salgspris; resten regnes som før
  const hasSp = (it: CostItem) => it.salgspris != null;
  const spPerUnit = lineQuantity > 0
    ? items.filter(hasSp).reduce((a, it) => a + (it.salgspris as number) * (it.qty ?? 0), 0) / lineQuantity
    : 0;

  if (pricing.pricing_mode === 'category_factors') {
    const lineF = pricing.category_factors ?? {};
    let total = 0;
    for (const it of items) {
      if (hasSp(it)) continue;
      const c = itemCostByCategory(it);
      const f = it.effective_category_factors ?? lineF; // produktets eget faktorsæt, ellers linjens
      let itemSell = 0;
      for (const k of COST_CATEGORIES) itemSell += c[k] * (f[k] ?? 1);
      total += itemSell * (it.qty ?? 0);
    }
    const sellPerUnit = lineQuantity > 0 ? total / lineQuantity : 0;
    return (sellPerUnit + spPerUnit + risk) * adj;
  }

  // markup_pct default — avancen lægges kun på varer uden salgspris
  const markup = pricing.markup_pct ?? 0;
  const costNoSpPerUnit = costPerUnit(items.filter(it => !hasSp(it)), lineQuantity);
  return ((costNoSpPerUnit + risk) * (1 + markup / 100) + spPerUnit) * adj;
}

interface LineTotals {
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
function calculateLine(
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
function pricingFromLine(lineRow: any): LinePricing {
  // Nyt format: kolonner direkte på line
  if (lineRow?.pricing_mode) {
    return {
      pricing_mode: toMode(lineRow.pricing_mode),
      markup_pct: Number(lineRow.markup_pct ?? 25),
      target_unit_price: lineRow.target_unit_price != null ? Number(lineRow.target_unit_price) : null,
      risk_per_unit: Number(lineRow.risk_per_unit ?? 0),
      category_factors: toFactors(lineRow.effective_category_factors ?? lineRow.category_factors),
      adjust_pct: Number(lineRow.adjust_pct ?? 0),
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
    adjust_pct: Number(p?.adjust_pct ?? 0),
  };
}

// ============================================================
// QuotePDF.tsx + QuoteAppendixPDF.tsx (inlined — shared styles+palette)
// ============================================================
const PALETTE = { ink: '#1a1a1a', muted: '#6b6b6b', line: '#d4d0c7', bg: '#f7f5f0', accent: '#3d4a3d' };
const MARGIN = 62;

const quoteStyles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, paddingTop: MARGIN, paddingBottom: MARGIN, paddingHorizontal: MARGIN, color: PALETTE.ink },
  pageHeader: { position: 'absolute', top: 22, left: MARGIN, right: MARGIN, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: PALETTE.line },
  pageHeaderBrand: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, letterSpacing: 1 },
  pageHeaderMeta: { fontSize: 8, color: PALETTE.muted },
  pageFooter: { position: 'absolute', bottom: 22, left: MARGIN, right: MARGIN, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 6, borderTopWidth: 0.5, borderTopColor: PALETTE.line, fontSize: 7, color: PALETTE.muted },
  pageFooterCenter: { textAlign: 'center', flex: 1 },
  brandBlock: { marginBottom: 24 },
  brand: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, letterSpacing: 1.5 },
  brandTagline: { fontSize: 8, color: PALETTE.muted, letterSpacing: 0.5, marginTop: 2 },
  hero: { marginBottom: 18 },
  heroLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  heroTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, lineHeight: 1.2, marginBottom: 12 },
  accentLine: { width: 85, height: 2, backgroundColor: PALETTE.accent, marginTop: 4 },
  metaBlock: { marginTop: 18, marginBottom: 24, paddingTop: 10, paddingBottom: 10, borderTopWidth: 0.5, borderTopColor: PALETTE.line, borderBottomWidth: 0.5, borderBottomColor: PALETTE.line, flexDirection: 'row' },
  metaCol: { flex: 1, paddingRight: 12 },
  metaColLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  metaColValue: { fontSize: 9, color: PALETTE.ink, lineHeight: 1.45 },
  metaColValueBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PALETTE.ink },
  intro: { fontSize: 10, color: PALETTE.ink, lineHeight: 1.55, marginBottom: 22 },
  sectionHeader: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, marginBottom: 10, marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: PALETTE.bg, paddingVertical: 7, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: PALETTE.line, borderBottomWidth: 0.5, borderBottomColor: PALETTE.line },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 0.3, borderBottomColor: PALETTE.line },
  colNo: { width: 22 },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 38, textAlign: 'right' },
  colUnit: { width: 36, textAlign: 'center' },
  colUnitPrice: { width: 70, textAlign: 'right' },
  colTotal: { width: 70, textAlign: 'right' },
  descTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: PALETTE.ink, marginBottom: 2 },
  descBody: { fontSize: 8.5, color: PALETTE.muted, lineHeight: 1.4 },
  cell: { fontSize: 10, color: PALETTE.ink },
  cellMuted: { fontSize: 10, color: PALETTE.muted },
  rowWithItems: { borderBottomWidth: 0, paddingBottom: 3 },
  itemsBlock: { paddingLeft: 28, paddingRight: 6, paddingBottom: 8, borderBottomWidth: 0.3, borderBottomColor: PALETTE.line },
  itemsLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  itemRow: { flexDirection: 'row', paddingVertical: 1.5 },
  itemQty: { width: 52, fontSize: 8.5, color: PALETTE.ink, textAlign: 'right', paddingRight: 8 },
  itemTitle: { flex: 1, fontSize: 8.5, color: PALETTE.ink, lineHeight: 1.35 },
  tableNote: { fontSize: 8.5, color: PALETTE.muted, lineHeight: 1.4, marginBottom: 8 },
  optionsBlock: { marginTop: 22 },
  totalBlock: { marginTop: 14, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 4, minWidth: 240 },
  totalLabel: { fontSize: 10, color: PALETTE.muted, width: 140, textAlign: 'right', paddingRight: 12 },
  totalValue: { fontSize: 10, color: PALETTE.ink, width: 100, textAlign: 'right' },
  grandTotalSep: { width: 240, height: 1.5, backgroundColor: PALETTE.accent, marginTop: 4 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 6, minWidth: 240 },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, width: 140, textAlign: 'right', paddingRight: 12 },
  grandTotalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, width: 100, textAlign: 'right' },
  paymentPlanBlock: { marginTop: 22 },
  paymentPlanHeader: { flexDirection: 'row', backgroundColor: PALETTE.bg, paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: PALETTE.line, borderBottomWidth: 0.5, borderBottomColor: PALETTE.line },
  paymentPlanHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase' },
  paymentPlanRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.3, borderBottomColor: PALETTE.line },
  paymentPlanColWhen: { flex: 2.5, fontSize: 10, color: PALETTE.ink },
  paymentPlanColAmount: { flex: 1.5, fontSize: 10, color: PALETTE.ink, textAlign: 'right' },
  paymentPlanFallback: { fontSize: 10, fontStyle: 'italic', color: PALETTE.muted, paddingTop: 4 },
  notesBlock: { marginTop: 22 },
  notesText: { fontSize: 10, color: PALETTE.ink, lineHeight: 1.5 },
  termsBlock: { marginTop: 28 },
  termsRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.3, borderBottomColor: PALETTE.line },
  termsLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase', width: 110, paddingTop: 1 },
  termsValue: { fontSize: 10, color: PALETTE.ink, flex: 1, lineHeight: 1.5 },
  acceptBlock: { marginTop: 26, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: PALETTE.line },
  acceptIntro: { fontSize: 9, color: PALETTE.muted, lineHeight: 1.5, marginBottom: 26 },
  signatureRow: { flexDirection: 'row', gap: 24 },
  signatureCol: { flex: 1 },
  signatureLine: { height: 1, backgroundColor: PALETTE.line, marginBottom: 4 },
  signatureLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase' },
});

// Hardcoded system-wide disclaimer på alle bilag (kunde-facing). Joachim 2026-06-16.
const RENDER_DISCLAIMER = 'Dette er renderinger, udførslen tilpasses det enkelte projekt.';

const appendixStyles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, paddingTop: MARGIN, paddingBottom: MARGIN, paddingHorizontal: MARGIN, color: PALETTE.ink },
  pageHeader: { position: 'absolute', top: 22, left: MARGIN, right: MARGIN, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: PALETTE.line },
  pageHeaderBrand: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, letterSpacing: 1 },
  pageHeaderMeta: { fontSize: 8, color: PALETTE.muted },
  pageFooter: { position: 'absolute', bottom: 22, left: MARGIN, right: MARGIN, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 6, borderTopWidth: 0.5, borderTopColor: PALETTE.line, fontSize: 7, color: PALETTE.muted },
  pageFooterCenter: { textAlign: 'center', flex: 1 },
  coverBrand: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, letterSpacing: 1.5, marginBottom: 4 },
  coverTagline: { fontSize: 8, color: PALETTE.muted, letterSpacing: 0.5, marginBottom: 60 },
  coverLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, lineHeight: 1.15, marginBottom: 12 },
  coverAccentLine: { width: 85, height: 2, backgroundColor: PALETTE.accent, marginTop: 4, marginBottom: 24 },
  coverIntro: { fontSize: 11, color: PALETTE.muted, lineHeight: 1.6, marginBottom: 14 },
  coverDisclaimer: { fontSize: 8, fontStyle: 'italic', color: PALETTE.muted, lineHeight: 1.5, marginBottom: 60 },
  coverMetaBlock: { paddingTop: 14, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: PALETTE.line, borderBottomWidth: 0.5, borderBottomColor: PALETTE.line, flexDirection: 'row' },
  coverMetaCol: { flex: 1, paddingRight: 12 },
  coverMetaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  coverMetaValue: { fontSize: 9, color: PALETTE.ink, lineHeight: 1.45 },
  coverMetaValueBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PALETTE.ink },
  lineHeaderBlock: { marginBottom: 18 },
  lineLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  lineTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: PALETTE.ink, lineHeight: 1.25 },
  lineAccentLine: { width: 60, height: 2, backgroundColor: PALETTE.accent, marginTop: 8 },
  imageBox: { width: '100%', height: 280, backgroundColor: PALETTE.bg, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  imageImg: { width: '100%', height: 280, objectFit: 'contain' },
  imageCaption: { fontSize: 8, color: PALETTE.muted, fontStyle: 'italic', marginTop: 4, marginBottom: 14 },
  imagePlaceholder: { color: PALETTE.muted, fontSize: 9, fontStyle: 'italic' },
  bodyBlock: { marginTop: 10 },
  bodyRow: { flexDirection: 'row', gap: 22, marginTop: 6 },
  bodyMain: { flex: 2 },
  bodySide: { flex: 1, paddingLeft: 18, borderLeftWidth: 0.5, borderLeftColor: PALETTE.line },
  blockLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  livingText: { fontSize: 11, color: PALETTE.ink, lineHeight: 1.6 },
  specText: { fontSize: 9, color: PALETTE.ink, lineHeight: 1.5 },
  emptyNote: { fontSize: 9, fontStyle: 'italic', color: PALETTE.muted },
});

type PaymentTermsTemplate = '50_50_levering' | '40_60' | '30_70' | '20_80' | 'per_levering' | 'custom';

interface PDFLineItem { title: string; quantity: number; unit?: string | null; }
interface PDFLine { title: string; description?: string; quantity: number; unit: string; sellingPricePerUnit: number; totalSellingPrice: number; items?: PDFLineItem[]; isOption?: boolean; }
interface PDFCustomer { name?: string | null; cvr?: string | null; addressLine1?: string | null; addressZip?: string | null; addressCity?: string | null; contactName?: string | null; }
interface PDFCreatedBy { name?: string | null; email?: string | null; phone?: string | null; }
interface QuotePDFProps {
  projectName: string; quoteTitle: string; quoteNumber: string; quoteDate: string;
  validUntil?: string | null; lines: PDFLine[]; customer?: PDFCustomer;
  paymentTerms?: string | null; deliveryPeriod?: string | null; deliveryNote?: string | null;
  reservations?: string | null; paymentTermsTemplate?: PaymentTermsTemplate | null;
  createdBy?: PDFCreatedBy; introText?: string | null; notes?: string | null;
  showItems?: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' kr.';
const fmtQty = (n: number) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n);

const formatCustomerAddress = (c?: PDFCustomer): string | null => {
  if (!c) return null;
  const cityZip = [c.addressZip, c.addressCity].filter(Boolean).join(' ');
  const parts = [c.addressLine1, cityZip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

function QuotePDF(props: QuotePDFProps) {
  const { projectName, quoteTitle, quoteNumber, quoteDate, validUntil, lines, customer, paymentTerms, deliveryPeriod, deliveryNote, reservations, paymentTermsTemplate, createdBy, introText, notes } = props;
  const showItems = props.showItems === true;
  // Optioner står i egen tabel og tæller ikke med i summen (samme regel som cached_option_total)
  const mainLines = lines.filter(l => !l.isOption);
  const optionLines = lines.filter(l => l.isOption);
  const subtotal = mainLines.reduce((sum, l) => sum + (l.totalSellingPrice || 0), 0);
  const tableHeader = () => React.createElement(View, { style: quoteStyles.tableHeader },
    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colNo] }, 'Nr.'),
    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colDesc] }, 'Beskrivelse'),
    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colQty] }, 'Antal'),
    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colUnit] }, 'Enh.'),
    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colUnitPrice] }, 'Enhedspris'),
    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colTotal] }, 'I alt'),
  );
  const renderLines = (list: PDFLine[], withItems: boolean, kp: string) => list.flatMap((line, i) => {
    // 0/tom = uprissat linje (—). Negative beløb SKAL vises — reduktions-/rabatlinjer
    // (fx 'Optimering -42.000') indgår i subtotalen og må ikke stå med blank beløbskolonne.
    const hasPrice = !!line.totalSellingPrice;
    const items = withItems ? (line.items ?? []) : [];
    const rows: any[] = [React.createElement(View, { key: `${kp}l${i}`, style: items.length ? [quoteStyles.row, quoteStyles.rowWithItems] : quoteStyles.row, wrap: false, minPresenceAhead: items.length ? 30 : undefined } as any,
      React.createElement(Text, { style: [quoteStyles.cellMuted, quoteStyles.colNo] }, String(i + 1)),
      React.createElement(View, { style: quoteStyles.colDesc },
        React.createElement(Text, { style: quoteStyles.descTitle }, line.title),
        line.description ? React.createElement(Text, { style: quoteStyles.descBody }, line.description) : null,
      ),
      React.createElement(Text, { style: [quoteStyles.cell, quoteStyles.colQty] }, fmtQty(line.quantity)),
      React.createElement(Text, { style: [quoteStyles.cellMuted, quoteStyles.colUnit] }, line.unit),
      React.createElement(Text, { style: [hasPrice ? quoteStyles.cell : quoteStyles.cellMuted, quoteStyles.colUnitPrice] }, hasPrice ? fmt(line.sellingPricePerUnit) : '—'),
      React.createElement(Text, { style: [hasPrice ? quoteStyles.cell : quoteStyles.cellMuted, quoteStyles.colTotal] }, hasPrice ? fmt(line.totalSellingPrice) : '—'),
    )];
    if (items.length) rows.push(React.createElement(View, { key: `${kp}i${i}`, style: quoteStyles.itemsBlock },
      React.createElement(Text, { style: quoteStyles.itemsLabel }, 'Posten omfatter'),
      ...items.map((it, j) => React.createElement(View, { key: j, style: quoteStyles.itemRow, wrap: false } as any,
        React.createElement(Text, { style: quoteStyles.itemQty }, `${fmtQty(it.quantity)} ${it.unit || 'stk'}`),
        React.createElement(Text, { style: quoteStyles.itemTitle }, it.title),
      )),
    ));
    return rows;
  });
  const vat = Math.round(subtotal * 0.25);
  const grandTotal = subtotal + vat;
  const customerAddress = formatCustomerAddress(customer);
  const intro = introText || 'Hermed vores tilbud på de beskrevne poster. Tilbuddet er udarbejdet på baggrund af det modtagne projektmateriale og forudsætninger angivet under vilkår.';

  const tmpl = paymentTermsTemplate ?? '50_50_levering';
  const splitRows = (firstPct: number, secondPct: number, secondLabel: string) => {
    const firstExcl = Math.round(subtotal * firstPct / 100);
    const secondExcl = subtotal - firstExcl;
    return [
      { when: `Ved accept af tilbuddet (${firstPct}%)`, excl: firstExcl, incl: Math.round(firstExcl * 1.25) },
      { when: `${secondLabel} (${secondPct}%)`, excl: secondExcl, incl: Math.round(secondExcl * 1.25) },
    ];
  };
  let paymentRows: Array<{ when: string; excl: number; incl: number }> | null = null;
  let paymentFallback: string | null = null;
  if (tmpl === '50_50_levering') paymentRows = splitRows(50, 50, 'Ved levering');
  else if (tmpl === '40_60') paymentRows = splitRows(40, 60, 'Ved levering');
  else if (tmpl === '30_70') paymentRows = splitRows(30, 70, 'Ved levering');
  else if (tmpl === '20_80') paymentRows = splitRows(20, 80, 'Ved levering');
  else if (tmpl === 'per_levering') paymentFallback = 'Faktureres pr. delleverance — se leveranceplan.';
  else if (tmpl === 'custom') paymentFallback = 'Betalingsbetingelser aftales individuelt.';

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: quoteStyles.page },
      React.createElement(View, { style: quoteStyles.pageHeader, fixed: true } as any,
        React.createElement(Text, { style: quoteStyles.pageHeaderBrand }, 'NEM INVENTAR'),
        React.createElement(Text, { style: quoteStyles.pageHeaderMeta },
          `Tilbud ${quoteNumber || ''}${quoteNumber && projectName ? ' · ' : ''}${projectName || ''}`,
        ),
      ),
      React.createElement(View, { style: quoteStyles.brandBlock },
        React.createElement(Text, { style: quoteStyles.brand }, 'NEM INVENTAR'),
        React.createElement(Text, { style: quoteStyles.brandTagline }, 'Snedker · Inventar · Specialopgaver'),
      ),
      React.createElement(View, { style: quoteStyles.hero },
        React.createElement(Text, { style: quoteStyles.heroLabel }, 'Tilbud'),
        React.createElement(Text, { style: quoteStyles.heroTitle }, quoteTitle),
        React.createElement(View, { style: quoteStyles.accentLine }),
      ),
      React.createElement(View, { style: quoteStyles.metaBlock },
        React.createElement(View, { style: quoteStyles.metaCol },
          React.createElement(Text, { style: quoteStyles.metaColLabel }, 'Kunde'),
          customer?.name
            ? React.createElement(Text, { style: quoteStyles.metaColValueBold }, customer.name)
            : React.createElement(Text, { style: quoteStyles.metaColValue }, '—'),
          customer?.cvr ? React.createElement(Text, { style: quoteStyles.metaColValue }, `CVR ${customer.cvr}`) : null,
          customerAddress ? React.createElement(Text, { style: quoteStyles.metaColValue }, customerAddress) : null,
          customer?.contactName ? React.createElement(Text, { style: quoteStyles.metaColValue }, `Att. ${customer.contactName}`) : null,
        ),
        React.createElement(View, { style: quoteStyles.metaCol },
          React.createElement(Text, { style: quoteStyles.metaColLabel }, 'Tilbud'),
          React.createElement(Text, { style: quoteStyles.metaColValueBold }, quoteNumber || '—'),
          React.createElement(Text, { style: quoteStyles.metaColValue }, `Dato: ${quoteDate}`),
          validUntil ? React.createElement(Text, { style: quoteStyles.metaColValue }, `Gyldigt til: ${validUntil}`) : null,
        ),
        React.createElement(View, { style: [quoteStyles.metaCol, { paddingRight: 0 }] },
          React.createElement(Text, { style: quoteStyles.metaColLabel }, 'Afsender'),
          React.createElement(Text, { style: quoteStyles.metaColValueBold }, COMPANY_INFO.name),
          React.createElement(Text, { style: quoteStyles.metaColValue }, `CVR ${COMPANY_INFO.cvr}`),
          createdBy?.name ? React.createElement(Text, { style: quoteStyles.metaColValue }, `Att. ${createdBy.name}`) : null,
          createdBy?.email ? React.createElement(Text, { style: quoteStyles.metaColValue }, createdBy.email) : null,
          createdBy?.phone ? React.createElement(Text, { style: quoteStyles.metaColValue }, createdBy.phone) : null,
        ),
      ),
      React.createElement(Text, { style: quoteStyles.intro }, intro),
      React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Tilbudslinjer'),
      showItems ? React.createElement(Text, { style: quoteStyles.tableNote }, 'Under hver post står, hvad posten omfatter.') : null,
      tableHeader(),
      ...renderLines(mainLines, showItems, 'm'),
      React.createElement(View, { style: quoteStyles.totalBlock, wrap: false } as any,
        React.createElement(View, { style: quoteStyles.totalRow },
          React.createElement(Text, { style: quoteStyles.totalLabel }, 'Subtotal ekskl. moms'),
          React.createElement(Text, { style: quoteStyles.totalValue }, fmt(subtotal)),
        ),
        React.createElement(View, { style: quoteStyles.totalRow },
          React.createElement(Text, { style: quoteStyles.totalLabel }, 'Moms (25%)'),
          React.createElement(Text, { style: quoteStyles.totalValue }, fmt(vat)),
        ),
        React.createElement(View, { style: quoteStyles.grandTotalSep }),
        React.createElement(View, { style: quoteStyles.grandTotalRow },
          React.createElement(Text, { style: quoteStyles.grandTotalLabel }, 'I alt inkl. moms'),
          React.createElement(Text, { style: quoteStyles.grandTotalValue }, fmt(grandTotal)),
        ),
      ),
      optionLines.length ? React.createElement(View, { style: quoteStyles.optionsBlock },
        React.createElement(View, { wrap: false, minPresenceAhead: 60 } as any,
          React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Optioner'),
          React.createElement(Text, { style: quoteStyles.tableNote }, 'Priserne er ekskl. moms og indgår ikke i tilbudssummen.'),
        ),
        tableHeader(),
        ...renderLines(optionLines, false, 'o'),
      ) : null,
      React.createElement(View, { style: quoteStyles.paymentPlanBlock, wrap: false } as any,
        React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Betalingsplan'),
        paymentRows ? React.createElement(React.Fragment, null,
          React.createElement(View, { style: quoteStyles.paymentPlanHeader },
            React.createElement(Text, { style: [quoteStyles.paymentPlanHeaderText, { flex: 2.5 }] }, 'Hvad'),
            React.createElement(Text, { style: [quoteStyles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }] }, 'Ekskl. moms'),
            React.createElement(Text, { style: [quoteStyles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }] }, 'Inkl. moms'),
          ),
          ...paymentRows.map((r, i) => React.createElement(View, { key: i, style: quoteStyles.paymentPlanRow },
            React.createElement(Text, { style: quoteStyles.paymentPlanColWhen }, r.when),
            React.createElement(Text, { style: quoteStyles.paymentPlanColAmount }, fmt(r.excl)),
            React.createElement(Text, { style: quoteStyles.paymentPlanColAmount }, fmt(r.incl)),
          )),
        ) : React.createElement(Text, { style: quoteStyles.paymentPlanFallback }, paymentFallback),
      ),
      (paymentTerms || deliveryPeriod || deliveryNote || reservations) ? React.createElement(View, { style: quoteStyles.termsBlock, wrap: false } as any,
        React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Vilkår'),
        paymentTerms ? React.createElement(View, { style: quoteStyles.termsRow },
          React.createElement(Text, { style: quoteStyles.termsLabel }, 'Betaling'),
          React.createElement(Text, { style: quoteStyles.termsValue }, paymentTerms),
        ) : null,
        deliveryPeriod ? React.createElement(View, { style: quoteStyles.termsRow },
          React.createElement(Text, { style: quoteStyles.termsLabel }, 'Leveringstid'),
          React.createElement(Text, { style: quoteStyles.termsValue }, deliveryPeriod),
        ) : null,
        deliveryNote ? React.createElement(View, { style: quoteStyles.termsRow },
          React.createElement(Text, { style: quoteStyles.termsLabel }, 'Leveringsnote'),
          React.createElement(Text, { style: quoteStyles.termsValue }, deliveryNote),
        ) : null,
        reservations ? React.createElement(View, { style: quoteStyles.termsRow },
          React.createElement(Text, { style: quoteStyles.termsLabel }, 'Forbehold'),
          React.createElement(Text, { style: quoteStyles.termsValue }, reservations),
        ) : null,
      ) : null,
      notes ? React.createElement(View, { style: quoteStyles.notesBlock, wrap: false } as any,
        React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Bemærkninger'),
        React.createElement(Text, { style: quoteStyles.notesText }, notes),
      ) : null,
      React.createElement(View, { style: quoteStyles.acceptBlock, wrap: false } as any,
        React.createElement(Text, { style: quoteStyles.acceptIntro },
          `Tilbuddet accepteres ved mailbekræftelse til ${createdBy?.email || COMPANY_INFO.email} eller ved underskrift nedenfor.`,
        ),
        React.createElement(View, { style: quoteStyles.signatureRow },
          React.createElement(View, { style: quoteStyles.signatureCol },
            React.createElement(View, { style: quoteStyles.signatureLine }),
            React.createElement(Text, { style: quoteStyles.signatureLabel }, 'Sted og dato'),
          ),
          React.createElement(View, { style: quoteStyles.signatureCol },
            React.createElement(View, { style: quoteStyles.signatureLine }),
            React.createElement(Text, { style: quoteStyles.signatureLabel }, 'Underskrift / navn'),
          ),
        ),
      ),
      React.createElement(View, { style: quoteStyles.pageFooter, fixed: true } as any,
        React.createElement(Text, null, quoteDate),
        React.createElement(Text, { style: quoteStyles.pageFooterCenter },
          `${COMPANY_INFO.name} · ${COMPANY_INFO.email} · ${COMPANY_INFO.phone}`,
        ),
        React.createElement(Text, { render: ({ pageNumber }: any) => `Side ${pageNumber}` } as any),
      ),
    ),
  );
}

interface AppendixLine { title: string; description?: string | null; livingDescription?: string | null; technicalSpec?: string | null; imageUrl?: string | null; imageCaption?: string | null; }
interface AppendixCustomer { name?: string | null; cvr?: string | null; contactName?: string | null; }
interface QuoteAppendixPDFProps { projectName: string; quoteTitle: string; quoteNumber: string; quoteDate: string; customer?: AppendixCustomer; lines: AppendixLine[]; introText?: string | null; }

function QuoteAppendixPDF(props: QuoteAppendixPDFProps) {
  const { projectName, quoteTitle, quoteNumber, quoteDate, customer, lines, introText } = props;
  const intro = introText || `Bilaget viser hver enkelt post i tilbuddet med billede og teknisk specifikation. Det giver et samlet overblik over materialer, mål og udførelse, og læses sammen med tilbudsdokument ${quoteNumber || '—'}.`;
  const visibleLines = lines.filter(l => l.imageUrl || l.livingDescription || l.technicalSpec);
  const headerMeta = `Bilag · ${quoteNumber || ''}${quoteNumber && projectName ? ' · ' : ''}${projectName || ''}`;

  const linePageElements = visibleLines.length === 0
    ? [React.createElement(Page, { key: 'empty', size: 'A4', style: appendixStyles.page },
        React.createElement(View, { style: appendixStyles.pageHeader, fixed: true } as any,
          React.createElement(Text, { style: appendixStyles.pageHeaderBrand }, 'NEM INVENTAR'),
          React.createElement(Text, { style: appendixStyles.pageHeaderMeta }, headerMeta),
        ),
        React.createElement(View, { style: appendixStyles.lineHeaderBlock },
          React.createElement(Text, { style: appendixStyles.lineLabel }, 'Bilag'),
          React.createElement(Text, { style: appendixStyles.lineTitle }, 'Ingen indhold'),
          React.createElement(View, { style: appendixStyles.lineAccentLine }),
        ),
        React.createElement(Text, { style: appendixStyles.emptyNote }, 'Tilbuddet har ingen linjer med billeder eller levende beskrivelser. Tilføj dem i tilbuds-editoren for at fylde dette bilag.'),
        React.createElement(View, { style: appendixStyles.pageFooter, fixed: true } as any,
          React.createElement(Text, null, quoteDate),
          React.createElement(Text, { style: appendixStyles.pageFooterCenter }, `${COMPANY_INFO.name} · ${COMPANY_INFO.email} · ${COMPANY_INFO.phone}`),
          React.createElement(Text, { render: ({ pageNumber }: any) => `Side ${pageNumber}` } as any),
        ),
      )]
    : visibleLines.map((line, i) => React.createElement(Page, { key: i, size: 'A4', style: appendixStyles.page },
        React.createElement(View, { style: appendixStyles.pageHeader, fixed: true } as any,
          React.createElement(Text, { style: appendixStyles.pageHeaderBrand }, 'NEM INVENTAR'),
          React.createElement(Text, { style: appendixStyles.pageHeaderMeta }, headerMeta),
        ),
        React.createElement(View, { style: appendixStyles.lineHeaderBlock },
          React.createElement(Text, { style: appendixStyles.lineLabel }, `Post ${i + 1} af ${visibleLines.length}`),
          React.createElement(Text, { style: appendixStyles.lineTitle }, line.title),
          React.createElement(View, { style: appendixStyles.lineAccentLine }),
        ),
        line.imageUrl
          ? React.createElement(React.Fragment, null,
              React.createElement(Image, { src: line.imageUrl, style: appendixStyles.imageImg } as any),
              line.imageCaption ? React.createElement(Text, { style: appendixStyles.imageCaption }, line.imageCaption) : null,
            )
          : React.createElement(View, { style: appendixStyles.imageBox },
              React.createElement(Text, { style: appendixStyles.imagePlaceholder }, 'Intet billede'),
            ),
        (line.livingDescription || line.technicalSpec) ? React.createElement(View, { style: appendixStyles.bodyBlock },
          React.createElement(View, { style: appendixStyles.bodyRow },
            line.livingDescription ? React.createElement(View, { style: line.technicalSpec ? appendixStyles.bodyMain : { flex: 1 } },
              React.createElement(Text, { style: appendixStyles.blockLabel }, 'Beskrivelse'),
              React.createElement(Text, { style: appendixStyles.livingText }, line.livingDescription),
            ) : null,
            line.technicalSpec ? React.createElement(View, { style: line.livingDescription ? appendixStyles.bodySide : { flex: 1 } },
              React.createElement(Text, { style: appendixStyles.blockLabel }, 'Teknisk spec'),
              React.createElement(Text, { style: appendixStyles.specText }, line.technicalSpec),
            ) : null,
          ),
        ) : null,
        React.createElement(View, { style: appendixStyles.pageFooter, fixed: true } as any,
          React.createElement(Text, null, quoteDate),
          React.createElement(Text, { style: appendixStyles.pageFooterCenter }, `${COMPANY_INFO.name} · ${COMPANY_INFO.email} · ${COMPANY_INFO.phone}`),
          React.createElement(Text, { render: ({ pageNumber }: any) => `Side ${pageNumber}` } as any),
        ),
      ));

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: appendixStyles.page },
      React.createElement(View, { style: appendixStyles.pageHeader, fixed: true } as any,
        React.createElement(Text, { style: appendixStyles.pageHeaderBrand }, 'NEM INVENTAR'),
        React.createElement(Text, { style: appendixStyles.pageHeaderMeta }, headerMeta),
      ),
      React.createElement(Text, { style: appendixStyles.coverBrand }, 'NEM INVENTAR'),
      React.createElement(Text, { style: appendixStyles.coverTagline }, 'Snedker · Inventar · Specialopgaver'),
      React.createElement(Text, { style: appendixStyles.coverLabel }, 'Bilag til tilbud'),
      React.createElement(Text, { style: appendixStyles.coverTitle }, quoteTitle),
      React.createElement(View, { style: appendixStyles.coverAccentLine }),
      React.createElement(Text, { style: appendixStyles.coverIntro }, intro),
      React.createElement(Text, { style: appendixStyles.coverDisclaimer }, RENDER_DISCLAIMER),
      React.createElement(View, { style: appendixStyles.coverMetaBlock },
        React.createElement(View, { style: appendixStyles.coverMetaCol },
          React.createElement(Text, { style: appendixStyles.coverMetaLabel }, 'Kunde'),
          customer?.name
            ? React.createElement(Text, { style: appendixStyles.coverMetaValueBold }, customer.name)
            : React.createElement(Text, { style: appendixStyles.coverMetaValue }, '—'),
          customer?.cvr ? React.createElement(Text, { style: appendixStyles.coverMetaValue }, `CVR ${customer.cvr}`) : null,
          customer?.contactName ? React.createElement(Text, { style: appendixStyles.coverMetaValue }, `Att. ${customer.contactName}`) : null,
        ),
        React.createElement(View, { style: appendixStyles.coverMetaCol },
          React.createElement(Text, { style: appendixStyles.coverMetaLabel }, 'Tilbud'),
          React.createElement(Text, { style: appendixStyles.coverMetaValueBold }, quoteNumber || '—'),
          React.createElement(Text, { style: appendixStyles.coverMetaValue }, `Dato: ${quoteDate}`),
        ),
        React.createElement(View, { style: [appendixStyles.coverMetaCol, { paddingRight: 0 }] },
          React.createElement(Text, { style: appendixStyles.coverMetaLabel }, 'Afsender'),
          React.createElement(Text, { style: appendixStyles.coverMetaValueBold }, COMPANY_INFO.name),
          React.createElement(Text, { style: appendixStyles.coverMetaValue }, `CVR ${COMPANY_INFO.cvr}`),
          React.createElement(Text, { style: appendixStyles.coverMetaValue }, COMPANY_INFO.email),
        ),
      ),
      React.createElement(View, { style: appendixStyles.pageFooter, fixed: true } as any,
        React.createElement(Text, null, quoteDate),
        React.createElement(Text, { style: appendixStyles.pageFooterCenter }, `${COMPANY_INFO.name} · ${COMPANY_INFO.email} · ${COMPANY_INFO.phone}`),
        React.createElement(Text, { render: ({ pageNumber }: any) => `Side ${pageNumber}` } as any),
      ),
    ),
    ...linePageElements,
  );
}

// ============================================================
// index.ts (main handler — orchestrator)
// ============================================================
type Format = 'pdf' | 'bilag' | 'pdf+bilag';
const VALID_FORMATS: Format[] = ['pdf', 'bilag', 'pdf+bilag'];

interface LineItemRow {
  id: string;
  qty: number | string;
  cost_total_per_unit: number | string | null;
  cost_breakdown_json: Record<string, number> | null;
}

interface LineRow {
  id: string; title: string; description: string | null;
  quantity: number | string; unit: string;
  display_order: number | null; sort_order: number | null; created_at: string;
  archived: boolean | null;
  pricing_mode: string | null; markup_pct: number | string | null;
  target_unit_price: number | string | null; risk_per_unit: number | string | null;
  living_description: string | null; technical_spec: string | null;
  custom_image_url: string | null; custom_image_caption: string | null;
  render_image_url: string | null;
  active_image_source: 'render' | 'custom' | 'none' | null;
  include_in_appendix: boolean | null;
  project_quote_line_items_2026_01_16_23_00: LineItemRow[];
}

interface QuoteRow {
  id: string; project_id: string; quote_number: string; title: string;
  created_at: string; valid_until: string | null;
  company_id: string | null; customer_contact_name: string | null;
  resolved_payment_terms: string | null; resolved_delivery_period: string | null; resolved_reservations: string | null;
  resolved_quote_date: string | null; resolved_payment_terms_template: string | null;
  payment_terms_template: string | null;
  intro_text: string | null; customer_remarks: string | null;
  appendix_intro_text: string | null; customer_delivery_note: string | null;
  recipient_name: string | null;
  created_by_name_resolved: string | null; created_by_email_resolved: string | null; created_by_phone_resolved: string | null;
  created_by_name: string | null; created_by_email: string | null; created_by_phone: string | null;
  company_name: string | null; company_cvr: string | null;
  company_address_line1: string | null; company_address_zip: string | null; company_address_city: string | null;
}

interface ProjectRow { id: string; name: string; project_number: string | null; customer: string | null; }

interface LoadedQuoteData {
  quote: QuoteRow;
  lines: LineRow[];
  project: ProjectRow;
  companyDefaultContactName: string | null;
}

async function loadQuoteData(supabase: ReturnType<typeof createClient>, quoteId: string): Promise<LoadedQuoteData | { error: string; status: number }> {
  const { data: quote, error: quoteErr } = await supabase.from('v_quotes_resolved').select('*').eq('id', quoteId).maybeSingle();
  if (quoteErr) { console.error('Quote-load fejlede:', quoteErr); return { error: 'Kunne ikke læse tilbud', status: 500 }; }
  if (!quote) return { error: 'Tilbud ikke fundet', status: 404 };

  const { data: linesData, error: linesErr } = await supabase
    .from('project_quote_lines_2026_01_16_23_00')
    .select(`*, project_quote_line_items_2026_01_16_23_00(*, project_products_2026_01_15_12_49(salgspris))`)
    .eq('project_quote_id', quoteId)
    .neq('archived', true)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (linesErr) { console.error('Lines-load fejlede:', linesErr); return { error: 'Kunne ikke læse tilbudslinjer', status: 500 }; }

  const { data: project, error: projErr } = await supabase
    .from('projects_2026_01_15_06_45')
    .select('id, name, project_number, customer')
    .eq('id', (quote as any).project_id)
    .maybeSingle();
  if (projErr || !project) { console.error('Project-load fejlede:', projErr); return { error: 'Kunne ikke læse projekt', status: 500 }; }

  let companyDefaultContactName: string | null = null;
  const q = quote as any;
  if (!q.recipient_name && !q.customer_contact_name && q.company_id) {
    const { data: companyData } = await supabase
      .from('companies_2026_04_27')
      .select('default_contact_name')
      .eq('id', q.company_id)
      .maybeSingle();
    companyDefaultContactName = (companyData as any)?.default_contact_name ?? null;
  }

  return { quote: quote as QuoteRow, lines: (linesData ?? []) as LineRow[], project: project as ProjectRow, companyDefaultContactName };
}

function formatDk(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('da-DK').format(new Date(iso));
}

// @react-pdf dekoder billeder i fuld opløsning — flere full-res renders (~2,3 MB/stk)
// sprænger edge-funktionens compute (WORKER_RESOURCE_LIMIT). Nedskalér derfor Supabase-
// storage-billeder via image-transform-endpointet før embed. Eksterne/allerede
// transformerede URLs røres ikke.
function toDownscaledUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes('/storage/v1/render/image/')) return url;
  const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  if (transformed === url) return url;
  return `${transformed}${transformed.includes('?') ? '&' : '?'}width=700&quality=70`;
}

function lineEffectiveImageUrl(line: LineRow): string | null {
  const raw = (() => {
    if (line.active_image_source === 'custom') return line.custom_image_url ?? null;
    if (line.active_image_source === 'render') return line.render_image_url ?? null;
    if (line.active_image_source === 'none') return null;
    return line.custom_image_url || line.render_image_url || null;
  })();
  return toDownscaledUrl(raw);
}

async function renderQuotePdf(loaded: LoadedQuoteData): Promise<Uint8Array> {
  const { quote, lines, project, companyDefaultContactName } = loaded;
  const pdfLines = lines.map((line) => {
    const items = (line.project_quote_line_items_2026_01_16_23_00 ?? []).map((it) => ({
      qty: Number(it.qty ?? 0),
      cost_total_per_unit: it.cost_total_per_unit != null ? Number(it.cost_total_per_unit) : 0,
      cost_breakdown_json: it.cost_breakdown_json,
      effective_category_factors: toFactors((it as any).effective_category_factors),
      salgspris: (() => { const pp = (it as any).project_products_2026_01_15_12_49; const v = (it as any).salgspris ?? (Array.isArray(pp) ? pp[0]?.salgspris : pp?.salgspris); return v == null ? null : Number(v); })(),
    }));
    const pricing = pricingFromLine(line);
    const t = calculateLine(items, Number(line.quantity ?? 0), pricing);
    // Niveau 2: varerne i tilbudslistens rækkefølge (samme sortering som portalen)
    const pdfItems = [...(line.project_quote_line_items_2026_01_16_23_00 ?? [])]
      .sort((a: any, b: any) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'da', { numeric: true }))
      .map((it: any) => ({ title: String(it.title ?? ''), quantity: Number(it.qty ?? 0), unit: it.unit ?? null }));
    return { title: line.title, description: line.description ?? undefined, quantity: Number(line.quantity ?? 0), unit: line.unit, sellingPricePerUnit: t.sellingPricePerUnit, totalSellingPrice: t.totalSellingPrice, items: pdfItems, isOption: (line as any).is_option === true };
  });

  const date = formatDk(quote.created_at);
  const validUntil = quote.valid_until ? formatDk(quote.valid_until) : null;
  const recipientName = quote.recipient_name ?? quote.customer_contact_name ?? companyDefaultContactName ?? null;
  const customer = quote.company_name
    ? { name: quote.company_name, cvr: quote.company_cvr ?? null, addressLine1: quote.company_address_line1 ?? null, addressZip: quote.company_address_zip ?? null, addressCity: quote.company_address_city ?? null, contactName: recipientName }
    : project.customer ? { name: project.customer, contactName: recipientName } : { contactName: recipientName };
  const quoteDateStr = quote.resolved_quote_date ? formatDk(quote.resolved_quote_date) : date;

  const doc = React.createElement(QuotePDF, {
    projectName: project.name, quoteTitle: quote.title, quoteNumber: quote.quote_number, quoteDate: quoteDateStr,
    validUntil, lines: pdfLines, customer,
    paymentTerms: quote.resolved_payment_terms ?? null, deliveryPeriod: quote.resolved_delivery_period ?? null,
    deliveryNote: quote.customer_delivery_note ?? null, reservations: quote.resolved_reservations ?? null,
    paymentTermsTemplate: (quote.resolved_payment_terms_template ?? quote.payment_terms_template ?? '50_50_levering') as PaymentTermsTemplate,
    introText: quote.intro_text ?? null, notes: quote.customer_remarks ?? null,
    showItems: (quote as any).pdf_show_items === true,
    createdBy: {
      name: quote.created_by_name_resolved ?? quote.created_by_name ?? null,
      email: quote.created_by_email_resolved ?? quote.created_by_email ?? null,
      phone: quote.created_by_phone_resolved ?? quote.created_by_phone ?? null,
    },
  } as QuotePDFProps);

  const blob = await pdf(doc as any).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

async function renderAppendixPdf(loaded: LoadedQuoteData): Promise<Uint8Array> {
  const { quote, lines, project, companyDefaultContactName } = loaded;
  const customer = quote.company_name
    ? { name: quote.company_name, cvr: quote.company_cvr ?? null, contactName: quote.customer_contact_name ?? companyDefaultContactName ?? null }
    : project.customer ? { name: project.customer, contactName: quote.customer_contact_name ?? null } : { contactName: quote.customer_contact_name ?? null };

  const sortedLines = [...lines]
    .filter((l) => l.include_in_appendix !== false)
    .sort((a, b) => {
      const aOrder = a.display_order;
      const bOrder = b.display_order;
      if (aOrder != null && bOrder != null) return aOrder - bOrder;
      if (aOrder != null) return -1;
      if (bOrder != null) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const appendixLines = sortedLines.map((line) => ({
    title: line.title,
    description: line.description ?? null,
    livingDescription: line.living_description ?? null,
    technicalSpec: line.technical_spec ?? null,
    imageUrl: lineEffectiveImageUrl(line),
    imageCaption: line.active_image_source === 'custom' ? line.custom_image_caption ?? null : null,
  }));

  const date = formatDk(quote.created_at);
  const quoteDateStr = quote.resolved_quote_date ? formatDk(quote.resolved_quote_date) : date;

  const doc = React.createElement(QuoteAppendixPDF, {
    projectName: project.name, quoteTitle: quote.title, quoteNumber: quote.quote_number, quoteDate: quoteDateStr,
    customer, lines: appendixLines, introText: quote.appendix_intro_text ?? null,
  } as QuoteAppendixPDFProps);

  const blob = await pdf(doc as any).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

async function mergePdfs(quoteBytes: Uint8Array, appendixBytes: Uint8Array): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  const quoteDoc = await PDFDocument.load(quoteBytes);
  const appendixDoc = await PDFDocument.load(appendixBytes);
  const quotePages = await merged.copyPages(quoteDoc, quoteDoc.getPageIndices());
  quotePages.forEach((p) => merged.addPage(p));
  const appendixPages = await merged.copyPages(appendixDoc, appendixDoc.getPageIndices());
  appendixPages.forEach((p) => merged.addPage(p));
  return await merged.save();
}

const SIGNED_URL_TTL_SECONDS = 3600;

interface UploadResult { signed_url: string; expires_at: string; path: string; filename: string; file_size_bytes: number; }

async function uploadAndSign(supabase: ReturnType<typeof createClient>, bytes: Uint8Array, loaded: LoadedQuoteData, format: Format): Promise<UploadResult | { error: string; status: number }> {
  const { quote, project } = loaded;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}`;
  const projectNumber = project.project_number || 'unknown';
  const quoteNumber = quote.quote_number || quote.id.slice(0, 8);
  const path = `${projectNumber}/${quoteNumber}/${timestamp}_${format}.pdf`;
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '-').replace(/^-+|-+$/g, '');
  const formatLabel = format === 'pdf' ? 'tilbud' : format === 'bilag' ? 'bilag' : 'tilbud+bilag';
  const filename = `${timestamp.replace('T', '_')}_${formatLabel}-${sanitize(project.name)}-${sanitize(quoteNumber)}.pdf`;

  const { error: uploadErr } = await supabase.storage.from('quote-pdfs').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) { console.error('Storage upload fejlede:', uploadErr); return { error: `Storage upload fejlede: ${uploadErr.message}`, status: 502 }; }

  const { data: signedData, error: signErr } = await supabase.storage.from('quote-pdfs').createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (signErr || !signedData?.signedUrl) { console.error('Signed URL generation fejlede:', signErr); return { error: 'Kunne ikke generere signed URL', status: 500 }; }

  const expiresAt = new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
  return { signed_url: signedData.signedUrl, expires_at: expiresAt, path, filename, file_size_bytes: bytes.byteLength };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const quoteId: string | undefined = body?.quote_id;
    const format: Format = (body?.format ?? 'pdf') as Format;

    if (!quoteId) return jsonResponse({ error: 'quote_id er påkrævet' }, 400);
    if (!VALID_FORMATS.includes(format)) return jsonResponse({ error: `format skal være en af: ${VALID_FORMATS.join(', ')}` }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const loaded = await loadQuoteData(supabase, quoteId);
    if ('error' in loaded) return jsonResponse({ error: loaded.error }, loaded.status);

    let pdfBytes: Uint8Array;
    if (format === 'pdf') pdfBytes = await renderQuotePdf(loaded);
    else if (format === 'bilag') pdfBytes = await renderAppendixPdf(loaded);
    else {
      const [quoteBytes, appendixBytes] = await Promise.all([renderQuotePdf(loaded), renderAppendixPdf(loaded)]);
      pdfBytes = await mergePdfs(quoteBytes, appendixBytes);
    }

    const uploaded = await uploadAndSign(supabase, pdfBytes, loaded, format);
    if ('error' in uploaded) return jsonResponse({ error: uploaded.error }, uploaded.status);

    return jsonResponse({ ...uploaded, quote_number: loaded.quote.quote_number, project_name: loaded.project.name, format }, 200);
  } catch (err) {
    console.error('Uventet fejl:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
