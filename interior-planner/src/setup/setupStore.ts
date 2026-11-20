/**
 * Черновик настройки квартиры (SPEC §9): выбранная стена и её сдвиг. Кандидат проверяется
 * тем же контрактом изменения; в историю попадает только применённое изменение.
 */
import { create } from 'zustand';
import type { Proposal } from '../commands/change';
import { moveWall } from '../commands/walls';
import type { Id } from '../domain/types';
import type { ProjectStore } from '../store/projectStore';

export interface SetupState {
  readonly wallId: Id | null;
  /** Сдвиг выбранной стены, см (0 — изменений нет). */
  readonly deltaCm: number;
  readonly proposal: Proposal | null;
  /** Причина последнего отклонённого применения. */
  readonly lastIssue: string | null;
  selectWall(wallId: Id | null): void;
  setDelta(deltaCm: number): void;
  /** Применить целиком или оставить прежнее состояние (8.5). */
  apply(): Proposal | null;
  reset(): void;
}

export const createSetupStore = (project: ProjectStore) =>
  create<SetupState>()((set, get) => ({
    wallId: null,
    deltaCm: 0,
    proposal: null,
    lastIssue: null,
    selectWall: (wallId) => set({ wallId, deltaCm: 0, proposal: null, lastIssue: null }),
    setDelta(deltaCm) {
      const { wallId } = get();
      if (!wallId) return;
      set({ deltaCm, proposal: deltaCm === 0 ? null : project.getState().preview(moveWall(wallId, deltaCm)), lastIssue: null });
    },
    apply() {
      const { wallId, deltaCm } = get();
      if (!wallId || deltaCm === 0) return null;
      const result = project.getState().execute(moveWall(wallId, deltaCm));
      set({ deltaCm: 0, proposal: null, lastIssue: result.ok ? null : result.issues[0].message });
      return result;
    },
    reset: () => set({ deltaCm: 0, proposal: null }),
  }));

export type SetupStore = ReturnType<typeof createSetupStore>;
