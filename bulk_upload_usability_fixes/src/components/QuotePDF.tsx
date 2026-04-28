import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_INFO } from '@/config/company';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 95,
    paddingHorizontal: 48,
    color: '#111',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end', minWidth: 160 },
  company: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  companyMeta: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.45,
  },
  metaLabel: {
    color: '#6b7280',
    fontSize: 9,
  },
  metaValue: {
    fontSize: 10,
    marginBottom: 4,
  },
  // Title block
  titleBlock: {
    marginBottom: 14,
  },
  projectName: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  quoteTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  // Customer block
  customerBlock: {
    marginBottom: 18,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
  },
  customerLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  customerName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  customerLine: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.4,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnit: { flex: 1, textAlign: 'center' },
  colUnitPrice: { flex: 2, textAlign: 'right' },
  colTotal: { flex: 2, textAlign: 'right' },
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  descTitle: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  descBody: {
    color: '#6b7280',
    fontSize: 9,
    lineHeight: 1.4,
  },
  // Totals
  totalSection: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 3,
    paddingHorizontal: 8,
    minWidth: 248,
  },
  totalLabel: {
    color: '#374151',
    width: 140,
    textAlign: 'right',
    marginRight: 8,
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f3f4f6',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    marginTop: 4,
    minWidth: 248,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 140,
    textAlign: 'right',
    marginRight: 8,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    width: 100,
    textAlign: 'right',
  },
  // Sections
  section: {
    marginTop: 18,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  sectionRowLabel: {
    width: 120,
    color: '#6b7280',
    fontSize: 9,
  },
  sectionRowValue: {
    flex: 1,
    fontSize: 10,
  },
  sectionText: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  // Accept
  acceptBlock: {
    marginTop: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'solid',
  },
  acceptText: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 1.4,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 16,
  },
  signatureCol: { flex: 1 },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#9ca3af',
    paddingTop: 3,
    fontSize: 8,
    color: '#6b7280',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    color: '#9ca3af',
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerLine: { textAlign: 'center', lineHeight: 1.35, marginBottom: 1 },
  footerPage: { textAlign: 'right', marginTop: 3 },
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
  reservations?: string | null;
  createdBy?: PDFCreatedBy;
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
  reservations,
  createdBy,
}: QuotePDFProps) {
  const subtotal = lines.reduce((sum, l) => sum + l.totalSellingPrice, 0);
  const vat = Math.round(subtotal * 0.25);
  const grandTotal = subtotal + vat;

  const customerAddress = formatCustomerAddress(customer);
  const hasCustomerInfo = customer && (customer.name || customer.cvr || customerAddress || customer.contactName);
  const hasTerms = paymentTerms || deliveryPeriod || reservations;
  const hasCreatedBy = createdBy && (createdBy.name || createdBy.email || createdBy.phone);

  const footerLine1 = `${COMPANY_INFO.name} · CVR ${COMPANY_INFO.cvr} · ${COMPANY_INFO.address.line2}, ${COMPANY_INFO.address.zip} ${COMPANY_INFO.address.city} · ${COMPANY_INFO.phone} · ${COMPANY_INFO.email}`;
  const footerLine2 = `Bank: ${COMPANY_INFO.bank.name} · Reg ${COMPANY_INFO.bank.regNo} · Konto ${COMPANY_INFO.bank.accountNo} · IBAN ${COMPANY_INFO.bank.iban} · BIC ${COMPANY_INFO.bank.bic}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.company}>{COMPANY_INFO.name}</Text>
            <Text style={styles.companyMeta}>
              CVR {COMPANY_INFO.cvr}{'\n'}
              {COMPANY_INFO.address.line1}{'\n'}
              {COMPANY_INFO.address.line2}{'\n'}
              {COMPANY_INFO.address.zip} {COMPANY_INFO.address.city}{'\n'}
              Tlf. {COMPANY_INFO.phone}{'\n'}
              {COMPANY_INFO.email}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.metaLabel}>Tilbudsnr.</Text>
            <Text style={styles.metaValue}>{quoteNumber || '—'}</Text>
            <Text style={styles.metaLabel}>Dato</Text>
            <Text style={styles.metaValue}>{quoteDate}</Text>
            {validUntil ? (
              <>
                <Text style={styles.metaLabel}>Gyldig til</Text>
                <Text style={styles.metaValue}>{validUntil}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.projectName}>{projectName}</Text>
          <Text style={styles.quoteTitle}>{quoteTitle}</Text>
        </View>

        {/* Customer */}
        {hasCustomerInfo ? (
          <View style={styles.customerBlock}>
            <Text style={styles.customerLabel}>Til</Text>
            {customer?.name ? <Text style={styles.customerName}>{customer.name}</Text> : null}
            {customer?.cvr ? <Text style={styles.customerLine}>CVR {customer.cvr}</Text> : null}
            {customerAddress ? <Text style={styles.customerLine}>{customerAddress}</Text> : null}
            {customer?.contactName ? <Text style={styles.customerLine}>Att. {customer.contactName}</Text> : null}
          </View>
        ) : null}

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.colDesc]}>Beskrivelse</Text>
          <Text style={[styles.headerText, styles.colQty]}>Antal</Text>
          <Text style={[styles.headerText, styles.colUnit]}>Enhed</Text>
          <Text style={[styles.headerText, styles.colUnitPrice]}>Enhedspris</Text>
          <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
        </View>

        {/* Lines */}
        {lines.map((line, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <View style={styles.colDesc}>
              <Text style={styles.descTitle}>{line.title}</Text>
              {line.description ? (
                <Text style={styles.descBody}>{line.description}</Text>
              ) : null}
            </View>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colUnit}>{line.unit}</Text>
            <Text style={styles.colUnitPrice}>{fmt(line.sellingPricePerUnit)}</Text>
            <Text style={styles.colTotal}>{fmt(line.totalSellingPrice)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ekskl. moms</Text>
            <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Moms (25%)</Text>
            <Text style={styles.totalValue}>{fmt(vat)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>I alt inkl. moms</Text>
            <Text style={styles.grandTotalValue}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        {/* Vilkår */}
        {hasTerms ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionLabel}>Vilkår</Text>
            {paymentTerms ? (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionRowLabel}>Betaling</Text>
                <Text style={styles.sectionRowValue}>{paymentTerms}</Text>
              </View>
            ) : null}
            {deliveryPeriod ? (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionRowLabel}>Leveringstid</Text>
                <Text style={styles.sectionRowValue}>{deliveryPeriod}</Text>
              </View>
            ) : null}
            {reservations ? (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.sectionRowLabel}>Forbehold</Text>
                <Text style={[styles.sectionText, { marginTop: 2 }]}>{reservations}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Tilbudsgiver */}
        {hasCreatedBy ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionLabel}>Tilbudsgiver</Text>
            {createdBy?.name ? <Text style={styles.sectionText}>{createdBy.name}</Text> : null}
            {createdBy?.email ? <Text style={styles.sectionText}>{createdBy.email}</Text> : null}
            {createdBy?.phone ? <Text style={styles.sectionText}>{createdBy.phone}</Text> : null}
          </View>
        ) : null}

        {/* Accept */}
        <View style={styles.acceptBlock} wrap={false}>
          <Text style={styles.acceptText}>
            Tilbuddet accepteres ved mailbekræftelse til {createdBy?.email || COMPANY_INFO.email} eller ved underskrift nedenfor.
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureCol}>
              <Text style={styles.signatureLine}>Sted og dato</Text>
            </View>
            <View style={styles.signatureCol}>
              <Text style={styles.signatureLine}>Underskrift</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLine}>{footerLine1}</Text>
          <Text style={styles.footerLine}>{footerLine2}</Text>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) => `Side ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
