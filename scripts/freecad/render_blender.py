# -*- coding: utf-8 -*-
"""
Render en STL fra FreeCAD-scriptet som PNG i Blender (headless).

    blender -b -noaudio --python render_blender.py -- <input.stl> <output.png>
"""
import math
import sys

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
stl, png = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

bpy.ops.wm.stl_import(filepath=stl, global_scale=0.001)   # mm -> m
obj = bpy.context.selected_objects[0]
obj.name = "Staalben"
bpy.ops.object.shade_smooth()
for p in obj.data.polygons:
    p.use_smooth = False

# RAL 7032 kiselgraa, let metallisk
mat = bpy.data.materials.new("RAL7032")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.47, 0.46, 0.41, 1)
bsdf.inputs["Roughness"].default_value = 0.45
bsdf.inputs["Metallic"].default_value = 0.15
obj.data.materials.append(mat)

# gulvplade som reference (lys)
bpy.ops.mesh.primitive_plane_add(size=3, location=(0.2, 0, 0))
gulv = bpy.context.active_object
gm = bpy.data.materials.new("Gulv"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.85, 0.85, 0.83, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
gulv.data.materials.append(gm)

# kamera: skraat forfra-hoejre, lidt over
bb = [obj.matrix_world @ mathutils.Vector(v) for v in obj.bound_box]
cx = sum(v.x for v in bb) / 8; cy = sum(v.y for v in bb) / 8; cz = sum(v.z for v in bb) / 8
bpy.ops.object.camera_add(location=(cx + 1.1, cy - 1.3, cz + 0.55))
cam = bpy.context.active_object
direction = mathutils.Vector((cx, cy, cz)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 60
scene.camera = cam

bpy.ops.object.light_add(type="SUN", location=(1, -1, 2))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
sun.data.angle = math.radians(8)

world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9

scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.film_transparent = False
scene.render.filepath = png
bpy.ops.render.render(write_still=True)
print("[render] skrevet", png)
