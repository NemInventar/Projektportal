# -*- coding: utf-8 -*-
"""
A3-tegneark (420 x 297 mm, y nedad) med primitiver der kan skrives som SVG, PDF (standardfonte,
ikke indlejret, flere sider) og PNG (matplotlib, hvis tilgaengeligt - kun til kontrol).

Layout foelger Milots Fusion-ark: ramme med zoner 1-8 / A-F, titelfelt ISO 7200 nederst til hoejre,
stykliste over titelfeltet. Alle maal i mm paa papiret.
"""

import math
import zlib

W, H = 420.0, 297.0
FRAME = (10.0, 10.0, 400.0, 277.0)          # x, y, w, h  indre ramme


class Page:
    def __init__(self):
        self.d = []          # svg
        self.prim = []       # primitiver til pdf/png

    # ---- primitiver --------------------------------------------------------------
    def line(self, x1, y1, x2, y2, w=0.35, dash=None, color="#000"):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.d.append(f'<line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" stroke="{color}" stroke-width="{w}"{da} stroke-linecap="round"/>')
        self.prim.append(("poly", [(x1, y1), (x2, y2)], w, dash, color, False))

    def poly(self, pts, w=0.5, dash=None, color="#000", close=False):
        pts = list(pts)
        if close and pts and pts[0] != pts[-1]:
            pts = pts + [pts[0]]
        da = f' stroke-dasharray="{dash}"' if dash else ""
        p = " ".join(f"{x:.3f},{y:.3f}" for x, y in pts)
        self.d.append(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{w}"{da} stroke-linejoin="round"/>')
        self.prim.append(("poly", pts, w, dash, color, False))

    def rect(self, x, y, w, h, sw=0.5, color="#000"):
        self.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)], w=sw, color=color)

    def circle(self, cx, cy, r, w=0.35, dash=None, color="#000"):
        n = max(24, int(r * 8))
        pts = [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]
        self.poly(pts, w=w, dash=dash, color=color)

    def text(self, x, y, s, size=3.5, anchor="start", bold=False, rot=0, color="#000"):
        fw = ' font-weight="bold"' if bold else ""
        tr = f' transform="rotate({rot} {x:.3f} {y:.3f})"' if rot else ""
        se = str(s).replace("&", "&amp;").replace("<", "&lt;")
        self.d.append(f'<text x="{x:.3f}" y="{y:.3f}" font-family="Helvetica, Arial, sans-serif" font-size="{size}" text-anchor="{anchor}" fill="{color}"{fw}{tr}>{se}</text>')
        self.prim.append(("text", x, y, str(s), size, anchor, bold, rot, color))

    def arrow(self, x, y, ang, L=3.0, half=0.5, color="#000"):
        c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        p1 = (x, y); p2 = (x - L * c + half * s, y - L * s - half * c); p3 = (x - L * c - half * s, y - L * s + half * c)
        self.d.append(f'<polygon points="{p1[0]:.3f},{p1[1]:.3f} {p2[0]:.3f},{p2[1]:.3f} {p3[0]:.3f},{p3[1]:.3f}" fill="{color}"/>')
        self.prim.append(("fill", [p1, p2, p3], color))

    def dot(self, x, y, r=0.6, color="#000"):
        n = 12
        pts = [(x + r * math.cos(2 * math.pi * i / n), y + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
        self.d.append('<polygon points="' + " ".join(f"{a:.3f},{b:.3f}" for a, b in pts) + f'" fill="{color}"/>')
        self.prim.append(("fill", pts, color))

    # ---- maal --------------------------------------------------------------------
    def dim_h(self, x1, x2, y_geo, y_dim, tekst, size=3.0):
        """Vandret maal mellem x1..x2 (papir), fra geometri ved y_geo, maallinje ved y_dim."""
        x1, x2 = min(x1, x2), max(x1, x2)
        ext = 1.5 if y_dim < y_geo else -1.5
        self.line(x1, y_geo, x1, y_dim - ext, w=0.18)
        self.line(x2, y_geo, x2, y_dim - ext, w=0.18)
        ty = y_dim - 1.0 if y_dim <= y_geo else y_dim - 1.0
        if x2 - x1 < 9:
            self.line(x1 - 6, y_dim, x2 + 6, y_dim, w=0.18)
            self.arrow(x1, y_dim, 0); self.arrow(x2, y_dim, 180)
            self.text(x2 + 7, y_dim + 1.0, tekst, size=size)
        else:
            self.line(x1, y_dim, x2, y_dim, w=0.18)
            self.arrow(x1, y_dim, 180); self.arrow(x2, y_dim, 0)
            self.text((x1 + x2) / 2, ty, tekst, size=size, anchor="middle")

    def dim_v(self, y1, y2, x_geo, x_dim, tekst, size=3.0):
        y1, y2 = min(y1, y2), max(y1, y2)
        ext = 1.5 if x_dim < x_geo else -1.5
        self.line(x_geo, y1, x_dim - ext, y1, w=0.18)
        self.line(x_geo, y2, x_dim - ext, y2, w=0.18)
        if y2 - y1 < 9:
            self.line(x_dim, y1 - 6, x_dim, y2 + 6, w=0.18)
            self.arrow(x_dim, y1, 90); self.arrow(x_dim, y2, 270)
            self.text(x_dim, y1 - 7, tekst, size=size, anchor="middle")
        else:
            self.line(x_dim, y1, x_dim, y2, w=0.18)
            self.arrow(x_dim, y1, 270); self.arrow(x_dim, y2, 90)
            self.text(x_dim - 1.0, (y1 + y2) / 2, tekst, size=size, anchor="middle", rot=-90)

    def callout(self, px, py, tx, ty, lines, size=2.8):
        """Henvisning: pil til (px,py), knaek ved (tx,ty), tekst til hoejre for knaekket."""
        self.line(px, py, tx, ty, w=0.18)
        ang = math.degrees(math.atan2(py - ty, px - tx))
        self.arrow(px, py, ang, L=2.5, half=0.45)
        L = 4 + max(len(s) for s in lines) * size * 0.55
        self.line(tx, ty, tx + L, ty, w=0.18)
        for i, s in enumerate(lines):
            self.text(tx + 1, ty - 0.8 - (len(lines) - 1 - i) * (size + 0.8), s, size=size)

    def balloon(self, px, py, bx, by, nr):
        self.line(px, py, bx, by, w=0.18)
        ang = math.degrees(math.atan2(py - by, px - bx))
        self.arrow(px, py, ang, L=2.5, half=0.45)
        self.circle(bx, by, 3.2, w=0.3)
        self.text(bx, by + 1.2, str(nr), size=3.2, anchor="middle")

    def detail_marker(self, cx, cy, r, letter, lx, ly):
        self.circle(cx, cy, r, w=0.25)
        self.line(cx + r * 0.7071, cy - r * 0.7071, lx, ly, w=0.25)
        self.text(lx + 1, ly - 1, letter, size=4.5)

    # ---- ark-elementer -------------------------------------------------------------
    def frame(self):
        x, y, w, h = FRAME
        self.rect(x - 3, y - 3, w + 6, h + 6, sw=0.25)     # yderste kant
        self.rect(x, y, w, h, sw=0.7)
        for i in range(8):                                  # zoner 1-8
            xx = x + w * i / 8
            if i:
                self.line(xx, y - 3, xx, y, w=0.25); self.line(xx, y + h, xx, y + h + 3, w=0.25)
            self.text(xx + w / 16, y - 0.8, str(i + 1), size=2.2, anchor="middle")
            self.text(xx + w / 16, y + h + 2.6, str(i + 1), size=2.2, anchor="middle")
        for i in range(6):                                  # zoner A-F
            yy = y + h * i / 6
            if i:
                self.line(x - 3, yy, x, yy, w=0.25); self.line(x + w, yy, x + w + 3, yy, w=0.25)
            self.text(x - 1.5, yy + h / 12 + 0.8, "ABCDEF"[i], size=2.2, anchor="middle")
            self.text(x + w + 1.5, yy + h / 12 + 0.8, "ABCDEF"[i], size=2.2, anchor="middle")

    def title_block(self, f):
        """ISO 7200-felter i Milots Fusion-layout. f = dict med noegler:
        dept, techref, created_by, created_date, approved_by, doctype, status, title, dwg_no, rev, date, sheet,
        + valgfri: project, material, scale, finish."""
        x0, y0 = FRAME[0] + FRAME[2] - 180, FRAME[1] + FRAME[3] - 45
        self.rect(x0, y0, 180, 45, sw=0.7)

        def fit(x, y, s, size, max_w, bold=False, anchor="start"):
            """Skriv tekst, skrump skriften indtil den passer i max_w."""
            s = str(s)
            while size > 1.6 and text_width(s, size, bold) > max_w:
                size -= 0.2
            if text_width(s, size, bold) > max_w:                 # stadig for lang: klip
                while len(s) > 3 and text_width(s + "…", size, bold) > max_w:
                    s = s[:-1]
                s += "…"
            self.text(x, y, s, size=size, bold=bold, anchor=anchor)

        def cell(x, y, w, h, label, value, vs=3.0, bold=False):
            self.rect(x, y, w, h, sw=0.25)
            self.text(x + 0.8, y + 2.2, label, size=1.7, color="#333")
            if value:
                fit(x + 1.2, y + h - 1.6, value, vs, w - 2.4, bold)

        cell(x0, y0, 24, 11, "Dept.", f.get("dept", ""), vs=2.4)
        cell(x0 + 24, y0, 32, 11, "Technical reference", f.get("techref", ""), vs=2.4)
        cell(x0 + 56, y0, 62, 11, "Created by", "")
        fit(x0 + 57.2, y0 + 9.4, f.get("created_by", ""), 3.0, 40)
        self.text(x0 + 117, y0 + 9.4, f.get("created_date", ""), size=3.0, anchor="end")
        cell(x0 + 118, y0, 62, 11, "Approved by", f.get("approved_by", ""))
        # venstre blok raekke 2-4 (projekt + materiale)
        self.rect(x0, y0 + 11, 56, 34, sw=0.25)
        for i, (lab, key, extra) in enumerate((("Project", "project", ""), ("Material", "material", ""), ("Finish", "finish", ""),
                                               ("Scale / units / tolerances", "scale", "  ·  mm  ·  ISO 2768-m"))):
            yy = y0 + 11 + 8.5 * i
            self.text(x0 + 0.8, yy + 2.2, lab, size=1.7, color="#333")
            fit(x0 + 1.2, yy + 6.8, f.get(key, "") + extra, 2.4, 53)
        cell(x0 + 56, y0 + 11, 62, 8, "Document type", f.get("doctype", ""), vs=2.6)
        cell(x0 + 118, y0 + 11, 62, 8, "Document status", f.get("status", ""), vs=2.8, bold=True)
        cell(x0 + 56, y0 + 19, 62, 15, "Title", "")
        fit(x0 + 57.2, y0 + 31.5, f.get("title", ""), 4.5, 59, bold=True)
        cell(x0 + 118, y0 + 19, 62, 15, "DWG No.", "")
        fit(x0 + 119.2, y0 + 31.5, f.get("dwg_no", ""), 4.5, 59, bold=True)
        cell(x0 + 56, y0 + 34, 62, 11, "Model / generator", f.get("model", ""), vs=2.2)
        cell(x0 + 118, y0 + 34, 16, 11, "Rev.", f.get("rev", ""), vs=3.2)
        cell(x0 + 134, y0 + 34, 28, 11, "Date of issue", f.get("date", ""), vs=2.8)
        cell(x0 + 162, y0 + 34, 18, 11, "Sheet", f.get("sheet", ""), vs=3.2)

    def table(self, x, y, title, cols, rows, size=2.8, rh=5.5):
        """cols = [(header, width)], rows = [[...]]. Returnerer hoejden."""
        wtot = sum(w for _, w in cols)
        self.rect(x, y, wtot, rh, sw=0.35)
        self.text(x + wtot / 2, y + rh - 1.5, title, size=3.2, anchor="middle")
        yy = y + rh
        for r, row in enumerate([[h for h, _ in cols]] + rows):
            xx = x
            for c, (val, (_, w)) in enumerate(zip(row, cols)):
                self.rect(xx, yy, w, rh, sw=0.25)
                self.text(xx + 1, yy + rh - 1.5, val, size=size, bold=(r == 0))
                xx += w
            yy += rh
        return yy - y

    def notes(self, x, y, title, lines, size=2.6, color="#000"):
        self.text(x, y, title, size=3.2, bold=True, color=color)
        for i, s in enumerate(lines):
            self.text(x, y + 4.5 + (size + 1.4) * i, s, size=size, color=color)
        return 4.5 + (size + 1.4) * len(lines)

    # ---- output ------------------------------------------------------------------
    def svg(self):
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">\n'
                '<rect width="420" height="297" fill="#fff"/>\n' + "\n".join(self.d) + "\n</svg>\n")


# ---------------------------------------------------------------------------------
# PDF med flere sider, Helvetica standardfont (ikke indlejret)
# ---------------------------------------------------------------------------------

_W = {c: 556 for c in "0123456789"}
_W.update({" ": 278, ".": 278, ",": 278, ":": 278, ";": 278, "-": 333, "/": 278, "(": 333, ")": 333,
           "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556, "h": 556, "i": 222, "j": 222,
           "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333, "s": 500, "t": 278,
           "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
           "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278, "J": 500,
           "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611,
           "U": 722, "V": 667, "W": 944, "X": 667, "Y": 667, "Z": 611,
           "Ø": 778, "°": 400, "·": 278, "=": 584, "+": 584, "'": 191, "%": 889, "_": 556, "#": 556, "±": 584, "×": 584})


def text_width(s, size, bold=False):
    return sum(_W.get(ch, 556) for ch in s) / 1000.0 * size * (1.08 if bold else 1.0)


def _rgb(color):
    c = color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _page_stream(page):
    K = 72.0 / 25.4

    def P(x, y):
        return f"{x * K:.2f} {(H - y) * K:.2f}"

    ops = ["1 J 1 j"]
    for p in page.prim:
        if p[0] == "poly":
            _, pts, w, dash, color, _ = p
            r, g, b = _rgb(color)
            ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG {w * K:.2f} w")
            ops.append("[" + " ".join(f"{float(v) * K:.2f}" for v in dash.split()) + "] 0 d" if dash else "[] 0 d")
            ops.append(" ".join(f"{P(x, y)} {'m' if i == 0 else 'l'}" for i, (x, y) in enumerate(pts)) + " S")
        elif p[0] == "fill":
            _, pts, color = p
            r, g, b = _rgb(color)
            ops.append(f"{r:.3f} {g:.3f} {b:.3f} rg " + " ".join(f"{P(x, y)} {'m' if i == 0 else 'l'}" for i, (x, y) in enumerate(pts)) + " h f")
        elif p[0] == "text":
            _, x, y, s, size, anchor, bold, rot, color = p
            r, g, b = _rgb(color)
            w = text_width(s, size, bold)
            dx = -w / 2 if anchor == "middle" else (-w if anchor == "end" else 0.0)
            a = math.radians(-rot)
            ca, sa = math.cos(a), math.sin(a)
            ox = x + dx * math.cos(math.radians(rot)); oy = y + dx * math.sin(math.radians(rot))
            esc = s.encode("cp1252", "replace").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)").decode("latin-1")
            ops.append(f"BT {r:.3f} {g:.3f} {b:.3f} rg {'/FB' if bold else '/F'} {size * K:.2f} Tf {ca:.4f} {sa:.4f} {-sa:.4f} {ca:.4f} {P(ox, oy)} Tm ({esc}) Tj ET")
    return zlib.compress("\n".join(ops).encode("latin-1"))


def write_pdf(pages, path):
    K = 72.0 / 25.4
    objs = [None, None]                      # 1 catalog, 2 pages (udfyldes)
    font_f = len(objs) + 1; objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    font_b = len(objs) + 1; objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    kids = []
    for pg in pages:
        stream = _page_stream(pg)
        cid = len(objs) + 1
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" /Filter /FlateDecode >>\nstream\n" + stream + b"\nendstream")
        pid = len(objs) + 1
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W * K:.2f} {H * K:.2f}] /Contents {cid} 0 R /Resources << /Font << /F {font_f} 0 R /FB {font_b} 0 R >> >> >>".encode())
        kids.append(pid)
    objs[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objs[1] = ("<< /Type /Pages /Kids [" + " ".join(f"{k} 0 R" for k in kids) + f"] /Count {len(kids)} >>").encode()
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
    with open(path, "wb") as f:
        f.write(bytes(out))


def write_png(page, path, dpi=150):
    """Kontrol-billede. Kraever matplotlib; returnerer False hvis det mangler."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Polygon
    except Exception:
        return False
    fig = plt.figure(figsize=(W / 25.4, H / 25.4), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(H, 0); ax.set_axis_off()
    for p in page.prim:
        if p[0] == "poly":
            _, pts, w, dash, color, _ = p
            xs, ys = zip(*pts)
            ax.plot(xs, ys, color=color, lw=w * 72 / 25.4 * 1.0, ls=(0, tuple(float(v) for v in dash.split())) if dash else "-", solid_capstyle="round")
        elif p[0] == "fill":
            ax.add_patch(Polygon(p[1], closed=True, color=p[2]))
        elif p[0] == "text":
            _, x, y, s, size, anchor, bold, rot, color = p
            ha = {"start": "left", "middle": "center", "end": "right"}[anchor]
            ax.text(x, y, s, fontsize=size * 72 / 25.4 * 0.92, ha=ha, va="baseline", rotation=-rot, rotation_mode="anchor",
                    color=color, fontweight="bold" if bold else "normal", family="sans-serif")
    fig.savefig(path, dpi=dpi, facecolor="white")
    plt.close(fig)
    return True
