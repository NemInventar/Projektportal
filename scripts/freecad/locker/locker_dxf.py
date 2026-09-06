# -*- coding: utf-8 -*-
"""
Locker 006.001.000 -> DXF pr. del og bearbejdningsflade til CNC.

    python locker_dxf.py            (kraever: pip install ezdxf)

Miljoevariable:
    LOCKER_OUT       output-mappe (default ./out)
    LOCKER_VARIANTS  "1,2"

Konvention (samme som Fusions 'Machining template'-DXF'er i 007.000.000):
    DXF R2013 (AC1027), mm ($INSUNITS = 4), 2D i XY, origo = pladens nederste venstre hjoerne
    SET FRA DEN FLADE DER BEARBEJDES. X mod hoejre, Y opad.

Lag (navnet baerer operationen, saa CAM kan vaelge vaerktoej pr. lag):
    CONTOUR                     yderkontur inkl. udsparinger (gennem)
    THRU_D<d>                   gennemgaaende hul, diameter d
    BLIND_D<d>_DEPTH<z>         blindhul fra denne flade
    POCKET_D<d>_DEPTH<z>        rund lomme fra denne flade
    SLOT_W<w>_DEPTH<z>          slids (lukket kontur) fra denne flade
    RABBET_DEPTH<z>             not (lukket kontur) fra denne flade
    CSK_D<d>_<ang>DEG           forsaenkning (cirkel = diameter i overfladen) fra denne flade
    NOTES                       tekst: del, flade, tykkelse, materiale, antagelser
    OTHER_FACE_REF              (kun reference, tynd) features paa modsatte flade, spejlet ind
Et hul der gaar gennem pladen ligger i DXF'en for den flade hvor det skal bores (vores valg: samme
flade som lommerne, saa pladen kun vendes een gang).
"""

import math
import os
import sys

HER = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
sys.path.insert(0, HER)

import ezdxf
from ezdxf.enums import TextEntityAlignment

import locker_params as LP


def fmt(x):
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", "p")


class Sheet:
    """En DXF for een flade af een del. u = vandret, v = lodret, som set fra fladen."""

    def __init__(self, p, face):
        self.p, self.face = p, face
        self.doc = ezdxf.new("R2013", setup=True)
        self.doc.header["$INSUNITS"] = 4
        self.doc.header["$MEASUREMENT"] = 1
        self.msp = self.doc.modelspace()
        self.layers = {}

    def layer(self, name, color=7, lw=25):
        if name not in self.layers:
            self.doc.layers.add(name, color=color, lineweight=lw)
            self.layers[name] = True
        return name

    def uv(self, a, b):
        """Lokalt (a, b) -> ark (u, v). Set fra '-' spejles a."""
        return (a, b) if self.face == "+" else (self.p.A - a, b)

    def circle(self, a, b, d, lay):
        u, v = self.uv(a, b)
        self.msp.add_circle((u, v), d / 2, dxfattribs={"layer": lay})

    def rounded_rect(self, a0, b0, a1, b1, r, lay):
        """Lukket LWPOLYLINE med bulge-hjoerner. Klippes ikke - kald med vaerdier inden for pladen."""
        u0, _ = self.uv(a0, b0); u1, _ = self.uv(a1, b1)
        u0, u1 = min(u0, u1), max(u0, u1)
        r = min(r, (u1 - u0) / 2, (b1 - b0) / 2)
        if r <= 1e-9:
            self.msp.add_lwpolyline([(u0, b0), (u1, b0), (u1, b1), (u0, b1)], close=True, dxfattribs={"layer": lay})
            return
        # Mod uret. Bulge sidder paa det punkt der STARTER buen (tan(vinkel/4); 90 grader -> 0.414, 180 -> 1).
        b90 = math.tan(math.radians(90) / 4)
        raw = [
            (u0 + r, b0, 0), (u1 - r, b0, b90),      # bund, saa bue op om nederste hoejre hjoerne
            (u1, b0 + r, 0), (u1, b1 - r, b90),      # hoejre side, bue om oeverste hoejre
            (u1 - r, b1, 0), (u0 + r, b1, b90),      # top, bue om oeverste venstre
            (u0, b1 - r, 0), (u0, b0 + r, b90),      # venstre side, bue om nederste venstre (lukker)
        ]
        pts = []
        for x, y, bl in raw:
            if pts and abs(pts[-1][0] - x) < 1e-9 and abs(pts[-1][1] - y) < 1e-9:
                # nul-laengde lige stykke (stadion-form): to 90-graders buer bliver een 180-graders bue
                pts[-1] = (x, y, 0, 0, 1.0 if bl else pts[-1][4])
                continue
            pts.append((x, y, 0, 0, bl))
        if abs(pts[-1][0] - pts[0][0]) < 1e-9 and abs(pts[-1][1] - pts[0][1]) < 1e-9:
            pts[0] = (pts[0][0], pts[0][1], 0, 0, 1.0)
            pts.pop()
        self.msp.add_lwpolyline(pts, format="xyseb", close=True, dxfattribs={"layer": lay})

    def text(self, u, v, s, h=5, lay="NOTES"):
        self.msp.add_text(s, height=h, dxfattribs={"layer": lay}).set_placement((u, v), align=TextEntityAlignment.LEFT)

    def save(self, path):
        self.doc.saveas(path)


def contour(sh, p):
    """Yderkontur med udsparinger (notches) langs kant a1."""
    lay = sh.layer("CONTOUR", color=1, lw=35)
    A, B = p.A, p.B
    notches = sorted(p.notches, key=lambda n: n["b"])
    if not notches:
        sh.msp.add_lwpolyline([sh.uv(0, 0), sh.uv(A, 0), sh.uv(A, B), sh.uv(0, B)], close=True, dxfattribs={"layer": lay})
        return
    # kontur mod uret i lokalt (a,b): (0,0) -> (A,0) -> op ad hoejre kant med notches -> (A,B) -> (0,B)
    bulge = math.tan(math.radians(90) / 4)
    pts = [(0, 0, 0), (A, 0, 0)]
    for n in notches:
        r, d = n["r"], n["depth"]
        b0, b1 = n["b"] - n["length"] / 2, n["b"] + n["length"] / 2
        # ind i pladen ved b0, rundt hjoerne R ved bunden af udsparingen, op, rundt hjoerne, ud igen
        pts += [(A, b0, 0), (A - d + r, b0, -bulge), (A - d, b0 + r, 0), (A - d, b1 - r, -bulge), (A - d + r, b1, 0), (A, b1, 0)]
    pts += [(A, B, 0), (0, B, 0)]
    out = []
    for a, b, bl in pts:
        u, v = sh.uv(a, b)
        out.append((u, v, 0, 0, bl if sh.face == "+" else -bl))
    sh.msp.add_lwpolyline(out, format="xyseb", close=True, dxfattribs={"layer": lay})


def lock_profile(sh, p, lock, lay):
    """Firkant + fire dogbone-cirkler som separate entiteter (CAM: union = lomme gennem)."""
    h, centres, r = LP.lock_profile(lock["a"], lock["b"])
    sh.rounded_rect(lock["a"] - h, lock["b"] - h, lock["a"] + h, lock["b"] + h, 0, lay)
    for cx, cy in centres:
        sh.circle(cx, cy, 2 * r, lay)


def features_on(sh, p, face, ref=False):
    """Tegn alle features der bearbejdes fra 'face'. ref=True: som reference paa den anden flade."""
    def L(name, color, lw=25):
        if ref:
            return sh.layer("OTHER_FACE_REF", color=8, lw=9)
        return sh.layer(name, color, lw)

    T = p.T
    thru_here = (face == p.thru_face)
    if thru_here or ref:
        for hh in p.holes:
            if hh["depth"] is None:
                sh.circle(hh["a"], hh["b"], hh["d"], L(f"THRU_D{fmt(hh['d'])}", 3))
        if p.lock:
            lock_profile(sh, p, p.lock, L("THRU_LOCK_SQ15p5_DOGBONE_R4", 3))
    for hh in p.holes:
        if hh["depth"] is not None and hh["face"] == face:
            sh.circle(hh["a"], hh["b"], hh["d"], L(f"BLIND_D{fmt(hh['d'])}_DEPTH{fmt(hh['depth'])}", 4))
    for pk in p.pockets:
        if pk["face"] == face:
            sh.circle(pk["a"], pk["b"], pk["d"], L(f"POCKET_D{fmt(pk['d'])}_DEPTH{fmt(pk['depth'])}", 5))
    for s in p.slots:
        if s["face"] == face:
            w = s["w"] / 2
            sh.rounded_rect(s["a"] - w, s["b0"], s["a"] + w, s["b1"], w, L(f"SLOT_W{fmt(s['w'])}_DEPTH{fmt(s['depth'])}", 5))
    for rb in p.rabbets:
        if rb["face"] == face:
            w = rb["width"]
            a0, b0, a1, b1 = {"a0": (0, 0, w, p.B), "a1": (p.A - w, 0, p.A, p.B), "b0": (0, 0, p.A, w), "b1": (0, p.B - w, p.A, p.B)}[rb["edge"]]
            sh.rounded_rect(a0, b0, a1, b1, 0, L(f"RABBET_DEPTH{fmt(rb['depth_t'])}", 6))
    for c in p.csk:
        if c["face"] == face:
            sh.circle(c["a"], c["b"], LP.P["CSK_D_TOP"], L(f"CSK_D{fmt(LP.P['CSK_D_TOP'])}_{LP.P['CSK_ANGLE']}DEG", 2))
        if thru_here or ref:
            sh.circle(c["a"], c["b"], LP.P["CSK_D_THRU"], L(f"THRU_D{fmt(LP.P['CSK_D_THRU'])}", 3))


def faces_needed(p):
    """Hvilke flader har bearbejdning? Gennemgaaende hul laegges paa 'thru_face'."""
    f = set()
    for hh in p.holes:
        if hh["depth"] is not None:
            f.add(hh["face"])
    for coll in (p.pockets, p.slots, p.rabbets, p.csk):
        for x in coll:
            f.add(x["face"])
    has_thru = any(h["depth"] is None for h in p.holes) or p.lock or p.notches or p.csk
    if not f:
        f.add("+")
    # gennemgaaende paa den flade med flest blinde operationer ('-' for laage = bagside, '+' for sider = inderside)
    counts = {fc: 0 for fc in f}
    for hh in p.holes:
        if hh["depth"] is not None:
            counts[hh["face"]] += 1
    for coll in (p.pockets, p.slots, p.rabbets):
        for x in coll:
            counts[x["face"]] += 1
    # har delen forsaenkninger, bores gennem fra samme flade (forsaenkbor tager begge i een operation)
    if p.csk:
        p.thru_face = p.csk[0]["face"]
    else:
        p.thru_face = max(counts, key=counts.get) if has_thru else None
    return sorted(f, key=lambda x: 0 if x == p.thru_face else 1)


FACE_NAME = {"+": "faceA_plus", "-": "faceB_minus"}


def write_part(p, out, variant):
    written = []
    faces = faces_needed(p)
    for face in faces:
        sh = Sheet(p, face)
        sh.layer("NOTES", 7, 13)
        contour(sh, p)
        features_on(sh, p, face)
        other = "-" if face == "+" else "+"
        if other in faces:
            features_on(sh, p, other, ref=True)
        # noter
        y = p.B + 12
        lines = [
            f"{p.dwg}  {p.navn}  |  {p.A:g} x {p.B:g} x {p.T:g} mm  |  {p.materiale}",
            f"VIEW FROM FACE {face} ({'inside/front' if face == '+' else 'outside/back'}) - origin lower-left as seen from this face. Units mm. DXF R2013.",
            f"Machine from this face: layers CONTOUR{', THRU_*' if face == p.thru_face else ''}, BLIND_*, POCKET_*, SLOT_*, RABBET_*, CSK_*.  OTHER_FACE_REF = flip part.",
            "FOR REVIEW - reconstructed from Fusion drawings 006.001.xxx (Milot Salihu). Verify against Fusion model before cutting.",
        ] + p.noter
        for i, s in enumerate(lines):
            sh.text(0, y + (len(lines) - 1 - i) * 7, s, h=4.5 if i else 6)
        # kantboringer som tekstliste
        if p.edge_holes:
            sh.text(0, -10, "EDGE DRILLING: " + "; ".join(
                f"edge {eh['edge']} @b={eh['pos_b']:g} t={eh['t']:g} O{eh['d']:g}x{eh['depth']:g}" for eh in p.edge_holes), h=3.5)
        name = f"{p.dwg}_{FACE_NAME[face]}.dxf" if len(faces) > 1 else f"{p.dwg}.dxf"
        path = os.path.join(out, name)
        sh.save(path)
        written.append(path)
        print(f"[dxf] {name:40s} entities={len(sh.msp)}")
    return written


def main():
    out = os.environ.get("LOCKER_OUT", os.path.join(HER, "out"))
    os.makedirs(out, exist_ok=True)
    done = set()
    for v in os.environ.get("LOCKER_VARIANTS", "1,2").split(","):
        for p in LP.unique_parts(int(v)):
            if p.dwg in done:
                continue
            done.add(p.dwg)
            write_part(p, out, int(v))
    print(f"[dxf] skrevet til {out}")


main()
