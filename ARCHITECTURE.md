# NemInventar ERP – Arkitekturprincipper

> Systemets "grundlov". Ændres sjældent. Alle AI-assistenter og udviklere skal overholde disse principper.

---

## 1. Vision

Et operationelt værktøj til hverdagen — ikke en platform. Det skal føles som "et Excel-ark, bare struktureret og automatiseret korrekt."

Systemet skal give fuld gennemsigtighed i økonomi og kunne håndtere rigtige projekter med kompleksitet.

## 2. V1 Mindset

Vi bygger en robust V1. Prioritering er fast:

1. **Korrekthed** – regnestykket skal være rigtigt
2. **Overblik** – man skal kunne læse og forstå hvad der sker
3. **Simpel implementering** – hellere simpelt + virker end smart + komplekst

Vi prioriterer IKKE: perfekte UI-detaljer, avanceret automation, generiske enterprise-features.

## 3. Kerneprincipper

### 3.1 Total-mode først
Systemet tænker i totaler. Enhedspriser er afledte (`total / antal`). Ingen "per unit først"-logik.

### 3.2 Produkter er centrum
Alt bygger på `project_products`. Et produkt repræsenterer "det vi bygger/sælger" og indeholder:
- Materialelinjer (med beregning: længde × bredde × antal, spild%)
- Arbejdsløn (produktion, DK installation, øvrig)
- Transport
- Øvrige omkostninger

### 3.3 Tilbudslinjen er kundens sandhed
Kunden ser: antal, enhedspris, total. Internt består tilbudslinjen af mange produkter og cost lines.

### 3.4 Cost → Risk → Margin
Rækkefølgen er fast og ufravigelig:

```
Base cost
+ Risk
= Total cost
+ Profit
= Salgspris
```

Risk behandles som cost. Der lægges ikke margin på risk i V1.

### 3.5 Snapshot-baseret logik
Når data bruges i tilbud eller budget, tages et snapshot. Ingen live afhængigheder der ændrer historik.

### 3.6 Simple flows > fleksibilitet
Default er altid: create new, copy data. Mapping, merge og automatisering kommer senere.

## 4. Dataarkitektur

### 4.1 Projekt-isolation
Al data er scoped til det aktive projekt. Klar adskillelse mellem globale data (standard) og projektspecifikke data.

### 4.2 Dobbelt materialedatabase
- **Standard Materials** – master-katalog, genbruges på tværs af projekter
- **Project Materials** – projektspecifikke varianter med egne priser og leverandører
- Projektmaterialer kan referere til standardmaterialer

### 4.3 Fire kostlinjetyper
Produkter brydes ned i: material, labor, transport, other cost. Hver linje tilføjes/redigeres/slettes uafhængigt.

### 4.4 Tilbud → Budget flow
Tilbud kan være kilde til budgets. Budgets låser salgspriser mens de tracker aktuelle omkostninger. Understøtter profit-tracking og variance-analyse.

### 4.5 Godkendelsessystem
Materialer tracker godkendelsesstatus (produktion + bæredygtighed). Purchase orders understøtter override med begrundelse.

## 5. Frontend-arkitektur

### 5.1 State management
7 React Context providers i hierarkisk nesting:
1. ProjectContext – aktivt projekt
2. StandardSuppliersProvider
3. StandardMaterialsProvider
4. ProjectMaterialsProvider
5. PurchaseOrdersProvider
6. TransportProvider
7. ProjectProductsProvider

Hver context loader data fra Supabase ved projektskift og tilbyder CRUD-operationer.

### 5.2 UI/UX-stil
- Tabellen er central (Excel-style)
- Rækker = typer af cost
- Kolonner = beløb, enhed, %
- Regnestykker skal kunne læses oppefra og ned

## 6. Backend-arkitektur

### 6.1 Supabase PostgreSQL
Progressiv skema-evolution via migrationer. Realtid aktiveret.

### 6.2 Edge Functions (Deno)
Bruges til prisforespørgsler og andre serverless operationer.

## 7. Regler – hvad du IKKE må gøre

- ❌ Introducere komplekse relationer uden behov
- ❌ Foreslå microservices eller over-arkitektur
- ❌ Optimere før der er et problem
- ❌ Blande V1 og V2 features
- ❌ Lave "magic calculations" – alt skal være transparent
- ❌ Bruge "per unit først"-logik
- ❌ Lave live afhængigheder i tilbud/budgets (brug snapshots)
