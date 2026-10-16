# 东郊（旱）程序化资产：龟裂地面 / 枯粟 / 桔槔井 / 老桑树 / 陶罐 / 禾的替身
# 用法：/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python build.py
# 来源：本机程序化生成（无外部素材）；配方随 recipe.json 一并写出。
import bpy, os, math, random, json

OUT = os.path.dirname(os.path.abspath(__file__))
random.seed(7)

LOESS = (0.72, 0.58, 0.41, 1)
UMBER = (0.23, 0.16, 0.12, 1)
OCHRE = (0.69, 0.46, 0.23, 1)
MIL = (0.84, 0.70, 0.35, 1)
BRONZE = (0.31, 0.42, 0.35, 1)
LACQ = (0.07, 0.05, 0.04, 1)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(7)

def mat(name, color, rough=0.95, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m

def export(name, note):
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False)
    tris = 0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
    meta = {"id": "east3d-" + name, "file": name + ".glb", "recipe": note,
            "faces": tris, "face_unit": "triangles", "source": "程序化生成（Blender 5.1，seed 7）", "license": "本项目自有", "era": "zhanguo", "tags": ["east3d", "drought"]}
    json.dump(meta, open(os.path.join(OUT, name + ".recipe.json"), "w"), ensure_ascii=False, indent=2)
    print(f"EXPORT {name}: faces={tris} bytes={os.path.getsize(path)}")

# ---------- 1. 龟裂地面（Voronoi 板块裂缝） ----------
reset()
SIZE, GRID = 26.0, 18
bpy.ops.mesh.primitive_plane_add(size=SIZE, location=(0, 0, 0))
g = bpy.context.object; g.name = "ground"
sub = g.modifiers.new("s", 'SUBSURF'); sub.subdivision_type = 'SIMPLE'; sub.levels = 7
bpy.ops.object.modifier_apply(modifier=sub.name)

# 抖动的格心，形成板块；到最近两块边界的距离 = 裂缝距离
pts = []
for i in range(GRID + 1):
    for j in range(GRID + 1):
        x = (i / GRID - 0.5) * SIZE + random.uniform(-0.28, 0.28)
        y = (j / GRID - 0.5) * SIZE + random.uniform(-0.28, 0.28)
        pts.append((x, y))
def cell_info(x, y):
    ds = sorted(((x - px) ** 2 + (y - py) ** 2) ** 0.5 for px, py in pts)
    return ds[1] - ds[0]   # 0 = 正好在裂缝边
for v in g.data.vertices:
    x, y = v.co.x, v.co.y
    edge = cell_info(x, y)
    groove = max(0.0, 1.0 - edge / 0.14) ** 1.8
    relief = 0.012 * math.sin(x * 0.9) * math.cos(y * 0.75) + 0.008 * math.sin((x + y) * 2.1)
    v.co.z = -0.09 * groove + relief
m = mat("loess", LOESS)
# 烘焙板块裂缝贴图（numpy 算最近/次近板块边，深色缝 + 三档黄土底色）
import numpy as np
T = 1024
rng = np.random.default_rng(11)
sites = [((px / SIZE + 0.5) * T, (py / SIZE + 0.5) * T) for px, py in pts]
yy, xx = np.mgrid[0:T, 0:T]
d1 = np.full((T, T), 1e12); d2 = np.full((T, T), 1e12); tone = np.zeros((T, T), dtype=np.int32)
for idx, (sx, sy) in enumerate(sites):
    d = (xx - sx) ** 2 + (yy - sy) ** 2
    closer = d < d1
    d2 = np.where(closer, d1, np.minimum(d2, d))
    tone = np.where(closer, idx % 3, tone)
    d1 = np.where(closer, d, d1)
edge = np.sqrt(d2) - np.sqrt(d1)
base = np.array([[0.72, 0.58, 0.41], [0.69, 0.55, 0.39], [0.75, 0.61, 0.44]])
crack = np.array([0.15, 0.10, 0.07])
rgb = base[tone]
w = (1.0 - np.clip(edge / 4.0, 0, 1))[..., None]
rgb = rgb * (1 - w) + crack * w * 0.94
rgb += (rng.random((T, T, 1)) - 0.5) * 0.025
img = bpy.data.images.new("crack-bake", T, T, alpha=False)
pix = np.dstack([rgb, np.ones((T, T, 1))]).astype(np.float32)
img.pixels.foreach_set(pix.ravel())
img.pack()
tex = m.node_tree.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.location = (-400, 200)
bsdf = m.node_tree.nodes["Principled BSDF"]
m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
g.data.materials.append(m)
export("ground", "26m 平面，7 级细分（32,768 三角面），抖动网格 Voronoi 板块裂缝（D1 同位烘焙细裂：板块约 1.4m、缝宽 0.14m、深 0.09m），Loess 材质")

# ---------- 2. 枯粟模板（运行时 26 丛） ----------
reset()
bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.022, depth=1.5, location=(0, 0, 0.75))
bpy.context.object.name = "millet-stalk"
bpy.context.object.data.materials.append(mat("millet", MIL))
bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.07, location=(0, 0, 1.56))
e = bpy.context.object; e.name = "millet-ear"; e.scale = (0.6, 0.6, 2.6); e.rotation_euler.x = math.radians(38); e.data.materials.append(mat("ear", OCHRE))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.join()
bpy.context.object.name = "millet-clump"
export("millet", "细杆+38°折垂穗，合并为单件；运行时 26 丛实例合批；五边杆、8x5 球穗")

# ---------- 3. 桔槔井 ----------
reset()
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.75, depth=0.85, location=(0, 0, 0.42))
wall = bpy.context.object; wall.name = "well-wall"; wall.data.materials.append(mat("stone", (0.45, 0.42, 0.36, 1), 0.9))
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.62, depth=0.1, location=(0, 0, 0.86))
lip = bpy.context.object; lip.name = "well-lip"; lip.data.materials.append(mat("stone2", (0.55, 0.5, 0.42, 1), 0.85))
for dx in (-0.95, 0.95):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.055, depth=2.3, location=(dx, 0, 1.15))
    bpy.context.object.name = f"post{dx}"; bpy.context.object.data.materials.append(mat("wood", UMBER, 0.85))
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.05, depth=2.6, location=(0, 0, 2.05))
bpy.context.object.rotation_euler = (0, math.radians(78), 0)
bpy.context.object.name = "lever"; bpy.context.object.data.materials.append(mat("wood2", UMBER, 0.85))
bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.22, radius2=0.26, depth=0.4, location=(1.1, 0, 1.15))
bpy.context.object.name = "bucket"; bpy.context.object.data.materials.append(mat("bucket", BRONZE, 0.6, 0.2))
export("well", "井圈+井沿+双柱+桔槔横杆+吊桶；青铜吊桶")

# ---------- 4. 老桑树 ----------
reset()
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.30, radius2=0.13, depth=1.5, location=(0, 0, 0.75))
t = bpy.context.object; t.name = "trunk"; t.data.materials.append(mat("bark", (0.3, 0.21, 0.15, 1)))
# 五根主枝，各自带 2 团小叶冠（小、偏平、贴枝头，不是一片大伞）
for i in range(5):
    a = i * math.tau / 5 + 0.35
    r = 0.55 + 0.15 * (i % 2)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.05, depth=1.25, location=(math.cos(a) * r * 0.55, math.sin(a) * r * 0.55, 1.55 + 0.12 * (i % 3)))
    b = bpy.context.object; b.rotation_euler = (math.radians(42 + 8 * (i % 3)), 0, a); b.data.materials.append(mat("branch", (0.32, 0.22, 0.15, 1)))
    for k in range(2):
        cr = 0.42 + 0.12 * k
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=cr, location=(math.cos(a) * (r + 0.45 + 0.25 * k), math.sin(a) * (r + 0.45 + 0.25 * k), 2.05 + 0.22 * k))
        f = bpy.context.object; f.name = f"foliage{i}-{k}"; f.scale = (1.0, 1.0, 0.62)  # 稍扁但成团
        f.rotation_euler = (0.2, 0.1, a)
        f.data.materials.append(mat("leaf", (0.40, 0.31, 0.15, 1), 0.95))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.join()
bpy.context.object.name = "mulberry"
export("tree", "1.5m 树干 + 5 主枝 + 10 小叶冠团（偏平），比第一版矮且成团")

# ---------- 5. 陶罐 ----------
reset()
def jar(x, s):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=9, radius=0.32, location=(x, 0, 0.3 * s))
    o = bpy.context.object; o.scale = (s, s, 1.15 * s)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.11 * s, depth=0.12 * s, location=(x, 0, 0.62 * s))
    n = bpy.context.object
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); n.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.join(); o.data.materials.append(mat("pot", (0.5, 0.36, 0.26, 1), 0.9)); o.name = f"jar{x}"
jar(-0.34, 1.0); jar(0.30, 0.8); jar(0.04, 0.6)
export("pots", "三只陶罐（球体+罐口圆柱，尺寸递减）")

# ---------- 6. 禾：可分件驱动的高跪农人（局部程序动作，无绑骨） ----------
reset()
cloth = mat("cloth", OCHRE)
skin = mat("skin", (0.49, 0.32, 0.20, 1))
hair = mat("hair", LACQ)
belt = mat("belt", UMBER)
dustcloth = mat("dust-cloth", (0.57, 0.40, 0.23, 1))
collarmat = mat("collar", (0.76, 0.54, 0.29, 1))

def ellipsoid(name, loc, scale, material, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale; o.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o

def beam(name, a, b, radius, material):
    from mathutils import Vector
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    o = bpy.context.object; o.name = name
    o.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler(); o.data.materials.append(material)
    return o

def strip(name, a, b, width, material):
    from mathutils import Vector
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object; o.name=name; o.scale=(width, 0.022, delta.length)
    o.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); o.data.materials.append(material)
    return o

# 十片大褶面；高跪时直身，运行时从髋处前倾，不缩放整个人。
verts=[]; faces=[]
for z, rx, ry in [(0.49,.29,.22),(.68,.25,.18),(.89,.23,.15),(1.16,.27,.15),(1.25,.17,.12)]:
    for i in range(10):
        a=math.tau*i/10
        pleat=1.0 + (0.05 if i%2 else -0.025)
        verts.append((math.cos(a)*rx*pleat, math.sin(a)*ry*pleat, z))
for j in range(4):
    for i in range(10):
        a=j*10+i; b=j*10+(i+1)%10
        faces.append((a,b,b+10,a+10))
faces.extend([tuple(reversed(range(10))),tuple(range(40,50))])
mesh=bpy.data.meshes.new('cloth-folds'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('torso',mesh); bpy.context.collection.objects.link(o); mesh.materials.append(cloth)
strip('collar-r', (.15,-.12,1.23),(-.12,-.175,.95),.052,collarmat)
strip('collar-l', (-.15,-.12,1.23),(.05,-.17,1.02),.043,collarmat)
ellipsoid('sash',(0,0,.79),(.257,.18,.055),belt)
beam('neck',(0,0,1.19),(0,-.015,1.36),.065,skin)
ellipsoid('head',(0,-.018,1.43),(.119,.13,.167),skin)
ellipsoid('hair-cap',(0,.025,1.50),(.122,.112,.105),hair)
ellipsoid('topknot',(0,.045,1.63),(.065,.065,.059),hair,10,6)
ellipsoid('nose',(0,-.152,1.43),(.028,.046,.043),skin,8,6)
beam('brow',(-.073,-.133,1.476),(.073,-.133,1.476),.009,hair)

# 手臂是单位长度，运行时以肩/肘/手的实际端点定向和定长。
for side in ['r','l']:
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=.09, radius2=.135, depth=1)
    o=bpy.context.object; o.name='upper-arm-'+side; o.data.materials.append(cloth)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=.044, radius2=.060, depth=1)
    o=bpy.context.object; o.name='forearm-'+side; o.data.materials.append(skin)
    parts=[ellipsoid('palm',(0,0,0),(.058,.09,.024),skin,10,6)]
    for i in range(4):
        x=(i-1.5)*.026
        parts.append(beam('finger',(x,-.05,0),(x,-.16+abs(i-1.5)*.012,-.006),.011,skin))
    parts.append(beam('thumb',(-.045,0,0),(-.086,-.065,-.008),.014,skin))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
    bpy.context.object.name='hand-'+side

for x, side in [(.17,'r'),(-.17,'l')]:
    beam('thigh-'+side,(x,.10,.50),(x,-.13,.12),.12,cloth)
    ellipsoid('knee-'+side,(x,-.14,.10),(.13,.14,.09),dustcloth)
    beam('shin-'+side,(x,-.10,.10),(x,.47,.095),.074,belt)
    ellipsoid('sandal-'+side,(x,.52,.055),(.10,.18,.04),belt)
export("he-placeholder", "D1 高跪农人：修长小头、交领大褶短褐、布带、发髻、鼻额、分指干手、沾土双膝与草履；命名分件支持髋部直身和肩肘端点动作；本机程序化替身，非绑骨；seed 7")
print("DONE")
