// Bemærk: Denne fil er også kopieret til app/supabase/edge_function/generate-quote-pdf/QuotePDF.tsx
// for headless PDF-generering. Hvis du ændrer her, opdater også kopien.

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_INFO } from '@/config/company';

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

interface PDFLine {
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  sellingPricePerUnit: number;
  totalSellingPrice: number;
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
}

const fmt = (n: number) =>
  new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' kr.';

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
}: QuotePDFProps) {
  // Subtotal og moms beregnes kun ud fra prissatte linjer
  const subtotal = lines.reduce((sum, l) => sum + (l.totalSellingPrice || 0), 0);
  const vat = Math.round(subtotal * 0.25);
  const grandTotal = subtotal + vat;

  const customerAddress = formatCustomerAddress(customer);

  const intro = introText
    || 'Hermed vores tilbud på de beskrevne poster. Tilbuddet er udarbejdet på baggrund af det modtagne projektmateriale og forudsætninger angivet under vilkår.';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Page-header (fixed) */}
        <View style={styles.pageHeader} fixed>
          <Text style={styles.pageHeaderBrand}>NEM INVENTAR</Text>
          <Text style={styles.pageHeaderMeta}>
            Tilbud {quoteNumber || ''}{quoteNumber && projectName ? ' · ' : ''}{projectName || ''}
          </Text>
        </View>

        {/* Brand-mark + tagline */}
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>NEM INVENTAR</Text>
          <Text style={styles.brandTagline}>Snedker · Inventar · Specialopgaver</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Tilbud</Text>
          <Text style={styles.heroTitle}>{quoteTitle}</Text>
          <View style={styles.accentLine} />
        </View>

        {/* 3-kolonne meta-blok */}
        <View style={styles.metaBlock}>
          {/* Kunde */}
          <View style={styles.metaCol}>
            <Text style={styles.metaColLabel}>Kunde</Text>
            {customer?.name ? <Text style={styles.metaColValueBold}>{customer.name}</Text> : <Text style={styles.metaColValue}>—</Text>}
            {customer?.cvr ? <Text style={styles.metaColValue}>CVR {customer.cvr}</Text> : null}
            {customerAddress ? <Text style={styles.metaColValue}>{customerAddress}</Text> : null}
            {customer?.contactName ? <Text style={styles.metaColValue}>Att. {customer.contactName}</Text> : null}
          </View>
          {/* Tilbud */}
          <View style={styles.metaCol}>
            <Text style={styles.metaColLabel}>Tilbud</Text>
            <Text style={styles.metaColValueBold}>{quoteNumber || '—'}</Text>
            <Text style={styles.metaColValue}>Dato: {quoteDate}</Text>
            {validUntil ? <Text style={styles.metaColValue}>Gyldigt til: {validUntil}</Text> : null}
          </View>
          {/* Afsender */}
          <View style={[styles.metaCol, { paddingRight: 0 }]}>
            <Text style={styles.metaColLabel}>Afsender</Text>
            <Text style={styles.metaColValueBold}>{COMPANY_INFO.name}</Text>
            <Text style={styles.metaColValue}>CVR {COMPANY_INFO.cvr}</Text>
            {createdBy?.name ? <Text style={styles.metaColValue}>Att. {createdBy.name}</Text> : null}
            {createdBy?.email ? <Text style={styles.metaColValue}>{createdBy.email}</Text> : null}
            {createdBy?.phone ? <Text style={styles.metaColValue}>{createdBy.phone}</Text> : null}
          </View>
        </View>

        {/* Intro */}
        <Text style={styles.intro}>{intro}</Text>

        {/* Tilbudslinje-tabel */}
        <Text style={styles.sectionHeader}>Tilbudslinjer</Text>

        {/* Tabel-header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colNo]}>Nr.</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Beskrivelse</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Antal</Text>
          <Text style={[styles.tableHeaderText, styles.colUnit]}>Enh.</Text>
          <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>Enhedspris</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>I alt</Text>
        </View>

        {/* Linjer */}
        {lines.map((line, i) => {
          // 0/tom = uprissat linje ("—"). Negative beløb SKAL vises — reduktions-/rabatlinjer
          // (fx "Optimering -42.000") indgår i subtotalen og må ikke stå med blank beløbskolonne.
          const hasPrice = !!line.totalSellingPrice;
          return (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={[styles.cellMuted, styles.colNo]}>{i + 1}</Text>
              <View style={styles.colDesc}>
                <Text style={styles.descTitle}>{line.title}</Text>
                {line.description ? (
                  <Text style={styles.descBody}>{line.description}</Text>
                ) : null}
              </View>
              <Text style={[styles.cell, styles.colQty]}>{line.quantity}</Text>
              <Text style={[styles.cellMuted, styles.colUnit]}>{line.unit}</Text>
              <Text style={[hasPrice ? styles.cell : styles.cellMuted, styles.colUnitPrice]}>
                {hasPrice ? fmt(line.sellingPricePerUnit) : '—'}
              </Text>
              <Text style={[hasPrice ? styles.cell : styles.cellMuted, styles.colTotal]}>
                {hasPrice ? fmt(line.totalSellingPrice) : '—'}
              </Text>
            </View>
          );
        })}

        {/* Total-blok */}
        <View style={styles.totalBlock} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ekskl. moms</Text>
            <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Moms (25%)</Text>
            <Text style={styles.totalValue}>{fmt(vat)}</Text>
          </View>
          <View style={styles.grandTotalSep} />
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>I alt inkl. moms</Text>
            <Text style={styles.grandTotalValue}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        {/* Betalingsplan */}
        {(() => {
          const tmpl = paymentTermsTemplate ?? '50_50_levering';
          const splitRows = (firstPct: number, secondPct: number, secondLabel: string) => {
            const firstExcl = Math.round(subtotal * firstPct / 100);
            const secondExcl = subtotal - firstExcl;
            const firstIncl = Math.round(firstExcl * 1.25);
            const secondIncl = Math.round(secondExcl * 1.25);
            return [
              { when: `Ved accept af tilbuddet (${firstPct}%)`, excl: firstExcl, incl: firstIncl },
              { when: `${secondLabel} (${secondPct}%)`, excl: secondExcl, incl: secondIncl },
            ];
          };
          let rows: Array<{ when: string; excl: number; incl: number }> | null = null;
          let fallback: string | null = null;
          if (tmpl === '50_50_levering') rows = splitRows(50, 50, 'Ved levering');
          else if (tmpl === '40_60') rows = splitRows(40, 60, 'Ved levering');
          else if (tmpl === '30_70') rows = splitRows(30, 70, 'Ved levering');
          else if (tmpl === '20_80') rows = splitRows(20, 80, 'Ved levering');
          else if (tmpl === 'per_levering') fallback = 'Faktureres pr. delleverance — se leveranceplan.';
          else if (tmpl === 'custom') fallback = 'Betalingsbetingelser aftales individuelt.';

          return (
            <View style={styles.paymentPlanBlock} wrap={false}>
              <Text style={styles.sectionHeader}>Betalingsplan</Text>
              {rows ? (
                <>
                  <View style={styles.paymentPlanHeader}>
                    <Text style={[styles.paymentPlanHeaderText, { flex: 2.5 }]}>Hvad</Text>
                    <Text style={[styles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }]}>Ekskl. moms</Text>
                    <Text style={[styles.paymentPlanHeaderText, { flex: 1.5, textAlign: 'right' }]}>Inkl. moms</Text>
                  </View>
                  {rows.map((r, i) => (
                    <View key={i} style={styles.paymentPlanRow}>
                      <Text style={styles.paymentPlanColWhen}>{r.when}</Text>
                      <Text style={styles.paymentPlanColAmount}>{fmt(r.excl)}</Text>
                      <Text style={styles.paymentPlanColAmount}>{fmt(r.incl)}</Text>
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
            <Text style={styles.sectionHeader}>Vilkår</Text>
            {paymentTerms ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>Betaling</Text>
                <Text style={styles.termsValue}>{paymentTerms}</Text>
              </View>
            ) : null}
            {deliveryPeriod ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>Leveringstid</Text>
                <Text style={styles.termsValue}>{deliveryPeriod}</Text>
              </View>
            ) : null}
            {deliveryNote ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>Leveringsnote</Text>
                <Text style={styles.termsValue}>{deliveryNote}</Text>
              </View>
            ) : null}
            {reservations ? (
              <View style={styles.termsRow}>
                <Text style={styles.termsLabel}>Forbehold</Text>
                <Text style={styles.termsValue}>{reservations}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bemærkninger */}
        {notes ? (
          <View style={styles.notesBlock} wrap={false}>
            <Text style={styles.sectionHeader}>Bemærkninger</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {/* Accept */}
        <View style={styles.acceptBlock} wrap={false}>
          <Text style={styles.acceptIntro}>
            Tilbuddet accepteres ved mailbekræftelse til {createdBy?.email || COMPANY_INFO.email} eller ved underskrift nedenfor.
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureCol}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Sted og dato</Text>
            </View>
            <View style={styles.signatureCol}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Underskrift / navn</Text>
            </View>
          </View>
        </View>

        {/* Page-footer (fixed) */}
        <View style={styles.pageFooter} fixed>
          <Text>{quoteDate}</Text>
          <Text style={styles.pageFooterCenter}>
            {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
          </Text>
          <Text render={({ pageNumber }) => `Side ${pageNumber}`} />
        </View>
      </Page>
    </Document>
  );
}
