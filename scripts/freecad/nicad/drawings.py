# -*- coding: utf-8 -*-
"""
Produktionstegninger: eet ark pr. del + samlingsark. Layout som Milots Fusion-ark.
Maal skrives fra parametrene (Part2D-features), ikke aflaest af geometrien.
"""

import math

import FreeCAD as App
import Part

from . import views
from .sheet import Page, FRAME

SCALES = [1, 2, 2.5, 5, 10, 20]      # 1:S


def pick_scale(w_mm, h_mm, w_max, h_max):
    for S in SCALES:
        if w_mm / S <= w_max and h_mm / S <= h_max:
            return S
    return SCALES[-1]


def scale_txt(S):
    return f"1:{S:g}"


def _groups(p):
    """Grupper af huller/lommer til maalsaetning: navn -> (liste af (a,b), beskrivelse)."""
    g = {}
    for h in p.holes:
        key = h.get("group") or f"Ø{h['d']:g}"
        g.setdefault(key, []).append((h["a"], h["b"]))
    for pk in p.pockets:
        key = pk.get("group") or f"pocket Ø{pk['d']:g}"
        g.setdefault(key, []).append((pk["a"], pk["b"]))
    if p.csk:
        g["csk"] = [(c["a"], c["b"]) for c in p.csk]
    return g


def _chain(page, view, positions, axis, level, total, side="left"):
    """Kaede af maal langs en akse: kant -> foerste, foerste -> anden, anden -> sidste.
    Regulaer deling skrives som 'n x pitch = span'. side='right' laegger lodrette kaeder til hoejre for visningen."""
    pos = sorted(set(round(x, 2) for x in positions))
    chain = [0.0] + pos[:2] + ([pos[-1]] if len(pos) > 2 else [])
    regular = len(pos) > 2 and all(abs((pos[i + 1] - pos[i]) - (pos[1] - pos[0])) < 0.05 for i in range(len(pos) - 1))
    labels = []
    for i, (x1, x2) in enumerate(zip(chain, chain[1:])):
        if x2 - x1 < 0.01:
            continue
        txt = f"{x2 - x1:g}"
        if i == 2 and regular:
            txt = f"{len(pos) - 2}x {pos[1] - pos[0]:g} = {x2 - x1:g}"
        labels.append((x1, x2, txt))
    for x1, x2, txt in labels:
        if axis == "a":
            y = view.Y(view.v0) + 10 + 8 * level
            page.dim_h(view.X(x1), view.X(x2), view.Y(view.v0), y, txt)
        elif side == "left":
            x = view.X(view.u0) - 10 - 8 * level
            page.dim_v(view.Y(x1), view.Y(x2), view.X(view.u0), x, txt)
        else:
            x = view.X(view.u1) + 10 + 8 * level
            page.dim_v(view.Y(x1), view.Y(x2), view.X(view.u1), x, txt)


def part_sheet(p, solid, cab, meta, sheet_no, sheet_of):
    page = Page()
    page.frame()
    c = cab.c
    T = p.T
    faces = []
    feats_plus = [h for h in p.holes if h["face"] == "+" and h["depth"] is not None] + [x for x in p.pockets + p.slots + p.rabbets if x["face"] == "+"]
    feats_minus = [h for h in p.holes if h["face"] == "-" and h["depth"] is not None] + [x for x in p.pockets + p.slots + p.rabbets if x["face"] == "-"] + [x for x in p.csk if x["face"] == "-"]
    faces.append("+")
    if feats_minus:
        faces.append("-")

    # skala: alle visninger paa een raekke: A + (A hvis to flader) + T + mellemrum, hoejde B
    n_a = len(faces)
    S = pick_scale(p.A * n_a + T + 40 * n_a, p.B, 215, 205)
    x = 42.0
    y_top = 46.0
    vws = {}
    for face in faces:
        k = views.project(solid, (0, 0, -1) if face == "+" else (0, 0, 1), (0, 1, 0))
        vw = views.View(k, 1.0 / S, x, y_top)
        vw.draw(page)
        vws[face] = vw
        label = ("FACE + (inside)" if face == "+" else "FACE - (outside)") if p.dwg.endswith((".002", ".003", ".004")) else ("FACE + (front)" if face == "+" else "FACE - (back)")
        page.text(x, y_top - 14, f"{label}  {scale_txt(S)}", size=3.2, bold=True)
        x += vw.w + 40
    # kantvisning (tykkelse), set langs -a fra a=A siden
    k = views.project(solid, (-1, 0, 0), (0, 1, 0))
    ve = views.View(k, 1.0 / S, x, y_top)
    ve.draw(page)
    page.text(x, y_top - 14, f"EDGE  {scale_txt(S)}", size=3.2, bold=True)
    page.dim_h(ve.X(ve.u0), ve.X(ve.u1), ve.Y(ve.v1), ve.Y(ve.v1) - 6, f"{T:g}")
    x_call = x + ve.w + 12                       # kolonne til henvisninger, hoejre for alle visninger

    # hovedmaal paa foerste visning
    v0 = vws["+"]
    page.dim_h(v0.X(0), v0.X(p.A), v0.Y(0), v0.Y(0) + 10, f"{p.A:g}")
    page.dim_v(v0.Y(0), v0.Y(p.B), v0.X(0), v0.X(0) - 10, f"{p.B:g}")

    # grupper: kaedemaal + henvisning, paa den flade de sidder paa
    groups = _groups(p)
    level = {"+": 1, "-": 1}
    vlevel = {("+", "left"): 1, ("+", "right"): 0, ("-", "left"): 0, ("-", "right"): 0}
    ncall = 0
    for name, pts in groups.items():
        face = None
        for h in p.holes + p.pockets:
            if (h.get("group") or f"Ø{h['d']:g}") == name or (h in p.pockets and (h.get("group") or f"pocket Ø{h['d']:g}") == name):
                face = h["face"] if h["depth"] is not None else "+"; break
        if name == "csk":
            face = "-"
        if face not in vws:
            face = "+"
        vw = vws[face]
        # spejlet flade: a maales fra den kant der er til venstre i visningen
        def A_(a):
            return a if face == "+" else p.A - a
        if not name.endswith("_pilot"):          # forboringer maalsaettes i detaljen, ikke paa hovedvisningen
            _chain(page, vw, [A_(a) for a, _ in pts], "a", level[face], p.A)
            # lodrette kaeder skiftevis venstre/hoejre for visningen, saa de ikke klumper
            side = "left" if vlevel[(face, "left")] <= vlevel[(face, "right")] else "right"
            _chain(page, vw, [b for _, b in pts], "b", vlevel[(face, side)], p.B, side=side)
            vlevel[(face, side)] += 1
            level[face] += 1
        desc = p.groups.get(name, name)
        a0, b0 = max(pts, key=lambda q: (q[1], -q[0]))
        ty = y_top + 4 + 9 * ncall
        page.callout(vw.X(A_(a0)), vw.Y(b0), x_call, ty, [desc])
        ncall += 1

    # not (rabbet): henvisning + snit-detalje 2:1
    dx, dy = 272.0, 30.0
    if p.rabbets:
        rb = p.rabbets[0]
        w, dt = rb["width"], rb["depth_t"]
        page.text(dx, dy - 4, "DETAIL A  rabbet for back panel  2:1", size=3.2, bold=True)
        s2 = 2.0
        L = 40.0
        # snit: plade set fra kanten, inderside (+) opad
        x0, y0 = dx, dy + 2
        pts = [(x0, y0 + T * s2), (x0, y0), (x0 + L * s2, y0), (x0 + L * s2, y0 + (T - dt) * s2), (x0 + (L - w) * s2, y0 + (T - dt) * s2), (x0 + (L - w) * s2, y0 + T * s2), (x0, y0 + T * s2)]
        page.poly(pts, w=0.5)
        for i in range(0, int(L * s2), 3):
            xa = x0 + i
            ya = y0 + T * s2 if xa < x0 + (L - w) * s2 else y0 + (T - dt) * s2
            page.line(xa, ya, min(xa + 3, x0 + L * s2), max(ya - 3, y0), w=0.18)
        page.dim_h(x0 + (L - w) * s2, x0 + L * s2, y0 + T * s2, y0 + T * s2 - 8, f"{w:g}")
        page.dim_v(y0 + (T - dt) * s2, y0 + T * s2, x0 + L * s2, x0 + L * s2 + 8, f"{dt:g} +2/0")
        page.dim_v(y0, y0 + T * s2, x0, x0 - 8, f"{T:g}")
        page.text(x0, y0 + T * s2 + 8, "inside face  (back panel " + f"{c['T_back']:g} mm sits in rabbet, screwed)", size=2.5)
        dy += T * s2 + 30

    # haengselkop-detalje 1:1
    cups = [pk for pk in p.pockets if pk.get("group") == "hinge_cup"]
    if cups:
        cup = cups[0]
        page.text(dx, dy - 4, "DETAIL B  hinge cup, seen from back  1:1", size=3.2, bold=True)
        r = cup["d"] / 2
        edge_left = cup["a"] < p.A / 2          # kopcentret naermest a=0?
        # tegn et 90 x 70 udsnit af laagens bagside med kanten til venstre
        ex, ey = dx + 10, dy + 5
        edge_x = ex
        cx = edge_x + c["hinge_cup_edge"]
        cy = ey + 35
        page.line(edge_x, ey, edge_x, ey + 70, w=0.5)
        page.line(edge_x, ey, edge_x + 90, ey, w=0.18, dash="3 1.5"); page.line(edge_x, ey + 70, edge_x + 90, ey + 70, w=0.18, dash="3 1.5")
        page.circle(cx, cy, r, w=0.5)
        page.line(cx - r - 3, cy, cx + r + 3, cy, w=0.18, dash="6 1 1 1"); page.line(cx, cy - r - 3, cx, cy + r + 3, w=0.18, dash="6 1 1 1")
        px = cx + c["hinge_pilot_da"]
        for db in (-c["hinge_pilot_db"], c["hinge_pilot_db"]):
            page.circle(px, cy + db, c["hinge_pilot_d"] / 2, w=0.35)
        page.dim_h(edge_x, cx, cy - r, ey - 6, f"{c['hinge_cup_edge']:g}")
        page.dim_h(cx, px, cy + r, ey + 76, f"{c['hinge_pilot_da']:g}")
        page.dim_v(cy - c["hinge_pilot_db"], cy + c["hinge_pilot_db"], px, edge_x + 82, f"{2 * c['hinge_pilot_db']:g}")
        page.callout(cx + r * 0.7071, cy - r * 0.7071, cx + 30, cy - 28, [f"Ø{cup['d']:g} x {cup['depth']:g} deep"])
        page.callout(px + 1, cy + c["hinge_pilot_db"], px + 22, cy + 30, [f"2x Ø{c['hinge_pilot_d']:g} x {c['hinge_pilot_depth']:g}"])
        dy += 95

    # noter
    ny = max(dy, 150.0)
    lines = [f"1. Material: {p.materiale}. Qty per cabinet: {p.qty}.",
             "2. Face '+' / '-' as defined on the DXF. All blind depths from the face stated.",
             "3. General tolerances ISO 2768-m. Panel size ±0.5.",
             ] + [f"{i + 4}. {n}" for i, n in enumerate(p.noter)]
    ny += page.notes(272, ny, "NOTES", lines)

    # afledte maal (roed)
    ant = cab.antagelser()
    if ant:
        page.notes(272, min(ny + 6, 205), "DERIVED / ASSUMED - confirm before production", ant[:8], size=2.3, color="#8a1c1c")

    page.title_block(dict(meta, title=f"{p.navn}", dwg_no=p.dwg, sheet=f"{sheet_no}/{sheet_of}",
                          material=p.materiale, scale=f"{scale_txt(S)} (details 2:1, 1:1)"))
    return page


def assembly_sheet(cab, inst_shapes, meta, sheet_no, sheet_of):
    """inst_shapes = [(navn, part, shape_global)]."""
    page = Page()
    page.frame()
    c = cab.c
    W, H, D = c["W"], c["H"], c["D"]
    comp = Part.makeCompound([s for _, _, s in inst_shapes])
    S = pick_scale(W + D + 60, H, 190, 200)
    x, y_top = 40.0, 46.0
    # front
    kf = views.project(comp, (0, 1, 0), (0, 0, 1))
    vf = views.View(kf, 1.0 / S, x, y_top); vf.draw(page, hidden=False)
    page.text(x, y_top - 14, f"FRONT  {scale_txt(S)}", size=3.2, bold=True)
    page.dim_h(vf.X(0), vf.X(W), vf.Y(0), vf.Y(0) + 10, f"{W:g}")
    page.dim_v(vf.Y(0), vf.Y(H), vf.X(0), vf.X(0) - 10, f"{H:g}")
    if c["door"]:
        page.dim_h(vf.X(c["door_gap"]), vf.X(W - c["door_gap"]), vf.Y(H), vf.Y(H) - 8, f"{c['door_W']:g}")
    # side (set fra hoejre; front til venstre)
    x2 = x + vf.w + 30
    ks = views.project(comp, (-1, 0, 0), (0, 0, 1))
    vs = views.View(ks, 1.0 / S, x2, y_top); vs.draw(page, hidden=False)
    page.text(x2, y_top - 14, f"SIDE  {scale_txt(S)}", size=3.2, bold=True)
    page.dim_h(vs.X(vs.u0), vs.X(vs.u1), vs.Y(0), vs.Y(0) + 10, f"{vs.u1 - vs.u0:g}")
    page.dim_h(vs.X(vs.u1 - D), vs.X(vs.u1), vs.Y(H), vs.Y(H) - 8, f"{D:g}")
    # top
    x3 = x2 + vs.w + 30
    kt = views.project(comp, (0, 0, -1), (0, 1, 0))
    vt = views.View(kt, 1.0 / S, x3, y_top); vt.draw(page, hidden=False)
    page.text(x3, y_top - 14, f"TOP  {scale_txt(S)}", size=3.2, bold=True)
    page.dim_v(vt.Y(vt.v0), vt.Y(vt.v1), vt.X(vt.u1), vt.X(vt.u1) + 10, f"{vt.v1 - vt.v0:g}")
    # stykliste over titelfeltet
    bom = cab.bom()
    cols = [("Item", 12), ("Qty", 12), ("Part", 30), ("Description", 126)]
    rows = [list(r) for r in bom]
    th = 5.5 * (len(rows) + 2)
    tx, ty = FRAME[0] + FRAME[2] - 180, FRAME[1] + FRAME[3] - 45 - th - 2
    page.table(tx, ty, "Parts List", cols, rows, size=2.5, rh=5.5)

    # isometri: til hoejre for topvisningen, skaleret til pladsen over styklisten
    x4 = x3 + vt.w + 28
    ki = views.project(comp, (1, 1, -1), (0, 0, 1))
    u0, v0, u1, v1 = views.bbox(ki)
    S_i = pick_scale(u1 - u0, v1 - v0, FRAME[0] + FRAME[2] - x4 - 20, ty - y_top - 12)
    vi = views.View(ki, 1.0 / S_i, x4 + 8, y_top); vi.draw(page, hidden=False)
    page.text(x4, y_top - 14, f"ISOMETRIC  {scale_txt(S_i)}", size=3.2, bold=True)
    # balloner
    f = views.frame((1, 1, -1), (0, 0, 1))
    item_of = {dwg: it for it, _, dwg, _ in bom}
    k = 0
    for navn, p, shp in inst_shapes:
        bb = shp.BoundBox
        cen = App.Vector((bb.XMin + bb.XMax) / 2, (bb.YMin + bb.YMax) / 2, (bb.ZMin + bb.ZMax) / 2)
        if navn == "RightSide":
            cen = App.Vector(bb.XMax, bb.YMin + 0.6 * (bb.YMax - bb.YMin), bb.ZMin + 0.4 * (bb.ZMax - bb.ZMin))
        elif navn == "LeftSide":
            cen = App.Vector(bb.XMin, bb.YMin + 0.3 * (bb.YMax - bb.YMin), bb.ZMin + 0.6 * (bb.ZMax - bb.ZMin))
        elif navn == "Door":
            cen = App.Vector((bb.XMin + bb.XMax) / 2, bb.YMin, bb.ZMin + 0.45 * (bb.ZMax - bb.ZMin))
        elif navn == "Top":
            cen = App.Vector((bb.XMin + bb.XMax) / 2, (bb.YMin + bb.YMax) / 2, bb.ZMax)
        elif navn == "Back":
            cen = App.Vector((bb.XMin + bb.XMax) / 2, bb.YMax, bb.ZMin + 0.8 * (bb.ZMax - bb.ZMin))
        elif navn == "Bottom":
            cen = App.Vector((bb.XMin + bb.XMax) / 2, bb.YMin, bb.ZMin)
        u, v = f(cen)
        px, py = vi.X(u), vi.Y(v)
        right = navn in ("RightSide", "Back", "Top")
        bx = vi.X(vi.u1) + 12 if right else vi.X(vi.u0) - 12
        page.balloon(px, py, bx, py, item_of.get(p.dwg, "?"))
        k += 1

    # samlingsnoter
    steps = ["1. Rabbet sides and top/bottom, drill all holes per part drawings (sheets 2-6).",
             "2. Edge-band and finish visible faces before assembly.",
             f"3. Screw top and bottom between the sides: {len(c['screw_pos'])} screws per corner joint from the outside, countersunk.",
             f"4. Slide back panel ({c['back_W']:g} x {c['back_H']:g} x {c['T_back']:g}) into the rabbet, screw from behind.",
             f"5. Mount {c['hinge_count']} hinge plates on the {c['hinge_side']} side, hang door, adjust gaps to {c['door_gap']:g} mm.",
             "6. Handle and interior (shelves, rail) per order - not part of this drawing."]
    page.notes(FRAME[0] + 15, FRAME[1] + FRAME[3] - 62, "ASSEMBLY", steps, size=2.5)

    page.title_block(dict(meta, title=f"{c['title']} {W:g} x {H:g} x {D:g}", dwg_no=f"{c['dwg_prefix']}.000",
                          sheet=f"{sheet_no}/{sheet_of}", material=c["material"], scale=scale_txt(S)))
    return page
