# -*- coding: utf-8 -*-
"""
Staalben i Z-form til baenke 713.001-713.003, 26022 Fremtidens Skaerehaller.

Koerer headless i FreeCAD 1.0:
    freecadcmd staalben.py

Miljoevariable:
    STAALBEN_OUT          output-mappe (default: ./out ved siden af scriptet)
    STAALBEN_ORIENTERING  12_lodret (default, som arkitektens snit N129)
                          50_lodret (variant fra styrke-eftervisningen)

Output:
    Staalben_<orientering>.FCStd   parametrisk model (regneark + TechDraw-ark) - aabn og ret i FreeCAD
    Staalben_<orientering>.step    til smed / Fusion / alt andet CAD
    Staalben_<orientering>.stl     til render
    Staalben_<orientering>.svg/.pdf A3-tegning med maal, stykliste, noter (pdf ~8 KB, standardfonte)
    Staalben_<orientering>.json    alle maal + kilde pr. maal

Koordinater (model):  X = dybde, 0 = panelforkant, + = ud i rummet
                      Y = langs baenken, 0 = benets midte
                      Z = hoejde, 0 = faerdigt gulv (F.G.)
"""

import datetime
import json
import os
import re

import FreeCAD as App
import Import
import Mesh
import Part
import TechDraw

# ---------------------------------------------------------------------------
# Parametre
# ---------------------------------------------------------------------------

ORIENTERING = os.environ.get("STAALBEN_ORIENTERING", "12_lodret")
if ORIENTERING not in ("12_lodret", "50_lodret"):
    raise SystemExit("STAALBEN_ORIENTERING skal vaere 12_lodret eller 50_lodret")

# navn: (vaerdi mm, kilde, forklaring)
PARAMETRE = {
    "B_staal":      (50,  "N129 paaskrift 'Staalben, 50 x 12 mm'", "fladstaalets bredde"),
    "T_staal":      (12,  "N129 paaskrift 'Staalben, 50 x 12 mm'", "fladstaalets tykkelse"),
    "H_flange_top": (388, "N129 maalsat '388' fra F.G. til flangens overside", "overside af vandret flange over gulv"),
    "X_front":      (475, "AFLEDT: 600 - 125 (saedeforkant 600 fra panel, udkrag 125)", "staalets forkant fra panelforkant"),
    "D_vaeg":       (57,  "AFLEDT: 12 mm panel + 45 mm underlag (N129 snit)", "panelforkant til bagvaeg"),
    "H_vaegplade":  (120, "ANTAGET: udsparing i underlag er 120 hoej (kote 388-508), flangen selv er ikke tegnet", "vaegpladens hoejde"),
    "L_fod":        (110, "ANTAGET: fodplade tegnet ca. 100 lang, ikke maalsat", "fodpladens laengde, maalt fra staalets forkant"),
    "X_hul_fod":    (40,  "ANTAGET: ikke tegnet", "hul i fod, fra fodens bagkant"),
    "D_hul":        (13,  "ANTAGET: M12 bolt (Joachim 05-09: 1 bolt gulv, 1 bolt vaeg)", "hul-diameter"),
    "D_forsaenk":   (24,  "ANTAGET: DIN 7991 M12 hoved, 90 grader ('nedsaenket skruemontage' N129)", "forsaenkning i fod, diameter ved overflade"),
}
P = {k: v[0] for k, v in PARAMETRE.items()}

# Hvilket maal er lodret paa flange og forben?
if ORIENTERING == "12_lodret":
    TV, TY = "T_staal", "B_staal"   # 12 lodret, 50 langs baenken (som N129)
else:
    TV, TY = "B_staal", "T_staal"   # 50 lodret, 12 langs baenken


def ev(udtryk):
    """Regn et parameterudtryk ud i mm."""
    return float(eval(udtryk, {"__builtins__": {}}, dict(P)))


def ex(udtryk):
    """Samme udtryk, men som FreeCAD-expression bundet til regnearket."""
    return re.sub(r"\b([A-Za-z_]\w*)\b",
                  lambda m: "Parametre." + m.group(1) if m.group(1) in P else m.group(1),
                  udtryk)


# ---------------------------------------------------------------------------
# Delene - fire stykker fladstaal (x0, x1, y0, y1, z0, z1) som udtryk
# ---------------------------------------------------------------------------

DELE = [
    # navn        x0                    x1          y0          y1         z0                            z1
    ("Fodplade",  "X_front - L_fod",    "X_front",  "-B_staal/2", "B_staal/2", "0",                        "T_staal"),
    ("Forben",    f"X_front - {TV}",    "X_front",  f"-{TY}/2", f"{TY}/2", "T_staal",                    f"H_flange_top - {TV}"),
    ("Flange",    "-D_vaeg",            "X_front",  f"-{TY}/2", f"{TY}/2", f"H_flange_top - {TV}",       "H_flange_top"),
    ("Vaegplade", "-D_vaeg",            "-D_vaeg + T_staal", "-B_staal/2", "B_staal/2", "H_flange_top",  "H_flange_top + H_vaegplade"),
]

HUL_FOD = dict(x="X_front - L_fod + X_hul_fod", y="0")          # gennem Z
HUL_VAEG = dict(z="H_flange_top + H_vaegplade/2", y="0")        # gennem X


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def byg_model(doc):
    ark = doc.addObject("Spreadsheet::Sheet", "Parametre")
    ark.set("A1", "Parameter"); ark.set("B1", "mm"); ark.set("C1", "Kilde")
    for i, (navn, (vaerdi, kilde, _)) in enumerate(PARAMETRE.items(), start=2):
        ark.set(f"A{i}", navn)
        ark.set(f"B{i}", str(vaerdi))
        ark.set(f"C{i}", kilde)
        ark.setAlias(f"B{i}", navn)
    doc.recompute()

    kasser = []
    for navn, x0, x1, y0, y1, z0, z1 in DELE:
        k = doc.addObject("Part::Box", navn)
        k.setExpression("Length", f"({ex(x1)}) - ({ex(x0)})")
        k.setExpression("Width",  f"({ex(y1)}) - ({ex(y0)})")
        k.setExpression("Height", f"({ex(z1)}) - ({ex(z0)})")
        k.setExpression(".Placement.Base.x", ex(x0))
        k.setExpression(".Placement.Base.y", ex(y0))
        k.setExpression(".Placement.Base.z", ex(z0))
        kasser.append(k)

    staal = doc.addObject("Part::MultiFuse", "Staal_uden_huller")
    staal.Shapes = kasser
    staal.Refine = True

    # Hul i fod: gennemgaaende + forsaenkning 90 grader fra oversiden
    hf = doc.addObject("Part::Cylinder", "Hul_fod")
    hf.setExpression("Radius", ex("D_hul/2"))
    hf.setExpression("Height", ex("T_staal + 2"))
    hf.setExpression(".Placement.Base.x", ex(HUL_FOD["x"]))
    hf.setExpression(".Placement.Base.y", ex(HUL_FOD["y"]))
    hf.Placement.Base.z = -1

    fs = doc.addObject("Part::Cone", "Forsaenkning_fod")
    fs.setExpression("Radius1", ex("D_hul/2"))
    fs.setExpression("Radius2", ex("D_forsaenk/2 + 1"))       # +1 saa keglen skaerer rent igennem oversiden
    fs.setExpression("Height",  ex("(D_forsaenk - D_hul)/2 + 1"))
    fs.setExpression(".Placement.Base.x", ex(HUL_FOD["x"]))
    fs.setExpression(".Placement.Base.y", ex(HUL_FOD["y"]))
    fs.setExpression(".Placement.Base.z", ex("T_staal - (D_forsaenk - D_hul)/2"))

    # Hul i vaegplade: gennemgaaende i X
    hv = doc.addObject("Part::Cylinder", "Hul_vaeg")
    hv.setExpression("Radius", ex("D_hul/2"))
    hv.setExpression("Height", ex("T_staal + 2"))
    hv.Placement = App.Placement(App.Vector(0, 0, 0), App.Rotation(App.Vector(0, 1, 0), 90))
    hv.setExpression(".Placement.Base.x", ex("-D_vaeg - 1"))
    hv.setExpression(".Placement.Base.y", ex(HUL_VAEG["y"]))
    hv.setExpression(".Placement.Base.z", ex(HUL_VAEG["z"]))

    huller = doc.addObject("Part::MultiFuse", "Huller")
    huller.Shapes = [hf, fs, hv]

    ben = doc.addObject("Part::Cut", "Staalben")
    ben.Base = staal
    ben.Tool = huller
    ben.Refine = True

    for o in kasser + [staal, hf, fs, hv, huller]:
        if hasattr(o, "ViewObject") and o.ViewObject:
            o.ViewObject.Visibility = False

    doc.recompute()
    return ben, kasser


# ---------------------------------------------------------------------------
# 2D-projektion med skjulte linjer (HLR) via TechDraw, mappet tilbage til modelakser
# ---------------------------------------------------------------------------

def _frame(retning, akser):
    """Find hvordan TechDraw.project laegger modelakserne i sit 2D-plan."""
    probe = Part.makeBox(1, 2, 4, App.Vector(10, 20, 30))
    res = TechDraw.project(probe, App.Vector(*retning))
    pts = [v.Point for s in res[:5] if not s.isNull() for v in s.Vertexes]
    us = [p.x for p in pts]; vs = [p.y for p in pts]
    ext = {"x": (10, 11), "y": (20, 22), "z": (30, 34)}
    mapping = {}
    for navn, vals in (("u", us), ("v", vs)):
        laengde = max(vals) - min(vals)
        center = (max(vals) + min(vals)) / 2
        for a in akser:
            m0, m1 = ext[a]
            if abs(laengde - (m1 - m0)) < 1e-6:
                fortegn = 1 if abs(center - (m0 + m1) / 2) < 1e-6 else -1
                mapping[navn] = (a, fortegn)
    assert len(mapping) == 2, mapping
    return mapping


def projekter(shape, retning, akser):
    """Returnerer liste af (punkter_i_modelkoordinater, skjult) for alle kanter."""
    mp = _frame(retning, akser)
    res = TechDraw.project(shape, App.Vector(*retning))
    kanter = []
    for i, s in enumerate(res):
        if s.isNull():
            continue
        skjult = i >= 5
        for e in s.Edges:
            pts = e.discretize(Number=32) if e.Length > 0 and not isinstance(e.Curve, Part.Line) else [e.Vertexes[0].Point, e.Vertexes[-1].Point]
            ud = []
            for p in pts:
                d = {}
                for navn, val in (("u", p.x), ("v", p.y)):
                    a, f = mp[navn]
                    d[a] = f * val
                ud.append(d)
            kanter.append((ud, skjult))
    return kanter


# ---------------------------------------------------------------------------
# SVG-tegning A3 liggende - Sundby-opsaetning (titelfelt ISO 7200, stykliste, noter)
# ---------------------------------------------------------------------------

class Svg:
    """
    Tegneflade i mm paa et A3-ark (420 x 297, y nedad som i SVG).
    Alle primitiver gemmes, saa arket kan skrives baade som SVG og som en
    lille PDF med standardfonte (Helvetica, ikke indlejret) - ca. 8 KB.
    """

    def __init__(self):
        self.d = []          # svg-strenge
        self.prim = []       # primitiver til pdf

    def add(self, s):
        self.d.append(s)

    def line(self, x1, y1, x2, y2, w=0.35, dash=None, color="#000"):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" stroke="{color}" stroke-width="{w}"{da} stroke-linecap="round"/>')
        self.prim.append(("poly", [(x1, y1), (x2, y2)], w, dash, color))

    def poly(self, pts, w=0.5, dash=None, color="#000"):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        p = " ".join(f"{x:.3f},{y:.3f}" for x, y in pts)
        self.add(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{w}"{da} stroke-linejoin="round"/>')
        self.prim.append(("poly", list(pts), w, dash, color))

    def rect(self, x, y, w, h, sw=0.5, fill="none"):
        self.add(f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" fill="{fill}" stroke="#000" stroke-width="{sw}"/>')
        self.prim.append(("poly", [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)], sw, None, "#000"))

    def text(self, x, y, s, size=3.5, anchor="start", bold=False, rot=0, color="#000"):
        fw = ' font-weight="bold"' if bold else ""
        tr = f' transform="rotate({rot} {x:.3f} {y:.3f})"' if rot else ""
        se = s.replace("&", "&amp;").replace("<", "&lt;")
        self.add(f'<text x="{x:.3f}" y="{y:.3f}" font-family="Helvetica, Arial, sans-serif" font-size="{size}" text-anchor="{anchor}" fill="{color}"{fw}{tr}>{se}</text>')
        self.prim.append(("text", x, y, s, size, anchor, bold, rot, color))

    def arrow(self, x, y, ang):
        # lukket pilespids 3 mm lang, ISO-agtig
        import math
        L, halv = 3.0, 0.5
        c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        p1 = (x, y)
        p2 = (x - L * c + halv * s, y - L * s - halv * c)
        p3 = (x - L * c - halv * s, y - L * s + halv * c)
        self.add(f'<polygon points="{p1[0]:.3f},{p1[1]:.3f} {p2[0]:.3f},{p2[1]:.3f} {p3[0]:.3f},{p3[1]:.3f}" fill="#000"/>')
        self.prim.append(("fill", [p1, p2, p3], "#000"))

    # ---- PDF ---------------------------------------------------------------

    # Helvetica-bredder (WinAnsi) i 1/1000 em, til tekstjustering
    _W = {c: 556 for c in "0123456789"}
    _W.update({" ": 278, ".": 278, ",": 278, ":": 278, ";": 278, "-": 333, "/": 278, "(": 333, ")": 333,
               "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556, "h": 556, "i": 222, "j": 222,
               "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333, "s": 500, "t": 278,
               "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
               "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278, "J": 500,
               "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611,
               "U": 722, "V": 667, "W": 944, "X": 667, "Y": 667, "Z": 611,
               "Ø": 778, "°": 400, "·": 278, "=": 584, "+": 584, "x": 500, "'": 191, "%": 889, "_": 556, "#": 556})

    def _tw(self, s, size, bold):
        f = 1.08 if bold else 1.0
        return sum(self._W.get(ch, 556) for ch in s) / 1000.0 * size * f

    @staticmethod
    def _rgb(color):
        c = color.lstrip("#")
        if len(c) == 3:
            c = "".join(ch * 2 for ch in c)
        return tuple(int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4))

    def render_pdf(self):
        import zlib
        K = 72.0 / 25.4                     # mm -> pt
        H = 297.0
        def P(x, y):                        # mm (y nedad) -> pt (y opad)
            return f"{x * K:.2f} {(H - y) * K:.2f}"

        ops = ["1 J 1 j"]
        for p in self.prim:
            if p[0] == "poly":
                _, pts, w, dash, color = p
                r, g, b = self._rgb(color)
                ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG {w * K:.2f} w")
                ops.append("[" + " ".join(f"{float(v) * K:.2f}" for v in dash.split()) + "] 0 d" if dash else "[] 0 d")
                ops.append(" ".join(f"{P(x, y)} {'m' if i == 0 else 'l'}" for i, (x, y) in enumerate(pts)) + " S")
            elif p[0] == "fill":
                _, pts, color = p
                r, g, b = self._rgb(color)
                ops.append(f"{r:.3f} {g:.3f} {b:.3f} rg " + " ".join(f"{P(x, y)} {'m' if i == 0 else 'l'}" for i, (x, y) in enumerate(pts)) + " h f")
            elif p[0] == "text":
                _, x, y, s, size, anchor, bold, rot, color = p
                r, g, b = self._rgb(color)
                w = self._tw(s, size, bold)
                dx = -w / 2 if anchor == "middle" else (-w if anchor == "end" else 0.0)
                import math
                a = math.radians(-rot)          # svg roterer med uret, pdf mod uret
                ca, sa = math.cos(a), math.sin(a)
                ox = x + dx * math.cos(math.radians(rot))
                oy = y + dx * math.sin(math.radians(rot))
                esc = s.encode("cp1252", "replace").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)").decode("latin-1")
                font = "/FB" if bold else "/F"
                ops.append(f"BT {r:.3f} {g:.3f} {b:.3f} rg {font} {size * K:.2f} Tf {ca:.4f} {sa:.4f} {-sa:.4f} {ca:.4f} {P(ox, oy)} Tm ({esc}) Tj ET")
        stream = zlib.compress("\n".join(ops).encode("latin-1"))

        objs = []
        objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {420 * K:.2f} {297 * K:.2f}] /Contents 4 0 R /Resources << /Font << /F 5 0 R /FB 6 0 R >> >> >>".encode())
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" /Filter /FlateDecode >>\nstream\n" + stream + b"\nendstream")
        objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = []
        for i, o in enumerate(objs, start=1):
            offsets.append(len(out))
            out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
        xref = len(out)
        out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
        for off in offsets:
            out += f"{off:010d} 00000 n \n".encode()
        out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
        return bytes(out)

    def dim_h(self, x1, x2, y_geo, y_dim, tekst):
        """Vandret maal mellem x1 og x2, maalt ved y_geo, maallinje ved y_dim."""
        ext = 1.5 if y_dim < y_geo else -1.5
        x1, x2 = min(x1, x2), max(x1, x2)
        self.line(x1, y_geo, x1, y_dim - ext, w=0.18)
        self.line(x2, y_geo, x2, y_dim - ext, w=0.18)
        if x2 - x1 < 9:                          # kort maal: pile udenfor, tekst ved siden af
            self.line(x1 - 6, y_dim, x2 + 6, y_dim, w=0.18)
            self.arrow(x1, y_dim, 0); self.arrow(x2, y_dim, 180)
            self.text(x2 + 7, y_dim + 1.0, tekst, size=3.0, anchor="start")
        else:
            self.line(x1, y_dim, x2, y_dim, w=0.18)
            self.arrow(x1, y_dim, 180); self.arrow(x2, y_dim, 0)
            self.text((x1 + x2) / 2, y_dim - 1.0, tekst, size=3.0, anchor="middle")

    def dim_v(self, y1, y2, x_geo, x_dim, tekst):
        ext = 1.5 if x_dim < x_geo else -1.5
        y1, y2 = min(y1, y2), max(y1, y2)
        self.line(x_geo, y1, x_dim - ext, y1, w=0.18)
        self.line(x_geo, y2, x_dim - ext, y2, w=0.18)
        if y2 - y1 < 9:                          # kort maal: pile udenfor, tekst over
            self.line(x_dim, y1 - 6, x_dim, y2 + 6, w=0.18)
            self.arrow(x_dim, y1, 90); self.arrow(x_dim, y2, 270)
            self.text(x_dim, y1 - 7, tekst, size=3.0, anchor="middle")
        else:
            self.line(x_dim, y1, x_dim, y2, w=0.18)
            self.arrow(x_dim, y1, 270); self.arrow(x_dim, y2, 90)
            self.text(x_dim - 1.0, (y1 + y2) / 2, tekst, size=3.0, anchor="middle", rot=-90)

    def render(self):
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">\n'
                '<rect width="420" height="297" fill="#fff"/>\n' + "\n".join(self.d) + "\n</svg>\n")


def tegn(ben, kasser, out_svg, out_json, dato, dwg_no, rev):
    B, T = P["B_staal"], P["T_staal"]
    tv, ty = ev(TV), ev(TY)
    Xmin, Xmax = -P["D_vaeg"], P["X_front"]
    Zmax = P["H_flange_top"] + P["H_vaegplade"]
    S = 0.25                                    # 1:4

    svg = Svg()
    svg.rect(10, 10, 400, 277, sw=0.7)          # ramme

    # ---- Sideopstalt (set langs baenken, fra +Y) --------------------------
    ox, oy = 40, 205                            # page-koordinat for model (X=Xmin, Z=0)
    def sx(x): return ox + (x - Xmin) * S
    def sz(z): return oy - z * S
    for pts, skjult in projekter(ben.Shape, (0, -1, 0), ("x", "z")):
        svg.poly([(sx(p["x"]), sz(p["z"])) for p in pts], w=0.25 if skjult else 0.5, dash="1.2 0.8" if skjult else None)
    # gulv- og vaeglinje som reference (tynd)
    svg.line(sx(Xmin) - 12, sz(0), sx(Xmax) + 12, sz(0), w=0.18, color="#555")
    svg.text(sx(Xmax) + 13, sz(0) + 1, "F.G.", size=2.5, color="#555")
    svg.line(sx(Xmin), sz(-10), sx(Xmin), sz(Zmax) + 8, w=0.18, dash="4 1 0.5 1", color="#555")
    svg.text(sx(Xmin) - 1, sz(Zmax) + 8, "WALL", size=2.5, anchor="end", color="#555")
    svg.line(sx(0), sz(-10), sx(0), sz(P["H_flange_top"]) + 6, w=0.18, dash="4 1 0.5 1", color="#555")
    svg.text(sx(0) + 1, sz(-10) + 3, "panel face", size=2.5, color="#555")
    svg.text(sx(Xmin), sz(Zmax) - 16, "SIDE VIEW  1:4", size=3.5, bold=True)

    # maal, side
    svg.dim_h(sx(0), sx(Xmax), sz(0), sz(0) + 14, f"{P['X_front']:.0f}")
    svg.dim_h(sx(Xmin), sx(0), sz(0), sz(0) + 14, f"{P['D_vaeg']:.0f}")
    svg.dim_h(sx(Xmax - P["L_fod"]), sx(Xmax), sz(0), sz(0) + 24, f"{P['L_fod']:.0f}")
    xh = ev(HUL_FOD["x"])
    svg.dim_h(sx(Xmax - P["L_fod"]), sx(xh), sz(T), sz(T) - 22, f"{P['X_hul_fod']:.0f}")
    svg.dim_v(sz(P["H_flange_top"]), sz(0), sx(Xmax), sx(Xmax) + 16, f"{P['H_flange_top']:.0f}")
    svg.dim_v(sz(Zmax), sz(0), sx(Xmax), sx(Xmax) + 26, f"{Zmax:.0f}")
    svg.dim_v(sz(Zmax), sz(P["H_flange_top"]), sx(Xmin), sx(Xmin) - 10, f"{P['H_vaegplade']:.0f}")
    zh = ev(HUL_VAEG["z"])
    svg.dim_v(sz(zh), sz(P["H_flange_top"]), sx(Xmin), sx(Xmin) - 20, f"{P['H_vaegplade']/2:.0f}")
    # tykkelse paa flange og forben, lokale maal
    svg.dim_v(sz(P["H_flange_top"]), sz(P["H_flange_top"] - tv), sx(200), sx(200) - 8, f"{tv:.0f}")
    svg.dim_h(sx(Xmax - tv), sx(Xmax), sz(250), sz(250) - 8, f"{tv:.0f}")

    # ---- Front (set fra +X, ind mod vaeggen) -----------------------------
    fx = sx(Xmax) + 52                          # page-x for model Y=-B/2
    def fy(y): return fx + (y + B / 2) * S
    for pts, skjult in projekter(ben.Shape, (-1, 0, 0), ("y", "z")):
        svg.poly([(fy(p["y"]), sz(p["z"])) for p in pts], w=0.25 if skjult else 0.5, dash="1.2 0.8" if skjult else None)
    svg.text(fx, sz(Zmax) - 16, "FRONT VIEW  1:4", size=3.5, bold=True)
    svg.dim_h(fy(-B / 2), fy(B / 2), sz(0), sz(0) + 14, f"{B:.0f}")

    # ---- Top (set fra +Z) --------------------------------------------------
    ty0 = sz(0) + 40                            # page-y for model Y=-B/2
    def tyy(y): return ty0 + (y + B / 2) * S
    for pts, skjult in projekter(ben.Shape, (0, 0, -1), ("x", "y")):
        svg.poly([(sx(p["x"]), tyy(p["y"])) for p in pts], w=0.25 if skjult else 0.5, dash="1.2 0.8" if skjult else None)
    svg.text(sx(Xmin), ty0 - 3, "TOP VIEW  1:4", size=3.5, bold=True)
    svg.dim_v(tyy(-B / 2), tyy(B / 2), sx(Xmin), sx(Xmin) - 10, f"{B:.0f}")
    if ORIENTERING == "50_lodret":                # flangens 12 mm ses kun i top/front - maal den her
        svg.dim_v(tyy(-ty / 2), tyy(ty / 2), sx(150), sx(150), f"{ty:.0f}")

    # ---- Detalje: forsaenkning 1:1 -----------------------------------------
    dx, dy = 300, 60
    svg.text(dx, dy - 15, "DETAIL A  countersunk hole, foot plate  1:1", size=3.5, bold=True)
    D, Dc = P["D_hul"], P["D_forsaenk"]
    dyb = (Dc - D) / 2
    # snit gennem fodpladen (X-Z), 1:1, 70 mm bredt udsnit
    w = 70
    x0 = dx; xm = dx + w / 2
    svg.line(x0, dy, xm - Dc / 2, dy, w=0.5); svg.line(xm + Dc / 2, dy, x0 + w, dy, w=0.5)
    svg.line(x0, dy + T, xm - D / 2, dy + T, w=0.5); svg.line(xm + D / 2, dy + T, x0 + w, dy + T, w=0.5)
    svg.line(x0, dy, x0, dy + T, w=0.5); svg.line(x0 + w, dy, x0 + w, dy + T, w=0.5)
    svg.line(xm - Dc / 2, dy, xm - D / 2, dy + dyb, w=0.5); svg.line(xm + Dc / 2, dy, xm + D / 2, dy + dyb, w=0.5)
    svg.line(xm - D / 2, dy + dyb, xm - D / 2, dy + T, w=0.5); svg.line(xm + D / 2, dy + dyb, xm + D / 2, dy + T, w=0.5)
    for i in range(0, int(w), 3):                # skravering
        xa = x0 + i
        for seg in ((x0, xm - Dc / 2 - 0.01), (xm + Dc / 2 + 0.01, x0 + w)):
            if seg[0] <= xa <= seg[1]:
                svg.line(xa, dy + T, min(xa + T, seg[1]), dy + max(T - (min(xa + T, seg[1]) - xa), 0), w=0.18)
    svg.dim_h(xm - Dc / 2, xm + Dc / 2, dy, dy - 8, f"Ø{Dc:.0f}")
    svg.dim_h(xm - D / 2, xm + D / 2, dy + T, dy + T + 8, f"Ø{D:.0f} THRU")
    svg.dim_v(dy, dy + T, x0 + w, x0 + w + 8, f"{T:.0f}")
    svg.text(xm, dy + T + 16, "90° countersink for M12 DIN 7991 - wall plate hole Ø13 plain", size=2.8, anchor="middle")

    # ---- Stykliste -----------------------------------------------------------
    px, py = 240, 98
    svg.text(px, py - 3, "PARTS LIST  (per leg, flat bar S235JR)", size=3.5, bold=True)
    hdr = ["Item", "Part", "Section", "Length", "Qty"]
    kol = [px, px + 12, px + 52, px + 82, px + 108]
    svg.rect(px - 1, py, 122, 5.5 * 5 + 1, sw=0.35)
    for i, h in enumerate(hdr):
        svg.text(kol[i] + 1, py + 4, h, size=2.8, bold=True)
    stk = []
    for n, (navn, x0e, x1e, y0e, y1e, z0e, z1e) in enumerate(DELE, start=1):
        L = max(ev(x1e) - ev(x0e), ev(y1e) - ev(y0e), ev(z1e) - ev(z0e))
        stk.append((n, navn, f"{B:.0f}x{T:.0f}", L))
        r = py + 5.5 * n + 4
        for c, val in zip(kol, (str(n), navn.replace("Vaegplade", "Wall plate").replace("Fodplade", "Foot plate").replace("Forben", "Front leg"), f"{B:.0f} x {T:.0f}", f"{L:.0f}", "1")):
            svg.text(c + 1, r, val, size=2.8)
    total_L = sum(s[3] for s in stk)
    masse = ben.Shape.Volume * 7.85e-6
    svg.text(px, py + 5.5 * 5 + 6, f"Bar per leg {total_L:.0f} mm  ·  mass per leg {masse:.2f} kg  ·  41 legs = {41*total_L/1000:.1f} m, {41*masse:.0f} kg", size=2.8)

    # ---- Konfigurationer -----------------------------------------------------
    cx, cy = 240, 140
    svg.text(cx, cy - 3, "CONFIGURATIONS  (26022, quantities per bench type)", size=3.5, bold=True)
    rows = [("713.001", "Niche bench w/ backrest", "2748", "3", "6", "18"),
            ("713.002", "Study bench w/ backrest", "2370", "3", "5", "15"),
            ("713.003", "Study bench, no backrest", "2970", "4", "2", "8")]
    kol2 = [cx, cx + 16, cx + 62, cx + 78, cx + 94, cx + 110]
    svg.rect(cx - 1, cy, 128, 5.5 * 5 + 1, sw=0.35)
    for c, h in zip(kol2, ["Item", "Bench", "Length", "Legs", "Benches", "Total legs"]):
        svg.text(c + 1, cy + 4, h, size=2.6, bold=True)
    for n, row in enumerate(rows, start=1):
        for c, val in zip(kol2, row):
            svg.text(c + 1, cy + 5.5 * n + 4, val, size=2.8)
    svg.text(cx + 1, cy + 5.5 * 4 + 4, "TOTAL", size=2.8, bold=True); svg.text(kol2[5] + 1, cy + 5.5 * 4 + 4, "41", size=2.8, bold=True)

    # ---- Noter ---------------------------------------------------------------
    nx, ny = 240, 182
    svg.text(nx, ny, "NOTES", size=3.5, bold=True)
    noter = [
        "1. Material: flat bar 50x12 S235JR (EN 10025-2), all four pieces.",
        "2. Joints: full fillet welds all round at the three corners, ground flush on visible faces.",
        "   ALTERNATIVE: cold-bent from one bar at the flange corners - state in offer if preferred.",
        "3. Finish: powder coating RAL 7032 (pebble grey), after welding. Mask threads/holes not required.",
        "4. Holes: Ø13 for M12. Foot plate: 90° countersink Ø24 (DIN 7991). Wall plate: plain hole.",
        "5. Flange passes through a slot in a 12 mm panel at the panel face (X=0) - keep flange straight, no weld spatter here.",
        "6. General tolerances ISO 2768-m. Flange top face flat within 1 mm over its length (seat rests on 21 mm blocks).",
        f"7. Orientation: {'12 mm vertical on flange and leg (as architect section N129)' if ORIENTERING=='12_lodret' else 'VARIANT - 50 mm vertical on flange and leg (structural variant)'}.",
        "8. Quantity: 41 legs + spares as agreed. Deliver with fasteners excluded.",
    ]
    for i, n in enumerate(noter):
        svg.text(nx, ny + 5 + 4.2 * i, n, size=2.6)

    # ---- Antagelser (den aerlige del) ------------------------------------------
    ax, ay = 40, 20
    svg.text(ax, ay, "ASSUMPTIONS - TO BE CONFIRMED BEFORE PRODUCTION (source per dimension in .json)", size=3.2, bold=True, color="#8a1c1c")
    ant = [(k, v) for k, v in PARAMETRE.items() if v[1].startswith(("ANTAGET", "AFLEDT"))]
    for i, (k, v) in enumerate(ant):
        svg.text(ax, ay + 4.5 + 4.0 * i, f"{k} = {P[k]:.0f}: {v[1]}", size=2.5, color="#8a1c1c")

    # ---- Titelfelt (ISO 7200-felter som paa Sundby-tegningerne) --------------------
    tx, ty_ = 230, 232                          # nederste hoejre blok 180 x 55
    svg.rect(tx, ty_, 180, 55, sw=0.7)
    def felt(x, y, w, h, label, value, vs=3.2, bold=False):
        svg.rect(x, y, w, h, sw=0.25)
        svg.text(x + 1, y + 2.6, label, size=1.8, color="#444")
        svg.text(x + 1, y + h - 1.6, value, size=vs, bold=bold)
    felt(tx, ty_, 45, 11, "Dept.", "Nem Inventar ApS")
    felt(tx + 45, ty_, 45, 11, "Technical reference", "N129 rev.1 / N290 290.03")
    felt(tx + 90, ty_, 45, 11, "Created by", "Claude (headless FreeCAD)")
    felt(tx + 135, ty_, 45, 11, "Approved by", "")
    felt(tx, ty_ + 11, 45, 11, "Document type", "Part drawing / RFQ")
    felt(tx + 45, ty_ + 11, 45, 11, "Document status", "FOR QUOTATION", bold=True)
    felt(tx + 90, ty_ + 11, 90, 11, "Title", "Steel leg Z-form 50x12 - benches 713.001-003", vs=3.2, bold=True)
    felt(tx, ty_ + 22, 90, 11, "Project", "26022 Fremtidens Skaerehaller, ZBC Roskilde")
    felt(tx + 90, ty_ + 22, 45, 11, "DWG No.", dwg_no, vs=3.6, bold=True)
    felt(tx + 135, ty_ + 22, 20, 11, "Rev.", rev, vs=3.6)
    felt(tx + 155, ty_ + 22, 25, 11, "Sheet", "1/1")
    felt(tx, ty_ + 33, 45, 11, "Date of issue", dato)
    felt(tx + 45, ty_ + 33, 45, 11, "Scale", "1:4  (detail 1:1)")
    felt(tx + 90, ty_ + 33, 45, 11, "Material", "S235JR flat bar 50x12")
    felt(tx + 135, ty_ + 33, 45, 11, "Finish", "Powder coat RAL 7032")
    felt(tx, ty_ + 44, 90, 11, "Model (parametric - edit spreadsheet 'Parametre')", os.path.basename(out_svg).replace(".svg", ".FCStd"))
    felt(tx + 90, ty_ + 44, 45, 11, "Orientation", "12 mm vertical (N129)" if ORIENTERING == "12_lodret" else "50 mm vertical (variant)")
    felt(tx + 135, ty_ + 44, 45, 11, "Units / tolerances", "mm  ·  ISO 2768-m")

    with open(out_svg, "w", encoding="utf-8") as f:
        f.write(svg.render())
    with open(out_svg[:-4] + ".pdf", "wb") as f:           # lille PDF, standardfonte
        f.write(svg.render_pdf())

    # ---- JSON: alle maal med kilde ----------------------------------------------
    data = {
        "dwg_no": dwg_no, "rev": rev, "dato": dato, "orientering": ORIENTERING,
        "parametre": {k: {"mm": v[0], "kilde": v[1], "hvad": v[2]} for k, v in PARAMETRE.items()},
        "dele": [{"nr": s[0], "navn": s[1], "profil": s[2], "laengde_mm": round(s[3], 1)} for s in stk],
        "stang_pr_ben_mm": round(total_L, 1),
        "masse_pr_ben_kg": round(masse, 3),
        "volumen_mm3": round(ben.Shape.Volume, 1),
        "antal_ben": {"713.001": 18, "713.002": 15, "713.003": 8, "total": 41},
        "huller": {"fod": {"x": ev(HUL_FOD["x"]), "y": 0, "d": P["D_hul"], "forsaenkning_d": P["D_forsaenk"]},
                   "vaeg": {"z": ev(HUL_VAEG["z"]), "y": 0, "d": P["D_hul"]}},
    }
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


# ---------------------------------------------------------------------------
# TechDraw-ark i FCStd (saa tegningen kan aabnes og rettes i FreeCAD-GUI)
# ---------------------------------------------------------------------------

def techdraw_ark(doc, ben, dwg_no, dato):
    tpl_dir = os.path.join(App.getResourceDir(), "Mod", "TechDraw", "Templates")
    tpl_fil = os.path.join(tpl_dir, "A3_Landscape_ISO5457_advanced.svg")
    if not os.path.exists(tpl_fil):
        kandidater = [f for f in os.listdir(tpl_dir) if f.startswith("A3_Landscape") and f.endswith(".svg")]
        if not kandidater:
            return None
        tpl_fil = os.path.join(tpl_dir, sorted(kandidater)[0])
    page = doc.addObject("TechDraw::DrawPage", "Ark")
    tpl = doc.addObject("TechDraw::DrawSVGTemplate", "Skabelon")
    tpl.Template = tpl_fil
    page.Template = tpl
    try:
        felter = dict(tpl.EditableTexts)
        for k in felter:
            kl = k.lower()
            if "title" in kl or "titel" in kl:
                felter[k] = "Steel leg Z-form 50x12 - bench 713.001-003"
            elif "drawing" in kl and "number" in kl or kl.startswith("dn") or "dwg" in kl:
                felter[k] = dwg_no
            elif "date" in kl:
                felter[k] = dato
            elif "author" in kl or "owner" in kl or "created" in kl:
                felter[k] = "Nem Inventar ApS"
        tpl.EditableTexts = felter
    except Exception:
        pass
    visninger = [("Side", (0, -1, 0), (0, 0, 1), 110, 150), ("Front", (-1, 0, 0), (0, 0, 1), 215, 150), ("Top", (0, 0, -1), (1, 0, 0), 110, 55)]
    for navn, d, xd, x, y in visninger:
        v = doc.addObject("TechDraw::DrawViewPart", f"Visning_{navn}")
        v.Source = [ben]
        v.Direction = App.Vector(*d)
        v.XDirection = App.Vector(*xd)
        v.ScaleType = "Custom"
        v.Scale = 0.25
        v.X = x
        v.Y = y
        page.addView(v)
    doc.recompute()
    return page


# ---------------------------------------------------------------------------
# Koersel
# ---------------------------------------------------------------------------

def main():
    her = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
    out = os.environ.get("STAALBEN_OUT", os.path.join(her, "out"))
    os.makedirs(out, exist_ok=True)
    dato = datetime.date.today().strftime("%d/%m/%Y")
    dwg_no = "SB.001.001" if ORIENTERING == "12_lodret" else "SB.001.001-V50"
    rev = "A"
    stem = os.path.join(out, f"Staalben_{ORIENTERING}")

    doc = App.newDocument("Staalben")
    ben, kasser = byg_model(doc)

    # kontrol: volumen af de fire stykker minus huller skal passe
    vol_kasser = sum(k.Shape.Volume for k in kasser)
    print(f"[staalben] orientering={ORIENTERING}  volumen stykker={vol_kasser:.0f} mm3  faerdig={ben.Shape.Volume:.0f} mm3  "
          f"huller={vol_kasser - ben.Shape.Volume:.0f} mm3  solids={len(ben.Shape.Solids)}  gyldig={ben.Shape.isValid()}")
    assert len(ben.Shape.Solids) == 1, "staalbenet er ikke eet sammenhaengende legeme"
    bb = ben.Shape.BoundBox
    print(f"[staalben] bbox X {bb.XMin:.1f}..{bb.XMax:.1f}  Y {bb.YMin:.1f}..{bb.YMax:.1f}  Z {bb.ZMin:.1f}..{bb.ZMax:.1f}")

    data = tegn(ben, kasser, stem + ".svg", stem + ".json", dato, dwg_no, rev)
    techdraw_ark(doc, ben, dwg_no, dato)

    Import.export([ben], stem + ".step")
    Mesh.export([ben], stem + ".stl")
    doc.saveAs(stem + ".FCStd")
    print(f"[staalben] skrevet: {stem}.{{FCStd,step,stl,svg,pdf,json}}  masse {data['masse_pr_ben_kg']} kg/ben")


main()
