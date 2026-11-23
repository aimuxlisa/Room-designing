/** Отрисовка собственной модели из деталей (ownModels): общие материалы на всю сцену, призрак — свои копии. */
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { OwnMaterial, OwnPart } from '../catalog/ownModels';
import type { GhostState } from './FurnitureModel';

const SPECS: Record<OwnMaterial, ConstructorParameters<typeof MeshStandardMaterial>[0]> = {
  ceramic: { color: '#f3f2ee', roughness: 0.18 },
  chrome: { color: '#d4d8dc', metalness: 0.95, roughness: 0.18 },
  glass: { color: '#cfe3ec', roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide },
  white: { color: '#ecebe7', roughness: 0.45 },
  oak: { color: '#b88c5c', roughness: 0.6 },
  walnut: { color: '#6b4a33', roughness: 0.55 },
  graphite: { color: '#3c3f44', roughness: 0.6 },
  stone: { color: '#9c9a94', roughness: 0.35 },
  shade: { color: '#f1e7d2', roughness: 0.8, side: DoubleSide, emissive: '#3a2e1a' },
  brass: { color: '#b8913f', metalness: 0.85, roughness: 0.3 },
  rug: { color: '#8a5a4a', roughness: 0.95 },
  rugBorder: { color: '#d9c9a8', roughness: 0.95 },
  seam: { color: '#9a9994', roughness: 0.8 },
  water: { color: '#bcd3dc', roughness: 0.1, metalness: 0.1 },
  curtain: { color: '#8c7a63', roughness: 0.95 },
  tulle: { color: '#f4f1ea', roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false, side: DoubleSide },
  screen: { color: '#0d0f12', roughness: 0.12, metalness: 0.3 },
  rugBlue: { color: '#4c6a8a', roughness: 0.95 },
};

/** Общие материалы: модели переиспользуют их, а не создают на каждый экземпляр (SPEC §12). */
const shared = Object.fromEntries(
  Object.entries(SPECS).map(([k, v]) => [k, new MeshStandardMaterial(v)]),
) as Record<OwnMaterial, MeshStandardMaterial>;

function ghostMaterials(ghost: GhostState): Record<OwnMaterial, MeshStandardMaterial> {
  if (ghost === 'none') return shared;
  return Object.fromEntries(
    Object.entries(shared).map(([k, m]) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.55;
      c.depthWrite = false;
      if (ghost === 'invalid') c.color = new Color('#ff5a5a');
      return [k, c];
    }),
  ) as Record<OwnMaterial, MeshStandardMaterial>;
}

export function OwnModel({ parts, ghost }: { parts: readonly OwnPart[]; ghost: GhostState }) {
  const mats = useMemo(() => ghostMaterials(ghost), [ghost]);
  // Копии материалов призрака освобождаются; общие материалы живут всё время работы (их передают свойством, R3F их не освобождает).
  useEffect(() => () => {
    if (mats !== shared) for (const m of Object.values(mats)) m.dispose();
  }, [mats]);
  return (
    <>
      {parts.map((p, i) => {
        const material = mats[p.mat];
        const shadow = ghost === 'none' && p.mat !== 'glass';
        if (p.shape === 'box')
          return (
            <mesh key={i} position={[...p.at]} material={material} castShadow={shadow} receiveShadow>
              <boxGeometry args={[...p.size]} />
            </mesh>
          );
        if (p.shape === 'torus')
          return (
            <mesh key={i} position={[...p.at]} rotation-x={Math.PI / 2} scale={[1, p.scaleZ ?? 1, 1]} material={material} castShadow={shadow} receiveShadow>
              <torusGeometry args={[p.r, p.tube, 12, 32]} />
            </mesh>
          );
        const rotation: [number, number, number] = p.axis === 'x' ? [0, 0, Math.PI / 2] : p.axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        return (
          <mesh key={i} position={[...p.at]} rotation={rotation} material={material} castShadow={shadow} receiveShadow>
            <cylinderGeometry args={[p.r2 ?? p.r, p.r, p.h, 24]} />
          </mesh>
        );
      })}
    </>
  );
}
