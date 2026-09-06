# -*- coding: utf-8 -*-
"""
Baenk paa maal - Fusion 360-script for Nem Inventar.

Bygger en pladebaenk som fem selvstaendige komponenter: saede, to gavle,
forkant og en valgfri mellemgavl. Alle dele haenger sammen med de samme
seks parametre, saa en rettelse i eet maal flytter resten med.

Saadan koerer du den:
  Fusion 360 -> fanen UTILITIES -> ADD-INS -> Scripts and Add-Ins (eller Shift+S)
  -> Scripts -> det groenne plus -> peg paa denne fil -> Run

Naar den har koert, retter du maalene under
  MODIFY -> Change Parameters
og modellen bygger sig selv om. Ret ikke tallene her i filen bagefter -
de er kun startvaerdier.

Koordinater: X = laengde, Y = dybde (0 = forkant), Z = hoejde (0 = gulv).
"""

import traceback

import adsk.core
import adsk.fusion


# --- Indstillinger ---------------------------------------------------------

# Mellemgavl paa midten. Slaa fra ved korte baenke.
MED_MELLEMGAVL = True

# Startmaal i mm.
PARAMETRE = [
    ("L_baenk",           1800, "Baenkens samlede laengde, yderkant til yderkant"),
    ("D_baenk",            400, "Baenkens dybde, forkant til bagkant"),
    ("H_saede",            450, "Faerdig siddehoejde, gulv til oversiden af saedet"),
    ("T_plade",             21, "Pladetykkelse - gaelder alle dele"),
    ("Gavl_tilbagetraek",   21, "Hvor langt gavlene staar tilbage fra forkanten. "
                                "Saet den lig T_plade, saa forkanten flugter"),
    ("Forkant_hoejde",      80, "Hoejden paa forkantbraettet under saedet"),
]


# --- Hjaelpere -------------------------------------------------------------

def _cm(mm):
    """Fusion regner internt i cm. Alle vores maal er i mm."""
    return mm / 10.0


def _opret_parametre(design):
    """Laegger parametrene ind. Koerer scriptet igen, opdateres de i stedet."""
    for navn, vaerdi, kommentar in PARAMETRE:
        udtryk = "{} mm".format(vaerdi)
        param = design.userParameters.itemByName(navn)
        if param is None:
            design.userParameters.add(
                navn,
                adsk.core.ValueInput.createByString(udtryk),
                "mm",
                kommentar,
            )
        else:
            param.expression = udtryk
            param.comment = kommentar


def _laas_position(sketch, komponent, hjoerne, x_udtryk, y_udtryk, x_nom, y_nom):
    """
    Binder delens nederste venstre hjoerne fast.

    Er udtrykket None, ligger hjoernet paa nul og saettes fast paa aksen -
    en maalsaetning paa nul er ikke gyldig i Fusion.
    """
    if x_udtryk is None:
        akse = sketch.project(komponent.yConstructionAxis).item(0)
        sketch.geometricConstraints.addCoincident(hjoerne, akse)
    else:
        tekst = adsk.core.Point3D.create(_cm(x_nom / 2.0), _cm(-90), 0)
        maal = sketch.sketchDimensions.addDistanceDimension(
            sketch.originPoint,
            hjoerne,
            adsk.fusion.DimensionOrientations.HorizontalDimensionOrientation,
            tekst,
        )
        maal.parameter.expression = x_udtryk

    if y_udtryk is None:
        akse = sketch.project(komponent.xConstructionAxis).item(0)
        sketch.geometricConstraints.addCoincident(hjoerne, akse)
    else:
        tekst = adsk.core.Point3D.create(_cm(-90), _cm(y_nom / 2.0), 0)
        maal = sketch.sketchDimensions.addDistanceDimension(
            sketch.originPoint,
            hjoerne,
            adsk.fusion.DimensionOrientations.VerticalDimensionOrientation,
            tekst,
        )
        maal.parameter.expression = y_udtryk


def _byg_del(rod, navn, udtryk, nominel):
    """
    Laver een pladedel som sin egen komponent.

    udtryk:   (x, y, z, bredde, dybde, hoejde) som Fusion-udtryk.
              x, y og z maa vaere None, hvilket betyder nul.
    nominel:  de samme seks tal i mm. De bruges kun til at tegne skitsen
              et sted at starte - maalsaetningerne overtager bagefter.
    """
    x_u, y_u, z_u, b_u, d_u, h_u = udtryk
    x, y, _z, b, d, _h = nominel

    okkurrens = rod.occurrences.addNewComponent(adsk.core.Matrix3D.create())
    komponent = okkurrens.component
    komponent.name = navn

    sketch = komponent.sketches.add(komponent.xYConstructionPlane)
    linjer = sketch.sketchCurves.sketchLines.addTwoPointRectangle(
        adsk.core.Point3D.create(_cm(x), _cm(y), 0),
        adsk.core.Point3D.create(_cm(x + b), _cm(y + d), 0),
    )
    bund = linjer.item(0)
    hoejre = linjer.item(1)

    # Bredden i X
    maal_b = sketch.sketchDimensions.addDistanceDimension(
        bund.startSketchPoint,
        bund.endSketchPoint,
        adsk.fusion.DimensionOrientations.HorizontalDimensionOrientation,
        adsk.core.Point3D.create(_cm(x + b / 2.0), _cm(y - 45), 0),
    )
    maal_b.parameter.expression = b_u

    # Dybden i Y
    maal_d = sketch.sketchDimensions.addDistanceDimension(
        hoejre.startSketchPoint,
        hoejre.endSketchPoint,
        adsk.fusion.DimensionOrientations.VerticalDimensionOrientation,
        adsk.core.Point3D.create(_cm(x + b + 45), _cm(y + d / 2.0), 0),
    )
    maal_d.parameter.expression = d_u

    _laas_position(sketch, komponent, bund.startSketchPoint, x_u, y_u, x, y)

    # Hoejden i Z bliver selve udtraekket
    udtraek = komponent.features.extrudeFeatures
    inddata = udtraek.createInput(
        sketch.profiles.item(0),
        adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
    )
    inddata.setDistanceExtent(False, adsk.core.ValueInput.createByString(h_u))
    if z_u is not None:
        inddata.startExtent = adsk.fusion.OffsetStartDefinition.create(
            adsk.core.ValueInput.createByString(z_u)
        )
    feature = udtraek.add(inddata)
    feature.bodies.item(0).name = navn
    return komponent


def _skaereliste(maal):
    """Emnestoerrelser i mm - laengde x bredde x tykkelse."""
    L = maal["L_baenk"]
    D = maal["D_baenk"]
    H = maal["H_saede"]
    T = maal["T_plade"]
    GT = maal["Gavl_tilbagetraek"]
    FH = maal["Forkant_hoejde"]

    gavle = 3 if MED_MELLEMGAVL else 2
    return [
        ("Saede",     1,     L,       D - 0,  T),
        ("Gavl",      gavle, H - T,   D - GT, T),
        ("Forkant",   1,     L - 2*T, FH,     T),
    ]


# --- Indgang ---------------------------------------------------------------

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        if design is None:
            ui.messageBox("Aabn et Fusion-designdokument foerst.")
            return

        # Direct modeling har ingen historik - saa virker parametrene ikke.
        if design.designType != adsk.fusion.DesignTypes.ParametricDesignType:
            design.designType = adsk.fusion.DesignTypes.ParametricDesignType

        try:
            design.fusionUnitsManager.distanceDisplayUnits = \
                adsk.fusion.DistanceUnits.MillimeterDistanceUnits
        except Exception:
            pass  # ikke kritisk - modellen er korrekt uanset visningsenhed

        _opret_parametre(design)
        maal = {navn: vaerdi for navn, vaerdi, _ in PARAMETRE}
        L = maal["L_baenk"]
        D = maal["D_baenk"]
        H = maal["H_saede"]
        T = maal["T_plade"]
        GT = maal["Gavl_tilbagetraek"]
        FH = maal["Forkant_hoejde"]

        rod = design.rootComponent
        rod.name = "Baenk"

        gavl_udtryk = (None, "Gavl_tilbagetraek", None,
                       "T_plade", "D_baenk - Gavl_tilbagetraek", "H_saede - T_plade")
        gavl_nom = (0, GT, 0, T, D - GT, H - T)

        _byg_del(
            rod, "Saede",
            (None, None, "H_saede - T_plade", "L_baenk", "D_baenk", "T_plade"),
            (0, 0, H - T, L, D, T),
        )
        _byg_del(rod, "Gavl venstre", gavl_udtryk, gavl_nom)
        _byg_del(
            rod, "Gavl hoejre",
            ("L_baenk - T_plade",) + gavl_udtryk[1:],
            (L - T,) + gavl_nom[1:],
        )
        _byg_del(
            rod, "Forkant",
            ("T_plade", None, "H_saede - T_plade - Forkant_hoejde",
             "L_baenk - 2 * T_plade", "T_plade", "Forkant_hoejde"),
            (T, 0, H - T - FH, L - 2 * T, T, FH),
        )
        if MED_MELLEMGAVL:
            _byg_del(
                rod, "Mellemgavl",
                ("L_baenk / 2 - T_plade / 2",) + gavl_udtryk[1:],
                (L / 2.0 - T / 2.0,) + gavl_nom[1:],
            )

        linjer = ["Baenk bygget: {} x {} x {} mm".format(L, D, H), "", "Emner:"]
        for navn, antal, a, b, t in _skaereliste(maal):
            linjer.append("  {} stk  {}  {:.0f} x {:.0f} x {:.0f} mm"
                          .format(antal, navn.ljust(10), a, b, t))
        linjer += ["", "Ret maalene under MODIFY -> Change Parameters."]
        ui.messageBox("\n".join(linjer), "Baenk")

    except Exception:
        if ui:
            ui.messageBox("Scriptet fejlede:\n{}".format(traceback.format_exc()))
