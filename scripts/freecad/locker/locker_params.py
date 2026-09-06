# -*- coding: utf-8 -*-
"""
Locker 006.001.000 (25001 Moerkhoej Skole) - geometri og maal for alle dele.

Ren Python, ingen FreeCAD-import. Bruges af
    locker_freecad.py   -> STEP + FCStd (koeres i FreeCADCmd)
    locker_dxf.py       -> DXF pr. bearbejdningsflade til CNC (koeres i almindelig Python med ezdxf)

Kilde: Milots produktionstegninger 006.001.000_1/_2 (19/06/2026), 006.001.001_1/_2 (18/12/2025),
006.001.002_1/_2 (18/12/2025), 006.001.003 (18/12/2025), 006.001.004 og 006.001.005 (08/01/2026).
Hvert maal har en kilde. "TEGNET" = staar paa tegningen. "AFLEDT" = regnet ud fra to tegnede maal.
"ANTAGET" = ikke entydigt paa tegningen, vores bud - skal kontrolleres mod Fusion-modellen.

Lokalt koordinatsystem pr. del (bruges af begge scripts):
    a  = foerste plane akse (bredde/dybde)      0..A
    b  = anden plane akse (hoejde)              0..B
    t  = tykkelse                               0..T
    Flade '+' = t = T, flade '-' = t = 0.  a x b = t (hoejrehaandet).
    Set fra '+'-fladen (kig mod -t) med b opad ligger a mod hoejre. Set fra '-' spejles a.

Globalt (samling): X = bredde (0 = venstre yderside), Y = dybde (0 = korpus forkant, + bagud),
Z = hoejde (0 = underkant).
"""

import math

# ---------------------------------------------------------------------------
# Parametre: navn -> (vaerdi mm, kilde, forklaring)
# ---------------------------------------------------------------------------

PARAMETRE = {
    # korpus
    "W":            (300,  "TEGNET 006.001.000 '300+-0.5'", "udvendig bredde"),
    "H":            (800,  "TEGNET 006.001.000 '800'", "udvendig hoejde"),
    "D":            (390,  "TEGNET 006.001.003 '390'", "korpusdybde (sider og top/bund)"),
    "T":            (21,   "TEGNET '21' paa alle korpusdele", "pladetykkelse krydsfiner"),
    "T_back":       (6.5,  "TEGNET 006.001.005 '6.5'", "bagpladens tykkelse"),
    "RAB_T":        (10,   "TEGNET '10 +2/0' (not i sider og top/bund)", "not: ind i pladetykkelsen fra inderside"),
    "RAB_W":        (7.5,  "TEGNET '7.5'", "not: bredde fra bagkant"),
    # top/bund og bagplade
    "TB_W":         (258,  "TEGNET 006.001.004 '258 0/-0.5' (= 300 - 2x21)", "top/bund bredde"),
    "BACK_W":       (278,  "TEGNET 006.001.005 '278' (= 258 + 2x10 not)", "bagplade bredde"),
    "BACK_H":       (778,  "TEGNET 006.001.005 '778' (= 800 - 2x21 + 2x10)", "bagplade hoejde"),
    "BACK_HOLE_D":  (21,   "TEGNET 006.001.005 'O21'", "to huller i bagplade"),
    "BACK_HOLE_X":  (39,   "TEGNET 006.001.005 '39' fra hver side", "hulcenter fra sidekant"),
    "BACK_HOLE_Z":  (58,   "TEGNET 006.001.005 '58' fra overkant", "hulcenter fra overkant"),
    # skruer sider -> top/bund
    "CSK_A":        ((30, 195, 360), "TEGNET '30 / 195 / 360' (symmetrisk om 195)", "skruepositioner i dybden"),
    "CSK_B":        (10.5, "TEGNET '10.5' (= T/2)", "skruepositioner fra over-/underkant"),
    "CSK_D_THRU":   (5,    "TEGNET 'O5'", "gennemgaaende hul"),
    "CSK_D_TOP":    (9.78, "TEGNET 'O9.78 x 100 grader'", "forsaenkning, diameter i overfladen"),
    "CSK_ANGLE":    (100,  "TEGNET '100 grader'", "forsaenkningsvinkel"),
    "PILOT_D":      (3,    "TEGNET 006.001.004 '6x O3 x 20'", "forboring i kant af top/bund"),
    "PILOT_DEPTH":  (20,   "TEGNET 006.001.004 '6x O3 x 20'", ""),
    # O8 i sider
    "S8_D":         (8,    "TEGNET '2x O8' paa inderside af begge sider", "blindhul"),
    "S8_A":         (195,  "TEGNET '195' (= D/2)", "fra forkant"),
    "S8_B":         (55,   "TEGNET '55' fra over- og underkant", ""),
    "S8_DEPTH":     (12,   "ANTAGET: dybde ikke tegnet (skjult i ydervisning = ikke gennem)", ""),
    # vaegbeslag (item 8) - forboring O2
    "WB_A":         ((19, 51), "TEGNET '19 / 51' fra kant; ANTAGET: fra BAGKANT (beslag sidder mod vaeg)", "to forboringer 32 mm fra hinanden"),
    "WB_B":         (69,   "TEGNET '69' fra overkant", ""),
    "WB_D":         (2,    "TEGNET '2x O2'", ""),
    "WB_DEPTH":     (10,   "ANTAGET: dybde ikke tegnet", ""),
    # ophaeng (item 9, 846.52.808) - slids i venstre side
    "SLOT_A":       (14,   "TEGNET 006.001.002 '14'; ANTAGET: fra FORKANT", "slidsens centerlinje fra kant"),
    "SLOT_W":       (6,    "TEGNET 'R3'", "slidsbredde"),
    "SLOT_L":       (35,   "TEGNET '35'", "slidslaengde (center til center + bredde)"),
    "SLOT_DEPTH":   (6,    "TEGNET '6mm deep'", ""),
    "SLOT_TOP_1":   (51.5, "TEGNET 006.001.002_1 '51.5' fra overkant til slidsens oeverste ende", "variant 1"),
    "SLOT_BOT_2":   (65.5, "TEGNET 006.001.002_2 '65.5'; ANTAGET: fra underkant til slidsens nederste ende", "variant 2"),
    # haengselplade paa hoejre side (item 5) - laest fra 006.001.003 detalje A
    "HP_A5":        ((16.5, 53.5), "AFLEDT: 18.5+18.5 om center 35 fra forkant (detalje A)", "4x O5 i rektangel 37 x 32"),
    "HP_B5":        (16,   "TEGNET '16 / 16'", "+-16 om haengselhoejden"),
    "HP_D5":        (5,    "TEGNET '4x O5'", ""),
    "HP_DEPTH5":    (12,   "ANTAGET: dybde ikke tegnet", ""),
    "HP_A2":        ((19, 51), "TEGNET '19 / 51' fra forkant (ydervisning, forkant til venstre)", "2x O2 forboring"),
    "HP_B_TOP":     (69,   "TEGNET '69' fra overkant", "oeverste haengselgruppe"),
    "HP_B_BOT":     (73,   "TEGNET '73' fra underkant", "nederste haengselgruppe"),
    # laage
    "DOOR_W":       (296,  "TEGNET 006.001.001 '296' (= 300 - 2x2)", ""),
    "DOOR_H":       (796,  "TEGNET 006.001.001 '796'", ""),
    "DOOR_GAP_SIDE": (2,   "TEGNET 006.001.000 detalje A '2'", "spalte til korpus i siderne"),
    "DOOR_GAP_BOT": (2,    "ANTAGET: 800-796 = 4 fordelt 2/2; detalje B viser '4' nederst - kan vaere 0 top / 4 bund", "laagens underkant over korpus underkant"),
    "DOOR_Y":       (0.7,  "AFLEDT: 411.7 - 390 - 21 (samlingstegning)", "laagens bagside foran korpus forkant"),
    "DOOR_R":       (2,    "TEGNET 'R2' forkanter", "afrunding forside, ikke i DXF (efterbearbejdning)"),
    "PERF_D":       (8,    "TEGNET 'O8'", "perforering"),
    "PERF_PITCH":   (30,   "TEGNET '30'", ""),
    "PERF_COLS":    (8,    "AFLEDT: 210/30 + 1", ""),
    "PERF_ROWS":    (25,   "AFLEDT: 720/30 + 1", ""),
    "PERF_MA":      (43,   "TEGNET '43' (296-43-210 = 43, symmetrisk)", "foerste kolonne fra sidekant"),
    "PERF_MB":      (38,   "TEGNET '38' (796-38-720 = 38, symmetrisk)", "foerste raekke fra over-/underkant"),
    "HINGE_D":      (35,   "TEGNET 'R17.5'", "haengselkop Haefele Aximat 300 SM"),
    "HINGE_DEPTH":  (13,   "TEGNET snit C-C '13'", ""),
    "HINGE_EDGE":   (21.5, "TEGNET '21.5' (= 17.5 + 4)", "kopcenter fra haengselkant"),
    "HINGE_B":      (69,   "TEGNET '69' fra over- og underkant (658 imellem)", ""),
    "HINGE_PILOT_D": (2,   "TEGNET '4x O2 x 17'", ""),
    "HINGE_PILOT_DEPTH": (17, "TEGNET '4x O2 x 17'", ""),
    "HINGE_PILOT_DA": (9.5, "AFLEDT: 26 - 16.5 = 9.5 (detalje D) = Haefele boremaal 45/9.5", "forboringer bag kopcenter"),
    "HINGE_PILOT_DB": (22.5, "TEGNET '22.5 / 45'", "+-22.5 om kopcenter"),
    "NOTCH_DEPTH":  (4,    "TEGNET detalje D '4'", "udsparing i laagekant til haengselarm"),
    "NOTCH_LEN":    (43,   "TEGNET detalje D '43'", ""),
    "NOTCH_R":      (6,    "TEGNET 'R6'", ""),
    "LOCK_A":       (65,   "TEGNET '65' fra laasekant", "kombinationslaas Siso M300"),
    "LOCK_B":       (74,   "TEGNET '74' fra overkant (variant 1) / underkant (variant 2)", ""),
    "LOCK_SQ":      (15.5, "TEGNET detalje A '15.5'", "gennemgaaende firkanthul"),
    "LOCK_EAR_R":   (4,    "TEGNET 'R4 ears are added to allow CNC machining'", "dogbone-relief i hjoernerne"),
    "LOCK_EAR_RC":  (9.3,  "TEGNET 'R9.3'; ANTAGET: afstand fra laasecenter til relief-center paa diagonalen", ""),
    "LOCK_POCKET_D": (35,  "TEGNET 'O35'", "lomme paa bagside til laasehus"),
    "LOCK_POCKET_DEPTH": (3, "TEGNET snit B-B '3'", ""),
    "BUMP_D":       (5,    "TEGNET '3x O5 x 7'", "tre blindhuller paa bagside ved laasekant (stoeddaemper?)"),
    "BUMP_DEPTH":   (7,    "TEGNET '3x O5 x 7'", ""),
    "BUMP_A":       (9.5,  "TEGNET '9.5' fra laasekant", ""),
    "BUMP_B":       ((69, 398, 727), "TEGNET '69' top, '398' (= H/2), '69' bund", ""),
}
P = {k: v[0] for k, v in PARAMETRE.items()}

ANTAGELSER = [f"{k}: {v[1]}" for k, v in PARAMETRE.items() if "ANTAGET" in v[1] or "AFLEDT" in v[1]]

UAFKLARET = [
    "Detalje A paa laagen viser fire cirkler paa randen af O35-lommen. Ikke modelleret - kan vaere laasehusets naeser eller naboperforeringer.",
    "Perforeringshul (kolonne 2, raekke 2) ligger inde i laaselommen (10 mm fra laasecenter) og er udeladt. Tegningen viser omraadet utydeligt.",
    "Hoejre side: gruppen med 5 skjulte kryds ved bagkant (top og bund) er ikke maalsat paa 006.001.003. Modelleret som vaegbeslag-forboring 2x O2 ved 19/51 fra bagkant, oeverst, som paa venstre side.",
    "Hoejre side: haengselpladegruppen (4x O5 + 2x O2, detalje A) er laest med forkant til venstre i ydervisningen. Hvis Fusion-modellen har den ved bagkant, er a-koordinaterne spejlet (a -> 390 - a).",
    "Laagens lodrette placering: 2/2 antaget. Detalje B paa samlingstegningen viser '4' nederst.",
    "Bagpladen er lagt i bunden af noten (1 mm luft til bagkant).",
]

# ---------------------------------------------------------------------------
# Hjaelpere
# ---------------------------------------------------------------------------

def csk_cone_height():
    """Forsaenkningens dybde: (D_top - D_thru)/2 / tan(vinkel/2)."""
    return (P["CSK_D_TOP"] - P["CSK_D_THRU"]) / 2 / math.tan(math.radians(P["CSK_ANGLE"] / 2))


class Part2D:
    """En plade med features i lokalt (a, b, t)."""

    def __init__(self, dwg, navn, A, B, T, materiale):
        self.dwg, self.navn, self.A, self.B, self.T, self.materiale = dwg, navn, A, B, T, materiale
        self.holes = []      # dict(a, b, d, depth, face) depth=None -> gennem
        self.csk = []        # dict(a, b, face) forsaenkning paa face + O5 gennem
        self.rabbets = []    # dict(edge in a0|a1|b0|b1, width, depth_t, face)
        self.slots = []      # dict(a, b0, b1, w, depth, face)  slids langs b
        self.pockets = []    # dict(a, b, d, depth, face)  rund lomme
        self.lock = None     # dict(a, b) firkant + dogbone gennem
        self.notches = []    # dict(edge 'a1', b, length, depth, r)  udsparing gennem, fra kant
        self.edge_holes = [] # dict(edge 'a0'|'a1', pos_b, t, d, depth)  boring i kant, ind langs a
        self.noter = []

    def hole(self, a, b, d, depth=None, face="+"):
        self.holes.append(dict(a=a, b=b, d=d, depth=depth, face=face))

    def as_dict(self):
        return dict(dwg=self.dwg, navn=self.navn, A=self.A, B=self.B, T=self.T, materiale=self.materiale,
                    holes=self.holes, csk=self.csk, rabbets=self.rabbets, slots=self.slots, pockets=self.pockets,
                    lock=self.lock, notches=self.notches, edge_holes=self.edge_holes, noter=self.noter)


# ---------------------------------------------------------------------------
# Delene
# ---------------------------------------------------------------------------

def side_common(p, back_at):
    """Fælles for begge sider. back_at = 'a1' (venstre side: a = y) eller 'a0' (hoejre: a = D - y)."""
    D, H, T = P["D"], P["H"], P["T"]
    p.rabbets.append(dict(edge=back_at, width=P["RAB_W"], depth_t=P["RAB_T"], face="+"))
    for a in P["CSK_A"]:
        for b in (P["CSK_B"], H - P["CSK_B"]):
            p.csk.append(dict(a=a, b=b, face="-"))
    for b in (P["S8_B"], H - P["S8_B"]):
        p.hole(P["S8_A"], b, P["S8_D"], P["S8_DEPTH"], "+")


def from_back(p, back_at, dist):
    return p.A - dist if back_at == "a1" else dist


def from_front(p, back_at, dist):
    return dist if back_at == "a1" else p.A - dist


def left_side(variant):
    p = Part2D(f"006.001.002_{variant}", "Locker korpus, left side", P["D"], P["H"], P["T"], "Plywood 21 mm")
    side_common(p, back_at="a1")
    for d in P["WB_A"]:
        p.hole(from_back(p, "a1", d), P["H"] - P["WB_B"], P["WB_D"], P["WB_DEPTH"], "+")
    if variant == 1:
        b1 = P["H"] - P["SLOT_TOP_1"]; b0 = b1 - P["SLOT_L"]
    else:
        b0 = P["SLOT_BOT_2"]; b1 = b0 + P["SLOT_L"]
    p.slots.append(dict(a=from_front(p, "a1", P["SLOT_A"]), b0=b0, b1=b1, w=P["SLOT_W"], depth=P["SLOT_DEPTH"], face="+"))
    p.noter += ["Face '+' = inside (towards cabinet). Face '-' = outside, countersinks 100 deg.",
                "Deburr front edges."]
    return p


def right_side():
    p = Part2D("006.001.003", "Locker korpus, right side", P["D"], P["H"], P["T"], "Plywood 21 mm")
    side_common(p, back_at="a0")
    for b in (P["H"] - P["HP_B_TOP"], P["HP_B_BOT"]):
        for a in P["HP_A5"]:
            for db in (-P["HP_B5"], P["HP_B5"]):
                p.hole(from_front(p, "a0", a), b + db, P["HP_D5"], P["HP_DEPTH5"], "+")
        for a in P["HP_A2"]:
            p.hole(from_front(p, "a0", a), b, P["WB_D"], P["WB_DEPTH"], "+")
    for d in P["WB_A"]:
        p.hole(from_back(p, "a0", d), P["H"] - P["WB_B"], P["WB_D"], P["WB_DEPTH"], "+")
    p.noter += ["Face '+' = inside (towards cabinet). Face '-' = outside, countersinks 100 deg.",
                "Hinge mounting plate holes at front edge (ANTAGET reading of detail A).",
                "Deburr front edges."]
    return p


def top_bottom():
    p = Part2D("006.001.004", "Locker korpus, top and bottom", P["TB_W"], P["D"], P["T"], "Plywood 21 mm")
    p.rabbets.append(dict(edge="b1", width=P["RAB_W"], depth_t=P["RAB_T"], face="+"))
    for edge in ("a0", "a1"):
        for pos in P["CSK_A"]:
            p.edge_holes.append(dict(edge=edge, pos_b=pos, t=P["T"] / 2, d=P["PILOT_D"], depth=P["PILOT_DEPTH"]))
    p.noter += ["Face '+' = inside (towards cabinet). b = depth, b=0 front edge, rabbet at back edge.",
                "6x O3 x 20 pilot holes in both side edges (not in DXF - edge drilling).", "Deburr front edges."]
    return p


def back():
    p = Part2D("006.001.005", "Locker korpus, back side", P["BACK_W"], P["BACK_H"], P["T_back"], "Plywood 6.5 mm")
    for a in (P["BACK_HOLE_X"], P["BACK_W"] - P["BACK_HOLE_X"]):
        p.hole(a, P["BACK_H"] - P["BACK_HOLE_Z"], P["BACK_HOLE_D"], None, "+")
    return p


def door(variant):
    p = Part2D(f"006.001.001_{variant}", "Locker korpus, front (door)", P["DOOR_W"], P["DOOR_H"], P["T"], "Plywood 21 mm")
    A, B = p.A, p.B
    lock_a = P["LOCK_A"]
    lock_b = B - P["LOCK_B"] if variant == 1 else P["LOCK_B"]
    p.lock = dict(a=lock_a, b=lock_b)
    p.pockets.append(dict(a=lock_a, b=lock_b, d=P["LOCK_POCKET_D"], depth=P["LOCK_POCKET_DEPTH"], face="-"))
    # perforering - udelad huller der ligger i laaselommen
    r_ex = P["LOCK_POCKET_D"] / 2
    udeladt = 0
    for i in range(P["PERF_COLS"]):
        for j in range(P["PERF_ROWS"]):
            a = P["PERF_MA"] + i * P["PERF_PITCH"]
            b = P["PERF_MB"] + j * P["PERF_PITCH"]
            if math.hypot(a - lock_a, b - lock_b) < r_ex:
                udeladt += 1
                continue
            p.hole(a, b, P["PERF_D"], None, "+")
    p.perf_udeladt = udeladt
    # haengsler paa hoejre kant (a = A)
    for b in (P["HINGE_B"], B - P["HINGE_B"]):
        ca = A - P["HINGE_EDGE"]
        p.pockets.append(dict(a=ca, b=b, d=P["HINGE_D"], depth=P["HINGE_DEPTH"], face="-"))
        for db in (-P["HINGE_PILOT_DB"], P["HINGE_PILOT_DB"]):
            p.hole(ca - P["HINGE_PILOT_DA"], b + db, P["HINGE_PILOT_D"], P["HINGE_PILOT_DEPTH"], "-")
        p.notches.append(dict(edge="a1", b=b, length=P["NOTCH_LEN"], depth=P["NOTCH_DEPTH"], r=P["NOTCH_R"]))
    # stoeddaemper-huller ved laasekant (a = 0), bagside
    for b in P["BUMP_B"]:
        p.hole(P["BUMP_A"], b, P["BUMP_D"], P["BUMP_DEPTH"], "-")
    p.noter += ["Face '+' = FRONT (visible). Face '-' = BACK: hinge cups, lock pocket, pilot holes.",
                "Front outer edges R2 rounding - post-op, not in DXF.", "Deburr backside outer edges.",
                f"Perforation {P['PERF_COLS']}x{P['PERF_ROWS']} O{P['PERF_D']} pitch {P['PERF_PITCH']}, {udeladt} hole(s) omitted inside lock pocket."]
    return p


def lock_profile(a, b):
    """Firkant med dogbone-relief som liste af (type, ...) til begge scripts:
    returnerer (halvside, [(cx, cy), ...] relief-centre, r)."""
    h = P["LOCK_SQ"] / 2
    rc = P["LOCK_EAR_RC"] / math.sqrt(2)
    centre = [(a + sa * rc, b + sb * rc) for sa in (-1, 1) for sb in (-1, 1)]
    return h, centre, P["LOCK_EAR_R"]


# ---------------------------------------------------------------------------
# Samling: placering af hver del i globalt XYZ.  Matrix M (3x3 raekker) + translation:
#   global = M * local + t
# ---------------------------------------------------------------------------

def assembly(variant):
    W, H, D, T = P["W"], P["H"], P["D"], P["T"]
    gy = P["DOOR_Y"]
    return [
        # (instansnavn, del, M raekker, translation)
        ("LeftSide",  left_side(variant), ((0, 0, 1), (1, 0, 0), (0, 1, 0)), (0, 0, 0)),
        ("RightSide", right_side(),       ((0, 0, -1), (-1, 0, 0), (0, 1, 0)), (W, D, 0)),
        ("Bottom",    top_bottom(),       ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (T, 0, 0)),
        ("Top",       top_bottom(),       ((-1, 0, 0), (0, 1, 0), (0, 0, -1)), (W - T, 0, H)),
        ("Back",      back(),             ((1, 0, 0), (0, 0, -1), (0, 1, 0)), (T - P["RAB_T"], D - 1, T - P["RAB_T"])),
        ("Door",      door(variant),      ((1, 0, 0), (0, 0, -1), (0, 1, 0)), (P["DOOR_GAP_SIDE"], -gy, P["DOOR_GAP_BOT"])),
    ]


def unique_parts(variant):
    seen, out = set(), []
    for _, p, _, _ in assembly(variant):
        if p.dwg not in seen:
            seen.add(p.dwg); out.append(p)
    return out


BOM = [
    ("1", 1, "006.001.002_{v}", "Locker korpus, left side - 21mm plywood"),
    ("2", 1, "006.001.003", "Locker korpus, right side - 21mm plywood"),
    ("3", 2, "006.001.004", "Locker and shoeshelf korpus, top and bottom - 21mm plywood"),
    ("4", 1, "006.001.005", "Locker korpus, back side - 6,5mm plywood"),
    ("5", 2, "Hinge 344_06_010", "Full overlay hinge Haefele Aximat 300 SM"),
    ("6", 1, "006.001.001_{v}", "Locker korpus, front - 21mm plywood"),
    ("7", 1, "Combi cam lock M300,4", "Combination lock M300 4-digit Siso"),
    ("8", 2, "Wall bracket 49x47x35mm", "Wall mount bracket, Beslag grosisten"),
    ("9", 1, "846.52.808", "Anker hanger beslag grosisten"),
]
