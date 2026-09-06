---
name: produktionstegning
description: Tegning på mål af en enkelt del eller et enkelt møbel — parametrisk 3D-model, STEP til smed/CAD og en A3-tegning med målsætning, stykliste og titelfelt i Sundby-stil — bygget headless i FreeCAD uden at nogen skal klikke. Brug denne skill når Joachim siger "tegn", "lav en tegning af", "produktionstegning", "RFQ-tegning", "smedetegning", "tegn benet/bænken/beslaget på mål", "STEP-fil til", "parametrisk model", eller når en tilbudspost skal have en tegning så en leverandør kan prise den. Trigges også ved "FreeCAD", "headless CAD", "kan du tegne det", "vis mig det i 3D med mål". IKKE til AI-billeder (det er render-produkt) og IKKE en erstatning for Milots produktionstegninger i Fusion 360 — den leverer grundlaget og RFQ-tegningen, Fusion leverer det færdige produktionsgrundlag.
---

<!-- Kilde: Projektportal/.claude/skills/produktionstegning/SKILL.md — kopien i plugins/produktionstegning/ er et spejl. Ret her. -->

# Produktionstegning — Nem Inventar

Du bygger en del på mål som **kode**, ikke som klik. Én kørsel giver model, STEP, A3-tegning og
JSON med hvert mål og dets kilde. Alt kan køres igen om tre måneder og give præcis samme resultat.

Referenceimplementering: `Projektportal/scripts/freecad/staalben.py` (stålben Z-form, 26022).
En ny del laves ved at kopiere den og skifte `PARAMETRE`, `DELE` og huller. Ikke ved at starte fra nul.

## Canon først — hvad denne skill er, og ikke er

**Fusion 360 er Nem Inventars CAD-værktøj** (canon, Joachim 17-08-2026). Milot modellerer i Fusion og
trækker produktionstegninger med stykliste ud af modellen. Det ændrer denne skill ikke på.

Denne skill leverer det Fusion ikke kan: **headless**. Ingen skærm, ingen klik, kørt fra chat.
Den er til:

| Brug | Ja | Nej |
|---|---|---|
| RFQ-tegning til smed/underleverandør så prisen bliver reel i stedet for AI-estimat | ✔ | |
| Tilbudstegning der viser konstruktionen før sagen er vundet | ✔ | |
| Parametrisk grundmodel Milot kan tage ind i Fusion (STEP) | ✔ | |
| Konfigurationsvarianter (3 længder, 2 orienteringer) på ét ark | ✔ | |
| Det endelige produktionsgrundlag til Korpus | | Fusion, Milot |
| Samlinger, dyvler, beslag, CNC-filer | | Fusion / CNC-flow |
| Pæne billeder til kunden | | render-produkt |

Titelfeltets **Document status** skal afspejle det: `FOR QUOTATION` indtil konstruktionen er frosset.
Skriv aldrig "for production" på noget denne skill har lavet, medmindre Joachim siger det.

## Faserne

```
1. Kilder og mål        hvert mål får en kilde: MÅLT / AFLEDT / ANTAGET
2. Model                Part-kasser + regneark med expressions, verificeret
3. Tegning              HLR-projektion → A3 SVG + PDF, Sundby-layout
4. Render (valgfrit)    Blender headless, kun til chat/tilbud
5. Verificér            se PDF'en, tjek overlap, genåbn FCStd og drej på et mål
6. Aflevér              SharePoint 01_Tilbud/<Del>_RFQ/ — lokal eller connector
7. Log                  aios_events skill_run; context_log ved beslutninger
```

### 1. Kilder og mål — den ærlige del

Før du tegner én linje: find hvor målene kommer fra.

- Arkitekttegninger i `01_Projekter/<projekt>/01_Tilbud/Indkommet_materiale/` (N-numre, snit i 1:10)
- Styrke-eftervisningens modeller i `plugins/styrke-eftervisning/modeller/<projekt>_*.json` — de har
  ofte allerede aflæst geometrien og noteret hvad der *ikke* er tegnet
- `v_project_narrative` for beslutninger (bolte, orientering, dybder)
- Arbejdsbeskrivelsen (N290 el.lign.) for materiale, overflade, tolerancer

Hvert parameter skrives som `(værdi, kilde, forklaring)`. Kilden starter med ét af tre ord:

| Ord | Betyder | På tegningen |
|---|---|---|
| **N129 målsat …** | står på tegningen | normal |
| **AFLEDT: …** | regnet ud fra to målsatte mål | rød blok "assumptions" |
| **ANTAGET: …** | ikke tegnet, vores bud | rød blok "assumptions" |

Alt der er afledt eller antaget står i rødt øverst på arket og i JSON'en. Smeden skal kunne se
hvad han ikke må stole på. Det er ikke svaghed at vise det — det er det der gør tegningen brugbar.

### 2. Model — parametrisk, ikke bare geometri

Mønster fra `staalben.py`:

- Et **Spreadsheet** `Parametre` med alias pr. mål og kilden i kolonne C
- Hver del er en `Part::Box` med **expressions** bundet til regnearket:
  `Length`, `Width`, `Height` og `.Placement.Base.x/y/z`. Udtryk skrives med bare navne
  (`"X_front - L_fod"`) og præfikses automatisk med `Parametre.`
- Huller: `Part::Cylinder` / `Part::Cone` (90° forsænkning = kegle med højde `(D2-D1)/2`)
- `Part::MultiFuse` → `Part::Cut` med `Refine = True`

**Verificér altid, i scriptet:**
```
solids == 1            ét sammenhængende legeme
isValid()              gyldig B-rep
volumen                sum af delene minus huller — regn det efter i hånden første gang
```
Og efter kørsel: **genåbn FCStd headless, sæt tre parametre til noget andet, recompute, tjek
bounding box.** Er den ikke flyttet, er modellen ikke parametrisk, og så lover du noget du ikke kan holde.

### 3. Tegning — Sundby-layout

Milots Sundby-ark (WB.002.000) er skabelonen:

| Element | Sådan |
|---|---|
| Nummer | `XX.001.000` samling, `.001`/`.002` dele, `_01…` konfigurationer. Første stålben blev `SB.001.001` |
| Visninger | Side / front / top i 1:4 (eller 1:5), detaljer 1:1 eller 1:2 |
| Tabeller | Stykliste pr. enhed, konfigurationstabel (antal pr. type, total) |
| Noter | Materiale, samlinger, overflade, huller, tolerancer (ISO 2768-m), antal |
| Assumptions | Rød blok — alt der er AFLEDT/ANTAGET |
| Titelfelt | ISO 7200: Dept, Technical reference, Created by, Approved by, Document type, Document status, Title, Project, DWG No., Rev., Sheet, Date, Scale, Material, Finish, Model, Orientation, Units |
| Sprog | Engelsk (Korpus og smede læser det) |

**Målene på tegningen skrives fra parametrene**, ikke aflæst af geometrien. Så er et tal på arket
altid det tal der står i regnearket.

Teknik der virker headless (og det der ikke gør):

- `TechDraw.project(shape, retning)` giver synlige + skjulte kanter uden GUI. Dens 2D-akser er
  *ikke* modelaksernes — `staalben.py` finder mappingen med en probe-kasse. Genbrug den.
- TechDraw-**ark** kan oprettes headless (og ligger i FCStd til GUI-brug), men **kan ikke
  eksporteres** til PDF/SVG uden skærm. Derfor tegnes arket som SVG i scriptet.
- PDF skrives med scriptets egen writer: Helvetica som standardfont, **ikke indlejret**. 8 KB i stedet
  for 35 KB. `rsvg-convert` indlejrer fonte og giver 4× størrelse — brug den kun til PNG.
- Korte mål (< 9 mm på papiret): pile udenfor, tekst ved siden af. Ellers overlapper de.
- Kig altid på PNG'en før du sender. Overlap mellem topvisning og tekst er den klassiske fejl.

### 4. Render

```
blender -b -noaudio --python scripts/freecad/render_blender.py -- del.stl del.png
```
Til chat og tilbud. Aldrig til produktion. Ligger uden for SharePoint-connectorens loft (1 MB PNG),
så render kun når sessionen er lokal, eller send den i chatten.

### 5. Verificér før aflevering

1. `Read` PDF'en — ser arket rigtigt ud? Ingen overlap, alle mål læsbare, titelfelt uden overløb
2. Genåbn FCStd, ændr tre parametre, recompute → bounding box flytter sig
3. Stykliste: længder og masse regnet efter (fladstål 50×12 = 4,71 kg/m; stål 7,85 kg/dm³)
4. Antal: stemmer konfigurationstabellen med tilbudslisten? (26022: 6×3 + 5×3 + 2×4 = 41)

### 6. Aflevér — og her afgør sessionstypen alt

Filerne hører til i `01_Projekter/<projekt>/01_Tilbud/<Del>_RFQ/` (før tilkendegivelse) eller
`04_Produktion/Production drawings/` (efter, og kun via Fusion).

| Session | Vej | Grænse |
|---|---|---|
| **Lokal** (Claude Code på Joachims PC) | Skriv direkte til den OneDrive-synkroniserede sti `…/Projekter neminventar - Documents/01_Projekter/…` | Ingen |
| **Cloud** (claude.ai/code) | `sharepoint_upload_file` med base64 | **~15–20 KB pr. fil.** Connectoren tager kun tekst Claude selv skriver; en fil skal læses ind (loft ~22.000 tegn) og genskrives tegn for tegn. Brug `expectedBytes`. PDF fra egen writer, STEP og FCStd går. PNG går ikke |

Filnavne: `<DWG>_<del>_<variant>_rev-<X>.pdf`, samme stamme for `.step`, `.FCStd`, `.json`.

**Anbefaling: CAD-arbejde køres lokalt.** FreeCAD og Blender installeres én gang på PC'en.
Cloud-sessioner er til kode, data og tekst.

### 7. Log

- `aios_events_2026_05_12`: én række `type='skill_run'`, summary = hvad der blev tegnet, details = filer, DWG-nr, antagelser
- Ved beslutninger undervejs ("vi antager M12", "orientering afventer"): `context_log` på projektet, kun når Joachim bruger triggerordene

## Installation

**Cloud-container** (tom ved hver session):
```bash
bash scripts/install-blender.sh                                  # Blender 4.5 LTS, valgfrit
# FreeCAD 1.0.2 AppImage, udpakket (ingen FUSE):
curl -sSL -o /opt/FreeCAD.AppImage https://github.com/FreeCAD/FreeCAD/releases/download/1.0.2/FreeCAD_1.0.2-conda-Linux-x86_64-py311.AppImage
cd /opt && chmod +x FreeCAD.AppImage && ./FreeCAD.AppImage --appimage-extract >/dev/null && mv squashfs-root freecad && rm FreeCAD.AppImage
/opt/freecad/usr/bin/freecadcmd scripts/freecad/staalben.py
```
Tager 2–3 minutter. `xvfb` og `librsvg2-bin` er kun nødvendige for PNG-preview.

**Lokal Windows:** installer FreeCAD 1.0 fra freecad.org; kør `"C:\Program Files\FreeCAD 1.0\bin\FreeCADCmd.exe" scripts\freecad\staalben.py`.

## Faldgruber vi allerede har betalt for

- Fusion 360 har ingen headless-tilstand og ingen Linux-version. Spild ikke tid på at prøve.
- `freecad -c script.py` er console mode — GUI-moduler kan ikke importeres. `freecad script.py` under Xvfb kan, men TechDraw-eksport fejler stadig stille (tom SVG). Lad være.
- `projectToSVG` returnerer koordinater med byttede/negerede akser afhængigt af retning. Brug probe-mappingen.
- `__file__` findes når `freecadcmd script.py` køres, men vær defensiv (`"__file__" in globals()`).
- Blender `obj.bound_box` giver tuples, ikke vektorer — wrap i `mathutils.Vector`.
- Første tegning havde topvisning oven i antagelsesblokken og pile der overlappede på 12 mm-mål. Kig på PNG'en.
- Base64 gennem connectoren: en 46.000-tegns streng kan ikke læses i ét stykke og bliver klippet midt i. Lav filen mindre eller kør lokalt.

## Done when

- [ ] Hvert mål har en kilde, og de afledte/antagne står i rødt på arket
- [ ] Model: ét legeme, gyldig, volumen regnet efter, parametrisk test bestået
- [ ] Tegning: set med egne øjne som PNG, ingen overlap, titelfelt korrekt, `FOR QUOTATION`
- [ ] Filer i `01_Tilbud/<Del>_RFQ/` (PDF, STEP, FCStd, JSON) — eller sendt i chat hvis cloud-loftet bider
- [ ] Scripts committet i `Projektportal/scripts/freecad/`
- [ ] `skill_run` logget
- [ ] Joachim ved hvad der er åbent (orientering, fastgørelse, mål der skal bekræftes)
