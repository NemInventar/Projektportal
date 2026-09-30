"""Niveau 2 + optioner i tilbuds-PDF'en (30-09-2026), oven på det L3-patchede bundle.

- pdf_show_items på tilbuddet -> "Posten omfatter" under hver post (antal, enhed, titel; ingen priser)
- is_option-linjer i egen tabel "Optioner", tæller ikke med i subtotal/moms/betalingsplan
Hver patch skal ramme præcis én gang.
"""
import sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")
D = pathlib.Path(__file__).parent
src = (D / "l3_patched_index.ts").read_text(encoding="utf-8")

patches = [
    ("styles",
     "  cellMuted: { fontSize: 10, color: PALETTE.muted },\n  totalBlock:",
     "  cellMuted: { fontSize: 10, color: PALETTE.muted },\n"
     "  rowWithItems: { borderBottomWidth: 0, paddingBottom: 3 },\n"
     "  itemsBlock: { paddingLeft: 28, paddingRight: 6, paddingBottom: 8, borderBottomWidth: 0.3, borderBottomColor: PALETTE.line },\n"
     "  itemsLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: PALETTE.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },\n"
     "  itemRow: { flexDirection: 'row', paddingVertical: 1.5 },\n"
     "  itemQty: { width: 52, fontSize: 8.5, color: PALETTE.ink, textAlign: 'right', paddingRight: 8 },\n"
     "  itemTitle: { flex: 1, fontSize: 8.5, color: PALETTE.ink, lineHeight: 1.35 },\n"
     "  tableNote: { fontSize: 8.5, color: PALETTE.muted, lineHeight: 1.4, marginBottom: 8 },\n"
     "  optionsBlock: { marginTop: 22 },\n"
     "  totalBlock:"),
    ("PDFLine",
     "interface PDFLine { title: string; description?: string; quantity: number; unit: string; sellingPricePerUnit: number; totalSellingPrice: number; }",
     "interface PDFLineItem { title: string; quantity: number; unit?: string | null; }\n"
     "interface PDFLine { title: string; description?: string; quantity: number; unit: string; sellingPricePerUnit: number; totalSellingPrice: number; items?: PDFLineItem[]; isOption?: boolean; }"),
    ("props",
     "  createdBy?: PDFCreatedBy; introText?: string | null; notes?: string | null;\n}\n\nconst fmt =",
     "  createdBy?: PDFCreatedBy; introText?: string | null; notes?: string | null;\n"
     "  showItems?: boolean;\n}\n\nconst fmt ="),
    ("fmtQty",
     "const fmt = (n: number) => new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' kr.';\n",
     "const fmt = (n: number) => new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' kr.';\n"
     "const fmtQty = (n: number) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n);\n"),
    ("subtotal+helpers",
     "introText, notes } = props;\n  const subtotal = lines.reduce((sum, l) => sum + (l.totalSellingPrice || 0), 0);\n",
     "introText, notes } = props;\n"
     "  const showItems = props.showItems === true;\n"
     "  // Optioner står i egen tabel og tæller ikke med i summen (samme regel som cached_option_total)\n"
     "  const mainLines = lines.filter(l => !l.isOption);\n"
     "  const optionLines = lines.filter(l => l.isOption);\n"
     "  const subtotal = mainLines.reduce((sum, l) => sum + (l.totalSellingPrice || 0), 0);\n"
     "  const tableHeader = () => React.createElement(View, { style: quoteStyles.tableHeader },\n"
     "    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colNo] }, 'Nr.'),\n"
     "    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colDesc] }, 'Beskrivelse'),\n"
     "    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colQty] }, 'Antal'),\n"
     "    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colUnit] }, 'Enh.'),\n"
     "    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colUnitPrice] }, 'Enhedspris'),\n"
     "    React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colTotal] }, 'I alt'),\n"
     "  );\n"
     "  const renderLines = (list: PDFLine[], withItems: boolean, kp: string) => list.flatMap((line, i) => {\n"
     "    // 0/tom = uprissat linje (—). Negative beløb SKAL vises — reduktions-/rabatlinjer\n"
     "    // (fx 'Optimering -42.000') indgår i subtotalen og må ikke stå med blank beløbskolonne.\n"
     "    const hasPrice = !!line.totalSellingPrice;\n"
     "    const items = withItems ? (line.items ?? []) : [];\n"
     "    const rows: any[] = [React.createElement(View, { key: `${kp}l${i}`, style: items.length ? [quoteStyles.row, quoteStyles.rowWithItems] : quoteStyles.row, wrap: false, minPresenceAhead: items.length ? 30 : undefined } as any,\n"
     "      React.createElement(Text, { style: [quoteStyles.cellMuted, quoteStyles.colNo] }, String(i + 1)),\n"
     "      React.createElement(View, { style: quoteStyles.colDesc },\n"
     "        React.createElement(Text, { style: quoteStyles.descTitle }, line.title),\n"
     "        line.description ? React.createElement(Text, { style: quoteStyles.descBody }, line.description) : null,\n"
     "      ),\n"
     "      React.createElement(Text, { style: [quoteStyles.cell, quoteStyles.colQty] }, fmtQty(line.quantity)),\n"
     "      React.createElement(Text, { style: [quoteStyles.cellMuted, quoteStyles.colUnit] }, line.unit),\n"
     "      React.createElement(Text, { style: [hasPrice ? quoteStyles.cell : quoteStyles.cellMuted, quoteStyles.colUnitPrice] }, hasPrice ? fmt(line.sellingPricePerUnit) : '—'),\n"
     "      React.createElement(Text, { style: [hasPrice ? quoteStyles.cell : quoteStyles.cellMuted, quoteStyles.colTotal] }, hasPrice ? fmt(line.totalSellingPrice) : '—'),\n"
     "    )];\n"
     "    if (items.length) rows.push(React.createElement(View, { key: `${kp}i${i}`, style: quoteStyles.itemsBlock },\n"
     "      React.createElement(Text, { style: quoteStyles.itemsLabel }, 'Posten omfatter'),\n"
     "      ...items.map((it, j) => React.createElement(View, { key: j, style: quoteStyles.itemRow, wrap: false } as any,\n"
     "        React.createElement(Text, { style: quoteStyles.itemQty }, `${fmtQty(it.quantity)} ${it.unit || 'stk'}`),\n"
     "        React.createElement(Text, { style: quoteStyles.itemTitle }, it.title),\n"
     "      )),\n"
     "    ));\n"
     "    return rows;\n"
     "  });\n"),
    ("tabel",
     "      React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Tilbudslinjer'),\n"
     "      React.createElement(View, { style: quoteStyles.tableHeader },\n"
     "        React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colNo] }, 'Nr.'),\n"
     "        React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colDesc] }, 'Beskrivelse'),\n"
     "        React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colQty] }, 'Antal'),\n"
     "        React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colUnit] }, 'Enh.'),\n"
     "        React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colUnitPrice] }, 'Enhedspris'),\n"
     "        React.createElement(Text, { style: [quoteStyles.tableHeaderText, quoteStyles.colTotal] }, 'I alt'),\n"
     "      ),\n"
     "      ...lines.map((line, i) => {\n"
     "        // 0/tom = uprissat linje (—). Negative beløb SKAL vises — reduktions-/rabatlinjer\n"
     "        // (fx 'Optimering -42.000') indgår i subtotalen og må ikke stå med blank beløbskolonne.\n"
     "        const hasPrice = !!line.totalSellingPrice;\n"
     "        return React.createElement(View, { key: i, style: quoteStyles.row, wrap: false } as any,\n"
     "          React.createElement(Text, { style: [quoteStyles.cellMuted, quoteStyles.colNo] }, String(i + 1)),\n"
     "          React.createElement(View, { style: quoteStyles.colDesc },\n"
     "            React.createElement(Text, { style: quoteStyles.descTitle }, line.title),\n"
     "            line.description ? React.createElement(Text, { style: quoteStyles.descBody }, line.description) : null,\n"
     "          ),\n"
     "          React.createElement(Text, { style: [quoteStyles.cell, quoteStyles.colQty] }, String(line.quantity)),\n"
     "          React.createElement(Text, { style: [quoteStyles.cellMuted, quoteStyles.colUnit] }, line.unit),\n"
     "          React.createElement(Text, { style: [hasPrice ? quoteStyles.cell : quoteStyles.cellMuted, quoteStyles.colUnitPrice] }, hasPrice ? fmt(line.sellingPricePerUnit) : '—'),\n"
     "          React.createElement(Text, { style: [hasPrice ? quoteStyles.cell : quoteStyles.cellMuted, quoteStyles.colTotal] }, hasPrice ? fmt(line.totalSellingPrice) : '—'),\n"
     "        );\n"
     "      }),\n",
     "      React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Tilbudslinjer'),\n"
     "      showItems ? React.createElement(Text, { style: quoteStyles.tableNote }, 'Under hver post står, hvad posten omfatter.') : null,\n"
     "      tableHeader(),\n"
     "      ...renderLines(mainLines, showItems, 'm'),\n"),
    ("optioner",
     "          React.createElement(Text, { style: quoteStyles.grandTotalValue }, fmt(grandTotal)),\n"
     "        ),\n"
     "      ),\n"
     "      React.createElement(View, { style: quoteStyles.paymentPlanBlock",
     "          React.createElement(Text, { style: quoteStyles.grandTotalValue }, fmt(grandTotal)),\n"
     "        ),\n"
     "      ),\n"
     "      optionLines.length ? React.createElement(View, { style: quoteStyles.optionsBlock },\n"
     "        React.createElement(View, { wrap: false, minPresenceAhead: 60 } as any,\n"
     "          React.createElement(Text, { style: quoteStyles.sectionHeader }, 'Optioner'),\n"
     "          React.createElement(Text, { style: quoteStyles.tableNote }, 'Priserne er ekskl. moms og indgår ikke i tilbudssummen.'),\n"
     "        ),\n"
     "        tableHeader(),\n"
     "        ...renderLines(optionLines, false, 'o'),\n"
     "      ) : null,\n"
     "      React.createElement(View, { style: quoteStyles.paymentPlanBlock"),
    ("mapping",
     "    return { title: line.title, description: line.description ?? undefined, quantity: Number(line.quantity ?? 0), unit: line.unit, sellingPricePerUnit: t.sellingPricePerUnit, totalSellingPrice: t.totalSellingPrice };\n",
     "    // Niveau 2: varerne i tilbudslistens rækkefølge (samme sortering som portalen)\n"
     "    const pdfItems = [...(line.project_quote_line_items_2026_01_16_23_00 ?? [])]\n"
     "      .sort((a: any, b: any) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'da', { numeric: true }))\n"
     "      .map((it: any) => ({ title: String(it.title ?? ''), quantity: Number(it.qty ?? 0), unit: it.unit ?? null }));\n"
     "    return { title: line.title, description: line.description ?? undefined, quantity: Number(line.quantity ?? 0), unit: line.unit, sellingPricePerUnit: t.sellingPricePerUnit, totalSellingPrice: t.totalSellingPrice, items: pdfItems, isOption: (line as any).is_option === true };\n"),
    ("showItems-prop",
     "    introText: quote.intro_text ?? null, notes: quote.customer_remarks ?? null,\n",
     "    introText: quote.intro_text ?? null, notes: quote.customer_remarks ?? null,\n"
     "    showItems: (quote as any).pdf_show_items === true,\n"),
]
out = src
for name, old, new in patches:
    n = out.count(old)
    assert n == 1, f"{name}: fandt {n} forekomster, forventede 1"
    out = out.replace(old, new)
    print(f"OK {name}")
(D / "l4_items_patched_index.ts").write_text(out, encoding="utf-8", newline="")
print(f"l3 {len(src)} tegn -> l4 {len(out)} tegn")
