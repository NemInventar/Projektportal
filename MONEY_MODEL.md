# Nem Inventar – Money Model

> Levende dokument. Versionér det, opdatér det månedligt med læring fra rigtige projekter.
> Inspireret af Alex Hormozi: *$100M Money Models* (Acquisition.com, 2025).
> Tilpasset B2B-snedkervirksomhed med projekt-baseret salg.

---

## 1. Hvad er problemet?

Vi sælger projekter i 100k–2M+ DKK størrelsen til hovedentreprenører, arkitekter og bygherrer. Salgscyklus er lang, depositum er ujævnt, og vi har ikke et systematisk billede af:

- Hvordan vi får **første** projekt med en ny kunde (attraction)
- Hvordan vi sælger **mere** på samme projekt (upsell)
- Hvad vi gør når kunden siger nej til fuldt tilbud (downsell)
- Hvordan vi bliver **fast leverandør** næste gang (continuity)

Uden den struktur efterlader vi penge på bordet og er afhængige af enkelt-salg.

## 2. Hormozi's princip i én sætning

**Cash-positiv inden 30 dage:** Bruttofortjeneste på én kunde de første 30 dage skal være større end (2 × CAC) + COGS, så hver ny kunde finansierer de næste to.

Oversat til vores virkelighed: **Depositum + early-stage betaling** skal dække vores reelle 30-dages udlæg (materialer, lønforskud, transport) **plus** vores salgsomkostning til at lande projektet **plus** budget til at finde næste kunde.

---

## 3. Vores fire ofre (V1)

### 3.1 Attraction Offer – få nye projekter ind

Mål: konvertere fremmed → første ordre med lav friktion.

| Offer | Hvad | Til hvem | Status |
|---|---|---|---|
| Gratis kalkulation + visualisering | 1 produkt tegnet og prissat på 5 hverdage | Nye arkitekter/HE | Idé |
| Pilot-leverance | Lille testenhed (fx 1 stk inventar) før hovedordre | Nye HE der vil teste kvalitet | Idé |
| Reference-rabat | % rabat mod at vi må filme/fotografere byggepladsen | Synlige projekter (skoler, hoteller) | Idé |
| Hurtigsvar-garanti | Tilbud inden 5 hverdage eller % rabat | Tidspressede HE | Idé |

### 3.2 Upsell Offer – mere på samme projekt

Mål: hæve gennemsnitlig projektværdi efter ja til hovedtilbud.

| Offer | Hvad | Hvornår | Status |
|---|---|---|---|
| "Vi så også..." | 2–3 ekstra steder hvor inventar passer | Ved tilbudsmøde | Idé |
| Premium-finish | Opgradering af overflade/materiale | I tilbud, som tilvalgslinje | Idé |
| Fast-track tillæg | Hastigheds-pris for komprimeret produktion | Når kunde nævner deadline | Idé |
| Montage + indjustering | Vi monterer + 1. service inkluderet | Som standard på tilbud | Idé |

### 3.3 Downsell Offer – red salget når fuldt tilbud afvises

Mål: aldrig miste en kunde til "for dyrt" uden at have prøvet et alternativ.

| Offer | Hvad | Trigger | Status |
|---|---|---|---|
| Materiale-downgrade | Samme design, billigere finish | "For dyrt" | Idé |
| Reduceret scope | Kerneprodukt minus tilvalg | "For dyrt" | Idé |
| Stage payment | Faser opdelt over længere tid | "Cashflow" | Idé |
| DIY-montage | Vi leverer, kunden monterer | "Vi har egne folk" | Idé |

### 3.4 Continuity Offer – bliv fast leverandør

Mål: gentagne projekter uden ny salgsindsats.

| Offer | Hvad | Til hvem | Status |
|---|---|---|---|
| Rammeaftale | Forhandlet pris + leveringstid på X stk/år | HE med løbende byggerier | Idé |
| Servicekontrakt | Årligt eftersyn + småreparation | Bygherrer med leveret inventar | Idé |
| Preferred supplier | Vi ligger første i deres udbudsliste mod fast rabat | Arkitekter | Idé |
| Standardkatalog | Pre-priset katalog kunden kan bestille fra | Gentagne kunder | Idé |

---

## 4. CFA-test for vores projekttype

For at vide om et projekt er **cash-positivt på 30 dage**, kør denne test inden vi siger ja:

```
30-dages cash in   = Depositum + tidlige milepælsbetalinger (≤30 dage fra ordre)
30-dages cash out  = Materialer købt + lønforskud + transport + salgsomkostning

Cash-positiv?      = (cash in − cash out) > 0
CFA-target         = cash in ≥ 2 × salgsomkostning + 30-dages COGS
```

**Konkrete håndtag i ERP'et vi allerede har:**
- `cost lines` → giver os COGS pr. produkt
- `budgets` (locked sell vs. current cost) → giver os real-time margin
- Snapshot-logik → vi kan måle planlagt vs. faktisk pr. projekt

**Mangler vi for at kunne måle CFA:**
- Salgsomkostning pr. lead/projekt (tidsforbrug × intern timesats)
- Betalingsplan-felt pr. tilbud (hvornår falder beløbene)
- "30-dages cash"-rapport pr. projekt

---

## 5. Forbedringsloop – hvordan vi reparerer modellen

Modellen er ikke statisk. Den skal slibes med data fra rigtige projekter.

**Pr. tilbud (tager 1 min):**
- Hvilken attraction-type kom kunden ind på?
- Hvilke upsells blev tilbudt? Hvilke landede?
- Blev der lavet en downsell? Hvilken?
- Er der en continuity-mulighed (rammeaftale, reference)?

**Månedligt review (Joachim, 30 min):**
- Win rate pr. attraction-type
- Gennemsnitlig opjustering fra upsell
- Downsell save-rate (procent reddet vs. tabt)
- Antal projekter der er blevet til gentagende kunde
- Opdatér tabellerne ovenfor: idé → test → virker / virker ikke

**Kvartalsvist:**
- Slet ofre der ikke virker
- Lav 1–2 nye attraction-eksperimenter
- Tjek CFA-tal pr. projekttype: er der projekttyper vi skal sige nej til?

---

## 6. Næste skridt (rækkefølge)

1. **Joachim:** Markér hvilke 2 attraction-ofre vi vil teste først (V1: hold det til 2)
2. **Joachim:** Vælg 1 upsell der bygges ind som standard tilvalgslinje i tilbud
3. **ERP:** Tilføj "betalingsplan" pr. tilbud (start simpelt: depositum % + milestones)
4. **ERP:** Tilføj rapport "30-dages cash pr. projekt"
5. **Proces:** Tilføj 4 felter til tilbudsformularen (attraction-type / upsells tilbudt / downsell brugt / continuity-mulighed)
6. **Efter 5 tilbud:** Første review af modellen

Vi tilføjer ikke flere ofre før vi har data på de første. **Idé → test → behold/drop.**

---

## Kilder

- Alex Hormozi, *$100M Money Models*, Acquisition.com 2025 (bog + Game-podcast ep. 895, 938–945)
- CFA-formel: gross profit (30d) > 2 × CAC + COGS
- Acquisition.com training: https://www.acquisition.com/training/money/context
