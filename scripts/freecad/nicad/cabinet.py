# -*- coding: utf-8 -*-
"""
Parametrisk skab: korpus (2 sider, top, bund, bagplade i not) + 1 laage med kophaengsler.
Valgfrie features (locker): perforering, kombinationslaas, haengsel-udsparing, vaegbeslag,
ophaengsslids, O8-blindhuller i sider, huller i bagplade.

Rent Python. Konfiguration = dict (typisk fra JSON). Hvert afledt maal faar en kilde.

Lokalt koordinatsystem pr. del: a (bredde/dybde), b (hoejde), t (tykkelse), flade '+' = t=T.
a x b = t. Set fra '+' med b opad ligger a mod hoejre; set fra '-' spejles a.
Globalt: X = bredde (0 = venstre yderside), Y = dybde (0 = korpus forkant, + bagud), Z = hoejde.
"""

import math

DEFAULTS = dict(
    dwg_prefix="SK.001", variant_suffix="",     # suffix ("_1") paa laage og venstre side (locker-varianter)
    title="Cabinet", project="",
    W=500, H=2000, D=622,
    T=19, T_back=6,
    material="MDF oak veneer 19 mm", material_back="Oak veneer plywood 6 mm", finish="Oil (Rubio Oil Plus 2C)",
    rabbet_t=10, rabbet_w=None, back_clearance=1,
    # laage
    door=True, door_gap=2, door_gap_top=None, door_gap_bottom=2, door_offset=0.7, hinge_side="right",
    door_edge_round=None,                       # fx 2 -> note "front outer edges R2" (efterbearbejdning)
    # haengsler (kop i laage, plade i side)
    hinge_count=None, hinge_end=100,
    hinge_cup_d=35, hinge_cup_depth=13, hinge_cup_edge=21.5,
    hinge_pilot_d=2, hinge_pilot_depth=17, hinge_pilot_da=9.5, hinge_pilot_db=22.5,
    hinge_notch=None,                           # {"depth":4, "length":43, "r":6}
    hinge_plate_front=37, hinge_plate_d=5, hinge_plate_depth=12, hinge_plate_db=16,
    hinge_plate_pilot=None,                     # {"front":18.5, "d":2, "depth":10}  een pr. haengsel paa haengselcenter
    hinge_name="Concealed hinge Ø35 cup, full overlay, soft-close (e.g. Blum CLIP top BLUMOTION 110°)",
    # korpus-skruer sider -> top/bund
    screw_d=5, screw_csk_d=9.78, screw_csk_angle=100, screw_edge=30, screw_pitch_max=200,
    pilot_d=3, pilot_depth=20,
    # valgfrit
    shelf_pins=False, shelf_pin_d=5, shelf_pin_depth=13, shelf_pin_front=37, shelf_pin_pitch=32, shelf_pin_margin=120,
    back_screws=True, back_screw_d=3, back_screw_pitch_max=250,
    perforation=None,       # {"d":8, "pitch":30, "cols":8, "rows":25, "margin_a":43, "margin_b":38}
    lock=None,              # {"edge":65, "end":74, "from":"top", "sq":15.5, "r":9.3, "ear_r":4, "pocket_d":35, "pocket_depth":3,
                            #  "bumpers":{"d":5,"depth":7,"edge":9.5,"end":69}, "name": "..."}
    wall_brackets=None,     # {"a_from_back":[19,51], "b_from_top":69, "d":2, "depth":10, "name": "..."}
    hanger_slot=None,       # {"side":"left", "a_from_front":14, "w":6, "L":35, "depth":6, "top":51.5} eller "bottom":65.5
    side_blind=None,        # {"d":8, "a":195, "b":55, "depth":12}
    back_holes=None,        # {"d":21, "x":39, "top":58}
    extra_bom=[],           # [[qty, part, description], ...]
)

LIMITS = dict(W=(250, 1200), H=(300, 2600), D=(200, 800), T=(12, 30), T_back=(3, 12))
HINGE_TABLE = [(900, 2), (1600, 3), (2200, 4), (2600, 5)]


def spaced(edge, length, pitch_max, n_min=2):
    span = length - 2 * edge
    n = max(n_min, int(math.ceil(span / pitch_max)) + 1)
    return [round(edge + span * i / (n - 1), 1) for i in range(n)]


class Part2D:
    def __init__(self, dwg, navn, A, B, T, materiale, qty=1):
        self.dwg, self.navn, self.A, self.B, self.T, self.materiale, self.qty = dwg, navn, A, B, T, materiale, qty
        self.holes, self.csk, self.rabbets, self.slots, self.pockets = [], [], [], [], []
        self.lock, self.notches, self.edge_holes, self.noter = None, [], [], []
        self.groups = {}

    def hole(self, a, b, d, depth=None, face="+", group=None):
        self.holes.append(dict(a=a, b=b, d=d, depth=depth, face=face, group=group))

    def as_dict(self):
        return dict(dwg=self.dwg, navn=self.navn, A=self.A, B=self.B, T=self.T, materiale=self.materiale, qty=self.qty,
                    holes=self.holes, csk=self.csk, rabbets=self.rabbets, slots=self.slots, pockets=self.pockets,
                    lock=self.lock, notches=self.notches, edge_holes=self.edge_holes, noter=self.noter)


class Cabinet:
    def __init__(self, cfg):
        c = dict(DEFAULTS); c.update(cfg)
        for k, (lo, hi) in LIMITS.items():
            if not lo <= c[k] <= hi:
                raise ValueError(f"{k}={c[k]} uden for graenser {lo}..{hi}")
        if c["rabbet_w"] is None:
            c["rabbet_w"] = c["T_back"] + 1.5
        if c["door_gap_top"] is None:
            c["door_gap_top"] = c["door_gap"]
        self.c = c
        self.src = {}
        self.derived()
        self.parts = {}
        self.build()

    def p(self, k, v, kilde):
        self.c[k] = v; self.src[k] = kilde
        return v

    def derived(self):
        c = self.c
        for k in ("W", "H", "D", "T", "T_back", "door_gap", "door_gap_top", "door_gap_bottom", "door_offset", "hinge_side"):
            self.src[k] = "CONFIG"
        self.p("inner_W", c["W"] - 2 * c["T"], "AFLEDT: W - 2T")
        self.p("back_W", c["inner_W"] + 2 * c["rabbet_t"], "AFLEDT: inner_W + 2 x rabbet_t")
        self.p("back_H", c["H"] - 2 * c["T"] + 2 * c["rabbet_t"], "AFLEDT: H - 2T + 2 x rabbet_t")
        self.p("door_W", c["W"] - 2 * c["door_gap"], "AFLEDT: W - 2 x door_gap")
        self.p("door_H", c["H"] - c["door_gap_bottom"] - c["door_gap_top"], "AFLEDT: H - gap bund - gap top")
        self.p("screw_pos", spaced(c["screw_edge"], c["D"], c["screw_pitch_max"], 3), f"AFLEDT: {c['screw_edge']:g} fra kanter, hoejst {c['screw_pitch_max']:g} imellem")
        if c["hinge_count"] is None:
            n = next((n for hmax, n in HINGE_TABLE if c["door_H"] <= hmax), HINGE_TABLE[-1][1])
            self.p("hinge_count", n, f"AFLEDT: laagehoejde {c['door_H']:.0f} -> {n} haengsler (Blum-tabel)")
        else:
            self.src["hinge_count"] = "CONFIG"
        self.p("hinge_pos", spaced(c["hinge_end"], c["door_H"], 10 ** 9, c["hinge_count"]), f"AFLEDT: {c['hinge_end']:g} fra laagens ender, resten ligeligt")
        self.p("csk_depth", round((c["screw_csk_d"] - c["screw_d"]) / 2 / math.tan(math.radians(c["screw_csk_angle"] / 2)), 2), "AFLEDT: forsaenkningsdybde")

    # ---- dele -----------------------------------------------------------------------
    def build(self):
        c = self.c
        pre, sfx = c["dwg_prefix"], c["variant_suffix"]
        T, D, H, W = c["T"], c["D"], c["H"], c["W"]
        hinge_right = c["hinge_side"] == "right"

        def side(dwg, navn, back_at, hinge, slot):
            p = Part2D(dwg, navn, D, H, T, c["material"])
            fb = (lambda d: D - d) if back_at == "a1" else (lambda d: d)      # afstand fra bagkant -> a
            ff = (lambda d: d) if back_at == "a1" else (lambda d: D - d)      # afstand fra forkant -> a
            p.rabbets.append(dict(edge=back_at, width=c["rabbet_w"], depth_t=c["rabbet_t"], face="+"))
            for a in c["screw_pos"]:
                for b in (T / 2, H - T / 2):
                    p.csk.append(dict(a=a, b=b, face="-"))
            p.groups["csk"] = f"{2 * len(c['screw_pos'])}x Ø{c['screw_d']:g} thru, csk Ø{c['screw_csk_d']:g} x {c['screw_csk_angle']}° from outside"
            if hinge:
                for hb in c["hinge_pos"]:
                    b = c["door_gap_bottom"] + hb
                    for db in (-c["hinge_plate_db"], c["hinge_plate_db"]):
                        p.hole(ff(c["hinge_plate_front"]), b + db, c["hinge_plate_d"], c["hinge_plate_depth"], "+", "hinge_plate")
                    hp = c["hinge_plate_pilot"]
                    if hp:
                        p.hole(ff(hp["front"]), b, hp["d"], hp["depth"], "+", "hinge_plate_pilot")
                p.groups["hinge_plate"] = f"{2 * len(c['hinge_pos'])}x Ø{c['hinge_plate_d']:g} x {c['hinge_plate_depth']:g} hinge mounting plate, {c['hinge_plate_front']:g} from front, {2 * c['hinge_plate_db']:g} apart"
                if c["hinge_plate_pilot"]:
                    p.groups["hinge_plate_pilot"] = f"{len(c['hinge_pos'])}x Ø{hp['d']:g} x {hp['depth']:g} pilot, {hp['front']:g} from front"
            if c["shelf_pins"]:
                for a in (ff(c["shelf_pin_front"]), fb(c["shelf_pin_front"] + c["rabbet_w"])):
                    b = c["shelf_pin_margin"]
                    while b <= H - c["shelf_pin_margin"]:
                        p.hole(a, b, c["shelf_pin_d"], c["shelf_pin_depth"], "+", "shelf_pin"); b += c["shelf_pin_pitch"]
                p.groups["shelf_pin"] = f"Ø{c['shelf_pin_d']:g} x {c['shelf_pin_depth']:g} shelf pin rows, pitch {c['shelf_pin_pitch']:g} (system 32)"
            if c["back_screws"]:
                for b in spaced(60, H, c["back_screw_pitch_max"]):
                    p.hole(fb(c["rabbet_w"] / 2), b, c["back_screw_d"], 12, "+", "back_screw")
                p.groups["back_screw"] = f"Ø{c['back_screw_d']:g} x 12 pilot for back panel screws, in rabbet"
            wb = c["wall_brackets"]
            if wb:
                for d in wb["a_from_back"]:
                    p.hole(fb(d), H - wb["b_from_top"], wb["d"], wb["depth"], "+", "wall_bracket")
                p.groups["wall_bracket"] = f"{len(wb['a_from_back'])}x Ø{wb['d']:g} x {wb['depth']:g} pilot, wall bracket, {'/'.join(f'{x:g}' for x in wb['a_from_back'])} from back"
            sb = c["side_blind"]
            if sb:
                for b in (sb["b"], H - sb["b"]):
                    p.hole(fb(D - sb["a"]) if back_at == "a1" else ff(sb["a"]), b, sb["d"], sb["depth"], "+", "side_blind")
                p.groups["side_blind"] = f"2x Ø{sb['d']:g} x {sb['depth']:g} blind (depth not on drawing)"
            if slot:
                hs = c["hanger_slot"]
                if "top" in hs:
                    b1 = H - hs["top"]; b0 = b1 - hs["L"]
                else:
                    b0 = hs["bottom"]; b1 = b0 + hs["L"]
                p.slots.append(dict(a=ff(hs["a_from_front"]), b0=b0, b1=b1, w=hs["w"], depth=hs["depth"], face="+", group="hanger_slot"))
                p.groups["hanger_slot"] = f"Slot {hs['w']:g} x {hs['L']:g} x {hs['depth']:g} deep for hanger, {hs['a_from_front']:g} from front"
            p.noter = ["Face '+' = inside. Face '-' = outside (visible).", "Rabbet for back panel on inside, full height.", "Deburr front edges."]
            return p

        hs = c["hanger_slot"]
        self.parts["left"] = side(f"{pre}.002{sfx}", "Locker korpus, left side" if c["perforation"] else "Side, left", "a1",
                                  hinge=not hinge_right, slot=bool(hs and hs.get("side", "left") == "left"))
        self.parts["right"] = side(f"{pre}.003", "Locker korpus, right side" if c["perforation"] else "Side, right", "a0",
                                   hinge=hinge_right, slot=bool(hs and hs.get("side") == "right"))

        tb = Part2D(f"{pre}.004", "Top and bottom", c["inner_W"], D, T, c["material"], qty=2)
        tb.rabbets.append(dict(edge="b1", width=c["rabbet_w"], depth_t=c["rabbet_t"], face="+"))
        for edge in ("a0", "a1"):
            for pos in c["screw_pos"]:
                tb.edge_holes.append(dict(edge=edge, pos_b=pos, t=T / 2, d=c["pilot_d"], depth=c["pilot_depth"]))
        if c["back_screws"]:
            for a in spaced(40, c["inner_W"], c["back_screw_pitch_max"]):
                tb.hole(a, D - c["rabbet_w"] / 2, c["back_screw_d"], 12, "+", "back_screw")
            tb.groups["back_screw"] = f"Ø{c['back_screw_d']:g} x 12 pilot for back panel screws, in rabbet"
        tb.noter = ["Face '+' = inside. b = depth, b=0 front edge, rabbet at back edge.",
                    f"{2 * len(c['screw_pos'])}x Ø{c['pilot_d']:g} x {c['pilot_depth']:g} pilot holes in side edges (edge drilling).", "Deburr front edges."]
        self.parts["topbottom"] = tb

        bk = Part2D(f"{pre}.005", "Back panel", c["back_W"], c["back_H"], c["T_back"], c["material_back"])
        bh = c["back_holes"]
        if bh:
            for a in (bh["x"], c["back_W"] - bh["x"]):
                bk.hole(a, c["back_H"] - bh["top"], bh["d"], None, "+", "back_hole")
            bk.groups["back_hole"] = f"2x Ø{bh['d']:g} thru"
        bk.noter = ["Sits in the rabbet." + (" Screwed from behind." if c["back_screws"] else "")]
        self.parts["back"] = bk

        if c["door"]:
            dw, dh = c["door_W"], c["door_H"]
            dr = Part2D(f"{pre}.001{sfx}", "Locker korpus, front" if c["perforation"] else "Door", dw, dh, T, c["material"])
            he = c["hinge_cup_edge"]
            hinge_a = dw - he if hinge_right else he
            pilot_a = hinge_a - c["hinge_pilot_da"] if hinge_right else hinge_a + c["hinge_pilot_da"]
            for b in c["hinge_pos"]:
                dr.pockets.append(dict(a=hinge_a, b=b, d=c["hinge_cup_d"], depth=c["hinge_cup_depth"], face="-", group="hinge_cup"))
                for db in (-c["hinge_pilot_db"], c["hinge_pilot_db"]):
                    dr.hole(pilot_a, b + db, c["hinge_pilot_d"], c["hinge_pilot_depth"], "-", "hinge_pilot")
                if c["hinge_notch"]:
                    n = c["hinge_notch"]
                    dr.notches.append(dict(edge="a1" if hinge_right else "a0", b=b, length=n["length"], depth=n["depth"], r=n["r"]))
            dr.groups["hinge_cup"] = f"{len(c['hinge_pos'])}x Ø{c['hinge_cup_d']:g} x {c['hinge_cup_depth']:g} hinge cup, {he:g} from edge"
            dr.groups["hinge_pilot"] = f"{2 * len(c['hinge_pos'])}x Ø{c['hinge_pilot_d']:g} x {c['hinge_pilot_depth']:g}, {2 * c['hinge_pilot_db']:g}/{c['hinge_pilot_da']:g} pattern"
            lk = c["lock"]
            lock_ab = None
            if lk:
                la = dw - lk["edge"] if hinge_right else lk["edge"]          # laas i modsat kant af haengslerne
                lb = dh - lk["end"] if lk.get("from", "top") == "top" else lk["end"]
                lock_ab = (la, lb)
                dr.lock = dict(a=la, b=lb, sq=lk["sq"], r=lk["r"], ear_r=lk["ear_r"])
                dr.pockets.append(dict(a=la, b=lb, d=lk["pocket_d"], depth=lk["pocket_depth"], face="-", group="lock_pocket"))
                dr.groups["lock_pocket"] = f"Ø{lk['pocket_d']:g} x {lk['pocket_depth']:g} pocket for lock, thru Ø{2 * lk['r']:g} clipped to {lk['sq']:g} + R{lk['ear_r']:g} ears"
                bp = lk.get("bumpers")
                if bp:
                    ba = dw - bp["edge"] if hinge_right else bp["edge"]
                    for b in (bp["end"], dh / 2, dh - bp["end"]):
                        dr.hole(ba, b, bp["d"], bp["depth"], "-", "bumper")
                    dr.groups["bumper"] = f"3x Ø{bp['d']:g} x {bp['depth']:g}, {bp['edge']:g} from lock edge"
            pf = c["perforation"]
            if pf:
                omitted = 0
                for i in range(pf["cols"]):
                    for j in range(pf["rows"]):
                        a = pf["margin_a"] + i * pf["pitch"]; b = dh - pf["margin_b"] - j * pf["pitch"]
                        if lock_ab and math.hypot(a - lock_ab[0], b - lock_ab[1]) < lk["pocket_d"] / 2:
                            omitted += 1; continue
                        dr.hole(a, b, pf["d"], None, "+", "perforation")
                dr.groups["perforation"] = f"{pf['cols'] * pf['rows'] - omitted}x Ø{pf['d']:g} thru, pitch {pf['pitch']:g} ({pf['cols']} x {pf['rows']}{', 1 omitted at lock' if omitted else ''})"
                self.p("perf_omitted", omitted, "AFLEDT: perforeringshuller inde i laaselommen udelades")
            dr.noter = ["Face '+' = FRONT (visible). Face '-' = BACK: hinge cups, lock pocket, pilot holes.",
                        f"Hinges on the {c['hinge_side']} side seen from the front."]
            if c["door_edge_round"]:
                dr.noter.append(f"Front outer edges rounded R{c['door_edge_round']:g}. Deburr backside outer edges.")
            self.parts["door"] = dr

    # ---- samling -----------------------------------------------------------------------
    def assembly(self):
        c = self.c
        W, H, D, T = c["W"], c["H"], c["D"], c["T"]
        yb = D - c["back_clearance"]
        inst = [
            ("LeftSide", self.parts["left"], ((0, 0, 1), (1, 0, 0), (0, 1, 0)), (0, 0, 0)),
            ("RightSide", self.parts["right"], ((0, 0, -1), (-1, 0, 0), (0, 1, 0)), (W, D, 0)),
            ("Bottom", self.parts["topbottom"], ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (T, 0, 0)),
            ("Top", self.parts["topbottom"], ((-1, 0, 0), (0, 1, 0), (0, 0, -1)), (W - T, 0, H)),
            ("Back", self.parts["back"], ((1, 0, 0), (0, 0, -1), (0, 1, 0)), (T - c["rabbet_t"], yb, T - c["rabbet_t"])),
        ]
        if c["door"]:
            inst.append(("Door", self.parts["door"], ((1, 0, 0), (0, 0, -1), (0, 1, 0)), (c["door_gap"], -c["door_offset"], c["door_gap_bottom"])))
        return inst

    def bom(self):
        c = self.c
        rows = []
        for key, item in (("door", 1), ("left", 2), ("right", 3), ("topbottom", 4), ("back", 5)):
            if key in self.parts:
                p = self.parts[key]
                rows.append((str(item), str(p.qty), p.dwg, f"{p.navn} - {p.materiale}, {p.A:g} x {p.B:g} x {p.T:g}"))
        n = 6
        if c["door"]:
            rows.append((str(n), str(c["hinge_count"]), "Hinge", c["hinge_name"])); n += 1
        if c["lock"]:
            rows.append((str(n), "1", "Lock", c["lock"].get("name", "Combination cam lock"))); n += 1
        if c["wall_brackets"]:
            rows.append((str(n), "2", "Wall bracket", c["wall_brackets"].get("name", "Wall mount bracket"))); n += 1
        if c["hanger_slot"]:
            rows.append((str(n), "1", "Hanger", c["hanger_slot"].get("name", "Hanger fitting"))); n += 1
        for qty, part, desc in c["extra_bom"]:
            rows.append((str(n), str(qty), part, desc)); n += 1
        rows.append((str(n), str(2 * len(c["screw_pos"]) * 2), "Screw", f"Screw Ø{c['screw_d']:g} x 50, countersunk")); n += 1
        return rows

    def antagelser(self):
        return [f"{k} = {v}: {self.src[k]}" for k, v in self.c.items() if k in self.src and self.src[k].startswith("AFLEDT")]
