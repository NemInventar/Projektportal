// KOPI af app/src/components/QuoteAppendixPDF.tsx
// Skal holdes synkroniseret med GUI-versionen.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_INFO } from './company.ts';

// Designguide (delt med QuotePDF)
const PALETTE = {
  ink: '#1a1a1a',
  muted: '#6b6b6b',
  line: '#d4d0c7',
  bg: '#f7f5f0',
  accent: '#3d4a3d',
};

const MARGIN = 62; // 22mm

// Hardcoded system-wide disclaimer på alle bilag (kunde-facing). Joachim 2026-06-16.
const RENDER_DISCLAIMER = 'Dette er renderinger, udførslen tilpasses det enkelte projekt.';

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
  // Page-footer
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

  // Cover page
  coverBrand: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  coverTagline: {
    fontSize: 8,
    color: PALETTE.muted,
    letterSpacing: 0.5,
    marginBottom: 60,
  },
  coverLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    lineHeight: 1.15,
    marginBottom: 12,
  },
  coverAccentLine: {
    width: 85,
    height: 2,
    backgroundColor: PALETTE.accent,
    marginTop: 4,
    marginBottom: 24,
  },
  coverIntro: {
    fontSize: 11,
    color: PALETTE.muted,
    lineHeight: 1.6,
    marginBottom: 14,
  },
  coverDisclaimer: {
    fontSize: 8,
    fontStyle: 'italic',
    color: PALETTE.muted,
    lineHeight: 1.5,
    marginBottom: 60,
  },
  coverMetaBlock: {
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.line,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.line,
    flexDirection: 'row',
  },
  coverMetaCol: { flex: 1, paddingRight: 12 },
  coverMetaLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  coverMetaValue: {
    fontSize: 9,
    color: PALETTE.ink,
    lineHeight: 1.45,
  },
  coverMetaValueBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
  },

  // Per-line page
  lineHeaderBlock: {
    marginBottom: 18,
  },
  lineLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  lineTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    lineHeight: 1.25,
  },
  lineAccentLine: {
    width: 60,
    height: 2,
    backgroundColor: PALETTE.accent,
    marginTop: 8,
  },

  imageBox: {
    width: '100%',
    height: 280,
    backgroundColor: PALETTE.bg,
    marginBottom: 6,
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
    color: PALETTE.muted,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 14,
  },
  imagePlaceholder: {
    color: PALETTE.muted,
    fontSize: 9,
    fontStyle: 'italic',
  },

  bodyBlock: {
    marginTop: 10,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 6,
  },
  bodyMain: {
    flex: 2,
  },
  bodySide: {
    flex: 1,
    paddingLeft: 18,
    borderLeftWidth: 0.5,
    borderLeftColor: PALETTE.line,
  },
  blockLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  livingText: {
    fontSize: 11,
    color: PALETTE.ink,
    lineHeight: 1.6,
  },
  specText: {
    fontSize: 9,
    color: PALETTE.ink,
    lineHeight: 1.5,
  },
  emptyNote: {
    fontSize: 9,
    fontStyle: 'italic',
    color: PALETTE.muted,
  },
});

export interface AppendixLine {
  title: string;
  description?: string | null;
  livingDescription?: string | null;
  technicalSpec?: string | null;
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
  introText?: string | null;
}

export function QuoteAppendixPDF({
  projectName,
  quoteTitle,
  quoteNumber,
  quoteDate,
  customer,
  lines,
  introText,
}: QuoteAppendixPDFProps) {
  const intro = introText
    || `Bilaget viser hver enkelt post i tilbuddet med billede og teknisk specifikation. Det giver et samlet overblik over materialer, mål og udførelse, og læses sammen med tilbudsdokument ${quoteNumber || '—'}.`;
  const visibleLines = lines.filter(l => l.imageUrl || l.livingDescription || l.technicalSpec);
  const headerMeta = `Bilag · ${quoteNumber || ''}${quoteNumber && projectName ? ' · ' : ''}${projectName || ''}`;

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        {/* Page-header (fixed) */}
        <View style={styles.pageHeader} fixed>
          <Text style={styles.pageHeaderBrand}>NEM INVENTAR</Text>
          <Text style={styles.pageHeaderMeta}>{headerMeta}</Text>
        </View>

        {/* Brand */}
        <Text style={styles.coverBrand}>NEM INVENTAR</Text>
        <Text style={styles.coverTagline}>Snedker · Inventar · Specialopgaver</Text>

        {/* Hero */}
        <Text style={styles.coverLabel}>Bilag til tilbud</Text>
        <Text style={styles.coverTitle}>{quoteTitle}</Text>
        <View style={styles.coverAccentLine} />

        <Text style={styles.coverIntro}>{intro}</Text>
        <Text style={styles.coverDisclaimer}>{RENDER_DISCLAIMER}</Text>

        {/* Meta */}
        <View style={styles.coverMetaBlock}>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>Kunde</Text>
            {customer?.name ? <Text style={styles.coverMetaValueBold}>{customer.name}</Text> : <Text style={styles.coverMetaValue}>—</Text>}
            {customer?.cvr ? <Text style={styles.coverMetaValue}>CVR {customer.cvr}</Text> : null}
            {customer?.contactName ? <Text style={styles.coverMetaValue}>Att. {customer.contactName}</Text> : null}
          </View>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>Tilbud</Text>
            <Text style={styles.coverMetaValueBold}>{quoteNumber || '—'}</Text>
            <Text style={styles.coverMetaValue}>Dato: {quoteDate}</Text>
          </View>
          <View style={[styles.coverMetaCol, { paddingRight: 0 }]}>
            <Text style={styles.coverMetaLabel}>Afsender</Text>
            <Text style={styles.coverMetaValueBold}>{COMPANY_INFO.name}</Text>
            <Text style={styles.coverMetaValue}>CVR {COMPANY_INFO.cvr}</Text>
            <Text style={styles.coverMetaValue}>{COMPANY_INFO.email}</Text>
          </View>
        </View>

        {/* Footer (fixed) */}
        <View style={styles.pageFooter} fixed>
          <Text>{quoteDate}</Text>
          <Text style={styles.pageFooterCenter}>
            {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
          </Text>
          <Text render={({ pageNumber }) => `Side ${pageNumber}`} />
        </View>
      </Page>

      {/* Per-line pages */}
      {visibleLines.length === 0 ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.pageHeader} fixed>
            <Text style={styles.pageHeaderBrand}>NEM INVENTAR</Text>
            <Text style={styles.pageHeaderMeta}>{headerMeta}</Text>
          </View>
          <View style={styles.lineHeaderBlock}>
            <Text style={styles.lineLabel}>Bilag</Text>
            <Text style={styles.lineTitle}>Ingen indhold</Text>
            <View style={styles.lineAccentLine} />
          </View>
          <Text style={styles.emptyNote}>
            Tilbuddet har ingen linjer med billeder eller levende beskrivelser.
            Tilføj dem i tilbuds-editoren for at fylde dette bilag.
          </Text>
          <View style={styles.pageFooter} fixed>
            <Text>{quoteDate}</Text>
            <Text style={styles.pageFooterCenter}>
              {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
            </Text>
            <Text render={({ pageNumber }) => `Side ${pageNumber}`} />
          </View>
        </Page>
      ) : (
        visibleLines.map((line, i) => (
          <Page key={i} size="A4" style={styles.page}>
            <View style={styles.pageHeader} fixed>
              <Text style={styles.pageHeaderBrand}>NEM INVENTAR</Text>
              <Text style={styles.pageHeaderMeta}>{headerMeta}</Text>
            </View>

            {/* Hero per linje */}
            <View style={styles.lineHeaderBlock}>
              <Text style={styles.lineLabel}>Post {i + 1} af {visibleLines.length}</Text>
              <Text style={styles.lineTitle}>{line.title}</Text>
              <View style={styles.lineAccentLine} />
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

            {/* Body: levende beskrivelse + teknisk spec.
                Skjules helt hvis begge er tomme. Hvis kun én er udfyldt
                rendres den i fuld bredde. */}
            {(line.livingDescription || line.technicalSpec) ? (
              <View style={styles.bodyBlock}>
                <View style={styles.bodyRow}>
                  {line.livingDescription ? (
                    <View style={line.technicalSpec ? styles.bodyMain : { flex: 1 }}>
                      <Text style={styles.blockLabel}>Beskrivelse</Text>
                      <Text style={styles.livingText}>{line.livingDescription}</Text>
                    </View>
                  ) : null}
                  {line.technicalSpec ? (
                    <View style={line.livingDescription ? styles.bodySide : { flex: 1 }}>
                      <Text style={styles.blockLabel}>Teknisk spec</Text>
                      <Text style={styles.specText}>{line.technicalSpec}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.pageFooter} fixed>
              <Text>{quoteDate}</Text>
              <Text style={styles.pageFooterCenter}>
                {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
              </Text>
              <Text render={({ pageNumber }) => `Side ${pageNumber}`} />
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}
