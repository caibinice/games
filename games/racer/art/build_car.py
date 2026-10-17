"""JET-R original low-poly roadster; Blender 4.5, executed through Blender MCP.
All geometry/materials are project-authored. +Y is forward; Z is up.
"""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, rough=.35, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m

paint=material('JET_R_Paint',(.13,.55,.63),.7,.24)
dark=material('Graphite',(.018,.027,.035),.65,.3)
glass=material('Smoked_Glass',(.035,.1,.14),.8,.16)
rubber=material('Rubber',(.012,.014,.018),0,.8)
rim=material('Machined_Aluminium',(.56,.66,.69),.9,.25)
white=material('Ice_LED',(.63,.95,1),.25,.15,4)
red=material('Tail_LED',(1,.07,.025),.25,.2,3)
accent=material('Copper',(.98,.43,.18),.75,.24)

def cube(name,loc,scale,mat,bevel=.05):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Edge highlights','BEVEL'); mod.width=bevel; mod.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def hull(name,rings,mat):
    verts=[]
    for y,w,bottom,top in rings: verts.extend([(-w,y,bottom),(w,y,bottom),(w,y,top),(-w,y,top)])
    faces=[(3,2,1,0)]
    for i in range(len(rings)-1):
        for j in range(4): faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    n=(len(rings)-1)*4; faces.append((n,n+1,n+2,n+3))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.materials.append(mat)
    ob=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(ob)
    bevel=ob.modifiers.new('Soft crease','BEVEL'); bevel.width=.045; bevel.segments=2
    ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return ob

hull('Aero_body',[(-2.15,.78,.35,.63),(-1.7,.98,.3,.82),(-.65,1.02,.3,.89),(.55,1.01,.32,.83),(1.7,.92,.36,.7),(2.12,.76,.4,.51)],paint)
hull('Cockpit',[(-.98,.71,.83,.9),(-.65,.63,.84,1.31),(.3,.61,.83,1.33),(1.1,.7,.78,.81)],glass)
cube('Roof_spar',(0,-.15,1.34),(1.26,.95,.045),dark,.02)
for x in [-.93,.93]:
    cube('Side_skirt',(x,0,.36),(.14,3.3,.18),dark)
    cube('Side_copper_inlay',(x*1.04,-.05,.48),(.035,2.6,.035),accent,.01)
for x in [-.56,.56]:
    led=cube('Headlight',(x,1.99,.61),(.42,.07,.075),white,.02)
    cube('Tail_light',(x,-2.105,.62),(.47,.04,.07),red,.015)
cube('Rear_diffuser',(0,-2.1,.4),(1.5,.15,.22),dark)
cube('Rear_spoiler',(0,-1.93,.94),(1.8,.32,.09),dark)
for x in [-.62,.62]: cube('Spoiler_pedestal',(x,-1.91,.79),(.06,.1,.26),dark,.01)
for x in [-1.0,1.0]:
    for y in [-1.34,1.32]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.41,depth=.28,location=(x,y,.43),rotation=(0,math.pi/2,0))
        wheel=bpy.context.object; wheel.name='Wheel'; wheel.data.materials.append(rubber)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.29,depth=.292,location=(x,y,.43),rotation=(0,math.pi/2,0))
        bpy.context.object.name='Wheel_rim'; bpy.context.object.data.materials.append(dark)
        for angle in range(5):
            a=angle*math.tau/5
            s=cube('Forged_spoke',(x*1.15,y+math.cos(a)*.15,.43+math.sin(a)*.15),(.025,.3,.045),rim,.008); s.rotation_euler[0]=a
for x in [-.67,.67]:
    for y in [-1.0,1.05]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.16,depth=.16,location=(x,y,.29))
        bpy.context.object.name='Cold_gas_nozzle'; bpy.context.object.data.materials.append(rim)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.11,depth=.17,location=(x,y,.28))
        bpy.context.object.name='Nozzle_core'; bpy.context.object.data.materials.append(dark)
for x in [-1.02,1.02]: cube('Side_thruster',(x,-.55,.67),(.1,.32,.14),dark,.035)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'jet-r.glb'),export_format='GLB',use_selection=True,export_apply=True)
# Native editable source; no external texture dependencies.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','jet-r.blend'))
print('JET-R EXPORTED',len(bpy.context.scene.objects),'objects',os.path.getsize(os.path.join(OUT,'jet-r.glb')),'bytes')
