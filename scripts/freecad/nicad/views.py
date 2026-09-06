# -*- coding: utf-8 -*-
"""
HLR-projektion af en FreeCAD-shape til 2D med styret orientering.

TechDraw.project(shape, retning) giver synlige og skjulte kanter i et 2D-plan hvis akser vi ikke
kender. Vi finder dem ved at projicere tre kendte linjestykker fra origo (laengde 1, 2, 3 langs
X, Y, Z) og loeser den 2x3-matrix der afbilder modelrummet i planet. Bagefter drejes planet saa
den oenskede 'op'-vektor peger op og hoejre er hoejre. Virker for alle retninger, ogsaa isometri.
"""

import math

import FreeCAD as App
import Part
import TechDraw

V = App.Vector


def _circle_fit(pts):
    """Algebraisk cirkelfit (Kasa). Returnerer (cx, cy, r) eller None hvis punkterne ikke ligger paa en cirkel."""
    n = len(pts)
    if n < 5:
        return None
    sx = sum(x for x, _ in pts) / n; sy = sum(y for _, y in pts) / n
    u = [x - sx for x, _ in pts]; v = [y - sy for _, y in pts]
    suu = sum(a * a for a in u); svv = sum(b * b for b in v); suv = sum(a * b for a, b in zip(u, v))
    suuu = sum(a ** 3 for a in u); svvv = sum(b ** 3 for b in v)
    suvv = sum(a * b * b for a, b in zip(u, v)); svuu = sum(b * a * a for a, b in zip(u, v))
    det = suu * svv - suv * suv
    if abs(det) < 1e-12:
        return None
    r1 = (suuu + suvv) / 2; r2 = (svvv + svuu) / 2
    uc = (r1 * svv - r2 * suv) / det; vc = (r2 * suu - r1 * suv) / det
    cx, cy = uc + sx, vc + sy
    ds = [math.hypot(x - cx, y - cy) for x, y in pts]
    r = sum(ds) / n
    if max(abs(d - r) for d in ds) > 0.02 * r + 1e-6:
        return None
    return cx, cy, r


def _frame(retning):
    """2x3-matrix: modelvektor -> planvektor.
    Fire kugler med forskellig radius (1,2,3,4) i P0, P0+L*X, P0+L*Y, P0+L*Z projiceres SAMLET
    (saa en evt. centrering er faelles). Kuglerne bliver cirkler med samme radius, saa de kan
    genkendes paa radius; centrene giver soejlerne."""
    P0 = V(10, 20, 30)
    L = 50.0
    d = V(*retning); d.normalize()
    # tynde skiver med normalen langs synsretningen -> projiceres som cirkler med samme radius
    skiver = [Part.makeCylinder(1.0, 0.1, P0, d), Part.makeCylinder(2.0, 0.1, P0 + V(L, 0, 0), d),
              Part.makeCylinder(3.0, 0.1, P0 + V(0, L, 0), d), Part.makeCylinder(4.0, 0.1, P0 + V(0, 0, L), d)]
    res = TechDraw.project(Part.makeCompound(skiver), d)
    centre = {}
    for s in res:
        if s.isNull():
            continue
        for e in s.Edges:
            fit = _circle_fit([(q.x, q.y) for q in e.discretize(Number=24)])
            if fit is None:
                continue
            cx, cy, rr = fit
            r = int(round(rr))
            if r in (1, 2, 3, 4) and abs(rr - r) < 0.05:
                centre.setdefault(r, (cx, cy))
    if 1 not in centre or len(centre) < 3:
        raise RuntimeError(f"projektionsramme kunne ikke bestemmes for {retning}: {centre}")
    ox, oy = centre[1]
    M = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
    for k, r in enumerate((2, 3, 4)):
        if r in centre:
            M[0][k], M[1][k] = (centre[r][0] - ox) / L, (centre[r][1] - oy) / L
    return M


class Frame:
    """model(p: App.Vector) -> (u, v)  og  plane(u_raw, v_raw) -> (u, v).
    Begge giver samme plan: 'op' peger mod +v, (retning x op) mod +u."""

    def __init__(self, retning, op=(0, 0, 1)):
        self.M = M = _frame(retning)

        def raw(p):
            return (M[0][0] * p.x + M[0][1] * p.y + M[0][2] * p.z, M[1][0] * p.x + M[1][1] * p.y + M[1][2] * p.z)
        self.raw = raw
        ou, ov = raw(V(*op))
        ang = math.atan2(ov, ou) - math.pi / 2
        self.c, self.s = math.cos(-ang), math.sin(-ang)
        hu, hv = raw(V(*retning).cross(V(*op)))
        self.flip = -1.0 if (self.c * hu - self.s * hv) < 0 else 1.0

    def plane(self, u, v):
        return (self.flip * (self.c * u - self.s * v), self.s * u + self.c * v)

    def model(self, p):
        return self.plane(*self.raw(p))

    def __call__(self, p):
        return self.model(p)


def frame(retning, op=(0, 0, 1)):
    return Frame(retning, op)


def project(shape, retning, op=(0, 0, 1)):
    """Liste af (punkter [(u,v),...], skjult: bool). Buer diskretiseres."""
    fr = Frame(retning, op)

    def f(p):                       # p er et raat punkt i TechDraws plan (x, y, 0)
        return fr.plane(p.x, p.y)
    res = TechDraw.project(shape, V(*retning))
    kanter = []
    n = len(res)                                  # FreeCAD 1.1: 4 grupper [synlig, synlig-omrids, skjult, skjult-omrids]
    for i, s in enumerate(res):
        if s.isNull():
            continue
        skjult = i >= n // 2
        for e in s.Edges:
            if e.Length <= 0:
                continue
            if isinstance(e.Curve, Part.Line):
                pts = [e.Vertexes[0].Point, e.Vertexes[-1].Point]
            else:
                pts = e.discretize(Number=max(8, min(48, int(e.Length / 2) + 8)))
            kanter.append(([f(p) for p in pts], skjult))
    return kanter


def bbox(kanter):
    us = [u for pts, _ in kanter for u, _ in pts]
    vs = [v for pts, _ in kanter for _, v in pts]
    return min(us), min(vs), max(us), max(vs)


class View:
    """En projektion placeret paa arket: model (u,v) -> papir (x,y) med skala S og y nedad."""

    def __init__(self, kanter, S, x0, y0):
        self.k = kanter
        self.S = S
        self.u0, self.v0, self.u1, self.v1 = bbox(kanter)
        self.x0, self.y0 = x0, y0                # papir for (u0, v1) = oeverste venstre hjoerne

    def X(self, u):
        return self.x0 + (u - self.u0) * self.S

    def Y(self, v):
        return self.y0 + (self.v1 - v) * self.S

    @property
    def w(self):
        return (self.u1 - self.u0) * self.S

    @property
    def h(self):
        return (self.v1 - self.v0) * self.S

    def draw(self, page, w_vis=0.5, w_hid=0.2, hidden=True):
        for pts, skjult in self.k:
            if skjult and not hidden:
                continue
            page.poly([(self.X(u), self.Y(v)) for u, v in pts], w=w_hid if skjult else w_vis, dash="1.2 0.8" if skjult else None)
