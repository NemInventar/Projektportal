import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    color: '#111',
  },
  header: {
    marginBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
  },
  company: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  projectName: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quoteTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  metaRight: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    color: '#6b7280',
    fontSize: 9,
  },
  metaValue: {
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 0,
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
  totalSection: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    paddingVertical: 4,
    minWidth: 240,
  },
  totalLabel: {
    color: '#6b7280',
    width: 140,
    textAlign: 'right',
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
  vatNote: {
    color: '#9ca3af',
    fontSize: 8,
    marginTop: 6,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#9ca3af',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
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

interface QuotePDFProps {
  projectName: string;
  quoteTitle: string;
  quoteNumber: string;
  quoteDate: string;
  lines: PDFLine[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' kr.';

export function QuotePDF({ projectName, quoteTitle, quoteNumber, quoteDate, lines }: QuotePDFProps) {
  const grandTotal = lines.reduce((sum, l) => sum + l.totalSellingPrice, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.company}>Nem Inventar ApS</Text>
          <Text style={styles.projectName}>{projectName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.quoteTitle}>{quoteTitle}</Text>
            <View style={styles.metaRight}>
              <Text style={styles.metaLabel}>Tilbudsnr.</Text>
              <Text style={styles.metaValue}>{quoteNumber}</Text>
              <Text style={[styles.metaLabel, { marginTop: 4 }]}>Dato</Text>
              <Text style={styles.metaValue}>{quoteDate}</Text>
            </View>
          </View>
        </View>

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
          <View key={i} style={styles.row}>
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
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>I alt ekskl. moms</Text>
            <Text style={styles.grandTotalValue}>{fmt(grandTotal)}</Text>
          </View>
          <Text style={styles.vatNote}>Priser er eksklusiv moms (25%)</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Nem Inventar ApS · js@neminventar.dk</Text>
          <Text render={({ pageNumber, totalPages }) => `Side ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
