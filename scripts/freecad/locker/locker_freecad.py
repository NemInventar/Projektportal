# -*- coding: utf-8 -*-
"""
Locker 006.001.000 -> STEP (pr. del + samling) og FCStd. Koeres headless:

    FreeCADCmd.exe locker_freecad.py

Miljoevariable:
    LOCKER_OUT       output-mappe (default ./out)
    LOCKER_VARIANTS  "1,2" (default) - variant 1 = laas oeverst, variant 2 = laas nederst

Output pr. variant:
    006.001.00X[_v].step        hver unik del i eget lokale koordinatsystem (a, b, t) -> til Fusion/CNC
    006.001.000_v_assembly.step samling med alle dele placeret
    006.001.000_v.FCStd         FreeCAD-dokument: regneark 'Parametre' + dele + samling
    006.001.000_v_maal-og-kilder.json

Geometrien defineres i locker_params.py (rent Python). Dette script bygger kun solids.
Modellen er IKKE expression-bundet til regnearket (250+ features) - regenerer ved at koere igen.
"""

import datetime
import json
import math
import os
import sys

HER = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
sys.path.insert(0, HER)

import FreeCAD as App
import Import
import Part

import locker_params as LP

V = App.Vector
EPS = 1.0  # overskud saa boolske snit gaar rent igennem overflader


# ---------------------------------------------------------------------------
# Feature-solids i lokalt (a, b, t)
# ---------------------------------------------------------------------------

def t_range(T, depth, face):
    """(t0, hoejde) for et vaerktoej der gaar 'depth' ind fra face. depth=None -> gennem."""
    if depth is None:
        return -EPS, T + 2 * EPS
    if face == "+":
        return T - depth, depth + EPS
    return -EPS, depth + EPS


def cyl(a, b, d, T, depth, face):
    t0, h = t_range(T, depth, face)
    return Part.makeCylinder(d / 2, h, V(a, b, t0))


def csk_tool(a, b, T, face):
    """O5 gennem + 100-graders forsaenkning fra face."""
    thru = Part.makeCylinder(LP.P["CSK_D_THRU"] / 2, T + 2 * EPS, V(a, b, -EPS))
    h = LP.csk_cone_height()
    half = math.radians(LP.P["CSK_ANGLE"] / 2)
    r_top = LP.P["CSK_D_TOP"] / 2 + EPS * math.tan(half)
    if face == "-":
        cone = Part.makeCone(r_top, LP.P["CSK_D_THRU"] / 2, h + EPS, V(a, b, -EPS))
    else:
        cone = Part.makeCone(LP.P["CSK_D_THRU"] / 2, r_top, h + EPS, V(a, b, T - h))
    return thru.fuse(cone)


def rounded_rect(a0, b0, a1, b1, r):
    """Lukket wire: rektangel med R-hjoerner, i planen t=0."""
    pts = []
    edges = []
    corners = [(a0 + r, b0 + r, 180, 270), (a1 - r, b0 + r, 270, 360), (a1 - r, b1 - r, 0, 90), (a0 + r, b1 - r, 90, 180)]
    arcs = []
    for cx, cy, s, e in corners:
        c = Part.Circle(V(cx, cy, 0), V(0, 0, 1), r)
        arcs.append(Part.ArcOfCircle(c, math.radians(s), math.radians(e)).toShape())
    lines = [
        Part.LineSegment(V(a0 + r, b0, 0), V(a1 - r, b0, 0)).toShape(),
        Part.LineSegment(V(a1, b0 + r, 0), V(a1, b1 - r, 0)).toShape(),
        Part.LineSegment(V(a1 - r, b1, 0), V(a0 + r, b1, 0)).toShape(),
        Part.LineSegment(V(a0, b1 - r, 0), V(a0, b0 + r, 0)).toShape(),
    ]
    return Part.Wire(Part.__sortEdges__(arcs + lines))


def prism(wire, t0, h):
    f = Part.Face(wire)
    f.translate(V(0, 0, t0))
    return f.extrude(V(0, 0, h))


def slot_tool(s, T):
    t0, h = t_range(T, s["depth"], s["face"])
    w = s["w"] / 2
    return prism(rounded_rect(s["a"] - w, s["b0"], s["a"] + w, s["b1"], w - 1e-6), t0, h)


def rabbet_tool(rb, A, B, T):
    w, dt = rb["width"], rb["depth_t"]
    t0, h = (T - dt, dt + EPS) if rb["face"] == "+" else (-EPS, dt + EPS)
    if rb["edge"] == "a0":
        return Part.makeBox(w + EPS, B + 2 * EPS, h, V(-EPS, -EPS, t0))
    if rb["edge"] == "a1":
        return Part.makeBox(w + EPS, B + 2 * EPS, h, V(A - w, -EPS, t0))
    if rb["edge"] == "b0":
        return Part.makeBox(A + 2 * EPS, w + EPS, h, V(-EPS, -EPS, t0))
    return Part.makeBox(A + 2 * EPS, w + EPS, h, V(-EPS, B - w, t0))


def notch_tool(n, A, B, T):
    """Udsparing fra kant a1 (hoejre), dybde ind i a, laengde langs b, R i de indvendige hjoerner.
    Tegnes som afrundet rektangel der rager ud over kanten, saa kun de indvendige hjoerner er runde."""
    r = n["r"]
    a0 = A - n["depth"]
    a1 = A + 2 * r + EPS
    b0, b1 = n["b"] - n["length"] / 2, n["b"] + n["length"] / 2
    return prism(rounded_rect(a0, b0, a1, b1, r), -EPS, T + 2 * EPS)


def lock_tool(lock, T):
    h, centres, r = LP.lock_profile(lock["a"], lock["b"])
    sq = Part.makeBox(2 * h, 2 * h, T + 2 * EPS, V(lock["a"] - h, lock["b"] - h, -EPS))
    for cx, cy in centres:
        sq = sq.fuse(Part.makeCylinder(r, T + 2 * EPS, V(cx, cy, -EPS)))
    return sq


def edge_hole_tool(eh, A):
    """Boring i kanten a0 eller a1, ind langs a."""
    d, depth = eh["d"], eh["depth"]
    if eh["edge"] == "a0":
        return Part.makeCylinder(d / 2, depth + EPS, V(-EPS, eh["pos_b"], eh["t"]), V(1, 0, 0))
    return Part.makeCylinder(d / 2, depth + EPS, V(A + EPS, eh["pos_b"], eh["t"]), V(-1, 0, 0))


def build_part(p):
    A, B, T = p.A, p.B, p.T
    solid = Part.makeBox(A, B, T)
    tools = []
    for rb in p.rabbets:
        tools.append(rabbet_tool(rb, A, B, T))
    for n in p.notches:
        tools.append(notch_tool(n, A, B, T))
    if p.lock:
        tools.append(lock_tool(p.lock, T))
    for pk in p.pockets:
        tools.append(cyl(pk["a"], pk["b"], pk["d"], T, pk["depth"], pk["face"]))
    for s in p.slots:
        tools.append(slot_tool(s, T))
    for c in p.csk:
        tools.append(csk_tool(c["a"], c["b"], T, c["face"]))
    for hh in p.holes:
        tools.append(cyl(hh["a"], hh["b"], hh["d"], T, hh["depth"], hh["face"]))
    for eh in p.edge_holes:
        tools.append(edge_hole_tool(eh, A))
    if tools:
        alle = tools[0].multiFuse(tools[1:]) if len(tools) > 1 else tools[0]
        solid = solid.cut(alle)
    solid = solid.removeSplitter()
    return solid, len(tools)


def placement(M, t):
    m = App.Matrix()
    (m.A11, m.A12, m.A13), (m.A21, m.A22, m.A23), (m.A31, m.A32, m.A33) = M
    m.A14, m.A24, m.A34 = t
    return App.Placement(m)


# ---------------------------------------------------------------------------
# Koersel
# ---------------------------------------------------------------------------

def run_variant(variant, out):
    dato = datetime.date.today().isoformat()
    doc = App.newDocument(f"Locker_{variant}")

    ark = doc.addObject("Spreadsheet::Sheet", "Parametre")
    ark.set("A1", "Parameter"); ark.set("B1", "mm"); ark.set("C1", "Kilde"); ark.set("D1", "Forklaring")
    for i, (navn, (vaerdi, kilde, forkl)) in enumerate(LP.PARAMETRE.items(), start=2):
        ark.set(f"A{i}", navn); ark.set(f"B{i}", str(vaerdi)); ark.set(f"C{i}", kilde); ark.set(f"D{i}", forkl)

    parts_json = []
    shapes = {}
    for p in LP.unique_parts(variant):
        shape, n = build_part(p)
        ok = shape.isValid() and len(shape.Solids) == 1
        bb = shape.BoundBox
        vol_box = p.A * p.B * p.T
        print(f"[locker] {p.dwg:16s} {p.A:g}x{p.B:g}x{p.T:g}  features={n:3d}  solids={len(shape.Solids)}  "
              f"gyldig={shape.isValid()}  fjernet={vol_box - shape.Volume:.0f} mm3 ({100 * (vol_box - shape.Volume) / vol_box:.1f} %)")
        assert ok, f"{p.dwg}: ikke eet gyldigt legeme"
        assert abs(bb.XLength - p.A) < 1e-6 and abs(bb.YLength - p.B) < 1e-6 and abs(bb.ZLength - p.T) < 1e-6, f"{p.dwg}: bbox {bb}"
        obj = doc.addObject("Part::Feature", p.dwg.replace(".", "_"))
        obj.Shape = shape
        obj.Label = f"{p.dwg} {p.navn}"
        shapes[p.dwg] = shape
        Import.export([obj], os.path.join(out, f"{p.dwg}.step"))
        d = p.as_dict()
        d.update(volume_mm3=round(shape.Volume), removed_mm3=round(vol_box - shape.Volume), features=n)
        parts_json.append(d)

    # samling
    grp = doc.addObject("App::Part", f"Assembly_006_001_000_{variant}")
    inst_objs = []
    for navn, p, M, t in LP.assembly(variant):
        o = doc.addObject("Part::Feature", f"{navn}")
        o.Shape = shapes[p.dwg]
        o.Placement = placement(M, t)
        o.Label = f"{navn} ({p.dwg})"
        grp.addObject(o)
        inst_objs.append(o)
    doc.recompute()

    # kontrol af samlingen: bbox og at ingen dele overlapper hinanden
    comp = Part.makeCompound([o.Shape for o in inst_objs])
    bb = comp.BoundBox
    print(f"[locker] samling {variant}: X {bb.XMin:.1f}..{bb.XMax:.1f}  Y {bb.YMin:.1f}..{bb.YMax:.1f}  Z {bb.ZMin:.1f}..{bb.ZMax:.1f}")
    overlap = 0.0
    for i in range(len(inst_objs)):
        for j in range(i + 1, len(inst_objs)):
            c = inst_objs[i].Shape.common(inst_objs[j].Shape)
            if c.Volume > 1e-3:
                overlap += c.Volume
                print(f"[locker]   OVERLAP {inst_objs[i].Name} x {inst_objs[j].Name}: {c.Volume:.1f} mm3")
    print(f"[locker] samlet overlap {overlap:.1f} mm3")

    Import.export(inst_objs, os.path.join(out, f"006.001.000_{variant}_assembly.step"))
    doc.saveAs(os.path.join(out, f"006.001.000_{variant}.FCStd"))

    # STL til render (ikke til produktion) - een fil pr. instans saa render kan farve delene
    import Mesh
    stl_dir = os.path.join(out, "_render")
    os.makedirs(stl_dir, exist_ok=True)
    for o in inst_objs:
        Mesh.export([o], os.path.join(stl_dir, f"v{variant}_{o.Name}.stl"))

    # kontrol: laes STEP-samlingen ind igen og tael solids
    chk = App.newDocument("chk")
    Import.insert(os.path.join(out, f"006.001.000_{variant}_assembly.step"), chk.Name)
    leaves = [o for o in chk.Objects if hasattr(o, "Shape") and not o.Shape.isNull() and not o.OutList]
    n_solids = sum(len(o.Shape.Solids) for o in leaves)
    print(f"[locker] STEP-samling laest tilbage: {len(leaves)} blade, {n_solids} solids (forventet {len(inst_objs)})")
    assert n_solids == len(inst_objs), "STEP-samlingen kom ikke tilbage med det rigtige antal dele"
    App.closeDocument(chk.Name)

    with open(os.path.join(out, f"006.001.000_{variant}_maal-og-kilder.json"), "w", encoding="utf-8") as f:
        json.dump(dict(
            dwg=f"006.001.000_{variant}", genereret=dato, generator="locker_freecad.py (FreeCAD " + App.Version()[0] + "." + App.Version()[1] + ")",
            status="FOR REVIEW - rekonstrueret fra produktionstegninger 006.001.xxx, ikke Fusion-kilden",
            parametre={k: dict(vaerdi=v[0], kilde=v[1], forklaring=v[2]) for k, v in LP.PARAMETRE.items()},
            antagelser=LP.ANTAGELSER, uafklaret=LP.UAFKLARET,
            samling_bbox=dict(x=[bb.XMin, bb.XMax], y=[bb.YMin, bb.YMax], z=[bb.ZMin, bb.ZMax]),
            overlap_mm3=overlap,
            bom=[dict(item=i, qty=q, part=pn.format(v=variant), desc=d) for i, q, pn, d in LP.BOM],
            dele=parts_json,
        ), f, ensure_ascii=False, indent=2)
    App.closeDocument(doc.Name)


def main():
    out = os.environ.get("LOCKER_OUT", os.path.join(HER, "out"))
    os.makedirs(out, exist_ok=True)
    for v in os.environ.get("LOCKER_VARIANTS", "1,2").split(","):
        run_variant(int(v), out)
    print(f"[locker] skrevet til {out}")


main()
