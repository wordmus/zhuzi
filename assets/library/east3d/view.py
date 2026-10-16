# 东郊资产的多机位校样图：按 D1 暂定布局摆放，Workbench 渲染 over/front/side 三张。
# 用法：Blender --background --factory-startup --python view.py
import bpy, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'docs', '3d-design', 'east-suburb', 'views'))
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)

def imp(name):
    before = set(o.name for o in bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, name + '.glb'))
    new = [o for o in bpy.context.scene.objects if o.name not in before]
    return new

# 地面
imp('ground')
# 禾：跪在田缝边
for o in imp('he-placeholder'):
    o.location = (0, 0.1, 0)
    o.rotation_euler = (0, 0, math.radians(12))
# 井与树：远处
for o in imp('well'):
    o.location = (-4.4, 3.8, 0)
for o in imp('tree'):
    o.location = (-2.6, 5.8, 0)
for o in imp('pots'):
    o.location = (1.3, 0.9, 0)
# 枯粟：散点实例
import random
random.seed(3)
proto = imp('millet')[0]
for i in range(22):
    a = random.uniform(0, math.tau); r = random.uniform(1.6, 8.0)
    o = proto.copy(); o.data = proto.data.copy()
    bpy.context.collection.objects.link(o)
    o.location = (math.cos(a) * r, math.sin(a) * r, 0)
    o.rotation_euler = (random.uniform(-0.12, 0.12), random.uniform(-0.12, 0.12), random.uniform(0, math.tau))
    o.scale = (random.uniform(0.75, 1.15),) * 3
proto.hide_render = True

# 相机与光
world = bpy.data.worlds.new('W'); bpy.context.scene.world = world
world.color = (0.95, 0.88, 0.72)
bpy.ops.object.light_add(type='SUN', location=(8, -6, 12)); sun = bpy.context.object
sun.data.energy = 4.0; sun.rotation_euler = (math.radians(52), 0, math.radians(35))
bpy.ops.object.camera_add(location=(0, 0, 0)); cam = bpy.context.object
bpy.context.scene.camera = cam

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.render.resolution_x, sc.render.resolution_y = 1280, 800
sc.render.film_transparent = False

from mathutils import Vector
def look(cam_loc, target, name, lens=35):
    cam.location = cam_loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath)

look((6.5, -8.0, 6.0), (0, 0.6, 0.3), 'over', lens=35)
look((0.4, -7.6, 1.6), (0, 0.6, 0.8), 'front', lens=42)
look((8.6, 0.6, 1.9), (0, 0.6, 0.7), 'side', lens=42)
