import { useEffect } from 'react';
import type { Stores } from '../app/stores';

/**
 * Завершение и отмена переноса (SPEC §11.1 п. 6–7, задача 14.6): отпускание кнопки где угодно
 * завершает перенос (вне видов кандидата нет — ничего не создаётся); потеря захвата указателя,
 * потеря фокуса окна, смена комнаты или шага приложения — отменяют. Камера включается сама:
 * OrbitControls включены, пока нет кандидата.
 */
export function useDragLifecycle({ drag, ui }: Stores) {
  useEffect(() => {
    const onUp = () => {
      const d = drag.getState().draft;
      if (!d) return;
      const result = drag.getState().finish();
      if (result?.ok) ui.getState().select(d.instanceId);
    };
    const cancel = () => drag.getState().draft && drag.getState().cancel();
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    const unsubscribe = ui.subscribe((s, prev) => {
      if (s.activeRoomId !== prev.activeRoomId || s.stage !== prev.stage) cancel();
    });
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      unsubscribe();
    };
  }, [drag, ui]);
}
