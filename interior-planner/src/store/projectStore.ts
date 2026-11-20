/**
 * Состояние проекта: только квартира и её история. Выбор, камера и этап — в uiStore (SPEC §6).
 */
import { create } from 'zustand';
import { proposeChange, type Command, type Proposal } from '../commands/change';
import { commit, createHistory, redo, undo, type History } from '../commands/history';
import { integrityValidators } from '../domain/integrity';
import type { Apartment } from '../domain/types';
import type { Validator } from '../domain/validation';

export interface ProjectState {
  readonly history: History<Apartment>;
  readonly validators: readonly Validator[];
  /** Предпросмотр: проверка без изменения состояния и истории. */
  preview(command: Command): Proposal;
  /** Применить целиком или ничего не менять; успешное изменение — один шаг истории. */
  execute(command: Command): Proposal;
  undo(): void;
  redo(): void;
  load(apartment: Apartment): void;
}

export const createProjectStore = (initial: Apartment, validators: readonly Validator[] = integrityValidators) =>
  create<ProjectState>()((set, get) => ({
    history: createHistory(initial),
    validators,
    preview: (command) => proposeChange(get().history.present, command, get().validators),
    execute(command) {
      const result = get().preview(command);
      if (result.ok) set({ history: commit(get().history, result.candidate) });
      return result;
    },
    undo: () => set({ history: undo(get().history) }),
    redo: () => set({ history: redo(get().history) }),
    load: (apartment) => set({ history: createHistory(apartment) }),
  }));

export type ProjectStore = ReturnType<typeof createProjectStore>;
