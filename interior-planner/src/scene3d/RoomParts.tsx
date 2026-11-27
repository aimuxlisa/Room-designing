/**
 * Общие части 3D-помещений для вида комнаты (этап 10) и прогулки по квартире (этап 24): пол с покрытием,
 * блоки стен с отделкой внутренних граней, окна со стеклом и рамой. Всё строится из функций domain.
 */
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Color, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import { useUi } from '../app/stores';
import { getWallMaterial } from '../catalog/materials';
import { openingFinish } from '../catalog/openingFinishes';
import { daylight } from '../domain/daylight';
import { openingSpan, openingVerticalRange } from '../domain/openings';
import { roomClearRect, surfaceKey, wallFootprint } from '../domain/rooms';
import { tileUv, type TileUv } from '../domain/surfaces';
import type { Apartment, MaterialDefinition, Opening, Room, Wall } from '../domain/types';
import { cmToScene } from '../domain/units';
import { wallSpanRect, type WallBlock } from '../domain/wallBlocks';
import { rectDepth, rectWidth, type Rect } from '../geometry/rect';
import { MASK_MATERIAL_PROPS, RENDER_ORDER } from './OutdoorWorld';
import { toColor } from './SceneLighting';

export const center = (r: Rect) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
export const NO_RAYCAST = () => {};
const WALL_COLOR = '#d9d4cb';
const GLASS_BASE = new Color('#9fc6e0');

/** Коробка по контуру в плане и высотному диапазону, см. */
export function BlockMesh({ rect, bottomCm, topCm, name, children }: { rect: Rect; bottomCm: number; topCm: number; name?: string; children: ReactNode }) {
  const c = center(rect);
  return (
    <mesh name={name} position={[cmToScene(c.x), cmToScene((bottomCm + topCm) / 2), cmToScene(c.z)]} castShadow receiveShadow>
      <boxGeometry args={[cmToScene(rectWidth(rect)), cmToScene(topCm - bottomCm), cmToScene(rectDepth(rect))]} />
      {children}
    </mesh>
  );
}

/** Рама окна (D-26): обвязка по контуру и вертикальный импост, толщина 6 см, по центру стены. */
function WindowFrame({ ap, wall, o }: { ap: Apartment; wall: Wall; o: Opening }) {
  const [s0, s1] = openingSpan(o);
  const [bottom, top] = openingVerticalRange(o);
  const f = openingFinish(o);
  const bar = 6;
  const mid = (s0 + s1) / 2;
  const parts: [number, number, number, number][] = [
    [s0, s0 + bar, bottom, top],
    [s1 - bar, s1, bottom, top],
    [s0, s1, bottom, bottom + bar],
    [s0, s1, top - bar, top],
    [mid - bar / 2, mid + bar / 2, bottom, top],
  ];
  return (
    <>
      {parts.map(([a, b, lo, hi], i) => (
        <BlockMesh key={i} name={`window-frame-${o.id}-${i}`} rect={wallSpanRect(ap, wall, a, b, 8)} bottomCm={lo} topCm={hi}>
          <meshStandardMaterial color={f.color} roughness={f.roughness} />
        </BlockMesh>
      ))}
    </>
  );
}

/**
 * Стекло окна (20.5): сквозь него виден внешний мир — маска трафарета той же формы открывает мир в этих
 * пикселях; оттенок и отражение стекла следуют небу текущего часа.
 */
function WindowGlass({ rect, bottomCm, topCm, name }: { rect: Rect; bottomCm: number; topCm: number; name: string }) {
  const hour = useUi((s) => s.hour);
  const d = daylight(hour);
  const tint = useMemo(() => new Color(), []);
  toColor(d.skyHorizon, tint).lerp(GLASS_BASE, 0.5);
  const c = center(rect);
  const position: [number, number, number] = [cmToScene(c.x), cmToScene((bottomCm + topCm) / 2), cmToScene(c.z)];
  const size: [number, number, number] = [cmToScene(rectWidth(rect)), cmToScene(topCm - bottomCm), cmToScene(rectDepth(rect))];
  return (
    <>
      <mesh name={`${name}-mask`} position={position} renderOrder={RENDER_ORDER.mask} raycast={NO_RAYCAST}>
        <boxGeometry args={size} />
        <meshBasicMaterial {...MASK_MATERIAL_PROPS} />
      </mesh>
      <mesh name={name} position={position} renderOrder={RENDER_ORDER.glass}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={tint} transparent opacity={0.12 + 0.1 * d.stars} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Окно в проёме стены: стекло и рама. */
export function WindowMesh({ ap, wall, o }: { ap: Apartment; wall: Wall; o: Opening }) {
  const [s0, s1] = openingSpan(o);
  const [bottom, top] = openingVerticalRange(o);
  return (
    <>
      <WindowGlass rect={wallSpanRect(ap, wall, s0, s1, 2)} bottomCm={bottom} topCm={top} name={`window-${o.id}`} />
      <WindowFrame ap={ap} wall={wall} o={o} />
    </>
  );
}

/** Обои и текстурные покрытия: своя копия текстуры на поверхность, повтор и сдвиг — из размеров в см (12.4). */
export function WallpaperMaterial({ attach, m, uv }: { attach: string; m: MaterialDefinition; uv: TileUv }) {
  const tex = useMemo(() => {
    const t = new TextureLoader().load(m.textureUrl!);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [m.textureUrl]);
  useEffect(() => () => tex.dispose(), [tex]);
  tex.repeat.set(uv.repeat[0], uv.repeat[1]);
  tex.offset.set(uv.offset[0], uv.offset[1]);
  return <meshStandardMaterial attach={attach} name={`finish:${m.id}`} map={tex} roughness={m.roughness} />;
}

/** Сторона стены, обращённая в комнату: грань BoxGeometry, направление оси u текстуры и отделка этой стороны. */
export interface WallFace {
  readonly index: number;
  readonly udir: 1 | -1;
  readonly finish: MaterialDefinition | undefined;
}

/** Ориентация стены и знак направления в комнату (+1 — комната со стороны больших координат). */
export function wallOrientation(ap: Apartment, wall: Wall, room: Room) {
  const fp = wallFootprint(ap, wall);
  const c = center(fp);
  const rc = center(roomClearRect(ap, room));
  const vertical = rectWidth(fp) < rectDepth(fp);
  const inward = vertical ? Math.sign(rc.x - c.x) : Math.sign(rc.z - c.z);
  return { vertical, inward, center: c };
}

export function wallFace(ap: Apartment, wall: Wall, room: Room): WallFace {
  const { vertical, inward } = wallOrientation(ap, wall, room);
  const finish = getWallMaterial(ap.finishes.walls[surfaceKey(wall.id, room.id)] ?? '');
  // BoxGeometry: 0 = +x, 1 = −x, 4 = +z, 5 = −z; u на +x растёт к −z, на −x к +z, на +z к +x, на −z к −x.
  if (vertical) return inward > 0 ? { index: 0, udir: -1, finish } : { index: 1, udir: 1, finish };
  return inward > 0 ? { index: 4, udir: 1, finish } : { index: 5, udir: -1, finish };
}

/** Блок стены: грани, обращённые в комнаты, получают отделку своей комнаты, остальные — базовый цвет (AC-11). */
export function WallBlockMesh(props: {
  block: WallBlock;
  name: string;
  vertical: boolean;
  faces: readonly WallFace[];
  onSelect?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { block, vertical, faces } = props;
  const { rect, bottomCm, topCm } = block;
  const c = center(rect);
  const [min, max] = vertical ? [rect.minZ, rect.maxZ] : [rect.minX, rect.maxX];
  return (
    <mesh
      name={props.name}
      userData={{ pick: !!props.onSelect }}
      position={[cmToScene(c.x), cmToScene((bottomCm + topCm) / 2), cmToScene(c.z)]}
      castShadow
      receiveShadow
      onClick={props.onSelect}
    >
      <boxGeometry args={[cmToScene(rectWidth(rect)), cmToScene(topCm - bottomCm), cmToScene(rectDepth(rect))]} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const face = faces.find((f) => f.index === i && f.finish);
        const finish = face?.finish;
        if (!face || !finish) return <meshStandardMaterial key={i} attach={`material-${i}`} color={WALL_COLOR} />;
        const uv = finish.tileSizeCm ? tileUv(face.udir * (face.udir > 0 ? min : max), max - min, bottomCm, topCm - bottomCm, finish.tileSizeCm) : null;
        return finish.textureUrl && uv ? (
          <WallpaperMaterial key={`${i}-${finish.id}`} attach={`material-${i}`} m={finish} uv={uv} />
        ) : (
          <meshStandardMaterial key={`${i}-${finish.id}`} attach={`material-${i}`} name={`finish:${finish.id}`} color={finish.color} roughness={finish.roughness} />
        );
      })}
    </mesh>
  );
}

/** Пол комнаты: покрытие (D-16, D-25) с физическим повтором текстуры или базовый цвет. */
export function FloorMesh({ ap, room }: { ap: Apartment; room: Room }) {
  const clear = roomClearRect(ap, room);
  const c = center(clear);
  const [w, d] = [rectWidth(clear), rectDepth(clear)];
  const finish = getWallMaterial(ap.finishes.floors[room.id] ?? '');
  return (
    <mesh name={`floor-${room.id}`} rotation-x={-Math.PI / 2} position={[cmToScene(c.x), 0, cmToScene(c.z)]} receiveShadow>
      <planeGeometry args={[cmToScene(w), cmToScene(d)]} />
      {finish?.textureUrl && finish.tileSizeCm ? (
        <WallpaperMaterial key={finish.id} attach="material" m={finish} uv={tileUv(clear.minX, w, clear.minZ, d, finish.tileSizeCm)} />
      ) : (
        <meshStandardMaterial color={finish?.color ?? '#b89a74'} />
      )}
    </mesh>
  );
}
