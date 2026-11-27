/**
 * Внешний мир за окнами (20.3, D-12): небо с солнцем, луной и звёздами, земля, процедурные дома
 * и деревья — без загрузки файлов. Мир рисуется только там, где сквозь стекло окна видна маска
 * трафарета (WindowMask): над открытой сверху комнатой и за скрытыми стенами его не видно.
 * Порядок отрисовки: комната (0) → маска окон (1) → мир (2) → стекло (3).
 */
import { apartmentRect } from '../domain/rooms';
import { useLayoutEffect, useMemo, useEffect } from 'react';
import {
  AlwaysStencilFunc,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EqualStencilFunc,
  Float32BufferAttribute,
  InstancedMesh,
  KeepStencilOp,
  Material,
  MeshStandardMaterial,
  Object3D,
  PointsMaterial,
  ReplaceStencilOp,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { useApartment, useUi } from '../app/stores';
import { daylight, type Daylight } from '../domain/daylight';
import { cmToScene } from '../domain/units';
import { toColor } from './SceneLighting';

export const RENDER_ORDER = { mask: 1, world: 2, glass: 3 } as const;
const STENCIL_REF = 1;
const NO_RAYCAST = () => {};

/** Свойства материала маски окна: пишет трафарет, но не цвет и не глубину. */
export const MASK_MATERIAL_PROPS = {
  colorWrite: false,
  depthWrite: false,
  stencilWrite: true,
  stencilRef: STENCIL_REF,
  stencilFunc: AlwaysStencilFunc,
  stencilZPass: ReplaceStencilOp,
} as const;

/** Материал мира виден только в пикселях маски окна. */
function throughWindow<M extends Material>(m: M): M {
  m.stencilWrite = true;
  m.stencilRef = STENCIL_REF;
  m.stencilFunc = EqualStencilFunc;
  m.stencilFail = m.stencilZFail = m.stencilZPass = KeepStencilOp;
  return m;
}

/** Детерминированный генератор: мир одинаков при каждом запуске. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKY_RADIUS = 450;

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFragment = /* glsl */ `
uniform vec3 top; uniform vec3 horizon; uniform vec3 ground;
uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunUp;
uniform vec3 moonDir; uniform float moonUp;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35) * sunUp;
  float m = max(dot(d, normalize(moonDir)), 0.0);
  col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99965, 0.99975, m) * 1.2 + pow(m, 60.0) * 0.08) * moonUp;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

interface HouseClass {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly floors: number;
  readonly cols: number;
  readonly count: number;
  readonly ring: readonly [number, number];
  readonly colors: readonly string[];
}

/** Классы домов, размеры в метрах; дальше от квартиры — выше. */
const HOUSES: readonly HouseClass[] = [
  { w: 10, d: 8, h: 7, floors: 2, cols: 4, count: 12, ring: [22, 36], colors: ['#c9b9a0', '#b8a48c', '#d6cdbd'] },
  { w: 14, d: 11, h: 16, floors: 5, cols: 6, count: 11, ring: [44, 70], colors: ['#c4bfb6', '#a9a49c', '#d2c6b4'] },
  { w: 18, d: 13, h: 29, floors: 9, cols: 7, count: 10, ring: [75, 115], colors: ['#b3b6ba', '#c8c3ba', '#9ea4aa'] },
];
const TREES = 22;

/** Фасад: стена с окнами (map) и огни в части окон (emissiveMap). */
function facadeTextures(cls: HouseClass, rnd: () => number) {
  const px = 32;
  const [W, H] = [cls.cols * px, cls.floors * px];
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')!] as const;
  };
  const [wall, w] = make();
  const [glow, g] = make();
  w.fillStyle = '#ffffff';
  w.fillRect(0, 0, W, H);
  g.fillStyle = '#000000';
  g.fillRect(0, 0, W, H);
  for (let f = 0; f < cls.floors; f++)
    for (let c = 0; c < cls.cols; c++) {
      const [x, y, ww, hh] = [c * px + 8, f * px + 8, px - 16, px - 12];
      w.fillStyle = '#4a5866';
      w.fillRect(x, y, ww, hh);
      if (rnd() < 0.6) {
        g.fillStyle = rnd() < 0.7 ? '#ffd08a' : '#cfe0ff';
        g.fillRect(x, y, ww, hh);
      }
    }
  const tex = (canvas: HTMLCanvasElement) => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  };
  return { map: tex(wall), emissiveMap: tex(glow) };
}

function buildWorld(radius: number) {
  const rnd = random(20);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const dummy = new Object3D();

  const sky = keep(
    throughWindow(
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          top: { value: new Color() },
          horizon: { value: new Color() },
          ground: { value: new Color() },
          sunDir: { value: new Vector3() },
          sunColor: { value: new Color() },
          sunUp: { value: 0 },
          moonDir: { value: new Vector3() },
          moonUp: { value: 0 },
        },
      }),
    ),
  );

  // Звёзды — точки на верхней полусфере чуть внутри неба.
  const starPos: number[] = [];
  for (let i = 0; i < 1400; i++) {
    const y = 0.04 + rnd() * 0.96;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * r * (SKY_RADIUS - 10), y * (SKY_RADIUS - 10), Math.sin(a) * r * (SKY_RADIUS - 10));
  }
  const starGeo = keep(new BufferGeometry());
  starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
  const starMat = keep(throughWindow(new PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })));

  const groundMat = keep(throughWindow(new MeshStandardMaterial({ color: '#5f6e48', roughness: 1 })));

  const houses = HOUSES.map((cls) => {
    const { map, emissiveMap } = facadeTextures(cls, rnd);
    keep(map);
    keep(emissiveMap);
    const geo = keep(new BoxGeometry(cls.w, cls.h, cls.d).translate(0, cls.h / 2, 0));
    const mat = keep(throughWindow(new MeshStandardMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.9 })));
    const mesh = new InstancedMesh(geo, mat, cls.count);
    const [r0, r1] = [radius + cls.ring[0], radius + cls.ring[1]];
    const offset = rnd() * Math.PI * 2;
    for (let i = 0; i < cls.count; i++) {
      const a = offset + ((i + 0.2 + rnd() * 0.6) / cls.count) * Math.PI * 2;
      const r = r0 + rnd() * (r1 - r0);
      dummy.position.set(Math.cos(a) * r, -0.3, Math.sin(a) * r);
      // Дом стоит лицом к квартире с небольшим разворотом.
      dummy.rotation.set(0, -a + Math.PI / 2 + (rnd() - 0.5) * 0.5, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new Color(cls.colors[i % cls.colors.length]));
    }
    return mesh;
  });

  const trunkGeo = keep(new CylinderGeometry(0.15, 0.22, 2.2, 6).translate(0, 1.1, 0));
  const crownGeo = keep(new ConeGeometry(1.6, 4.2, 7).translate(0, 4.1, 0));
  const trunkMat = keep(throughWindow(new MeshStandardMaterial({ color: '#5a4030', roughness: 1 })));
  const crownMat = keep(throughWindow(new MeshStandardMaterial({ color: '#3f6a3a', roughness: 1 })));
  const trunks = new InstancedMesh(trunkGeo, trunkMat, TREES);
  const crowns = new InstancedMesh(crownGeo, crownMat, TREES);
  for (let i = 0; i < TREES; i++) {
    const a = ((i + rnd()) / TREES) * Math.PI * 2;
    const r = radius + 9 + rnd() * 12;
    const s = 0.75 + rnd() * 0.6;
    dummy.position.set(Math.cos(a) * r, -0.3, Math.sin(a) * r);
    dummy.rotation.set(0, rnd() * Math.PI, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
    crowns.setColorAt(i, new Color().setHSL(0.27 + rnd() * 0.08, 0.35, 0.28 + rnd() * 0.1));
  }
  dummy.scale.setScalar(1);

  const instanced = [...houses, trunks, crowns];
  for (const m of instanced) {
    m.renderOrder = RENDER_ORDER.world;
    m.raycast = NO_RAYCAST;
    m.frustumCulled = false;
  }
  /** Небо, звёзды и огни города для часа. */
  const apply = (d: Daylight) => {
    const u = sky.uniforms;
    toColor(d.skyTop, u.top.value);
    toColor(d.skyHorizon, u.horizon.value);
    toColor(d.ground, u.ground.value);
    u.sunDir.value.set(...d.sunDir);
    toColor(d.key.isSun ? d.key.color : [1, 0.8, 0.6], u.sunColor.value);
    u.sunUp.value = Math.min(1, Math.max(0, (d.sunDir[1] + 0.03) / 0.06));
    u.moonDir.value.set(...d.moonDir);
    u.moonUp.value = Math.min(1, Math.max(0, (d.moonDir[1] + 0.02) / 0.05));
    starMat.opacity = d.stars;
    starMat.visible = d.stars > 0.01;
    for (const h of houses) (h.material as MeshStandardMaterial).emissiveIntensity = d.cityLights * 1.4;
  };
  return { sky, starGeo, starMat, groundMat, instanced, apply, dispose: () => disposables.forEach((x) => x.dispose()) };
}

export function OutdoorWorld() {
  const ap = useApartment();
  const hour = useUi((s) => s.hour);
  // Мир стоит вокруг центра квартиры и не сдвигается при переходах между комнатами.
  const r = apartmentRect(ap);
  const [cx, cz] = [cmToScene((r.minX + r.maxX) / 2), cmToScene((r.minZ + r.maxZ) / 2)];
  const radius = Math.ceil(cmToScene(Math.hypot(r.maxX - r.minX, r.maxZ - r.minZ) / 2));
  const world = useMemo(() => buildWorld(radius), [radius]);
  useEffect(() => () => world.dispose(), [world]);

  const d = daylight(hour);
  useLayoutEffect(() => world.apply(d));

  return (
    <group name="outdoor-world" position={[cx, 0, cz]}>
      <mesh name="sky" renderOrder={RENDER_ORDER.world} material={world.sky} raycast={NO_RAYCAST} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      </mesh>
      <points name="stars" renderOrder={RENDER_ORDER.world} geometry={world.starGeo} material={world.starMat} raycast={NO_RAYCAST} frustumCulled={false} />
      <mesh name="ground" rotation-x={-Math.PI / 2} position-y={-0.3} renderOrder={RENDER_ORDER.world} material={world.groundMat} raycast={NO_RAYCAST}>
        <circleGeometry args={[SKY_RADIUS - 20, 48]} />
      </mesh>
      {world.instanced.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
