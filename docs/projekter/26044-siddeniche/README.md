# 26044 Lille Næstved Skole — siddeniche i 3D

Kilde: Skitseoplæg Rev. 1, oktober 2026 (William Tolstrup Arkitekter), mail fra Tommy Østergaard til tilbud@ 05-11-2026.

## Indhold

- `siddeniche.html` — 3D-konfigurator (three.js 0.147). Publiceret som artifact.
- `filer/` — eksport til arkitekten, model i meter, Y op:
  - `.glb` — med farver og teksturer. Åbner i Blender, Rhino 8, SketchUp (via import), Windows 3D Viewer, online viewers.
  - `.dae` — Collada. SketchUp importerer direkte.
  - `.obj` — kun geometri, til alt andet.
  - `render_*.png` — stillbilleder til mail.

Revit og ArchiCAD tager ikke GLB/OBJ direkte. Skal arkitekten have IFC/DWG/STEP, laves det i FreeCAD (skill `produktionstegning`) eller af Milot i Fusion 360.

## Forudsætninger

- 4 elever: 2170 × 1115 mm (arkitektens isometri). 2 elever: 1550 × 1115 mm (planen side 6).
- Højde 2100 (tag) og 2250 (bagvæg) er antaget. Står ikke i skitsen.
- Bagvæg er en del af nichen. Skitsen side 6: "Bagsiden af siddenichen danner væg for placering af skohylderne", og nichen "rykkes mod rummet med elevernes skabe".
- Siddehøjde 450, bordhøjde 720, bænkdybde 420 (400 ved 2-pers).
- Farver er vejledende (side 3). Udtryk fra Fable-sparring 05-11-2026: Rolig, Legende, Premium.

## Gen-eksport

Konfiguratoren har `window.nicheExport` med `set()`, `glb()`, `obj()`, `dae()`, `png()`. Kør siden i Playwright og skriv resultaterne til `filer/`.
