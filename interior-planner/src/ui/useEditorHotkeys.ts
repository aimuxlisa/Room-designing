import { useEffect } from 'react';
import { moveFurniture, removeFurniture } from '../commands/furniture';
import { editorActionForKey, historyActionForKey, type KeyInput } from '../commands/hotkeys';
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

/** Горячие клавиши редактора и истории; по коду клавиши — работают в русской раскладке. */
export function useEditorHotkeys({ project, ui, drag }: Stores) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = toKeyInput(e);
      const history = historyActionForKey(key);
      if (history) {
        e.preventDefault();
        if (!drag.getState().draft) project.getState()[history]();
        return;
      }
      const action = editorActionForKey(key);
      if (!action) return;
      const draft = drag.getState().draft;
      const selected = ui.getState().selectedId;
      const instance = selected ? project.getState().history.present.furniture[selected] : undefined;
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
      else if (instance) project.getState().execute(moveFurniture(instance.id, instance.position, instance.angleDeg + delta));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, ui, drag]);
}
