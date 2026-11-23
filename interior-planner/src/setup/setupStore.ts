/**
 * Черновик настройки квартиры (SPEC §9): выбранная стена или проём и их изменение. Кандидат проверяется
 * тем же контрактом изменения; в историю попадает только применённое изменение.
 */
import { create } from 'zustand';
import type { Proposal } from '../commands/change';
import { patchOpening, type OpeningPatch } from '../commands/openings';
import { moveWall } from '../commands/walls';
import type { CatalogLookup } from '../domain/furniture';
import type { Id } from '../domain/types';
import type { ProjectStore } from '../store/projectStore';

export interface SetupState {
  readonly wallId: Id | null;
  /** Сдвиг выбранной стены, см (0 — изменений нет). */
  readonly deltaCm: number;
  readonly proposal: Proposal | null;
  /** Выбранный проём (дверь или окно). */
  readonly openingId: Id | null;
  /** Черновик изменений проёма: только поля, отличающиеся от текущих. */
  readonly openingDraft: OpeningPatch;
  readonly openingProposal: Proposal | null;
  /** Причина последнего отклонённого применения. */
  readonly lastIssue: string | null;
  /** Объекты последнего отказа (мебель, комнаты) — подсветка и переход к предмету (15.4). */
  readonly lastObjectIds: readonly Id[];
  selectWall(wallId: Id | null): void;
  setDelta(deltaCm: number): void;
  /** Применить целиком или оставить прежнее состояние (8.5). */
  apply(): Proposal | null;
  reset(): void;
  selectOpening(openingId: Id | null): void;
  /** Слить поля в черновик проёма; значения, совпадающие с текущими, из черновика убираются. */
  editOpening(patch: OpeningPatch): void;
  applyOpening(): Proposal | null;
  resetOpening(): void;
}

const EMPTY_DRAFT: OpeningPatch = {};
const NO_ISSUE = { lastIssue: null, lastObjectIds: [] as readonly Id[] };
const outcome = (r: Proposal) => (r.ok ? NO_ISSUE : { lastIssue: r.issues[0].message, lastObjectIds: r.issues.flatMap((i) => i.objectIds) });

/** С каталогом настенные предметы на сдвигаемой стене едут вместе с ней (см. moveWall). */
export const createSetupStore = (project: ProjectStore, catalog?: CatalogLookup) =>
  create<SetupState>()((set, get) => ({
    wallId: null,
    deltaCm: 0,
    proposal: null,
    openingId: null,
    openingDraft: EMPTY_DRAFT,
    openingProposal: null,
    ...NO_ISSUE,
    selectWall: (wallId) => set({ wallId, deltaCm: 0, proposal: null, ...NO_ISSUE, openingId: null, openingDraft: EMPTY_DRAFT, openingProposal: null }),
    setDelta(deltaCm) {
      const { wallId } = get();
      if (!wallId) return;
      set({ deltaCm, proposal: deltaCm === 0 ? null : project.getState().preview(moveWall(wallId, deltaCm, catalog)), ...NO_ISSUE });
    },
    apply() {
      const { wallId, deltaCm } = get();
      if (!wallId || deltaCm === 0) return null;
      const result = project.getState().execute(moveWall(wallId, deltaCm, catalog));
      set({ deltaCm: 0, proposal: null, ...outcome(result) });
      return result;
    },
    reset: () => set({ deltaCm: 0, proposal: null }),

    selectOpening: (openingId) =>
      set({ openingId, openingDraft: EMPTY_DRAFT, openingProposal: null, ...NO_ISSUE, wallId: null, deltaCm: 0, proposal: null }),
    editOpening(patch) {
      const { openingId, openingDraft } = get();
      if (!openingId) return;
      const current = project.getState().history.present.openings[openingId];
      const merged: Record<string, unknown> = { ...openingDraft, ...patch };
      const draft: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(merged)) {
        if ((current as unknown as Record<string, unknown>)[k] !== v) draft[k] = v;
      }
      const next = draft as OpeningPatch;
      const empty = Object.keys(next).length === 0;
      set({
        openingDraft: next,
        openingProposal: empty ? null : project.getState().preview(patchOpening(openingId, next)),
        ...NO_ISSUE,
      });
    },
    applyOpening() {
      const { openingId, openingDraft } = get();
      if (!openingId || Object.keys(openingDraft).length === 0) return null;
      const result = project.getState().execute(patchOpening(openingId, openingDraft));
      set({ openingDraft: EMPTY_DRAFT, openingProposal: null, ...outcome(result) });
      return result;
    },
    resetOpening: () => set({ openingDraft: EMPTY_DRAFT, openingProposal: null }),
  }));

export type SetupStore = ReturnType<typeof createSetupStore>;

/** Объекты, мешающие текущему кандидату или последнему применению (для подсветки на плане). */
export const conflictObjectIds = (s: Pick<SetupState, 'proposal' | 'openingProposal' | 'lastObjectIds'>): readonly Id[] => {
  const failed = [s.proposal, s.openingProposal].flatMap((p) => (p && !p.ok ? p.issues.flatMap((i) => i.objectIds) : []));
  return failed.length ? failed : s.lastObjectIds;
};
