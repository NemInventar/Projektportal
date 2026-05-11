# Plan: Sub-faner pr. tilbudslinje (Tilbud / Bilag)

_Status: forslag, ikke kørt. Gemt 2026-05-08 til senere genbesøg._

---

## Problemet vi prøver at løse

Lige nu er bilag-relateret indhold for en tilbudslinje spredt på flere steder:

- **Billede + AI-render** → inline på linje-kortet (i den udfoldede tilstand)
- **Levende beskrivelse** → inline på linje-kortet (også udfoldet)
- **Teknisk spec** → på den overordnede Bilags-PDF-fane som en separat linje-liste
- **Include in appendix-toggle** → samme overordnede sted

Det betyder du redigerer "én linjes bilag-indhold" tre forskellige steder. Mental model er rodet.

## Forslag

Hver tilbudslinje får sub-faner inde i den udfoldede tilstand:

**Tab 1: "Tilbud" (default)**
- Prisfastsættelse-blok
- Line Items
- Kalkulation-summary (styret af globale toggles som nu)

**Tab 2: "Bilag"**
- Layout der mirror'er bilags-PDF'en:
  - Øverst: billed-preview + render-status + custom upload + caption
  - Derunder to kolonner: "Levende beskrivelse" (venstre) og "Teknisk spec" (højre) — præcis som bilag viser dem
- Alle felter editerbare inline
- Giver semi-preview mens man arbejder
- Include-in-appendix-toggle øverst (eller som eye/eye-off i tab-headeren)

## Konsekvenser for resten af UI'et

- **Global toolbar** reduceres til kun tilbuds-relaterede chips (Prisfastsættelse / Line Items / Kalkulation), ELLER fjernes helt fordi tabs erstatter den
- **Bilags-PDF-fanen (overordnet)** trimmes til kun cover-tekst + en simpel oversigt over linjer med include/exclude-toggle (uden tekst-redigering)
- **Image og Levende-beskrivelse-sektionerne** flyttes JSX-mæssigt ind i bilag-tab
- **Technical_spec-redigering** flyttes fra Bilags-PDF-tabben til linje-bilag-tabben

## Risiko

**Lavt:**
- Tabs-wrapping og state pr. linje — standard React-pattern

**Mellem:**
- Image-sektionen har intern logik (upload, custom-image-toggle, render-status, caption)
- Levende-beskrivelse-sektionen har AI-generate-flow med stale-state-håndtering
- Hvis JSX flyttes forkert kan handlers gå i stykker

**Mitigations:**
- Byg tabs-skelet først som tom struktur, type-tjek
- Flyt sektioner én ad gangen, type-tjek mellem hver
- Behold sub-handlers urørt — flyt kun JSX
- Drag-and-drop kører på Card-niveau, ikke i fare

**Estimat:** 45-60 min med forsigtig flytning.

## Når jeg vender tilbage

1. Læs denne fil
2. Verificér at strukturen stadig giver mening (tab-navne, defaults)
3. Beslut om global toolbar skal beholdes eller fjernes
4. Beslut om "Bilags-PDF"-fanen på det overordnede niveau skal beholde linje-listen (kun toggle) eller fjernes helt
5. Kør implementeringen som beskrevet i risiko-mitigations

## Alternativer overvejet (men afvist)

- **Separat side til bilag-redigering** — afvist fordi det fjerner kontekst af linjen
- **Pop-up modal pr. linje** — afvist fordi det blokerer udsynet
- **Beholde nuværende struktur og bare tilføje toggles** — det er hvad vi har nu, det løser ikke "tre forskellige steder"-problemet
