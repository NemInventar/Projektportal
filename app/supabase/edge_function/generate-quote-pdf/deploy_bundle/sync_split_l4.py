"""Synk edge-split-kilden med GUI'en efter niveau 2 + optioner (30-09-2026)."""
import sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")
EDGE = pathlib.Path(__file__).parent.parent
APP = EDGE.parent.parent.parent

# 1. QuotePDF.tsx: kopi af GUI-filen, kun header-kommentar og company-import afviger
gui = (APP / "src/components/QuotePDF.tsx").read_text(encoding="utf-8")
gui_head = ("// Bemærk: Denne fil er også kopieret til app/supabase/edge_function/generate-quote-pdf/QuotePDF.tsx\n"
            "// for headless PDF-generering. Hvis du ændrer her, opdater også kopien.\n")
assert gui.startswith(gui_head)
edge = ("// KOPI af app/src/components/QuotePDF.tsx\n"
        "// Skal holdes synkroniseret med GUI-versionen.\n"
        "// Hvis du ændrer designet i GUI, opdater også her.\n") + gui[len(gui_head):]
assert edge.count("from '@/config/company';") == 1
edge = edge.replace("from '@/config/company';", "from './company.ts';")
(EDGE / "QuotePDF.tsx").write_text(edge, encoding="utf-8", newline="")
print("OK QuotePDF.tsx synket")

# 2. index.ts: varer + option-flag + showItems
p = EDGE / "index.ts"
s = p.read_text(encoding="utf-8")
patches = [
    ("mapping",
     "      sellingPricePerUnit: t.sellingPricePerUnit,\n      totalSellingPrice: t.totalSellingPrice,\n    };\n  });\n",
     "      sellingPricePerUnit: t.sellingPricePerUnit,\n      totalSellingPrice: t.totalSellingPrice,\n"
     "      // Niveau 2: varerne i tilbudslistens rækkefølge (samme sortering som portalen)\n"
     "      items: [...(line.project_quote_line_items_2026_01_16_23_00 ?? [])]\n"
     "        .sort((a: any, b: any) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'da', { numeric: true }))\n"
     "        .map((it: any) => ({ title: String(it.title ?? ''), quantity: Number(it.qty ?? 0), unit: it.unit ?? null })),\n"
     "      isOption: line.is_option === true,\n"
     "    };\n  });\n"),
    ("LineRow.is_option",
     "  include_in_appendix: boolean | null;\n  project_quote_line_items_2026_01_16_23_00: LineItemRow[];",
     "  include_in_appendix: boolean | null;\n  is_option?: boolean | null;\n  project_quote_line_items_2026_01_16_23_00: LineItemRow[];"),
    ("QuoteRow.pdf_show_items",
     "  appendix_intro_text: string | null;\n",
     "  appendix_intro_text: string | null;\n  pdf_show_items?: boolean | null;\n"),
    ("prop",
     "    notes: quote.customer_remarks ?? null,\n    createdBy: {",
     "    notes: quote.customer_remarks ?? null,\n    showItems: quote.pdf_show_items === true,\n    createdBy: {"),
]
for name, old, new in patches:
    n = s.count(old)
    assert n == 1, f"{name}: fandt {n} forekomster, forventede 1"
    s = s.replace(old, new)
    print(f"OK index.ts {name}")
p.write_text(s, encoding="utf-8", newline="")
