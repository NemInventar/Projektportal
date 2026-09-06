# -*- coding: utf-8 -*-
"""
Part2D -> DXF pr. bearbejdningsflade (CNC). Samme konvention som Fusions 'Machining template'-DXF'er:
R2013, mm, origo = nederste venstre hjoerne SET FRA DEN FLADE DER BEARBEJDES.

Lag = operation: CONTOUR, THRU_D<d>, BLIND_D<d>_DEPTH<z>, POCKET_D<d>_DEPTH<z>, SLOT_W<w>_DEPTH<z>,
RABBET_DEPTH<z>, CSK_D<d>_<ang>DEG, NOTES, OTHER_FACE_REF (den anden flade spejlet ind, tynd).
"""

import math
import os

import ezdxf
from ezdxf.enums import TextEntityAlignment


def fmt(x):
    return f"{x:.2f}".rstrip("0").rstrip(".").replace(".", "p")


class Sheet:
    def __init__(self, p, face):
        self.p, self.face = p, face
        self.doc = ezdxf.new("R2013", setup=True)
        self.doc.header["$INSUNITS"] = 4
        self.doc.header["$MEASUREMENT"] = 1
        self.msp = self.doc.modelspace()
        self.layers = set()

    def layer(self, name, color=7, lw=25):
        if name not in self.layers:
            self.doc.layers.add(name, color=color, lineweight=lw); self.layers.add(name)
        return name

    def uv(self, a, b):
        return (a, b) if self.face == "+" else (self.p.A - a, b)

    def circle(self, a, b, d, lay):
        u, v = self.uv(a, b)
        self.msp.add_circle((u, v), d / 2, dxfattribs={"layer": lay})

    def rounded_rect(self, a0, b0, a1, b1, r, lay):
        u0, _ = self.uv(a0, b0); u1, _ = self.uv(a1, b1)
        u0, u1 = min(u0, u1), max(u0, u1)
        r = min(r, (u1 - u0) / 2, (b1 - b0) / 2)
        if r <= 1e-9:
            self.msp.add_lwpolyline([(u0, b0), (u1, b0), (u1, b1), (u0, b1)], close=True, dxfattribs={"layer": lay}); return
        b90 = math.tan(math.radians(90) / 4)
        raw = [(u0 + r, b0, 0), (u1 - r, b0, b90), (u1, b0 + r, 0), (u1, b1 - r, b90),
               (u1 - r, b1, 0), (u0 + r, b1, b90), (u0, b1 - r, 0), (u0, b0 + r, b90)]
        pts = []
        for x, y, bl in raw:
            if pts and abs(pts[-1][0] - x) < 1e-9 and abs(pts[-1][1] - y) < 1e-9:
                pts[-1] = (x, y, 0, 0, 1.0 if bl else pts[-1][4]); continue
            pts.append((x, y, 0, 0, bl))
        if abs(pts[-1][0] - pts[0][0]) < 1e-9 and abs(pts[-1][1] - pts[0][1]) < 1e-9:
            pts[0] = (pts[0][0], pts[0][1], 0, 0, 1.0); pts.pop()
        self.msp.add_lwpolyline(pts, format="xyseb", close=True, dxfattribs={"layer": lay})

    def text(self, u, v, s, h=5, lay="NOTES"):
        self.msp.add_text(s, height=h, dxfattribs={"layer": lay}).set_placement((u, v), align=TextEntityAlignment.LEFT)


def contour(sh, p):
    lay = sh.layer("CONTOUR", color=1, lw=35)
    A, B = p.A, p.B
    notches = sorted(p.notches, key=lambda n: n["b"])
    if not notches:
        sh.msp.add_lwpolyline([sh.uv(0, 0), sh.uv(A, 0), sh.uv(A, B), sh.uv(0, B)], close=True, dxfattribs={"layer": lay}); return
    bulge = math.tan(math.radians(90) / 4)
    pts = [(0, 0, 0), (A, 0, 0)]
    for n in notches:
        r, d = n["r"], n["depth"]
        b0, b1 = n["b"] - n["length"] / 2, n["b"] + n["length"] / 2
        pts += [(A, b0, 0), (A - d + r, b0, -bulge), (A - d, b0 + r, 0), (A - d, b1 - r, -bulge), (A - d + r, b1, 0), (A, b1, 0)]
    pts += [(A, B, 0), (0, B, 0)]
    out = [(*sh.uv(a, b), 0, 0, bl if sh.face == "+" else -bl) for a, b, bl in pts]
    sh.msp.add_lwpolyline(out, format="xyseb", close=True, dxfattribs={"layer": lay})


def features_on(sh, p, face, csk_spec, ref=False):
    def L(name, color, lw=25):
        return sh.layer("OTHER_FACE_REF", 8, 9) if ref else sh.layer(name, color, lw)
    thru_here = (face == p.thru_face)
    if thru_here or ref:
        for h in p.holes:
            if h["depth"] is None:
                sh.circle(h["a"], h["b"], h["d"], L(f"THRU_D{fmt(h['d'])}", 3))
    for h in p.holes:
        if h["depth"] is not None and h["face"] == face:
            sh.circle(h["a"], h["b"], h["d"], L(f"BLIND_D{fmt(h['d'])}_DEPTH{fmt(h['depth'])}", 4))
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
    if p.csk:
        d_thru, d_top, ang = csk_spec
        for c in p.csk:
            if c["face"] == face:
                sh.circle(c["a"], c["b"], d_top, L(f"CSK_D{fmt(d_top)}_{ang:g}DEG", 2))
            if thru_here or ref:
                sh.circle(c["a"], c["b"], d_thru, L(f"THRU_D{fmt(d_thru)}", 3))


def faces_needed(p):
    f = set(h["face"] for h in p.holes if h["depth"] is not None)
    for coll in (p.pockets, p.slots, p.rabbets, p.csk):
        f |= set(x["face"] for x in coll)
    has_thru = any(h["depth"] is None for h in p.holes) or p.notches or p.csk
    if not f:
        f.add("+")
    counts = {fc: 0 for fc in f}
    for h in p.holes:
        if h["depth"] is not None:
            counts[h["face"]] += 1
    for coll in (p.pockets, p.slots, p.rabbets):
        for x in coll:
            counts[x["face"]] += 1
    p.thru_face = p.csk[0]["face"] if p.csk else (max(counts, key=counts.get) if has_thru else None)
    return sorted(f, key=lambda x: 0 if x == p.thru_face else 1)


FACE_NAME = {"+": "faceA_plus", "-": "faceB_minus"}


def write_part(p, out, csk_spec, status_line):
    written = []
    faces = faces_needed(p)
    for face in faces:
        sh = Sheet(p, face)
        sh.layer("NOTES", 7, 13)
        contour(sh, p)
        features_on(sh, p, face, csk_spec)
        other = "-" if face == "+" else "+"
        if other in faces:
            features_on(sh, p, other, csk_spec, ref=True)
        lines = [f"{p.dwg}  {p.navn}  |  {p.A:g} x {p.B:g} x {p.T:g} mm  |  {p.materiale}",
                 f"VIEW FROM FACE {face} ({'inside/front' if face == '+' else 'outside/back'}) - origin lower-left as seen from this face. Units mm. DXF R2013.",
                 f"Machine from this face: CONTOUR{', THRU_*' if face == p.thru_face else ''}, BLIND_*, POCKET_*, SLOT_*, RABBET_*, CSK_*.  OTHER_FACE_REF = flip part.",
                 status_line] + p.noter
        y = p.B + 12
        for i, s in enumerate(lines):
            sh.text(0, y + (len(lines) - 1 - i) * 7, s, h=4.5 if i else 6)
        if p.edge_holes:
            sh.text(0, -10, "EDGE DRILLING: " + "; ".join(f"edge {eh['edge']} @{eh['pos_b']:g} t={eh['t']:g} O{eh['d']:g}x{eh['depth']:g}" for eh in p.edge_holes), h=3.5)
        name = f"{p.dwg}_{FACE_NAME[face]}.dxf" if len(faces) > 1 else f"{p.dwg}.dxf"
        sh.doc.saveas(os.path.join(out, name))
        written.append(name)
    return written
