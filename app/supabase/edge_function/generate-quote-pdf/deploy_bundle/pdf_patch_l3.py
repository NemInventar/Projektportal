"""L3-patch af den live, hånd-bundlede generate-quote-pdf (v10). Hver patch skal ramme præcis én gang."""
import sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")
D = pathlib.Path(r"C:\Users\Joach\AppData\Local\Temp\claude\c--Users-Joach-NemInventar-Aps-Projekter-neminventar---Documents\57db8379-3606-4e6e-a6f1-f1024af92361\scratchpad\pdf_deploy")
src = (D / "live_index.ts").read_text(encoding="utf-8")

patches = [
    ("CostItem.salgspris",
     "  effective_category_factors?: CategoryFactors | null;\n  cost_breakdown_json?: {",
     "  effective_category_factors?: CategoryFactors | null;\n"
     "  /** L3 (28-09-2026): produktets godkendte salgspris pr. enhed (project_products.salgspris). */\n"
     "  salgspris?: number | null;\n"
     "  cost_breakdown_json?: {"),
    ("formel",
     "  const adj = 1 + (pricing.adjust_pct ?? 0) / 100;\n"
     "\n"
     "  if (pricing.pricing_mode === 'category_factors') {\n"
     "    const lineF = pricing.category_factors ?? {};\n"
     "    let total = 0;\n"
     "    for (const it of items) {\n"
     "      const c = itemCostByCategory(it);\n"
     "      const f = it.effective_category_factors ?? lineF; // produktets eget faktorsæt, ellers linjens\n"
     "      let itemSell = 0;\n"
     "      for (const k of COST_CATEGORIES) itemSell += c[k] * (f[k] ?? 1);\n"
     "      total += itemSell * (it.qty ?? 0);\n"
     "    }\n"
     "    const sellPerUnit = lineQuantity > 0 ? total / lineQuantity : 0;\n"
     "    return (sellPerUnit + risk) * adj;\n"
     "  }\n"
     "\n"
     "  // markup_pct default\n"
     "  const markup = pricing.markup_pct ?? 0;\n"
     "  return totalCostPerUnit * (1 + markup / 100) * adj;\n"
     "}",
     "  const adj = 1 + (pricing.adjust_pct ?? 0) / 100;\n"
     "  // L3: varer hvis produkt har salgspris sælges til antal × salgspris; resten regnes som før\n"
     "  const hasSp = (it: CostItem) => it.salgspris != null;\n"
     "  const spPerUnit = lineQuantity > 0\n"
     "    ? items.filter(hasSp).reduce((a, it) => a + (it.salgspris as number) * (it.qty ?? 0), 0) / lineQuantity\n"
     "    : 0;\n"
     "\n"
     "  if (pricing.pricing_mode === 'category_factors') {\n"
     "    const lineF = pricing.category_factors ?? {};\n"
     "    let total = 0;\n"
     "    for (const it of items) {\n"
     "      if (hasSp(it)) continue;\n"
     "      const c = itemCostByCategory(it);\n"
     "      const f = it.effective_category_factors ?? lineF; // produktets eget faktorsæt, ellers linjens\n"
     "      let itemSell = 0;\n"
     "      for (const k of COST_CATEGORIES) itemSell += c[k] * (f[k] ?? 1);\n"
     "      total += itemSell * (it.qty ?? 0);\n"
     "    }\n"
     "    const sellPerUnit = lineQuantity > 0 ? total / lineQuantity : 0;\n"
     "    return (sellPerUnit + spPerUnit + risk) * adj;\n"
     "  }\n"
     "\n"
     "  // markup_pct default — avancen lægges kun på varer uden salgspris\n"
     "  const markup = pricing.markup_pct ?? 0;\n"
     "  const costNoSpPerUnit = costPerUnit(items.filter(it => !hasSp(it)), lineQuantity);\n"
     "  return ((costNoSpPerUnit + risk) * (1 + markup / 100) + spPerUnit) * adj;\n"
     "}"),
    ("select",
     ".select(`*, project_quote_line_items_2026_01_16_23_00(*)`)",
     ".select(`*, project_quote_line_items_2026_01_16_23_00(*, project_products_2026_01_15_12_49(salgspris))`)"),
    ("mapping",
     "      effective_category_factors: toFactors((it as any).effective_category_factors),\n    }));",
     "      effective_category_factors: toFactors((it as any).effective_category_factors),\n"
     "      salgspris: (() => { const pp = (it as any).project_products_2026_01_15_12_49; const v = (it as any).salgspris ?? (Array.isArray(pp) ? pp[0]?.salgspris : pp?.salgspris); return v == null ? null : Number(v); })(),\n"
     "    }));"),
]
out = src
for name, old, new in patches:
    n = out.count(old)
    assert n == 1, f"{name}: fandt {n} forekomster, forventede 1"
    out = out.replace(old, new)
    print(f"OK {name}")
(D / "patched_index.ts").write_text(out, encoding="utf-8", newline="")
print(f"live {len(src)} tegn → patched {len(out)} tegn")
