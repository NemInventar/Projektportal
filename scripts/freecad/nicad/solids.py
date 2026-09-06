# -*- coding: utf-8 -*-
"""Part2D -> FreeCAD-solid i lokalt (a, b, t). Koeres kun i FreeCAD."""

import math

import FreeCAD as App
import Part

V = App.Vector
EPS = 1.0


def t_range(T, depth, face):
    if depth is None:
        return -EPS, T + 2 * EPS
    return (T - depth, depth + EPS) if face == "+" else (-EPS, depth + EPS)


def cyl(a, b, d, T, depth, face):
    t0, h = t_range(T, depth, face)
    return Part.makeCylinder(d / 2, h, V(a, b, t0))


def csk_tool(a, b, T, face, d_thru, d_top, angle):
    thru = Part.makeCylinder(d_thru / 2, T + 2 * EPS, V(a, b, -EPS))
    h = (d_top - d_thru) / 2 / math.tan(math.radians(angle / 2))
    r_top = d_top / 2 + EPS * math.tan(math.radians(angle / 2))
    if face == "-":
        cone = Part.makeCone(r_top, d_thru / 2, h + EPS, V(a, b, -EPS))
    else:
        cone = Part.makeCone(d_thru / 2, r_top, h + EPS, V(a, b, T - h))
    return thru.fuse(cone)


def rounded_rect(a0, b0, a1, b1, r):
    arcs = []
    for cx, cy, s, e in ((a0 + r, b0 + r, 180, 270), (a1 - r, b0 + r, 270, 360), (a1 - r, b1 - r, 0, 90), (a0 + r, b1 - r, 90, 180)):
        arcs.append(Part.ArcOfCircle(Part.Circle(V(cx, cy, 0), V(0, 0, 1), r), math.radians(s), math.radians(e)).toShape())
    lines = []
    for p, q in (((a0 + r, b0), (a1 - r, b0)), ((a1, b0 + r), (a1, b1 - r)), ((a1 - r, b1), (a0 + r, b1)), ((a0, b1 - r), (a0, b0 + r))):
        if abs(p[0] - q[0]) > 1e-9 or abs(p[1] - q[1]) > 1e-9:
            lines.append(Part.LineSegment(V(p[0], p[1], 0), V(q[0], q[1], 0)).toShape())
    return Part.Wire(Part.__sortEdges__(arcs + lines))


def prism(wire, t0, h):
    f = Part.Face(wire)
    f.translate(V(0, 0, t0))
    return f.extrude(V(0, 0, h))


def rabbet_tool(rb, A, B, T):
    w, dt = rb["width"], rb["depth_t"]
    t0, h = (T - dt, dt + EPS) if rb["face"] == "+" else (-EPS, dt + EPS)
    return {"a0": Part.makeBox(w + EPS, B + 2 * EPS, h, V(-EPS, -EPS, t0)),
            "a1": Part.makeBox(w + EPS, B + 2 * EPS, h, V(A - w, -EPS, t0)),
            "b0": Part.makeBox(A + 2 * EPS, w + EPS, h, V(-EPS, -EPS, t0)),
            "b1": Part.makeBox(A + 2 * EPS, w + EPS, h, V(-EPS, B - w, t0))}[rb["edge"]]


def notch_tool(n, A, B, T):
    r = n["r"]
    b0, b1 = n["b"] - n["length"] / 2, n["b"] + n["length"] / 2
    return prism(rounded_rect(A - n["depth"], b0, A + 2 * r + EPS, b1, r), -EPS, T + 2 * EPS)


def slot_tool(s, T):
    t0, h = t_range(T, s["depth"], s["face"])
    w = s["w"] / 2
    return prism(rounded_rect(s["a"] - w, s["b0"], s["a"] + w, s["b1"], w - 1e-6), t0, h)


def edge_hole_tool(eh, A, B):
    d, depth = eh["d"], eh["depth"]
    if eh["edge"] == "a0":
        return Part.makeCylinder(d / 2, depth + EPS, V(-EPS, eh["pos_b"], eh["t"]), V(1, 0, 0))
    if eh["edge"] == "a1":
        return Part.makeCylinder(d / 2, depth + EPS, V(A + EPS, eh["pos_b"], eh["t"]), V(-1, 0, 0))
    if eh["edge"] == "b0":
        return Part.makeCylinder(d / 2, depth + EPS, V(eh["pos_b"], -EPS, eh["t"]), V(0, 1, 0))
    return Part.makeCylinder(d / 2, depth + EPS, V(eh["pos_b"], B + EPS, eh["t"]), V(0, -1, 0))


def build(p, csk_spec=None):
    """csk_spec = (d_thru, d_top, angle) for p.csk."""
    A, B, T = p.A, p.B, p.T
    solid = Part.makeBox(A, B, T)
    tools = [rabbet_tool(rb, A, B, T) for rb in p.rabbets]
    tools += [notch_tool(n, A, B, T) for n in p.notches]
    tools += [cyl(pk["a"], pk["b"], pk["d"], T, pk["depth"], pk["face"]) for pk in p.pockets]
    tools += [slot_tool(s, T) for s in p.slots]
    if p.csk:
        d_thru, d_top, ang = csk_spec
        tools += [csk_tool(c["a"], c["b"], T, c["face"], d_thru, d_top, ang) for c in p.csk]
    tools += [cyl(h["a"], h["b"], h["d"], T, h["depth"], h["face"]) for h in p.holes]
    tools += [edge_hole_tool(eh, A, B) for eh in p.edge_holes]
    if tools:
        alle = tools[0].multiFuse(tools[1:]) if len(tools) > 1 else tools[0]
        solid = solid.cut(alle)
    solid = solid.removeSplitter()
    assert solid.isValid() and len(solid.Solids) == 1, f"{p.dwg}: ikke eet gyldigt legeme"
    bb = solid.BoundBox
    assert abs(bb.XLength - A) < 1e-6 and abs(bb.YLength - B) < 1e-6 and abs(bb.ZLength - T) < 1e-6, f"{p.dwg}: bbox {bb}"
    return solid, len(tools)


def placement(M, t):
    m = App.Matrix()
    (m.A11, m.A12, m.A13), (m.A21, m.A22, m.A23), (m.A31, m.A32, m.A33) = M
    m.A14, m.A24, m.A34 = t
    return App.Placement(m)
