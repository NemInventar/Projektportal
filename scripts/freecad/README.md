# FreeCAD-scripts (headless)

Scripts der bygger geometri, tegning og eksportfiler **uden skærm**. De kører i
containeren (FreeCAD 1.0.2 AppImage udpakket til `/opt/freecad`) eller på enhver
maskine med FreeCAD 1.0:

```bash
freecadcmd scripts/freecad/staalben.py
```

Hvorfor FreeCAD her og Fusion i `scripts/fusion/`: Fusion 360 kan ikke køre
headless. FreeCAD kan. Så Fusion-scripts er noget *du* kører; FreeCAD-scripts er
noget *Claude* kører og leverer filer fra.

## staalben.py — stålben Z-form, bænke 713.001–003 (26022)

Bygger stålbenet som fire stykker fladstål 50×12 (fodplade, forben, flange,
vægplade) med hul + forsænkning i foden og hul i vægpladen. Alle mål ligger i
et FreeCAD-regneark (`Parametre`) med **kilde pr. mål** — målt på N129, afledt
eller antaget.

| Variabel | Værdi | Betydning |
|---|---|---|
| `STAALBEN_OUT` | `./out` | output-mappe |
| `STAALBEN_ORIENTERING` | `12_lodret` | som arkitektens snit N129 |
| | `50_lodret` | variant fra styrke-eftervisningen (stålet vendt) |

Output pr. kørsel:

| Fil | Brug |
|---|---|
| `Staalben_<o>.FCStd` | parametrisk model + TechDraw-ark. Åbn i FreeCAD, ret i regnearket `Parametre`, alt følger med |
| `Staalben_<o>.step` | til smed, Fusion, alt andet CAD |
| `Staalben_<o>.svg` | A3-tegning: side/front/top 1:4, detalje 1:1, stykliste, konfigurationstabel, noter, antagelser, ISO 7200-titelfelt |
| `Staalben_<o>.json` | alle mål med kilde, stykliste, masse |
| `Staalben_<o>.stl` | til render |

PDF af tegningen: `rsvg-convert -f pdf -o x.pdf Staalben_<o>.svg`

Scriptet tjekker selv at resultatet er ét sammenhængende legeme, at volumen af
de fire stykker minus huller stemmer, og at det er gyldig B-rep.

### Sådan er tegningen lavet

Geometrien projiceres med FreeCADs egen HLR (`TechDraw.project`) — synlige og
skjulte kanter — og lægges på et A3-ark som SVG sammen med målsætning, tabeller
og titelfelt. Målene skrives *fra parametrene*, ikke aflæst af geometrien, så et
mål på tegningen er altid det tal der står i regnearket.

Der ligger også et TechDraw-ark i FCStd-filen (tre visninger uden mål) til dem
der hellere vil målsætte i FreeCAD-GUI.

## render_blender.py — 3D-billede af en STL

```bash
blender -b -noaudio --python scripts/freecad/render_blender.py -- in.stl out.png
```

Cycles, RAL 7032-agtig overflade, gulvplade, sol. Til chat og tilbud, ikke til
produktion.
