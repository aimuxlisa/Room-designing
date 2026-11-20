/**
 * Общий цикл переноса для каталога, плана и 3D (SPEC §11.1). Виды только сообщают точку
 * на полу в см; кандидат проверяется тем же контрактом, что и любое изменение (preview).
 * Временный кандидат в историю не попадает.
 */
import { create } from 'zustand';
import type { Command, Proposal } from '../commands/change';
import { moveFurniture, placeFurniture } from '../commands/furniture';
import { restingY, type CatalogLookup } from '../domain/furniture';
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
  readonly roomId: Id;
  readonly position: Vec3Cm | null;
  readonly angleDeg: number;
  /** Смещение опорной точки от точки захвата. */
  readonly grabOffset: Point;
  readonly proposal: Proposal | null;
}

export interface DragState {
  readonly draft: Draft | null;
  /** Причина последнего отклонённого отпускания (для сообщения). */
  readonly lastIssue: string | null;
  startFromCatalog(itemId: Id): void;
  startMove(instanceId: Id, grab: Point): void;
  /** null — указатель вне видов. snap=false при зажатом Alt (D-10). */
  pointAt(p: Point | null, snap?: boolean): void;
  rotate(deltaDeg: number): void;
  /** Применить допустимый кандидат; при отказе ничего не меняется (AC-08). */
  finish(): Proposal | null;
  cancel(): void;
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
    return {
      draft: null,
      lastIssue: null,
      startFromCatalog(itemId) {
        const roomId = activeRoomId();
        if (!roomId) return;
        set({
          draft: { itemId, instanceId: newId(), isNew: true, roomId, position: null, angleDeg: 0, grabOffset: { x: 0, z: 0 }, proposal: null },
        });
      },
      startMove(instanceId, grab) {
        const f = project.getState().history.present.furniture[instanceId];
        if (!f) return;
        set({
          draft: {
            itemId: f.catalogItemId,
            instanceId,
            isNew: false,
            roomId: f.roomId,
            position: f.position,
            angleDeg: f.angleDeg,
            grabOffset: { x: f.position.xCm - grab.x, z: f.position.zCm - grab.z },
            proposal: null,
          },
        });
      },
      pointAt(p, snap = true) {
        const d = get().draft;
        if (!d) return;
        if (!p) return update({ position: null });
        const s = (v: number) => (snap ? snapCm(v, SNAP_CM) : v);
        update({ position: { xCm: s(p.x + d.grabOffset.x), yCm: 0, zCm: s(p.z + d.grabOffset.z) } });
      },
      rotate(deltaDeg) {
        const d = get().draft;
        if (d) update({ angleDeg: normalizeDeg(d.angleDeg + deltaDeg) });
      },
      finish() {
        const d = get().draft;
        const cmd = d && commandFor(d);
        const result = cmd ? project.getState().execute(cmd) : null;
        set({ draft: null, lastIssue: result && !result.ok ? result.issues[0].message : null });
        return result;
      },
      cancel: () => set({ draft: null }),
    };
  });

export type DragStore = ReturnType<typeof createDragStore>;
