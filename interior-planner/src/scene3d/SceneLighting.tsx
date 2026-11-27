/**
 * Единое освещение интерактивного вида (16.1), зависящее от времени суток (20.4, D-12): рассеянный свет
 * полусферы, солнце или луна с мягкими тенями, привязанные к активной комнате, и окружение для отражений
 * из процедурных световых панелей — без загрузки HDRI.
 * Над комнатой — невидимый потолок, который только отбрасывает тень: прямой свет солнца и луны попадает
 * в комнату через окна и проёмы, а не сверху; ночью без светильников комната тёмная.
 * Цветопередача — по умолчанию R3F: ACES Filmic и вывод в sRGB; текстуры цвета помечены sRGB.
 */
import { Environment, Lightformer } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DirectionalLight, HemisphereLight, Object3D, SRGBColorSpace } from 'three';
import { daylight, type Rgb } from '../domain/daylight';
import { cmToScene } from '../domain/units';
import { rectDepth, rectWidth, type Rect } from '../geometry/rect';
import { useUi } from '../app/stores';

/** Цвет модели (sRGB) в рабочее пространство Three.js. */
export const toColor = (rgb: Rgb, out = new Color()) => out.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

const NO_RAYCAST = () => {};
/** Расстояние от комнаты до источника направленного света, м. */
const KEY_DISTANCE = 12;

/**
 * Окружение для отражений. Отдельный неизменный компонент: drei снимает куб окружения заново при каждой
 * перерисовке с новыми children, а SceneLighting перерисовывается на каждом шаге ползунка времени.
 */
const StudioEnvironment = memo(function StudioEnvironment() {
  return (
    <Environment resolution={256}>
      <Lightformer form="rect" intensity={1.5} color="#fff6ea" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#dfe8ff" position={[8, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={0.5} position={[-8, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={0.4} color="#b39b7a" position={[0, -1, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
    </Environment>
  );
});

export function SceneLighting({ clear, ceilingCm }: { clear: Rect; ceilingCm: number }) {
  const hour = useUi((s) => s.hour);
  const getThree = useThree((s) => s.get);
  const target = useMemo(() => new Object3D(), []);
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const c: [number, number, number] = [cmToScene((clear.minX + clear.maxX) / 2), 0, cmToScene((clear.minZ + clear.maxZ) / 2)];
  const spanCm = Math.max(rectWidth(clear), rectDepth(clear));
  // Ортокамера тени должна вмещать комнату при любом наклоне луча.
  const half = cmToScene(spanCm) / 2 + cmToScene(ceilingCm) + 1;
  const d = daylight(hour);

  useLayoutEffect(() => {
    const k = key.current;
    const f = fill.current;
    if (!k || !f) return;
    k.position.set(c[0] + d.key.dir[0] * KEY_DISTANCE, d.key.dir[1] * KEY_DISTANCE, c[2] + d.key.dir[2] * KEY_DISTANCE);
    toColor(d.key.color, k.color);
    k.intensity = d.key.intensity;
    toColor(d.fill.sky, f.color);
    toColor(d.fill.ground, f.groundColor);
    f.intensity = d.fill.intensity;
    // Не через свойство Environment: его смена заново снимает куб окружения на каждом шаге ползунка.
    getThree().scene.environmentIntensity = d.envIntensity;
  });

  // Потолок-заслонка: шире комнаты на толщину стен, чтобы свет не проходил по краю.
  const pad = 40;
  return (
    <>
      <hemisphereLight ref={fill} />
      <primitive object={target} position={c} />
      <directionalLight
        ref={key}
        target={target}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={0.5}
        shadow-camera-far={KEY_DISTANCE * 2.5}
      />
      <mesh
        name="ceiling-shadow"
        rotation-x={Math.PI / 2}
        position={[c[0], cmToScene(ceilingCm + 1), c[2]]}
        castShadow
        raycast={NO_RAYCAST}
      >
        <planeGeometry args={[cmToScene(rectWidth(clear) + pad * 2), cmToScene(rectDepth(clear) + pad * 2)]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <StudioEnvironment />
    </>
  );
}
