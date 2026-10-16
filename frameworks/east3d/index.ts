// 东郊 · 独立 L3：两次行动、一处留痕、同一片田，50 秒一镜。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Framework } from '../../app/context';
import { PAL } from '../../components/paint/palette';
import groundUrl from '../../assets/library/east3d/ground.glb?url';
import milletUrl from '../../assets/library/east3d/millet.glb?url';
import wellUrl from '../../assets/library/east3d/well.glb?url';
import treeUrl from '../../assets/library/east3d/tree.glb?url';
import potsUrl from '../../assets/library/east3d/pots.glb?url';
import heUrl from '../../assets/library/east3d/he-placeholder.glb?url';

const QUALITY = 0.62;
// 旧的独立自测 Plan 仍可送入；本件只能说 PRD 中的这一句。
const SKY_LINE = '天老爷，东郊还有我呢。';
const ease = (x: number) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const out = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const east3d: Framework = {
  async run(act, ctx) {
    const { stage, aff, lines, audio, bus } = ctx;
    for (const id of ['vignette', 'reveal', 'walk2d', 'chronicle', 'studio', 'east3d']) stage.removeLayer(id);
    lines.clear();
    const layer = stage.dom('east3d', 0);
    const canvas = document.createElement('canvas');
    canvas.dataset.east3d = '1';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    layer.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    const resize = () => renderer.setSize(Math.max(320, Math.round(stage.width * QUALITY)), Math.max(200, Math.round(stage.height * QUALITY)), false);
    resize();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.silk);
    scene.fog = new THREE.Fog(PAL.silk, 18, 44);
    const camera = new THREE.PerspectiveCamera(43, stage.width / stage.height, 0.1, 100);
    const startPos = vec(3.8, 4.8, 8.1), closePos = vec(2.15, 1.75, 4.4), finalPos = vec(2.9, 2.5, 5.6);
    const handLook = vec(0, 0.66, 0.22), startLook = vec(0, 0.28, -0.6);
    const sunLook = vec(-1.4, 5.2, -12), finalLook = vec(-0.15, 1.7, -0.3);
    const look = startLook.clone();
    camera.position.copy(startPos); camera.lookAt(look);
    scene.add(new THREE.HemisphereLight(0xf6e8c9, 0x6b5540, 1.05));
    const light = new THREE.DirectionalLight(0xfff0d0, 1.5);
    light.position.set(6, 11, 4); scene.add(light);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ color: PAL.cinnabar, fog: false }));
    sun.position.set(-2.8, 6.8, -16); scene.add(sun);
    const rim = new THREE.Mesh(new THREE.RingGeometry(1.27, 1.29, 48), new THREE.MeshBasicMaterial({ color: PAL.gold, fog: false }));
    sun.add(rim);

    const loader = new GLTFLoader();
    const [ground, millet, well, tree, pots, he] = await Promise.all(
      [groundUrl, milletUrl, wellUrl, treeUrl, potsUrl, heUrl].map(url => loader.loadAsync(url).then(g => g.scene)),
    );
    scene.add(ground, well, tree, pots, he);
    // GLB 的色块烘进顶点色，保留颜色而共用材质；加引擎效果全场共 10 个材质。
    const retiredMaterials = new Set<THREE.Material>();
    function sharePaint(root: THREE.Object3D, material: THREE.MeshStandardMaterial) {
      root.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        const old = Array.isArray(o.material) ? o.material : [o.material];
        const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        const colors = new Float32Array(geometry.getAttribute('position').count * 3);
        const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: colors.length / 3, materialIndex: 0 }];
        for (const group of groups) {
          const color = (old[group.materialIndex ?? 0] as THREE.MeshStandardMaterial).color;
          for (let i = group.start; i < group.start + group.count; i++) color.toArray(colors, i * 3);
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.clearGroups();
        o.geometry.dispose(); o.geometry = geometry; old.forEach(m => retiredMaterials.add(m)); o.material = material;
      });
    }
    sharePaint(he, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    const propPaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    for (const prop of [well, tree, pots]) {
      sharePaint(prop, propPaint);
      prop.updateMatrixWorld(true);
      const pieces: THREE.BufferGeometry[] = [];
      prop.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
        pieces.push(g); o.geometry.dispose();
      });
      const merged = mergeGeometries(pieces);
      if (!merged) throw new Error('east3d static prop merge failed');
      pieces.forEach(g => g.dispose()); prop.clear(); prop.add(new THREE.Mesh(merged, propPaint));
    }
    sharePaint(millet, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    well.position.set(4.8, 0, -5.2); tree.position.set(6.6, 0, -7.4);
    pots.position.set(3.8, 0, -4.5);
    he.rotation.y = -0.28;
    const rng = ctx.rng.fork('east3d-millet');
    // 两侧合批，手、脸、视线通道留空；实例的三角面也计入总预算。
    const transforms: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 26; i++) {
      dummy.position.set((i % 2 ? 1 : -1) * (2.1 + rng.next() * 6), 0, -1.5 - rng.next() * 9);
      dummy.rotation.y = rng.next() * Math.PI * 2;
      dummy.scale.setScalar(0.7 + rng.next() * 0.4); dummy.updateMatrix();
      transforms.push(dummy.matrix.clone());
    }
    millet.updateMatrixWorld(true);
    millet.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const batch = new THREE.InstancedMesh(o.geometry, o.material, transforms.length);
      transforms.forEach((m, i) => batch.setMatrixAt(i, m.clone().multiply(o.matrixWorld)));
      scene.add(batch);
    });

    // 膝盖始终着地；只从髋部伸直上身，头和手各有自己的连续动作。
    he.updateMatrixWorld(true);
    const upper = new THREE.Group(); upper.position.set(0, 0.52, 0); he.add(upper);
    const upperNames = ['torso', 'collar-r', 'collar-l', 'sash', 'neck'];
    for (const name of upperNames) upper.attach(he.getObjectByName(name)!);
    const head = new THREE.Group(); head.position.set(0, 0.80, 0); upper.add(head);
    for (const name of ['head', 'hair-cap', 'topknot', 'nose', 'brow']) head.attach(he.getObjectByName(name)!);
    const armR = he.getObjectByName('upper-arm-r')!, armL = he.getObjectByName('upper-arm-l')!;
    const foreR = he.getObjectByName('forearm-r')!, foreL = he.getObjectByName('forearm-l')!;
    const handR = he.getObjectByName('hand-r')!, handL = he.getObjectByName('hand-l')!;
    const up = vec(0, 1, 0), direction = vec(0, 0, 0), shoulder = vec(0, 0, 0), elbow = vec(0, 0, 0);
    const handFrom = vec(0.34, 0.11, 0.74), handTo = vec(0.56, 0.13, 0.60), rightHand = handFrom.clone();
    const leftHand = vec(-0.34, 0.12, 0.55);
    function segment(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
      direction.subVectors(a, b); o.position.copy(a).add(b).multiplyScalar(0.5);
      o.scale.set(1, direction.length(), 1); o.quaternion.setFromUnitVectors(up, direction.normalize());
    }
    function arm(side: number, hand: THREE.Vector3, sleeve: THREE.Object3D, forearm: THREE.Object3D, palm: THREE.Object3D) {
      shoulder.set(side * 0.25, 0.68, 0).applyMatrix4(upper.matrix);
      elbow.copy(shoulder).lerp(hand, 0.48); elbow.x += side * 0.10; elbow.z += 0.04;
      segment(sleeve, shoulder, elbow); segment(forearm, elbow, hand);
      palm.position.copy(hand); palm.rotation.x = -0.10;
    }

    // 主缝与覆盖它的薄土唇。仅一块土唇会脱落，深色缺口、擦痕和碎土留到末帧。
    const soil = new THREE.Group(); soil.rotation.y = he.rotation.y; scene.add(soil);
    const dark = new THREE.MeshBasicMaterial({ color: PAL.umber });
    const lipMat = new THREE.MeshStandardMaterial({ color: PAL.loess, roughness: 1 });
    const fissure = new THREE.Shape();
    fissure.moveTo(-0.02, -0.48);
    for (const [x, y] of [[0.02, -0.27], [-0.015, -0.08], [0.045, 0.10], [0.01, 0.35], [0.05, 0.49], [0.035, 0.20], [0.075, 0.08], [0.015, -0.10], [0.045, -0.28]]) fissure.lineTo(x!, y!);
    fissure.closePath();
    const crackBed = new THREE.Mesh(new THREE.ShapeGeometry(fissure), dark);
    crackBed.rotation.x = -Math.PI / 2; crackBed.position.set(0.34, 0.055, 0.68); soil.add(crackBed);
    const gap = new THREE.Mesh(new THREE.CircleGeometry(0.14, 7), dark);
    gap.rotation.x = -Math.PI / 2; gap.scale.set(0.70, 1, 1); gap.position.set(0.39, 0.057, 0.78);
    gap.visible = false; soil.add(gap);
    const lip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), lipMat);
    lip.scale.set(0.85, 0.26, 1.1); lip.position.set(0.39, 0.08, 0.78); soil.add(lip);
    const scratches = new THREE.Group(); soil.add(scratches); scratches.visible = false;
    for (let i = 0; i < 3; i++) {
      const scratch = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.005, 0.14), dark);
      scratch.position.set(0.45 + i * 0.022, 0.058, 0.64); scratch.rotation.y = 0.35; scratches.add(scratch);
    }
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: PAL.umber, transparent: true, opacity: 0.16, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.set(0, 0.055, 0.05); contact.scale.set(1, 1.4, 1); scene.add(contact);
    const dustN = 18, dustPos = new Float32Array(dustN * 3), dustBase: number[] = [];
    for (let i = 0; i < dustN; i++) dustBase.push(rng.next() - 0.5, rng.next(), rng.next() - 0.5);
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: PAL.ochre, size: 0.025, transparent: true, opacity: 0.8 });
    const dust = new THREE.Points(dustGeo, dustMat); dust.visible = false; soil.add(dust);
    let triangles = 0;
    const sceneMaterials = new Set<THREE.Material>();
    scene.traverse(o => {
      if (o instanceof THREE.Points) sceneMaterials.add(o.material as THREE.Material);
      if (!(o instanceof THREE.Mesh)) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => sceneMaterials.add(m));
      triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3 * (o instanceof THREE.InstancedMesh ? o.count : 1);
    });
    if (triangles > 120000) throw new Error(`east3d triangle budget: ${triangles}`);

    let elapsed = 0, lastNow = performance.now(), crackAt: number | null = null, skyAt: number | null = null;
    let shiftLogged = false, phase = 0, pulseAt = -10, finished = false;
    const state = { elapsed: 0, phase: '0–3', cracked: false, looked: false, gapCount: 0, handShifted: false, done: false, triangles, materials: sceneMaterials.size, drawCalls: 0, peakDrawCalls: 0, reducedMotion: stage.reducedMotion };
    ctx.handoff.east3d = state;
    const trace = (kind: string, data: Record<string, unknown> = {}) => bus.log('world.event', { kind: `east3d.${kind}`, elapsed: Math.round(elapsed * 1000) / 1000, ...data });
    const point = vec(0, 0, 0);
    const crackShape = () => {
      he.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      point.copy(handFrom); he.localToWorld(point); point.project(camera);
      return { kind: 'circle' as const, x: (point.x * 0.5 + 0.5) * stage.width, y: (-point.y * 0.5 + 0.5) * stage.height, r: Math.max(46, Math.min(stage.width, stage.height) * 0.095) };
    };
    const skyShape = () => ({ kind: 'rect' as const, x: 0, y: 0, w: stage.width, h: stage.height * 0.44 });
    // 留白中的字幕不跟着头挤到太阳或手上。
    const lineAnchor = () => ({ x: stage.width * 0.74, y: stage.height * 0.28 });
    const touch = (source: 'user' | 'self') => {
      if (elapsed >= 24) return;
      pulseAt = elapsed;
      if (crackAt !== null) { trace('touch-response'); return; }
      crackAt = elapsed; state.cracked = true; state.gapCount = 1;
      gap.visible = scratches.visible = true;
      lip.position.y -= 0.035; // 输入当帧先松动，不等长动画。
      if (source === 'user') { audio.unlock(); audio.sfx('soil', { gain: 0.3 }); }
      trace('crack', { source });
      bus.log('world.mark', { id: 'east3d-soil-gap', kind: 'ground', count: 1, effect: '碎土挡住原手位，向右换手，缺口保留到结束' });
    };
    const gaze = (source: 'user' | 'self') => {
      if (elapsed < 24 || elapsed >= 42) return;
      pulseAt = elapsed;
      if (skyAt !== null) { trace('gaze-response'); return; }
      skyAt = elapsed; state.looked = true;
      if (source === 'user') { audio.unlock(); audio.sfx('shimmer', { gain: 0.16 }); }
      void lines.say({ who: '禾', text: SKY_LINE, anchor: lineAnchor, ink: 'dark', tone: 'speech', holdMs: 4500 });
      trace('sky', { source });
    };
    const crack = aff.add({ id: 'east-crack', label: '碰田缝', represents: act.elements.find(e => e.id === 'east-crack')?.represents ?? '田缝', shape: crackShape(), key: 'Enter', onActivate: () => touch('user') });
    const sky = aff.add({ id: 'east-sky', label: '望天', represents: act.elements.find(e => e.id === 'east-sky')?.represents ?? '天', shape: skyShape(), key: ' ', enabled: false, onActivate: () => gaze('user'), onDrag: e => { if (e.phase === 'move' && e.dy < -3) gaze('user'); } });
    // Enter 在天空阶段同样确认当前焦点；空格仍是望天快捷键。
    const confirm = (e: KeyboardEvent) => { if (e.key === 'Enter' && elapsed >= 24 && elapsed < 42 && !sky.el.disabled) { e.preventDefault(); sky.el.click(); } };
    window.addEventListener('keydown', confirm);
    const visible = () => { lastNow = performance.now(); };
    document.addEventListener('visibilitychange', visible);
    const offResize = stage.onResize(() => {
      resize(); camera.aspect = stage.width / stage.height; camera.updateProjectionMatrix();
      crack.setShape(crackShape()); sky.setShape(skyShape());
    });
    trace('start', { act: act.id, triangles, quality: QUALITY });
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const offFrame = stage.onFrame(() => {
      const now = performance.now();
      if (!document.hidden) elapsed = Math.min(50, elapsed + (now - lastNow) / 1000);
      lastNow = now;
      if (document.hidden || finished) return;
      state.elapsed = elapsed;
      if (crackAt === null && elapsed >= 6) touch('self');
      if (elapsed >= 24 && phase < 2) { phase = 2; state.phase = '24–42'; crack.setEnabled(false); sky.setEnabled(true); trace('phase', { phase: state.phase }); }
      else if (elapsed >= 3 && phase === 0) { phase = 1; state.phase = '3–24'; trace('phase', { phase: state.phase }); }
      if (skyAt === null && elapsed >= 32) gaze('self');
      if (elapsed >= 42 && phase < 3) { phase = 3; state.phase = '42–50'; sky.setEnabled(false); trace('phase', { phase: state.phase }); }
      const touchAge = crackAt === null ? -1 : elapsed - crackAt;
      const gazeAge = skyAt === null ? -1 : elapsed - skyAt;
      // 允许动作中的一次小回应，然后收起已完成焦点，不能反复掏土或重播字幕。
      if (touchAge > 1.6) crack.setEnabled(false);
      if (gazeAge > 1.6) sky.setEnabled(false);
      const reduced = stage.reducedMotion;
      const shift = touchAge < 0 ? 0 : ease((touchAge - (reduced ? 0.18 : 0.50)) / (reduced ? 0.25 : 0.65));
      if (shift >= 1 && !shiftLogged) { shiftLogged = true; state.handShifted = true; trace('hand-shift', { reason: 'rubble', from: handFrom.toArray(), to: handTo.toArray() }); }
      const rise = gazeAge < 0 ? 0 : ease(gazeAge / (reduced ? 0.4 : 1.8));
      const nod = gazeAge < 0 ? ease((elapsed - 24) / 2) * 0.12 : rise * 0.36;
      upper.rotation.x = 0.62 * (1 - rise); upper.updateMatrix();
      head.rotation.x = -nod;
      rightHand.copy(handFrom).lerp(handTo, shift);
      if (touchAge >= 0 && touchAge < 1) rightHand.y -= Math.sin(touchAge * Math.PI) * (reduced ? 0.015 : 0.055);
      // 望天时两手离土收在腿前，双膝与小腿不动。
      rightHand.lerp(vec(0.25, 0.66, 0.16), rise); leftHand.set(-0.34, 0.12, 0.55).lerp(vec(-0.25, 0.66, 0.16), rise);
      const response = Math.max(0, 1 - (elapsed - pulseAt) / 0.3);
      rightHand.y += response * 0.016;
      arm(1, rightHand, armR, foreR, handR); arm(-1, leftHand, armL, foreL, handL);
      if (touchAge >= 0) {
        const collapse = ease(touchAge / (reduced ? 0.25 : 0.65));
        lip.position.set(0.39 + 0.12 * collapse, 0.07 - 0.025 * collapse, 0.78 + 0.12 * collapse);
        lip.rotation.z = collapse * 0.6;
        dust.visible = !reduced && touchAge < 1.4;
        if (dust.visible) {
          for (let i = 0; i < dustN; i++) {
            dustPos[i * 3] = 0.39 + dustBase[i * 3]! * (0.09 + touchAge * 0.15);
            dustPos[i * 3 + 1] = Math.max(0.055, 0.08 + dustBase[i * 3 + 1]! * 0.22 * Math.sin(Math.min(1, touchAge) * Math.PI));
            dustPos[i * 3 + 2] = 0.78 + dustBase[i * 3 + 2]! * (0.12 + touchAge * 0.18);
          }
          (dustGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
          dustMat.opacity = 0.8 * Math.max(0, 1 - touchAge / 1.4);
        }
      } else {
        // 首次土唇明暗呼吸仅一次，其他东西不争焦点。
        const breathe = !reduced && elapsed >= 1 && elapsed <= 3 ? Math.sin((elapsed - 1) / 2 * Math.PI) : 0;
        lipMat.emissive.set(PAL.gold); lipMat.emissiveIntensity = breathe * 0.15;
      }
      if (touchAge >= 0) lipMat.emissiveIntensity = 0;
      // 单一轴线：斜俯下降 → 右侧三分之四近景 → 沿视线上摇 → 稍落回。
      // 减少动态只留短且小幅的同向过渡，不取消动作及环境留痕。
      // 行动前只微降，读手的下降由第一次探土带动；背景不盖过输入的局部反馈。
      const descend = reduced ? 1 : 0.015 * ease(elapsed / 3) + (crackAt === null ? 0 : 0.985 * out((elapsed - crackAt) / 7));
      camera.position.copy(reduced ? closePos : startPos).lerp(closePos, descend);
      look.copy(reduced ? handLook : startLook).lerp(handLook, descend);
      const tilt = gazeAge < 0 ? 0 : 1 - Math.pow(1 - THREE.MathUtils.clamp(gazeAge / (reduced ? 0.45 : 4.6), 0, 1), 3);
      look.lerp(reduced ? vec(-0.2, 1.7, -0.6) : sunLook, tilt);
      const settle = ease((elapsed - 42) / (reduced ? 0.45 : 5));
      camera.position.lerp(reduced ? closePos : finalPos, settle);
      look.lerp(reduced ? vec(-0.15, 1.5, -0.3) : finalLook, settle);
      camera.lookAt(look); sun.lookAt(camera.position);
      crack.setShape(crackShape());
      renderer.render(scene, camera); state.drawCalls = renderer.info.render.calls; state.peakDrawCalls = Math.max(state.peakDrawCalls, state.drawCalls);
      if (elapsed >= 50) {
        finished = true; state.done = true; trace('done', { cracked: state.cracked, looked: state.looked, gapCount: state.gapCount, handShifted: state.handShifted });
        // 保存真实末帧后释放 GPU；结束不会把整片田清空。
        const still = document.createElement('canvas'); still.width = canvas.width; still.height = canvas.height;
        still.dataset.east3d = 'final'; still.style.cssText = canvas.style.cssText;
        still.getContext('2d')!.drawImage(canvas, 0, 0); canvas.replaceWith(still);
        resolve();
      }
    });
    try { await done; } finally {
      offFrame(); offResize(); crack.remove(); sky.remove(); lines.clear();
      window.removeEventListener('keydown', confirm); document.removeEventListener('visibilitychange', visible);
      renderer.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(retiredMaterials), textures = new Set<THREE.Texture>();
      for (const root of [scene, millet]) root.traverse(o => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
        geometries.add(o.geometry);
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    }
    return { act: act.id, data: { cracked: state.cracked, looked: state.looked, gapCount: state.gapCount, handShifted: state.handShifted, duration: elapsed, framework: 'east3d' } };
  },
};
