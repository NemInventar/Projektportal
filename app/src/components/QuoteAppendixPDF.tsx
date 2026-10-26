// Bemærk: Denne fil er også kopieret til app/supabase/edge_function/generate-quote-pdf/QuoteAppendixPDF.tsx
// for headless PDF-generering. Hvis du ændrer her, opdater også kopien.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_INFO } from '@/config/company';

// Designguide (delt med QuotePDF)
const PALETTE = {
  ink: '#1a1a1a',
  muted: '#6b6b6b',
  line: '#d4d0c7',
  bg: '#f7f5f0',
  accent: '#3d4a3d',
};

const MARGIN = 62; // 22mm

// Bilagets faste tekster pr. sprog (project_quotes.pdf_language, Milot 26-10-2026). Disclaimeren står på alle bilag
// (kunde-facing, Joachim 2026-06-16).
const TEXT = {
  da: {
    disclaimer: 'Dette er renderinger, udførslen tilpasses det enkelte projekt.',
    tagline: 'Snedker · Inventar · Specialopgaver',
    appendix: 'Bilag',
    appendixTo: 'Bilag til tilbud',
    defaultIntro: (nr: string) => `Bilaget viser hver enkelt post i tilbuddet med billede og teknisk specifikation. Det giver et samlet overblik over materialer, mål og udførelse, og læses sammen med tilbudsdokument ${nr}.`,
    customer: 'Kunde', quote: 'Tilbud', sender: 'Afsender', customerReg: 'CVR', ourReg: `CVR ${COMPANY_INFO.cvr}`, attn: 'Att.', date: 'Dato',
    noContent: 'Ingen indhold',
    emptyNote: 'Tilbuddet har ingen linjer med billeder eller levende beskrivelser. Tilføj dem i tilbuds-editoren for at fylde dette bilag.',
    item: (i: number, n: number) => `Post ${i} af ${n}`,
    noImage: 'Intet billede',
    description: 'Beskrivelse',
    spec: 'Teknisk spec',
    page: 'Side',
  },
  en: {
    disclaimer: 'These are renderings. The final design is adapted to each project.',
    tagline: 'Joinery · Furniture · Special projects',
    appendix: 'Appendix',
    appendixTo: 'Appendix to quotation',
    defaultIntro: (nr: string) => `This appendix shows each item in the quotation with an image and technical specification. It gives an overview of materials, dimensions and finish, and should be read together with quotation ${nr}.`,
    customer: 'Customer', quote: 'Quotation', sender: 'From', customerReg: 'Reg. no.', ourReg: `VAT no. DK${COMPANY_INFO.cvr}`, attn: 'Attn.', date: 'Date',
    noContent: 'No content',
    emptyNote: 'The quotation has no lines with images or descriptions.',
    item: (i: number, n: number) => `Item ${i} of ${n}`,
    noImage: 'No image',
    description: 'Description',
    spec: 'Technical specification',
    page: 'Page',
  },
} as const;

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
  /** Bilagets faste tekster (project_quotes.pdf_language) */
  language?: 'da' | 'en';
}

export function QuoteAppendixPDF({
  projectName,
  quoteTitle,
  quoteNumber,
  quoteDate,
  customer,
  lines,
  introText,
  language = 'da',
}: QuoteAppendixPDFProps) {
  const T = TEXT[language] ?? TEXT.da;
  const intro = introText || T.defaultIntro(quoteNumber || '—');
  const visibleLines = lines.filter(l => l.imageUrl || l.livingDescription || l.technicalSpec);
  const headerMeta = `${T.appendix} · ${quoteNumber || ''}${quoteNumber && projectName ? ' · ' : ''}${projectName || ''}`;

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
        <Text style={styles.coverTagline}>{T.tagline}</Text>

        {/* Hero */}
        <Text style={styles.coverLabel}>{T.appendixTo}</Text>
        <Text style={styles.coverTitle}>{quoteTitle}</Text>
        <View style={styles.coverAccentLine} />

        <Text style={styles.coverIntro}>{intro}</Text>
        <Text style={styles.coverDisclaimer}>{T.disclaimer}</Text>

        {/* Meta */}
        <View style={styles.coverMetaBlock}>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>{T.customer}</Text>
            {customer?.name ? <Text style={styles.coverMetaValueBold}>{customer.name}</Text> : <Text style={styles.coverMetaValue}>—</Text>}
            {customer?.cvr ? <Text style={styles.coverMetaValue}>{T.customerReg} {customer.cvr}</Text> : null}
            {customer?.contactName ? <Text style={styles.coverMetaValue}>{T.attn} {customer.contactName}</Text> : null}
          </View>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>{T.quote}</Text>
            <Text style={styles.coverMetaValueBold}>{quoteNumber || '—'}</Text>
            <Text style={styles.coverMetaValue}>{T.date}: {quoteDate}</Text>
          </View>
          <View style={[styles.coverMetaCol, { paddingRight: 0 }]}>
            <Text style={styles.coverMetaLabel}>{T.sender}</Text>
            <Text style={styles.coverMetaValueBold}>{COMPANY_INFO.name}</Text>
            <Text style={styles.coverMetaValue}>{T.ourReg}</Text>
            <Text style={styles.coverMetaValue}>{COMPANY_INFO.email}</Text>
          </View>
        </View>

        {/* Footer (fixed) */}
        <View style={styles.pageFooter} fixed>
          <Text>{quoteDate}</Text>
          <Text style={styles.pageFooterCenter}>
            {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
          </Text>
          <Text render={({ pageNumber }) => `${T.page} ${pageNumber}`} />
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
            <Text style={styles.lineLabel}>{T.appendix}</Text>
            <Text style={styles.lineTitle}>{T.noContent}</Text>
            <View style={styles.lineAccentLine} />
          </View>
          <Text style={styles.emptyNote}>{T.emptyNote}</Text>
          <View style={styles.pageFooter} fixed>
            <Text>{quoteDate}</Text>
            <Text style={styles.pageFooterCenter}>
              {COMPANY_INFO.name} · {COMPANY_INFO.email} · {COMPANY_INFO.phone}
            </Text>
            <Text render={({ pageNumber }) => `${T.page} ${pageNumber}`} />
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
              <Text style={styles.lineLabel}>{T.item(i + 1, visibleLines.length)}</Text>
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
                <Text style={styles.imagePlaceholder}>{T.noImage}</Text>
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
                      <Text style={styles.blockLabel}>{T.description}</Text>
                      <Text style={styles.livingText}>{line.livingDescription}</Text>
                    </View>
                  ) : null}
                  {line.technicalSpec ? (
                    <View style={line.livingDescription ? styles.bodySide : { flex: 1 }}>
                      <Text style={styles.blockLabel}>{T.spec}</Text>
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
              <Text render={({ pageNumber }) => `${T.page} ${pageNumber}`} />
            </View>
          </Page>
        ))
      )}
    </Document>
  );
}
