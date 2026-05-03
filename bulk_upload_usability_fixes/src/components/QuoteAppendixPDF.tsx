import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_INFO } from '@/config/company';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 48,
    color: '#111',
  },
  // Cover
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 60,
    color: '#111',
  },
  coverHeader: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  coverCompany: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  coverProject: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 60,
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 30,
  },
  coverMetaBlock: {
    marginTop: 80,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  coverMetaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  coverMetaLabel: { width: 130, color: '#6b7280', fontSize: 10 },
  coverMetaValue: { flex: 1, fontSize: 11 },
  // Per-line page
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  lineTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    paddingRight: 16,
  },
  lineMetaRight: {
    alignItems: 'flex-end',
  },
  lineMetaLabel: { color: '#6b7280', fontSize: 8 },
  lineMetaValue: { fontSize: 10 },
  imageBox: {
    width: '100%',
    height: 280,
    backgroundColor: '#f3f4f6',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageImg: {
    width: '100%',
    height: 280,
    objectFit: 'contain',
  },
  imageCaption: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  imagePlaceholder: {
    color: '#9ca3af',
    fontSize: 10,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 18,
  },
  bodyMain: {
    flex: 2,
  },
  bodySide: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
  },
  livingTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  livingText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#1f2937',
  },
  specTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  specText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#374151',
  },
  emptyNote: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 28,
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

export interface AppendixLine {
  title: string;
  description?: string | null;
  livingDescription?: string | null;
  imageUrl?: string | null;
  imageCaption?: string | null;
}

interface AppendixCustomer {
  name?: string | null;
  cvr?: string | null;
  contactName?: string | null;
}

interface QuoteAppendixPDFProps {
  projectName: string;
  quoteTitle: string;
  quoteNumber: string;
  quoteDate: string;
  customer?: AppendixCustomer;
  lines: AppendixLine[];
}

const FOOTER_LINE = `${COMPANY_INFO.name} · CVR ${COMPANY_INFO.cvr} · ${COMPANY_INFO.address.line2}, ${COMPANY_INFO.address.zip} ${COMPANY_INFO.address.city} · ${COMPANY_INFO.phone} · ${COMPANY_INFO.email}`;

export function QuoteAppendixPDF({
  projectName,
  quoteTitle,
  quoteNumber,
  quoteDate,
  customer,
  lines,
}: QuoteAppendixPDFProps) {
  // Vis kun linjer der har enten billede, levende beskrivelse, eller teknisk beskrivelse.
  // En linje uden noget indhold er ikke værd at vise i bilaget.
  const visibleLines = lines.filter(l => l.imageUrl || l.livingDescription || l.description);

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverHeader}>BILAG TIL TILBUD</Text>
        <Text style={styles.coverCompany}>{COMPANY_INFO.name}</Text>
        <Text style={styles.coverProject}>{projectName}</Text>

        <Text style={styles.coverTitle}>{quoteTitle}</Text>
        <Text style={styles.coverSubtitle}>
          Visuelle illustrationer og beskrivelser af de enkelte poster i tilbuddet.
          Tilhører tilbudsdokument {quoteNumber}.
        </Text>

        <View style={styles.coverMetaBlock}>
          {customer?.name ? (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Til</Text>
              <Text style={styles.coverMetaValue}>{customer.name}</Text>
            </View>
          ) : null}
          {customer?.cvr ? (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>CVR</Text>
              <Text style={styles.coverMetaValue}>{customer.cvr}</Text>
            </View>
          ) : null}
          {customer?.contactName ? (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Att.</Text>
              <Text style={styles.coverMetaValue}>{customer.contactName}</Text>
            </View>
          ) : null}
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Tilbudsnr.</Text>
            <Text style={styles.coverMetaValue}>{quoteNumber}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Dato</Text>
            <Text style={styles.coverMetaValue}>{quoteDate}</Text>
          </View>
        </View>
      </Page>

      {/* Per-line pages */}
      {visibleLines.length === 0 ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.lineHeader}>
            <Text style={styles.lineTitle}>Ingen indhold</Text>
          </View>
          <Text style={styles.emptyNote}>
            Tilbuddet har ingen linjer med billeder eller levende beskrivelser.
            Tilføj dem i tilbuds-editoren for at fylde dette bilag.
          </Text>
          <View style={styles.footer} fixed>
            <Text style={styles.footerLine}>{FOOTER_LINE}</Text>
            <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `Side ${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ) : (
        visibleLines.map((line, i) => (
          <Page key={i} size="A4" style={styles.page}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>{line.title}</Text>
              <View style={styles.lineMetaRight}>
                <Text style={styles.lineMetaLabel}>Bilagspost</Text>
                <Text style={styles.lineMetaValue}>{i + 1} af {visibleLines.length}</Text>
              </View>
            </View>

            {/* Billede */}
            {line.imageUrl ? (
              <>
                <Image src={line.imageUrl} style={styles.imageImg} />
                {line.imageCaption ? <Text style={styles.imageCaption}>{line.imageCaption}</Text> : null}
              </>
            ) : (
              <View style={styles.imageBox}>
                <Text style={styles.imagePlaceholder}>Intet billede</Text>
              </View>
            )}

            {/* Body: levende beskrivelse + teknisk spec */}
            {line.livingDescription || line.description ? (
              <View style={styles.bodyRow}>
                <View style={styles.bodyMain}>
                  <Text style={styles.livingTitle}>Beskrivelse</Text>
                  {line.livingDescription ? (
                    <Text style={styles.livingText}>{line.livingDescription}</Text>
                  ) : (
                    <Text style={styles.emptyNote}>Levende beskrivelse mangler.</Text>
                  )}
                </View>
                {line.description ? (
                  <View style={styles.bodySide}>
                    <Text style={styles.specTitle}>Teknisk spec</Text>
                    <Text style={styles.specText}>{line.description}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text style={styles.footerLine}>{FOOTER_LINE}</Text>
              <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `Side ${pageNumber} / ${totalPages}`} />
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}
