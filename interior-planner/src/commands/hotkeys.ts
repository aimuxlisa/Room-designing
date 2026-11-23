/** Сопоставление клавиш истории (D-18). По коду клавиши — работает в русской раскладке. */
export type HistoryAction = 'undo' | 'redo';

export interface KeyInput {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  /** Фокус в поле ввода — горячие клавиши не перехватываются (AC-16). */
  readonly inEditableField: boolean;
}

export type EditorAction = 'rotate-cw' | 'rotate-ccw' | 'delete' | 'cancel';

/** R / Shift+R — поворот, Delete — удаление, Esc — отмена переноса (D-10). */
export function editorActionForKey(e: KeyInput): EditorAction | null {
  if (e.inEditableField || e.ctrlKey || e.metaKey) return null;
  if (e.code === 'KeyR') return e.shiftKey ? 'rotate-ccw' : 'rotate-cw';
  if (e.code === 'Delete') return 'delete';
  if (e.code === 'Escape') return 'cancel';
  return null;
}

/** Стрелки — сдвиг выбранного предмета на 1 см, с Shift — на 10 см (D-10); вверх — к северу (−Z). */
export function nudgeForKey(e: KeyInput): { dx: number; dz: number } | null {
  if (e.inEditableField || e.ctrlKey || e.metaKey) return null;
  const step = e.shiftKey ? 10 : 1;
  const map: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const d = map[e.code];
  return d ? { dx: d[0], dz: d[1] } : null;
}

export function historyActionForKey(e: KeyInput): HistoryAction | null {
  if (e.inEditableField || !(e.ctrlKey || e.metaKey)) return null;
  if (e.code === 'KeyZ') return e.shiftKey ? 'redo' : 'undo';
  if (e.code === 'KeyY' && !e.shiftKey) return 'redo';
  return null;
}
