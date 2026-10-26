// KOPI af app/src/components/QuotePDF.tsx
// Skal holdes synkroniseret med GUI-versionen.
// Hvis du ændrer designet i GUI, opdater også her.

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_INFO } from './company.ts';

// Designguide (fælles for QuotePDF og QuoteAppendixPDF)
const PALETTE = {
  ink: '#1a1a1a',
  muted: '#6b6b6b',
  line: '#d4d0c7',
  bg: '#f7f5f0',
  accent: '#3d4a3d',
};

// 22mm = 62.36pt @ 72dpi (PDF bruger pt). Brug 62 for enkelhed.
const MARGIN = 62;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    color: PALETTE.ink,
  },
  // Page-header (på hver side)
  pageHeader: {
    position: 'absolute',
    top: 22,
    left: MARGIN,
    right: MARGIN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.line,
  },
  pageHeaderBrand: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    letterSpacing: 1,
  },
  pageHeaderMeta: {
    fontSize: 8,
    color: PALETTE.muted,
  },
  // Page-footer (på hver side)
  pageFooter: {
    position: 'absolute',
    bottom: 22,
    left: MARGIN,
    right: MARGIN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.line,
    fontSize: 7,
    color: PALETTE.muted,
  },
  pageFooterCenter: { textAlign: 'center', flex: 1 },
  // Brand-mark
  brandBlock: {
    marginBottom: 24,
  },
  brand: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    letterSpacing: 1.5,
  },
  brandTagline: {
    fontSize: 8,
    color: PALETTE.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // Hovedtitel
  hero: {
    marginBottom: 18,
  },
  heroLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    lineHeight: 1.2,
    marginBottom: 12,
  },
  accentLine: {
    width: 85,
    height: 2,
    backgroundColor: PALETTE.accent,
    marginTop: 4,
  },
  // Meta-blok (3 kolonner)
  metaBlock: {
    marginTop: 18,
    marginBottom: 24,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.line,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.line,
    flexDirection: 'row',
  },
  metaCol: { flex: 1, paddingRight: 12 },
  metaColLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metaColValue: {
    fontSize: 9,
    color: PALETTE.ink,
    lineHeight: 1.45,
  },
  metaColValueBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
  },
  // Intro-tekst
  intro: {
    fontSize: 10,
    color: PALETTE.ink,
    lineHeight: 1.55,
    marginBottom: 22,
  },
  // Sektion-headers
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    marginBottom: 10,
    marginTop: 8,
  },
  // Tabel
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PALETTE.bg,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.line,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.line,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: PALETTE.line,
  },
  // Kolonner: NR · BESKRIVELSE · ANTAL · ENH · ENHEDSPRIS · I ALT
  colNo:        { width: 22 },
  colDesc:      { flex: 1, paddingRight: 8 },
  colQty:       { width: 38, textAlign: 'right' },
  colUnit:      { width: 36, textAlign: 'center' },
  colUnitPrice: { width: 70, textAlign: 'right' },
  colTotal:     { width: 70, textAlign: 'right' },
  descTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: PALETTE.ink,
    marginBottom: 2,
  },
  descBody: {
    fontSize: 8.5,
    color: PALETTE.muted,
    lineHeight: 1.4,
  },
  cell: {
    fontSize: 10,
    color: PALETTE.ink,
  },
  cellMuted: {
    fontSize: 10,
    color: PALETTE.muted,
  },
  // Beløbet i euro under kronebeløbet (kun når tilbuddet har en EUR-kurs)
  eurCell: {
    fontSize: 8,
    color: PALETTE.accent,
    textAlign: 'right',
    marginTop: 2,
  },
  // Niveau 2: varerne under en post (antal + enhed + titel, ingen priser)
  rowWithItems: {
    borderBottomWidth: 0,
    paddingBottom: 3,
  },
  itemsBlock: {
    paddingLeft: 28,
    paddingRight: 6,
    paddingBottom: 8,
    borderBottomWidth: 0.3,
    borderBottomColor: PALETTE.line,
  },
  itemsLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 1.5,
  },
  itemQty: {
    width: 52,
    fontSize: 8.5,
    color: PALETTE.ink,
    textAlign: 'right',
    paddingRight: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 8.5,
    color: PALETTE.ink,
    lineHeight: 1.35,
  },
  tableNote: {
    fontSize: 8.5,
    color: PALETTE.muted,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  // Optioner (indgår ikke i tilbudssummen)
  optionsBlock: {
    marginTop: 22,
  },
  // Total-blok
  totalBlock: {
    marginTop: 14,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    minWidth: 240,
  },
  totalLabel: {
    fontSize: 10,
    color: PALETTE.muted,
    width: 140,
    textAlign: 'right',
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 10,
    color: PALETTE.ink,
    width: 100,
    textAlign: 'right',
  },
  totalNote: {
    fontSize: 8,
    color: PALETTE.muted,
    width: 240,
    textAlign: 'right',
    marginTop: 3,
  },
  grandTotalSep: {
    width: 240,
    height: 1.5,
    backgroundColor: PALETTE.accent,
    marginTop: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 6,
    minWidth: 240,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    width: 140,
    textAlign: 'right',
    paddingRight: 12,
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    width: 100,
    textAlign: 'right',
  },
  // Betalingsplan
  paymentPlanBlock: {
    marginTop: 22,
  },
  paymentPlanHeader: {
    flexDirection: 'row',
    backgroundColor: PALETTE.bg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.line,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.line,
  },
  paymentPlanHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  paymentPlanRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.3,
    borderBottomColor: PALETTE.line,
  },
  paymentPlanColWhen: { flex: 2.5, fontSize: 10, color: PALETTE.ink },
  paymentPlanColAmount: { flex: 1.5, fontSize: 10, color: PALETTE.ink, textAlign: 'right' },
  paymentPlanFallback: {
    fontSize: 10,
    fontStyle: 'italic',
    color: PALETTE.muted,
    paddingTop: 4,
  },
  // Bemærkninger (notes)
  notesBlock: {
    marginTop: 22,
  },
  notesText: {
    fontSize: 10,
    color: PALETTE.ink,
    lineHeight: 1.5,
  },
  // Vilkår
  termsBlock: {
    marginTop: 28,
  },
  termsRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.3,
    borderBottomColor: PALETTE.line,
  },
  termsLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 110,
    paddingTop: 1,
  },
  termsValue: {
    fontSize: 10,
    color: PALETTE.ink,
    flex: 1,
    lineHeight: 1.5,
  },
  // Accept
  acceptBlock: {
    marginTop: 26,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.line,
  },
  acceptIntro: {
    fontSize: 9,
    color: PALETTE.muted,
    lineHeight: 1.5,
    marginBottom: 26,
  },
  signatureRow: {
    flexDirection: 'row',
    gap: 24,
  },
  signatureCol: {
    flex: 1,
  },
  signatureLine: {
    height: 1,
    backgroundColor: PALETTE.line,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

interface PDFLineItem {
  title: string;
  quantity: number;
  unit?: string | null;
}

interface PDFLine {
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  sellingPricePerUnit: number;
  totalSellingPrice: number;
  /** Niveau 2 — vises kun når showItems er slået til på tilbuddet */
  items?: PDFLineItem[];
  /** Option/reguleringspost — står i egen tabel og tæller ikke med i summen */
  isOption?: boolean;
}

interface PDFCustomer {
  name?: string | null;
  cvr?: string | null;
  addressLine1?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
  contactName?: string | null;
}

interface PDFCreatedBy {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export type PaymentTermsTemplate = '50_50_levering' | '40_60' | '30_70' | '20_80' | 'per_levering' | 'custom';

interface QuotePDFProps {
  projectName: string;
  quoteTitle: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil?: string | null;
  lines: PDFLine[];
  customer?: PDFCustomer;
  paymentTerms?: string | null;
  deliveryPeriod?: string | null;
  deliveryNote?: string | null;
  reservations?: string | null;
  paymentTermsTemplate?: PaymentTermsTemplate | null;
  createdBy?: PDFCreatedBy;
  introText?: string | null;
  notes?: string | null;
  /** Vis varerne under hver post (project_quotes.pdf_show_items) */
  showItems?: boolean;
  /** PDF'ens faste tekster (project_quotes.pdf_language) — tilbuddets egne tekster står på det sprog, de er skrevet på */
  language?: PdfLanguage;
  /** dk = 25 % dansk moms · reverse_charge = ingen dansk moms, køber afregner (project_quotes.vat_mode) */
  vatMode?: VatMode;
  /** DKK pr. EUR — sat = beløbene vises også i euro (project_quotes.eur_rate) */
  eurRate?: number | null;
}

export type PdfLanguage = 'da' | 'en';
export type VatMode = 'dk' | 'reverse_charge';

// PDF'ens faste tekster pr. sprog (Milot 26-10-2026, 26039 Sylt: tilbud til Tyskland på engelsk, i euro og uden dansk moms)
const TEXT = {
  da: {
    tagline: 'Snedker · Inventar · Specialopgaver',
    quote: 'Tilbud',
    customer: 'Kunde',
    sender: 'Afsender',
    customerReg: 'CVR',
    ourReg: `CVR ${COMPANY_INFO.cvr}`,
    attn: 'Att.',
    date: 'Dato',
    validUntil: 'Gyldigt til',
    defaultIntro: 'Hermed vores tilbud på de beskrevne poster. Tilbuddet er udarbejdet på baggrund af det modtagne projektmateriale og forudsætninger angivet under vilkår.',
    lines: 'Tilbudslinjer',
    itemsNote: 'Under hver post står, hvad posten omfatter.',
    itemsLabel: 'Posten omfatter',
    colNo: 'Nr.', colDesc: 'Beskrivelse', colQty: 'Antal', colUnit: 'Enh.', colUnitPrice: 'Enhedspris', colTotal: 'I alt',
    subtotal: 'Subtotal ekskl. moms',
    vat: 'Moms (25%)',
    total: 'I alt inkl. moms',
    vatReverse: 'Moms',
    vatReverseValue: 'Omvendt betalingspligt',
    totalReverse: 'I alt',
    reverseNote: 'Der lægges ikke dansk moms på. Køber afregner momsen (omvendt betalingspligt).',
    eurRow: (rate: string) => `Ca. i EUR (kurs ${rate})`,
    eurNote: (rate: string) => `Beløb i euro er vejledende til kurs ${rate} DKK pr. EUR. Der faktureres i DKK.`,
    options: 'Optioner',
    optionsNote: 'Priserne er ekskl. moms og indgår ikke i tilbudssummen.',
    paymentPlan: 'Betalingsplan',
    when: 'Hvad',
    excl: 'Ekskl. moms',
    incl: 'Inkl. moms',
    amount: 'Beløb',
    onAccept: (pct: number) => `Ved accept af tilbuddet (${pct}%)`,
    onDelivery: 'Ved levering',
    perDelivery: 'Faktureres pr. delleverance — se leveranceplan.',
    custom: 'Betalingsbetingelser aftales individuelt.',
    terms: 'Vilkår',
    payment: 'Betaling',
    deliveryTime: 'Leveringstid',
    deliveryNote: 'Leveringsnote',
    comments: 'Kommentarer',
    notes: 'Bemærkninger',
    accept: (email: string) => `Tilbuddet accepteres ved mailbekræftelse til ${email} eller ved underskrift nedenfor.`,
    placeDate: 'Sted og dato',
    signature: 'Underskrift / navn',
    page: 'Side',
  },
  en: {
    tagline: 'Joinery · Furniture · Special projects',
    quote: 'Quotation',
    customer: 'Customer',
    sender: 'From',
    customerReg: 'Reg. no.',
    ourReg: `VAT no. DK${COMPANY_INFO.cvr}`,
    attn: 'Attn.',
    date: 'Date',
    validUntil: 'Valid until',
    defaultIntro: 'Please find our quotation for the items described below. It is based on the project material we have received and the conditions stated under terms.',
    lines: 'Items',
    itemsNote: 'Each item lists what it includes.',
    itemsLabel: 'Includes',
    colNo: 'No.', colDesc: 'Description', colQty: 'Qty', colUnit: 'Unit', colUnitPrice: 'Unit price', colTotal: 'Total',
    subtotal: 'Subtotal excl. VAT',
    vat: 'VAT (25%)',
    total: 'Total incl. VAT',
    vatReverse: 'VAT',
    vatReverseValue: 'Reverse charge',
    totalReverse: 'Total',
    reverseNote: 'No Danish VAT is added. VAT is accounted for by the customer (reverse charge).',
    eurRow: (rate: string) => `Approx. in EUR (rate ${rate})`,
    eurNote: (rate: string) => `EUR amounts are for guidance at ${rate} DKK per EUR. Invoices are issued in DKK.`,
    options: 'Options',
    optionsNote: 'Prices are excl. VAT and are not included in the total.',
    paymentPlan: 'Payment schedule',
    when: 'When',
    excl: 'Excl. VAT',
    incl: 'Incl. VAT',
    amount: 'Amount',
    onAccept: (pct: number) => `On acceptance of the quotation (${pct}%)`,
    onDelivery: 'On delivery',
    perDelivery: 'Invoiced per partial delivery, see the delivery plan.',
    custom: 'Payment terms are agreed individually.',
    terms: 'Terms',
    payment: 'Payment',
    deliveryTime: 'Delivery time',
    deliveryNote: 'Delivery',
    comments: 'Comments',
    notes: 'Notes',
    accept: (email: string) => `To accept the quotation, confirm by email to ${email} or sign below.`,
    placeDate: 'Place and date',
    signature: 'Signature / name',
    page: 'Page',
  },
} as const;

// Enheder, som de står i ERP'et, på engelsk (ukendte enheder vises som de er)
const UNIT_EN: Record<string, string> = { stk: 'pcs', 'stk.': 'pcs', 'sæt': 'set', lbm: 'lin. m', time: 'hr', timer: 'hrs', 'm2': 'm²' };
const unitText = (unit: string | null | undefined, language: PdfLanguage) =>
  language === 'en' ? (UNIT_EN[(unit ?? '').trim().toLowerCase()] ?? unit ?? '') : (unit ?? '');

const numberLocale = (language: PdfLanguage) => (language === 'en' ? 'en-GB' : 'da-DK');

const makeFmt = (language: PdfLanguage) => (n: number) => {
  const s = new Intl.NumberFormat(numberLocale(language), { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  return language === 'en' ? `DKK ${s}` : `${s} kr.`;
};

const makeFmtEur = (language: PdfLanguage, rate: number) => (dkk: number) =>
  `EUR ${new Intl.NumberFormat(numberLocale(language), { maximumFractionDigits: 0 }).format(Math.round(dkk / rate))}`;

const makeFmtQty = (language: PdfLanguage) => (n: number) =>
  new Intl.NumberFormat(numberLocale(language), { maximumFractionDigits: 2 }).format(n);

const formatCustomerAddress = (c?: PDFCustomer): string | null => {
  if (!c) return null;
  const cityZip = [c.addressZip, c.addressCity].filter(Boolean).join(' ');
  const parts = [c.addressLine1, cityZip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

export function QuotePDF({
  projectName,
  quoteTitle,
  quoteNumber,
  quoteDate,
  validUntil,
  lines,
  customer,
  paymentTerms,
  deliveryPeriod,
  deliveryNote,
  reservations,
  paymentTermsTemplate,
  createdBy,
  introText,
  notes,
  showItems = false,
  language = 'da',
  vatMode = 'dk',
  eurRate = null,
}: QuotePDFProps) {
  const T = TEXT[language] ?? TEXT.da;
  const fmt = makeFmt(language);
  const fmtQty = makeFmtQty(language);
  const reverseCharge = vatMode === 'reverse_charge';
  // Euro vises kun med en gyldig kurs — vejledende, der faktureres i DKK
  const showEur = typeof eurRate === 'number' && eurRate > 0;
  const fmtEur = showEur ? makeFmtEur(language, eurRate as number) : null;
  const rateText = showEur ? new Intl.NumberFormat(numberLocale(language), { maximumFractionDigits: 4 }).format(eurRate as number) : '';

  // Optioner står i egen tabel og tæller ikke med i summen (samme regel som cached_option_total)
  const mainLines = lines.filter(l => !l.isOption);
  const optionLines = lines.filter(l => l.isOption);
  // Subtotal og moms beregnes kun ud fra prissatte linjer. Omvendt betalingspligt: ingen dansk moms
  const subtotal = mainLines.reduce((sum, l) => sum + (l.totalSellingPrice || 0), 0);
  const vat = reverseCharge ? 0 : Math.round(subtotal * 0.25);
  const grandTotal = subtotal + vat;

  const customerAddress = formatCustomerAddress(customer);

  const intro = introText || T.defaultIntro;

  const tableHeader = (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderText, styles.colNo]}>{T.colNo}</Text>
      <Text style={[styles.tableHeaderText, styles.colDesc]}>{T.colDesc}</Text>
      <Text style={[styles.tableHeaderText, styles.colQty]}>{T.colQty}</Text>
      <Text style={[styles.tableHeaderText, styles.colUnit]}>{T.colUnit}</Text>
      <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>{T.colUnitPrice}</Text>
      <Text style={[styles.tableHeaderText, styles.colTotal]}>{T.colTotal}</Text>
    </View>
  );

  const renderLines = (list: PDFLine[], withItems: boolean) =>
    list.flatMap((line, i) => {
      // 0/tom = uprissat linje ("—"). Negative beløb SKAL vises — reduktions-/rabatlinjer
      // (fx "Optimering -42.000") indgår i subtotalen og må ikke stå med blank beløbskolonne.
      const hasPrice = !!line.totalSellingPrice;
      const items = withItems ? (line.items ?? []) : [];
      const rows = [
        <View
          key={`l${i}`}
          style={items.length ? [styles.row, styles.rowWithItems] : styles.row}
          wrap={false}
          minPresenceAhead={items.length ? 30 : undefined}
        >
          <Text style={[styles.cellMuted, styles.colNo]}>{i + 1}</Text>
          <View style={styles.colDesc}>
            <Text style={styles.descTitle}>{line.title}</Text>
            {line.description ? (
              <Text style={styles.descBody}>{line.description}</Text>
            ) : null}
          </View>
          <Text style={[styles.cell, styles.colQty]}>{fmtQty(line.quantity)}</Text>
          <Text style={[styles.cellMuted, styles.colUnit]}>{unitText(line.unit, language)}</Text>
          <Text style={[hasPrice ? styles.cell : styles.cellMuted, styles.colUnitPrice]}>
            {hasPrice ? fmt(line.sellingPricePerUnit) : '—'}
          </Text>
          <View style={styles.colTotal}>
            <Text style={[hasPrice ? styles.cell : styles.cellMuted, { textAlign: 'right' }]}>
              {hasPrice ? fmt(line.totalSellingPrice) : '—'}
            </Text>
            {hasPrice && fmtEur ? <Text style={styles.eurCell}>{fmtEur(line.totalSellingPrice)}</Text> : null}
          </View>
        </View>,
      ];
      if (items.length) {
        rows.push(
          <View key={`i${i}`} style={styles.itemsBlock}>
            <Text style={styles.itemsLabel}>{T.itemsLabel}</Text>
            {items.map((it, j) => (
              <View key={j} style={styles.itemRow} wrap={false}>
                <Text style={styles.itemQty}>{fmtQty(it.quantity)} {unitText(it.unit || 'stk', language)}</Text>
                <Text style={styles.itemTitle}>{it.title}</Text>
              </View>
            ))}
          </View>
        );
      }
      return rows;
    });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Page-header (fixed) */}
        <View style={styles.pageHeader} fixed>
          <Text style={styles.pageHeaderBrand}>NEM INVENTAR</Text>
          <Text style={styles.pageHeaderMeta}>
            {T.quote} {quoteNumber || ''}{quoteNumber && projectName ? ' · ' : ''}{projectName || ''}
          </Text>
        </View>

        {/* Brand-mark + tagline */}
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>NEM INVENTAR</Text>
          <Text style={styles.brandTagline}>{T.tagline}</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{T.quote}</Text>
          <Text style={styles.heroTitle}>{quoteTitle}</Text>
          <View style={styles.accentLine} />
        </View>

        {/* 3-kolonne meta-blok */}
        <View style={styles.metaBlock}>
          {/* Kunde */}
          <View style={styles.metaCol}>
            <Text style={styles.metaColLabel}>{T.customer}</Text>
            {customer?.name ? <Text style={styles.metaColValueBold}>{customer.name}</Text> : <Text style={styles.metaColValue}>—</Text>}
            {customer?.cvr ? <Text style={styles.metaColValue}>{T.customerReg} {customer.cvr}</Text> : null}
            {customerAddress ? <Text style={styles.metaColValue}>{customerAddress}</Text> : null}
            {customer?.contactName ? <Text style={styles.metaColValue}>{T.attn} {customer.contactName}</Text> : null}
          </View>
          {/* Tilbud */}
          <View style={styles.metaCol}>
            <Text style={styles.metaColLabel}>{T.quote}</Text>
            <Text style={styles.metaColValueBold}>{quoteNumber || '—'}</Text>
            <Text style={styles.metaColValue}>{T.date}: {quoteDate}</Text>
            {validUntil ? <Text style={styles.metaColValue}>{T.validUntil}: {validUntil}</Text> : null}
          </View>
          {/* Afsender */}
          <View style={[styles.metaCol, { paddingRight: 0 }]}>
            <Text style={styles.metaColLabel}>{T.sender}</Text>
            <Text style={styles.metaColValueBold}>{COMPANY_INFO.name}</Text>
            <Text style={styles.metaColValue}>{T.ourReg}</Text>
            {createdBy?.name ? <Text style={styles.metaColValue}>{T.attn} {createdBy.name}</Text> : null}
            {createdBy?.email ? <Text style={styles.metaColValue}>{createdBy.email}</Text> : null}
            {createdBy?.phone ? <Text style={styles.metaColValue}>{createdBy.phone}</Text> : null}
          </View>
        </View>

        {/* Intro */}
        <Text style={styles.intro}>{intro}</Text>

        {/* Tilbudslinje-tabel */}
        <Text style={styles.sectionHeader}>{T.lines}</Text>
        {showItems ? (
          <Text style={styles.tableNote}>{T.itemsNote}</Text>
        ) : null}

        {tableHeader}
        {renderLines(mainLines, showItems)}

        {/* Total-blok — omvendt betalingspligt: ingen dansk moms, køber afregner */}
        <View style={styles.totalBlock} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{T.subtotal}</Text>
            <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{reverseCharge ? T.vatReverse : T.vat}</Text>
            <Text style={styles.totalValue}>{reverseCharge ? T.vatReverseValue : fmt(vat)}</Text>
          </View>
          <View style={styles.grandTotalSep} />
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{reverseCharge ? T.totalReverse : T.total}</Text>
            <Text style={styles.grandTotalValue}>{fmt(grandTotal)}</Text>
          </View>
          {fmtEur ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{T.eurRow(rateText)}</Text>
              <Text style={styles.totalValue}>{fmtEur(grandTotal)}</Text>
            </View>
          ) : null}
          {reverseCharge ? <Text style={styles.totalNote}>{T.reverseNote}</Text> : null}
          {fmtEur ? <Text style={styles.totalNote}>{T.eurNote(rateText)}</Text> : null}
        </View>

        {/* Optioner — egen tabel, indgår ikke i summen ovenfor */}
        {optionLines.length ? (
          <View style={styles.optionsBlock}>
            <View wrap={false} minPresenceAhead={60}>
              <Text style={styles.sectionHeader}>{T.options}</Text>
              <Text style={styles.tableNote}>{T.optionsNote}</Text>
            </View>
            {tableHeader}
            {renderLines(optionLines, false)}
          </View>
        ) : null}

        {/* Betalingsplan */}
        {(() => {
          const tmpl = paymentTermsTemplate ?? '50_50_levering';
          // Omvendt betalingspligt: ingen "inkl. moms"-kolonne (der lægges ikke dansk moms på). EUR-kurs: egen kolonne i euro
          const splitRows = (firstPct: number, secondPct: number, secondLabel: string) => {
            const firstExcl = Math.round(subtotal * firstPct / 100);
            const secondExcl = subtotal - firstExcl;
            const firstIncl = Math.round(firstExcl * 1.25);
            const secondIncl = Math.round(secondExcl * 1.25);
            return [
              { when: T.onAccept(firstPct), excl: firstExcl, incl: firstIncl },
              { when: `${secondLabel} (${secondPct}%)`, excl: secondExcl, incl: secondIncl },
            ];
          };
          let rows: Array<{ when: string; excl: number; incl: number }> | null = null;
          let fallback: string | null = null;
          if (tmpl === '50_50_levering') rows = splitRows(50, 50, T.onDelivery);
          else if (tmpl === '40_60') rows = splitRows(40, 60, T.onDelivery);
          else if (tmpl === '30_70') rows = splitRows(30, 70, T.onDelivery);
          else if (tmpl === '20_80') rows = splitRows(20, 80, T.onDelivery);
          else if (tmpl === 'per_levering') fallback = T.perDelivery;
          else if (tmpl === 'custom') fallback = T.custom;

          return (
            <View style={styles.paymentPlanBlock} wrap={false}>
              <Text style={styles.sectionHeader}>{T.paymentPlan}</Text>
              {rows ? (
                <>
                  <View style={styles.paymentPlanHeader}>
                    <Text style={[styles.paymentPlanHeaderText, { flex: 2.5 }]}>{T.when}</Text>
                    <Text style={[styles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }]}>{reverseCharge ? T.amount : T.excl}</Text>
                    {reverseCharge ? null : <Text style={[styles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }]}>{T.incl}</Text>}
                    {fmtEur ? <Text style={[styles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }]}>EUR</Text> : null}
                  </View>
                  {rows.map((r, i) => (
                    <View key={i} style={styles.paymentPlanRow}>
                      <Text style={styles.paymentPlanColWhen}>{r.when}</Text>
                      <Text style={styles.paymentPlanColAmount}>{fmt(r.excl)}</Text>
                      {reverseCharge ? null : <Text style={styles.paymentPlanColAmount}>{fmt(r.incl)}</Text>}
                      {fmtEur ? <Text style={styles.paymentPlanColAmount}>{fmtEur(reverseCharge ? r.excl : r.incl)}</Text> : null}
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.paymentPlanFallback}>{fallback}</Text>
              )}
            </View>
          );
        })()}

        {/* Vilkår */}
        {(paymentTerms || deliveryPeriod || deliveryNote || reservations) ? (
          <View style={styles.termsBlock} wrap={false}>
            <Text style={styles.sectionHeader}>{T.terms}</Text>
            {paymentTerms ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>{T.payment}</Text>
                <Text style={styles.termsValue}>{paymentTerms}</Text>
              </View>
            ) : null}
            {deliveryPeriod ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>{T.deliveryTime}</Text>
                <Text style={styles.termsValue}>{deliveryPeriod}</Text>
              </View>
            ) : null}
            {deliveryNote ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>{T.deliveryNote}</Text>
                <Text style={styles.termsValue}>{deliveryNote}</Text>
              </View>
            ) : null}
            {reservations ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>{T.comments}</Text>
                <Text style={styles.termsValue}>{reservations}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bemærkninger */}
        {notes ? (
          <View style={styles.notesBlock} wrap={false}>
            <Text style={styles.sectionHeader}>{T.notes}</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {/* Accept */}
        <View style={styles.acceptBlock} wrap={false}>
          <Text style={styles.acceptIntro}>
            {T.accept(createdBy?.email || COMPANY_INFO.email)}
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureCol}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{T.placeDate}</Text>
            </View>
            <View style={styles.signatureCol}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{T.signature}</Text>
            </View>
          </View>
        </View>

        {/* Page-footer (fixed) */}
        <View style={styles.pageFooter} fixed>
          <Text>{quoteDate}</Text>
          <Text style={styles.pageFooterCenter}>
            {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
          </Text>
          <Text render={({ pageNumber }) => `${T.page} ${pageNumber}`} />
        </View>
      </Page>
    </Document>
  );
}
