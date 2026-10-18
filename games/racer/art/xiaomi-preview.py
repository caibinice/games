"""Independent Blender import, geometry audit and optional preview; no source writes.
blender -b --python games/racer/art/xiaomi-preview.py -- OUTPUT.glb TMP_DIR
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

model, output = (Path(value).resolve() for value in sys.argv[sys.argv.index("--") + 1:][:2])
assert output != model.parent
output.mkdir(parents=True, exist_ok=True)
before = hashlib.sha256(model.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
meshes = []
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        meshes.append({"name": obj.name, "triangles": len(obj.data.loop_triangles), "materials": [m.name for m in obj.data.materials]})
report = {"file": str(model), "blender": bpy.app.version_string, "sha256": before,
          "meshes": meshes, "triangles": sum(m["triangles"] for m in meshes),
          "images": [{"name": im.name, "size": list(im.size), "packed": im.packed_file is not None} for im in bpy.data.images]}
(output / (model.stem + "-blender.json")).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 560
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("preview-world")
scene.world.color = (.2, .2, .2)
scene.view_settings.view_transform = "AgX"
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.02))
plane = bpy.context.object
mat = bpy.data.materials.new("preview-ground")
mat.diffuse_color = (.055, .07, .09, 1)
plane.data.materials.append(mat)
for location, power, size in [((3, -4, 7), 1800, 5), ((-5, -1, 4), 1400, 4), ((2, 5, 6), 2200, 5)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = power
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, .6)) - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(6.8, -8.5, 4.2))
camera = bpy.context.object
camera.data.lens = 52
camera.rotation_euler = (Vector((0, 0, .65)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
scene.render.filepath = str(output / (model.stem + "-front.png"))
bpy.ops.render.render(write_still=True)
camera.location = (6.8, 8.5, 4.2)
camera.rotation_euler = (Vector((0, 0, .65)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(output / (model.stem + "-rear.png"))
bpy.ops.render.render(write_still=True)
assert hashlib.sha256(model.read_bytes()).hexdigest() == before
print(json.dumps({"file": str(model), "triangles": report['triangles'], "images": report['images']}, ensure_ascii=False))
