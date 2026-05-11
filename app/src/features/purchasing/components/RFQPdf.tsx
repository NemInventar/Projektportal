/**
 * RFQPdf — PDF-renderer til en prisforespørgsel (RFQ).
 *
 * Bruges i SendRFQDialog og "Download PDF"-knappen på RFQDetail.
 * Ingen priser vises — leverandøren skal udfylde dem selv.
 *
 * Stil-reference: `src/components/QuotePDF.tsx`
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { RfqWithRelations } from '../types';

// ---------------------------------------------------------------------------
// NemInventar-kontakt (hardcoded for V1 — kan rykkes til settings senere)
// ---------------------------------------------------------------------------
const NEMINVENTAR_CONTACT = {
  companyName: 'Nem Inventar ApS',
  address: 'Danmark', // TODO: udfyld fast adresse når kendt
  contactName: 'Joachim Skovbogaard',
  email: 'js@neminventar.dk',
  phone: '', // TODO: tilføj telefon hvis relevant
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  company: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  companyMeta: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docType: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  titleBlock: {
    marginBottom: 16,
  },
  rfqTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  projectLine: {
    fontSize: 10,
    color: '#6b7280',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginBottom: 16,
  },
  metaItem: {
    width: '50%',
    marginBottom: 6,
    paddingRight: 8,
  },
  metaLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  metaValue: {
    fontSize: 10,
  },
  metaValueBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  metaValueUrgent: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
  },
  descBox: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#fefce8',
    borderLeftWidth: 3,
    borderLeftColor: '#eab308',
  },
  descLabel: {
    fontSize: 8,
    color: '#854d0e',
    textTransform: 'uppercase',
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  descText: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 4,
  },
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
  colNo: { width: 28, textAlign: 'left' },
  colName: { flex: 3, paddingRight: 6 },
  colSpec: { flex: 3, paddingRight: 6 },
  colQty: { width: 48, textAlign: 'right' },
  colUnit: { width: 48, textAlign: 'center' },
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
  instructionsBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  instructionsTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 9,
    color: '#1e3a8a',
    lineHeight: 1.5,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('da-DK');
  } catch {
    return String(iso);
  }
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function fmtDeliveryWindow(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  if (!first && !last) return '—';
  if (first && last) return `${fmtDate(first)} → ${fmtDate(last)}`;
  return fmtDate(first ?? last);
}

// ---------------------------------------------------------------------------
// Props + component
// ---------------------------------------------------------------------------
export interface RFQPdfProps {
  rfq: RfqWithRelations;
  projectName: string;
  projectNumber?: string;
}

export function RFQPdf({ rfq, projectName, projectNumber }: RFQPdfProps) {
  const deadlineDays = daysUntil(rfq.deadline);
  const deadlineUrgent = deadlineDays !== null && deadlineDays < 7;
  const generatedOn = new Date().toLocaleDateString('da-DK');

  const companyLines = [
    NEMINVENTAR_CONTACT.address,
    NEMINVENTAR_CONTACT.contactName,
    NEMINVENTAR_CONTACT.email,
    NEMINVENTAR_CONTACT.phone,
  ].filter((l) => l && l.trim().length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{NEMINVENTAR_CONTACT.companyName}</Text>
            {companyLines.map((l, i) => (
              <Text key={i} style={styles.companyMeta}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docType}>Prisforespørgsel</Text>
            <Text style={[styles.companyMeta, { marginTop: 6 }]}>
              Dato: {generatedOn}
            </Text>
          </View>
        </View>

        {/* Titel + projekt */}
        <View style={styles.titleBlock}>
          <Text style={styles.rfqTitle}>{rfq.title}</Text>
          <Text style={styles.projectLine}>
            Projekt: {projectName}
            {projectNumber ? ` (${projectNumber})` : ''}
          </Text>
        </View>

        {/* Meta-blok */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Frist for svar</Text>
            <Text
              style={
                deadlineUrgent
                  ? styles.metaValueUrgent
                  : rfq.deadline
                    ? styles.metaValueBold
                    : styles.metaValue
              }
            >
              {fmtDate(rfq.deadline)}
              {deadlineUrgent && deadlineDays !== null
                ? ` (${deadlineDays} dage)`
                : ''}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Leveringsvindue</Text>
            <Text style={styles.metaValue}>
              {fmtDeliveryWindow(rfq.first_delivery_date, rfq.last_delivery_date)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Betalingsvilkår</Text>
            <Text style={styles.metaValue}>{rfq.payment_terms || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Valuta</Text>
            <Text style={styles.metaValue}>{rfq.currency || 'DKK'}</Text>
          </View>
        </View>

        {/* Beskrivelse */}
        {rfq.description && rfq.description.trim().length > 0 && (
          <View style={styles.descBox}>
            <Text style={styles.descLabel}>Beskrivelse</Text>
            <Text style={styles.descText}>{rfq.description}</Text>
          </View>
        )}

        {/* Linje-tabel */}
        <Text style={styles.sectionLabel}>Varer</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, styles.colNo]}>#</Text>
          <Text style={[styles.headerText, styles.colName]}>Vare</Text>
          <Text style={[styles.headerText, styles.colSpec]}>Specifikation</Text>
          <Text style={[styles.headerText, styles.colQty]}>Antal</Text>
          <Text style={[styles.headerText, styles.colUnit]}>Enhed</Text>
        </View>
        {rfq.lines.map((line) => (
          <View key={line.id} style={styles.row} wrap={false}>
            <Text style={styles.colNo}>{line.line_no}</Text>
            <View style={styles.colName}>
              <Text style={styles.descTitle}>{line.name}</Text>
              {line.description ? (
                <Text style={styles.descBody}>{line.description}</Text>
              ) : null}
            </View>
            <Text style={[styles.colSpec, styles.descBody]}>
              {line.spec || '—'}
            </Text>
            <Text style={styles.colQty}>{line.qty}</Text>
            <Text style={styles.colUnit}>{line.unit}</Text>
          </View>
        ))}

        {/* Instruks */}
        <View style={styles.instructionsBox} wrap={false}>
          <Text style={styles.instructionsTitle}>Sådan svarer du</Text>
          <Text style={styles.instructionsText}>
            Venligst returnér priser pr. vare, leveringstid, mindstemængde og
            gyldighedsperiode senest {fmtDate(rfq.deadline)}. Send gerne PDF
            eller Excel retur til {NEMINVENTAR_CONTACT.email}.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {NEMINVENTAR_CONTACT.companyName} · {NEMINVENTAR_CONTACT.email} ·
            Genereret {generatedOn}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Side ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export default RFQPdf;
