# Fusion 360-scripts

Scripts der bygger møbler på mål i Fusion 360. De kører **inde i** Fusion —
Fusion har ingen headless-tilstand og ingen Linux-version, så de kan ikke
køres herfra.

## Sådan kører du et script

1. Åbn Fusion 360 og opret et nyt, tomt design.
2. Fanen **UTILITIES** → **ADD-INS** → **Scripts and Add-Ins** (genvej `Shift+S`).
3. Fanen **Scripts** → det grønne **+** → peg på scriptets `.py`-fil.
4. Marker scriptet → **Run**.

Første gang tilføjer du filen. Derefter ligger den på listen.

## baenk.py — pladebænk

Bygger en bænk som fem komponenter: sæde, to gavle, forkant og en valgfri
mellemgavl. Sædet hviler på gavlene, forkanten flugter med undersiden af
sædet.

Efter kørsel retter du målene i Fusion under **MODIFY → Change Parameters**.
Modellen bygger sig selv om. Rediger *ikke* tallene i `.py`-filen bagefter —
de er kun startværdier til første kørsel.

| Parameter | Start | Betydning |
|---|---|---|
| `L_baenk` | 1800 | Samlet længde, yderkant til yderkant |
| `D_baenk` | 400 | Dybde, forkant til bagkant |
| `H_saede` | 450 | Færdig siddehøjde, gulv til overside af sædet |
| `T_plade` | 21 | Pladetykkelse, alle dele |
| `Gavl_tilbagetraek` | 21 | Hvor langt gavlene står tilbage fra forkanten |
| `Forkant_hoejde` | 80 | Højden på forkantbrættet under sædet |

`Gavl_tilbagetraek` bør normalt være lig `T_plade`, så forkanten flugter med
gavlenes forkant.

Mellemgavlen slås fra i toppen af filen: `MED_MELLEMGAVL = False`.

### Hvad scriptet ikke gør

- **Ingen samlinger.** Ingen dominoer, skruehuller, gevindbøsninger eller
  udfræsninger. Det er en råmodel med rigtige mål.
- **Ingen tegning.** Produktionstegningen laver du selv: højreklik på
  komponenten i browseren → **Create Drawing** → **From Design**.
- **Ingen stålben.** Kun pladekonstruktion. Stålbenskonstruktionen
  (50×12 Z-form) er en anden geometri og skal have sit eget script.
