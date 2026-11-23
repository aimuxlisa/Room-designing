import { useEffect } from 'react';
import type { Command } from '../commands/change';
import { moveFurniture, removeFurniture } from '../commands/furniture';
import { editorActionForKey, historyActionForKey, nudgeForKey, type KeyInput } from '../commands/hotkeys';
import type { Stores } from '../app/stores';
import { ROTATE_STEP_DEG } from '../interaction/dragStore';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

const toKeyInput = (e: KeyboardEvent): KeyInput => ({
  code: e.code,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
  shiftKey: e.shiftKey,
  inEditableField: isEditable(e.target),
});

/**
 * Горячие клавиши редактора и истории (D-10); по коду клавиши — работают в русской раскладке.
 * Не срабатывают в полях ввода. Изменение выбранного предмета проходит тот же валидатор:
 * при отказе предмет не меняется, причина — в строке состояния.
 */
export function useEditorHotkeys({ project, ui, drag, catalog }: Stores) {
  useEffect(() => {
    const execute = (cmd: Command) => {
      const r = project.getState().execute(cmd);
      drag.getState().report(r.ok ? null : r.issues[0].message);
    };
    const onKey = (e: KeyboardEvent) => {
      const key = toKeyInput(e);
      const history = historyActionForKey(key);
      if (history) {
        e.preventDefault();
        if (!drag.getState().draft) project.getState()[history]();
        return;
      }
      const draft = drag.getState().draft;
      const selected = ui.getState().selectedId;
      const instance = selected ? project.getState().history.present.furniture[selected] : undefined;
      const nudge = nudgeForKey(key);
      if (nudge) {
        if (!instance || draft) return;
        e.preventDefault();
        const p = instance.position;
        execute(moveFurniture(instance.id, { ...p, xCm: p.xCm + nudge.dx, zCm: p.zCm + nudge.dz }, instance.angleDeg));
        return;
      }
      const action = editorActionForKey(key);
      if (!action) return;
      e.preventDefault();
      if (action === 'cancel') return drag.getState().cancel();
      if (action === 'delete') {
        if (instance && !draft) {
          project.getState().execute(removeFurniture(instance.id));
          ui.getState().select(null);
        }
        return;
      }
      const delta = action === 'rotate-cw' ? -ROTATE_STEP_DEG : ROTATE_STEP_DEG;
      if (draft) drag.getState().rotate(delta);
      // Настенные предметы не поворачиваются: их угол задаёт стена (SPEC §11.1).
      else if (instance && catalog(instance.catalogItemId)?.mounting !== 'wall')
        execute(moveFurniture(instance.id, instance.position, instance.angleDeg + delta));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, ui, drag, catalog]);
}
