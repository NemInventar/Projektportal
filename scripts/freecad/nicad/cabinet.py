# -*- coding: utf-8 -*-
"""
Parametrisk skab: korpus (2 sider, top, bund, bagplade i not) + 1 laage med kophaengsler.
Rent Python. Konfiguration = dict (typisk fra JSON). Hvert afledt maal faar en kilde.

Lokalt koordinatsystem pr. del: a (bredde/dybde), b (hoejde), t (tykkelse), flade '+' = t=T.
a x b = t. Set fra '+' med b opad ligger a mod hoejre; set fra '-' spejles a.
Globalt: X = bredde (0 = venstre yderside), Y = dybde (0 = korpus forkant, + bagud), Z = hoejde.

Konfigurationsnoegler (mm) - se DEFAULTS. Grænser i LIMITS; udenfor -> ValueError.
"""

import math

DEFAULTS = dict(
    dwg_prefix="SK.001",           # samling SK.001.000, dele .001 (laage) .002 (venstre) .003 (hoejre) .004 (top/bund) .005 (bag)
    title="Cabinet",
    project="",
    W=500, H=2000, D=622,          # udvendige maal korpus (D = korpusdybde uden laage)
    T=19, T_back=6,
    material="MDF oak veneer 19 mm", material_back="Oak veneer plywood 6 mm", finish="Oil (Rubio Oil Plus 2C)",
    rabbet_t=10, rabbet_w=None,    # not til bagplade: ind i tykkelsen / bredde fra bagkant (None -> T_back + 1.5)
    back_clearance=1,              # luft mellem bagpladens bagside og korpus bagkant
    door=True, door_gap=2, door_gap_bottom=2, door_offset=0.7, hinge_side="right",   # set fra front
    hinge_cup_d=35, hinge_cup_depth=13, hinge_cup_edge=21.5, hinge_end=100,
    hinge_pilot_d=2, hinge_pilot_depth=17, hinge_pilot_da=9.5, hinge_pilot_db=22.5,
    hinge_plate_front=37, hinge_plate_d=5, hinge_plate_depth=12, hinge_plate_db=16,
    hinge_count=None,              # None -> efter hoejde
    screw_d=5, screw_csk_d=9.78, screw_csk_angle=100, screw_edge=30, screw_pitch_max=200,
    pilot_d=3, pilot_depth=20,
    shelf_pins=False, shelf_pin_d=5, shelf_pin_depth=13, shelf_pin_front=37, shelf_pin_pitch=32, shelf_pin_margin=120,
    back_screws=True, back_screw_d=3, back_screw_pitch_max=250,
)

LIMITS = dict(W=(250, 1200), H=(300, 2600), D=(200, 800), T=(12, 30), T_back=(3, 12))

HINGE_TABLE = [(900, 2), (1600, 3), (2200, 4), (2600, 5)]   # laagehoejde -> antal haengsler (Blum-vejledning)


def spaced(edge, length, pitch_max, n_min=2):
    """Positioner fra 'edge' til 'length-edge' med hoejst pitch_max imellem."""
    span = length - 2 * edge
    n = max(n_min, int(math.ceil(span / pitch_max)) + 1)
    return [round(edge + span * i / (n - 1), 1) for i in range(n)]


class Part2D:
    def __init__(self, dwg, navn, A, B, T, materiale, qty=1):
        self.dwg, self.navn, self.A, self.B, self.T, self.materiale, self.qty = dwg, navn, A, B, T, materiale, qty
        self.holes, self.csk, self.rabbets, self.slots, self.pockets = [], [], [], [], []
        self.lock, self.notches, self.edge_holes, self.noter = None, [], [], []
        self.groups = {}       # navn -> beskrivelse til tegning (callouts)

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
        self.c = c
        self.src = {}          # parameter -> kilde
        self.derived()
        self.parts = {}
        self.build()

    def p(self, k, v, kilde):
        self.c[k] = v; self.src[k] = kilde
        return v

    # ---- afledte maal ---------------------------------------------------------------
    def derived(self):
        c = self.c
        for k in ("W", "H", "D", "T", "T_back", "door_gap", "door_gap_bottom", "door_offset", "hinge_side"):
            self.src[k] = "CONFIG"
        self.p("inner_W", c["W"] - 2 * c["T"], "AFLEDT: W - 2T")
        self.p("back_W", c["inner_W"] + 2 * c["rabbet_t"], "AFLEDT: inner_W + 2 x rabbet_t")
        self.p("back_H", c["H"] - 2 * c["T"] + 2 * c["rabbet_t"], "AFLEDT: H - 2T + 2 x rabbet_t")
        self.p("door_W", c["W"] - 2 * c["door_gap"], "AFLEDT: W - 2 x door_gap")
        self.p("door_H", c["H"] - c["door_gap_bottom"] - c["door_gap"], "AFLEDT: H - gap bund - gap top")
        self.p("screw_pos", spaced(c["screw_edge"], c["D"], c["screw_pitch_max"], 3), "AFLEDT: 30 fra kanter, hoejst 200 imellem")
        if c["hinge_count"] is None:
            n = next((n for hmax, n in HINGE_TABLE if c["door_H"] <= hmax), HINGE_TABLE[-1][1])
            self.p("hinge_count", n, f"AFLEDT: laagehoejde {c['door_H']:.0f} -> {n} haengsler (Blum-tabel)")
        else:
            self.src["hinge_count"] = "CONFIG"
        self.p("hinge_pos", spaced(c["hinge_end"], c["door_H"], 10 ** 9, c["hinge_count"]), "AFLEDT: hinge_end fra laagens ender, resten ligeligt")
        self.p("csk_depth", round((c["screw_csk_d"] - c["screw_d"]) / 2 / math.tan(math.radians(c["screw_csk_angle"] / 2)), 2), "AFLEDT: forsaenkningsdybde")

    # ---- dele -----------------------------------------------------------------------
    def build(self):
        c = self.c
        pre = c["dwg_prefix"]
        T, D, H, W = c["T"], c["D"], c["H"], c["W"]

        def side(dwg, navn, back_at, hinge):
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
                p.groups["hinge_plate"] = f"{2 * len(c['hinge_pos'])}x Ø{c['hinge_plate_d']:g} x {c['hinge_plate_depth']:g} hinge mounting plates, {c['hinge_plate_front']:g} from front, 32 apart"
            if c["shelf_pins"]:
                for a in (ff(c["shelf_pin_front"]), fb(c["shelf_pin_front"] + c["rabbet_w"])):
                    b = c["shelf_pin_margin"]
                    while b <= H - c["shelf_pin_margin"]:
                        p.hole(a, b, c["shelf_pin_d"], c["shelf_pin_depth"], "+", "shelf_pin")
                        b += c["shelf_pin_pitch"]
                p.groups["shelf_pin"] = f"Ø{c['shelf_pin_d']:g} x {c['shelf_pin_depth']:g} shelf pin rows, pitch {c['shelf_pin_pitch']:g} (system 32)"
            if c["back_screws"]:
                for b in spaced(60, H, c["back_screw_pitch_max"]):
                    p.hole(fb(c["rabbet_w"] / 2), b, c["back_screw_d"], 12, "+", "back_screw")
                p.groups["back_screw"] = f"Ø{c['back_screw_d']:g} x 12 pilot for back panel screws, in rabbet"
            p.noter = ["Face '+' = inside. Face '-' = outside (visible).", "Rabbet for back panel on inside, full height.", "Deburr front edge."]
            return p

        hinge_right = c["hinge_side"] == "right"
        self.parts["left"] = side(f"{pre}.002", "Side, left", "a1", hinge=not hinge_right)
        self.parts["right"] = side(f"{pre}.003", "Side, right", "a0", hinge=hinge_right)

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
                    f"{2 * len(c['screw_pos'])}x Ø{c['pilot_d']:g} x {c['pilot_depth']:g} pilot holes in side edges (edge drilling).", "Deburr front edge."]
        self.parts["topbottom"] = tb

        bk = Part2D(f"{pre}.005", "Back panel", c["back_W"], c["back_H"], c["T_back"], c["material_back"])
        bk.noter = ["Sits in the rabbet, screwed from behind. Grain vertical."]
        self.parts["back"] = bk

        if c["door"]:
            dw, dh = c["door_W"], c["door_H"]
            dr = Part2D(f"{pre}.001", "Door", dw, dh, T, c["material"])
            hinge_a = dw - c["hinge_cup_edge"] if hinge_right else c["hinge_cup_edge"]
            pilot_a = hinge_a - c["hinge_pilot_da"] if hinge_right else hinge_a + c["hinge_pilot_da"]
            for b in c["hinge_pos"]:
                dr.pockets.append(dict(a=hinge_a, b=b, d=c["hinge_cup_d"], depth=c["hinge_cup_depth"], face="-", group="hinge_cup"))
                for db in (-c["hinge_pilot_db"], c["hinge_pilot_db"]):
                    dr.hole(pilot_a, b + db, c["hinge_pilot_d"], c["hinge_pilot_depth"], "-", "hinge_pilot")
            dr.groups["hinge_cup"] = f"{len(c['hinge_pos'])}x Ø{c['hinge_cup_d']:g} x {c['hinge_cup_depth']:g} hinge cup, {c['hinge_cup_edge']:g} from edge"
            dr.groups["hinge_pilot"] = f"{2 * len(c['hinge_pos'])}x Ø{c['hinge_pilot_d']:g} x {c['hinge_pilot_depth']:g}, 45/9.5 pattern"
            dr.noter = ["Face '+' = FRONT (visible). Face '-' = BACK: hinge cups and pilot holes.",
                        f"Hinges on the {c['hinge_side']} side seen from the front. Handle: not included, customer choice.",
                        "Edge banding all four edges before drilling."]
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
            rows.append((str(n), str(c["hinge_count"]), "Hinge", "Concealed hinge Ø35 cup, full overlay, soft-close (e.g. Blum CLIP top BLUMOTION 110°)")); n += 1
            rows.append((str(n), str(c["hinge_count"]), "Mounting plate", "Cruciform mounting plate 0 mm, screw-on")); n += 1
        rows.append((str(n), str(2 * len(c["screw_pos"]) * 2), "Screw", f"Confirmat/chipboard screw Ø{c['screw_d']:g} x 50, countersunk")); n += 1
        if c["back_screws"]:
            rows.append((str(n), "~" + str(2 * len(spaced(60, c["H"], c["back_screw_pitch_max"])) + 2 * len(spaced(40, c["inner_W"], c["back_screw_pitch_max"]))), "Screw", f"Screw Ø{c['back_screw_d']:g} x 16 for back panel"))
        return rows

    def antagelser(self):
        return [f"{k} = {v}: {self.src[k]}" for k, v in self.c.items() if k in self.src and self.src[k].startswith("AFLEDT")]
