/**
 * Общий цикл переноса и поворота для каталога, плана и 3D (SPEC §11.1). Виды только сообщают точку
 * на полу в см; кандидат проверяется тем же контрактом, что и любое изменение (preview).
 * Временный кандидат в историю не попадает. В режиме поворота точка задаёт направление лицевой стороны.
 */
import { create } from 'zustand';
import type { Command, Proposal } from '../commands/change';
import { moveFurniture, placeFurniture } from '../commands/furniture';
import { angleTowards, restingY, snapToWall, type CatalogLookup } from '../domain/furniture';
import type { Id, Vec3Cm } from '../domain/types';
import { normalizeDeg, snapCm } from '../geometry/placement';
import type { Point } from '../geometry/rect';
import type { ProjectStore } from '../store/projectStore';

export const SNAP_CM = 5;
export const ROTATE_STEP_DEG = 15;

export interface Draft {
  readonly itemId: Id;
  /** Существующий предмет или новый id для предмета из каталога. */
  readonly instanceId: Id;
  readonly isNew: boolean;
  /** Перенос или поворот мышью за ручку (план) или кольцо (3D). */
  readonly mode: 'move' | 'rotate';
  readonly roomId: Id;
  readonly position: Vec3Cm | null;
  readonly angleDeg: number;
  /** Смещение опорной точки от точки захвата. */
  readonly grabOffset: Point;
  readonly proposal: Proposal | null;
}

export interface DragState {
  readonly draft: Draft | null;
  /** Причина последнего отклонённого изменения (для сообщения). */
  readonly lastIssue: string | null;
  startFromCatalog(itemId: Id): void;
  startMove(instanceId: Id, grab: Point): void;
  /** Поворот существующего предмета мышью; настенные предметы не поворачиваются. */
  startRotate(instanceId: Id): void;
  /** null — указатель вне видов. snap=false при зажатом Alt (D-10). */
  pointAt(p: Point | null, snap?: boolean): void;
  rotate(deltaDeg: number): void;
  /** Применить допустимый кандидат; при отказе ничего не меняется (AC-08). */
  finish(): Proposal | null;
  cancel(): void;
  /** Сообщение об отклонённом изменении вне переноса (стрелки, клавиша R). */
  report(issue: string | null): void;
}

let counter = 0;
const newId = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;

function commandFor(d: Draft): Command | null {
  if (!d.position) return null;
  return d.isNew
    ? placeFurniture({
        id: d.instanceId,
        catalogItemId: d.itemId,
        assetVersion: 1,
        roomId: d.roomId,
        position: d.position,
        angleDeg: normalizeDeg(d.angleDeg),
        variantId: null,
      })
    : moveFurniture(d.instanceId, d.position, d.angleDeg);
}

export const createDragStore = (project: ProjectStore, activeRoomId: () => Id | null, catalog: CatalogLookup) =>
  create<DragState>()((set, get) => {
    const isWallItem = (itemId: Id) => catalog(itemId)?.mounting === 'wall';
    const update = (patch: Partial<Draft>) => {
      const d = get().draft;
      if (!d) return;
      let next = { ...d, ...patch };
      const item = catalog(next.itemId);
      if (next.position && item) {
        // Высота установки по способу из карточки (пол, стена, потолок, столешница).
        const ap = project.getState().history.present;
        const yCm = restingY(ap, catalog, item, { position: next.position, angleDeg: next.angleDeg, roomId: next.roomId }, next.instanceId);
        next = { ...next, position: { ...next.position, yCm } };
      }
      const cmd = commandFor(next);
      set({ draft: { ...next, proposal: cmd ? project.getState().preview(cmd) : null } });
    };
    const existing = (instanceId: Id) => project.getState().history.present.furniture[instanceId];
    return {
      draft: null,
      lastIssue: null,
      startFromCatalog(itemId) {
        const roomId = activeRoomId();
        if (!roomId) return;
        set({
          draft: {
            itemId,
            instanceId: newId(),
            isNew: true,
            mode: 'move',
            roomId,
            position: null,
            angleDeg: 0,
            grabOffset: { x: 0, z: 0 },
            proposal: null,
          },
        });
      },
      startMove(instanceId, grab) {
        const f = existing(instanceId);
        if (!f) return;
        set({
          draft: {
            itemId: f.catalogItemId,
            instanceId,
            isNew: false,
            mode: 'move',
            roomId: f.roomId,
            position: f.position,
            angleDeg: f.angleDeg,
            grabOffset: { x: f.position.xCm - grab.x, z: f.position.zCm - grab.z },
            proposal: null,
          },
        });
      },
      startRotate(instanceId) {
        const f = existing(instanceId);
        if (!f || isWallItem(f.catalogItemId)) return;
        set({
          draft: {
            itemId: f.catalogItemId,
            instanceId,
            isNew: false,
            mode: 'rotate',
            roomId: f.roomId,
            position: f.position,
            angleDeg: f.angleDeg,
            grabOffset: { x: 0, z: 0 },
            proposal: null,
          },
        });
      },
      pointAt(p, snap = true) {
        const d = get().draft;
        if (!d) return;
        if (d.mode === 'rotate') {
          // Поворот: лицевая сторона смотрит на указатель; привязка 15°, Alt — свободный угол (D-10).
          if (!p || !d.position) return;
          const raw = angleTowards({ x: d.position.xCm, z: d.position.zCm }, p);
          return update({ angleDeg: normalizeDeg(snap ? snapCm(raw, ROTATE_STEP_DEG) : raw) });
        }
        if (!p) return update({ position: null });
        const s = (v: number) => (snap ? snapCm(v, SNAP_CM) : v);
        const target = { x: p.x + d.grabOffset.x, z: p.z + d.grabOffset.z };
        const item = catalog(d.itemId);
        if (item?.mounting === 'wall') {
          // Настенный предмет прилегает к ближайшей стене; угол задаёт стена, привязка — только вдоль стены.
          const w = snapToWall(project.getState().history.present, d.roomId, item, target);
          const point = w.along === 'x' ? { x: s(w.point.x), z: w.point.z } : { x: w.point.x, z: s(w.point.z) };
          return update({ position: { xCm: point.x, yCm: 0, zCm: point.z }, angleDeg: w.angleDeg });
        }
        update({ position: { xCm: s(target.x), yCm: 0, zCm: s(target.z) } });
      },
      rotate(deltaDeg) {
        const d = get().draft;
        if (d && !isWallItem(d.itemId)) update({ angleDeg: normalizeDeg(d.angleDeg + deltaDeg) });
      },
      finish() {
        const d = get().draft;
        const cmd = d && commandFor(d);
        const result = cmd ? project.getState().execute(cmd) : null;
        set({ draft: null, lastIssue: result && !result.ok ? result.issues[0].message : null });
        return result;
      },
      cancel: () => set({ draft: null }),
      report: (lastIssue) => set({ lastIssue }),
    };
  });

export type DragStore = ReturnType<typeof createDragStore>;
