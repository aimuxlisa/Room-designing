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

export function historyActionForKey(e: KeyInput): HistoryAction | null {
  if (e.inEditableField || !(e.ctrlKey || e.metaKey)) return null;
  if (e.code === 'KeyZ') return e.shiftKey ? 'redo' : 'undo';
  if (e.code === 'KeyY' && !e.shiftKey) return 'redo';
  return null;
}
