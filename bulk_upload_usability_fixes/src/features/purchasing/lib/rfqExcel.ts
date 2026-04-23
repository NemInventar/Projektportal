/**
 * rfqExcel — genererer en Excel-skabelon til leverandører for en RFQ.
 *
 * Leverandøren får en struktureret .xlsx de kan udfylde direkte. Låste celler
 * sikrer at vi kan matche deres svar deterministisk tilbage til vores linjer
 * via den skjulte kolonne O (`line_id` = `rfq_line_id`).
 *
 * Se PROCUREMENT_SKILL.md → WORKFLOW: PARSE_EXCEL for parse-flowet.
 */
import ExcelJS from 'exceljs';
import type { RfqWithRelations } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dansk datoformat dd-mm-yyyy. Tom input → tom streng. */
function fmtDateDk(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return '';
  }
}

/** Beskyttelses-password til arket. */
const SHEET_PASSWORD = 'neminventar';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateRfqExcelArgs {
  rfq: RfqWithRelations;
  projectName: string;
  projectNumber?: string;
}

/**
 * Genererer Excel-skabelon for en RFQ. Returnerer en Blob klar til download.
 */
export async function generateRfqExcel(
  args: GenerateRfqExcelArgs,
): Promise<Blob> {
  const { rfq, projectName, projectNumber } = args;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NemInventar ApS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Prisforespørgsel', {
    views: [{ state: 'frozen', ySplit: 9 }],
  });

  // -----------------------------------------------------------------------
  // Kolonnebredder — skal sættes FØR vi merger/fylder data.
  // -----------------------------------------------------------------------
  sheet.columns = [
    { key: 'lineNo', width: 5 },         // A — #
    { key: 'ourItem', width: 25 },       // B — Vores vare
    { key: 'description', width: 30 },   // C — Beskrivelse
    { key: 'qty', width: 8 },            // D — Antal
    { key: 'unit', width: 8 },           // E — Enhed
    { key: 'alternative', width: 10 },   // F — Alternativ
    { key: 'productNumber', width: 15 }, // G — Produktnummer
    { key: 'productName', width: 25 },   // H — Produktnavn
    { key: 'spec', width: 30 },          // I — Specifikation
    { key: 'totalPrice', width: 12 },    // J — Totalpris
    { key: 'leadTime', width: 12 },      // K — Leveringstid
    { key: 'minQty', width: 12 },        // L — Mindstemængde
    { key: 'validUntil', width: 12 },    // M — Gyldig til
    { key: 'notes', width: 30 },         // N — Bemærkninger
    { key: 'lineId', width: 38 },        // O — line_id (skjult)
  ];

  // Skjul kolonne O.
  sheet.getColumn('O').hidden = true;

  // -----------------------------------------------------------------------
  // Række 1 — Titel (merged A-L)
  // -----------------------------------------------------------------------
  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Prisforespørgsel: ${rfq.title}`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 22;

  // -----------------------------------------------------------------------
  // Række 2-6 — Meta
  // -----------------------------------------------------------------------
  const projectRef = projectNumber
    ? `${projectName} (${projectNumber})`
    : projectName;

  const firstDelivery = fmtDateDk(rfq.first_delivery_date);
  const lastDelivery = fmtDateDk(rfq.last_delivery_date);
  const deliveryWindow =
    firstDelivery && lastDelivery
      ? `${firstDelivery} → ${lastDelivery}`
      : firstDelivery || lastDelivery || '';

  const metaRows: Array<[string, string]> = [
    ['Projekt:', projectRef],
    ['Deadline:', fmtDateDk(rfq.deadline)],
    ['Leveringsvindue:', deliveryWindow],
    ['Betalingsvilkår:', rfq.payment_terms ?? ''],
    ['Vores kontakt:', 'Joachim Skovbogaard · js@neminventar.dk'],
  ];

  metaRows.forEach(([label, value], idx) => {
    const rowIdx = 2 + idx;
    const labelCell = sheet.getCell(`A${rowIdx}`);
    labelCell.value = label;
    labelCell.font = { bold: true };
    labelCell.alignment = { vertical: 'middle' };

    sheet.mergeCells(`B${rowIdx}:D${rowIdx}`);
    const valueCell = sheet.getCell(`B${rowIdx}`);
    valueCell.value = value;
    valueCell.alignment = { vertical: 'middle' };
  });

  // -----------------------------------------------------------------------
  // Række 7 — Instruks (merged A-L, kursiv, wrap text)
  // -----------------------------------------------------------------------
  sheet.mergeCells('A7:L7');
  const instrCell = sheet.getCell('A7');
  const deadlineStr = fmtDateDk(rfq.deadline) || '[deadline]';
  instrCell.value =
    `Udfyld din løsning pr. linje. Produktnummer, specifikation, pris og leveringstid er obligatoriske. ` +
    `Tilføj gerne alternativer som ekstra rækker — sæt 'x' i kolonne 'Alternativ' og brug samme linje-nummer som hovedproduktet. ` +
    `Returnér filen til js@neminventar.dk senest ${deadlineStr}.`;
  instrCell.font = { italic: true, size: 10 };
  instrCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
  sheet.getRow(7).height = 52;

  // Række 8 er tom som separator.

  // -----------------------------------------------------------------------
  // Række 9 — Header
  // -----------------------------------------------------------------------
  const headerRow = sheet.getRow(9);
  const headers: string[] = [
    '#',
    'Vores vare',
    'Beskrivelse',
    'Antal',
    'Enhed',
    'Alternativ',
    'Produktnummer',
    'Produktnavn',
    'Specifikation',
    'Totalpris (DKK)',
    'Leveringstid (dage)',
    'Mindstemængde',
    'Gyldig til',
    'Bemærkninger',
    'line_id',
  ];
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  headerRow.height = 24;

  // -----------------------------------------------------------------------
  // Række 10+ — Én række pr. RFQ-linje + 1 tom alternativ-række under hver.
  // -----------------------------------------------------------------------
  // Sorter lines efter line_no for deterministisk rækkefølge.
  const lines = [...rfq.lines].sort((a, b) => a.line_no - b.line_no);

  let currentRow = 10;

  for (const line of lines) {
    // Hovedrække — låst A-E + O, editable F-N.
    const mainRow = sheet.getRow(currentRow);
    mainRow.getCell(1).value = line.line_no;
    mainRow.getCell(2).value = line.name;
    mainRow.getCell(3).value = line.description ?? '';
    mainRow.getCell(4).value = line.qty;
    mainRow.getCell(5).value = line.unit;
    mainRow.getCell(15).value = line.id; // O — line_id

    // Låsning + wrap text
    applyLockForRow(mainRow);
    mainRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    mainRow.getCell(9).alignment = { wrapText: true, vertical: 'top' };
    mainRow.getCell(14).alignment = { wrapText: true, vertical: 'top' };
    mainRow.alignment = { vertical: 'top' };

    // Number formats på editable celler.
    mainRow.getCell(10).numFmt = '#,##0.00';
    mainRow.getCell(11).numFmt = '0';
    mainRow.getCell(12).numFmt = '#,##0.00';
    mainRow.getCell(13).numFmt = 'dd-mm-yyyy';

    // Alternativ-række — line_id fastholdes så parser kan gruppere.
    const altRow = sheet.getRow(currentRow + 1);
    altRow.getCell(1).value = ''; // # tom — same-line marker er line_id
    altRow.getCell(15).value = line.id;
    applyLockForRow(altRow);
    altRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    altRow.getCell(9).alignment = { wrapText: true, vertical: 'top' };
    altRow.getCell(14).alignment = { wrapText: true, vertical: 'top' };
    altRow.alignment = { vertical: 'top' };
    altRow.getCell(10).numFmt = '#,##0.00';
    altRow.getCell(11).numFmt = '0';
    altRow.getCell(12).numFmt = '#,##0.00';
    altRow.getCell(13).numFmt = 'dd-mm-yyyy';

    // Data-validering på editable celler i begge rækker.
    for (const row of [mainRow, altRow]) {
      // F — Alternativ: kun "x" eller tom.
      row.getCell(6).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"x"'],
        showErrorMessage: true,
        errorTitle: 'Ugyldig værdi',
        error: 'Sæt "x" hvis dette er et alternativ. Lad ellers feltet stå tomt.',
      };
      // J — Totalpris: decimal ≥ 0
      row.getCell(10).dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: 'Ugyldig pris',
        error: 'Pris skal være 0 eller derover.',
      };
      // K — Leveringstid: integer ≥ 0
      row.getCell(11).dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: 'Ugyldig leveringstid',
        error: 'Leveringstid skal være et heltal (antal dage).',
      };
      // L — Mindstemængde: decimal ≥ 0
      row.getCell(12).dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: 'Ugyldig mindstemængde',
        error: 'Mindstemængde skal være 0 eller derover.',
      };
      // M — Gyldig til: date
      row.getCell(13).dataValidation = {
        type: 'date',
        operator: 'greaterThan',
        allowBlank: true,
        formulae: [new Date(1900, 0, 1)],
        showErrorMessage: true,
        errorTitle: 'Ugyldig dato',
        error: 'Udfyld en gyldig dato.',
      };
    }

    currentRow += 2;
  }

  // -----------------------------------------------------------------------
  // Sum / kommentarer — 2 blanke rækker + sektion.
  // -----------------------------------------------------------------------
  currentRow += 2;
  const sumHeaderRow = sheet.getRow(currentRow);
  sheet.mergeCells(`A${currentRow}:N${currentRow}`);
  const sumHeaderCell = sumHeaderRow.getCell(1);
  sumHeaderCell.value = 'Sum / kommentarer';
  sumHeaderCell.font = { bold: true };
  sumHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };
  sumHeaderCell.alignment = { vertical: 'middle' };
  // Sum-header er låst (ikke editable).
  sumHeaderCell.protection = { locked: true };

  // 3 åbne rækker hvor supplier kan skrive noter (ikke låst, merged A-N).
  for (let i = 1; i <= 3; i += 1) {
    const r = currentRow + i;
    sheet.mergeCells(`A${r}:N${r}`);
    const c = sheet.getCell(`A${r}`);
    c.value = '';
    c.protection = { locked: false };
    c.alignment = { wrapText: true, vertical: 'top' };
    sheet.getRow(r).height = 20;
  }

  // -----------------------------------------------------------------------
  // Beskyt arket — password + kun editering af ikke-låste celler.
  // -----------------------------------------------------------------------
  await sheet.protect(SHEET_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: false,
    insertColumns: false,
    deleteRows: false,
    deleteColumns: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  // -----------------------------------------------------------------------
  // Skriv til Blob
  // -----------------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ---------------------------------------------------------------------------
// Intern: sæt protection på en række. Pre-udfyldte celler (A-E + O) låses,
// editable celler (F-N) låses op.
// ---------------------------------------------------------------------------
function applyLockForRow(row: ExcelJS.Row): void {
  // Låste celler: A, B, C, D, E, O
  for (const col of [1, 2, 3, 4, 5, 15]) {
    row.getCell(col).protection = { locked: true };
  }
  // Editable celler: F-N
  for (let col = 6; col <= 14; col += 1) {
    row.getCell(col).protection = { locked: false };
  }
}
