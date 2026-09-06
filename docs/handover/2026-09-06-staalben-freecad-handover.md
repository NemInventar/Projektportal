# Handover — stålben 26022 + headless CAD-flow

**Dato:** 06-09-2026 · **Fra:** cloud-session (claude.ai/code) · **Til:** lokal Claude Code-session
**Branch:** `claude/blender-download-v3umuo` — alt er committet og pushet.

> **Kanonisk handoff:** `handoffs_2026_05_28` id **`7909626d`** — start den lokale session med
> `pick up handoff 7909626d`. Denne fil er kun uddybende noter; rowen i Supabase er det der tæller.

## Hvor vi er

| Leverance | Status | Hvor |
|---|---|---|
| Stålben SB.001.001 (12 mm lodret) — PDF, STEP, FCStd, JSON | Færdig, på SharePoint | `26022 Fremtidens Skærehaller/01_Tilbud/Staalben_RFQ/` |
| Stålben SB.001.001-V50 (50 mm lodret) — PDF | Færdig, på SharePoint | samme |
| 50 mm-variantens STEP + FCStd, render PNG | Ligger kun i cloud-containeren (tabt når den lukker) | genkør scriptet lokalt, 20 sek. |
| Slack til Argjent og Milot | Sendt 06-09 med link og spørgsmål | DM'er |
| Fusion-script pladebænk `scripts/fusion/baenk.py` | Færdig, ikke testet i Fusion | repo |
| Skill `produktionstegning` | Skrevet, repo + SharePoint plugins/ | `.claude/skills/produktionstegning/SKILL.md` |

## Hvad der er åbent — Joachims beslutninger

1. **Stålorientering.** Eftervisningen (05-09) siger 12 mm lodret bryder på nedbøjning og ende-udkrag i
   alle tre bænketyper; 50 mm lodret holder. Arkitekten har tegnet 12 mm. Skal besluttes før smeden
   priser — ellers priser han den forkerte. Begge varianter er tegnet.
2. **Stålafstivning under sædet** eller flere ben — eftervisningen kalder det nødvendigt.
3. **Benplacering** — ikke målsat af arkitekten.
4. **Fastgørelse** — én bolt gulv + én bolt væg (Joachims læsning 05-09). Bolttype ukendt; antaget M12.
5. **Tre antagne mål** på tegningen (rød blok): vægplade 120, fodplade 110 / hul 40, Ø13 / Ø24.

Venter på svar fra Argjent (svejst vs. bukket, Korpus vs. smed) og Milot (review mod Sundby-standard).
**Tilbudsfrist 26022: tirsdag 08-09 kl. 12.**

## Sådan kører du videre lokalt

```powershell
# én gang
winget install FreeCAD.FreeCAD            # 1.0.x
winget install BlenderFoundation.Blender  # 4.5 LTS, valgfrit (render)

# pr. kørsel — fra repo-roden
$env:STAALBEN_OUT = "C:\Users\Joach\NemInventar Aps\Projekter neminventar - Documents\01_Projekter\26022 Fremtidens Skærehaller\01_Tilbud\Staalben_RFQ"
$env:STAALBEN_ORIENTERING = "50_lodret"    # eller 12_lodret
& "C:\Program Files\FreeCAD 1.0\bin\FreeCADCmd.exe" scripts\freecad\staalben.py
```

Output lander direkte i den OneDrive-synkroniserede mappe. Ingen upload, ingen størrelsesgrænse.
Det er hele pointen med at gå lokalt.

Render: `blender -b -noaudio --python scripts\freecad\render_blender.py -- <sti>\Staalben_50_lodret.stl <sti>\render.png`

## Hvorfor cloud-sessionen ramte et loft

SharePoint-connectoren tager kun tekst Claude selv skriver ind i kaldet. En binær fil skal
base64-kodes (+33 %), læses ind (loft ~22.000 tegn pr. læsning) og genskrives tegn for tegn. Praktisk
loft ~15–20 KB pr. fil. PDF'en blev derfor bygget om med egen writer og standardfonte (8 KB i stedet
for 35 KB). Render-PNG (1,1 MB) kan slet ikke komme over.

Løsning på sigt, hvis cloud skal kunne det: Graph API-token som miljøvariabel i Claude Code-miljøet →
`curl` direkte til SharePoint. Ikke logget i backlog — Joachim har ikke sagt "log det".

## Næste skridt (forslag, ikke besluttet)

- Når orientering er valgt: sæt `Document status` til det Joachim vil have, ryk Rev. til B, send til smed
- Fusion-script for Z-bænken (de tre typer 713.001–003 som én samling med konfigurationstabel) — det
  var det oprindelige mål; stålbenet var første skridt
- Test `scripts/fusion/baenk.py` i Fusion — den er skrevet blindt uden Fusion til rådighed

## Filer i repoet

```
scripts/install-blender.sh              Blender i cloud-container (SessionStart-hook ikke oprettet — kræver Joachims OK)
scripts/fusion/baenk.py                 parametrisk pladebænk til Fusion 360 (kør i Fusion)
scripts/fusion/README.md
scripts/freecad/staalben.py             stålben Z-form, headless FreeCAD → FCStd/STEP/STL/SVG/PDF/JSON
scripts/freecad/render_blender.py       STL → PNG
scripts/freecad/README.md
.claude/skills/produktionstegning/SKILL.md
docs/handover/2026-09-06-staalben-freecad-handover.md   denne fil
```
