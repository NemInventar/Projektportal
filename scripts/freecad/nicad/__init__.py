# -*- coding: utf-8 -*-
"""
nicad - Nem Inventars headless CAD-motor (FreeCAD + ezdxf).

    cabinet.py   parametrisk skab: korpus, laager, beslag -> dele som 2D-features + samling
    solids.py    Part2D -> FreeCAD-solid (STEP)
    dxf.py       Part2D -> DXF pr. bearbejdningsflade (CNC)
    views.py     HLR-projektion (TechDraw.project) til 2D med styret orientering
    sheet.py     A3-ark: ramme, titelfelt (ISO 7200, Milots Fusion-layout), maal, tabeller, PDF/SVG/PNG
    drawings.py  produktionstegninger pr. del + samlingstegning

Koer: FreeCADCmd.exe build.py --config configs/<x>.json --out <mappe>
"""
