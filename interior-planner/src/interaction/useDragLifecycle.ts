import { useEffect } from 'react';
import type { Stores } from '../app/stores';

/** Отпускание кнопки где угодно завершает перенос; потеря фокуса окна — отменяет (SPEC §11.1 п. 7). */
export function useDragLifecycle({ drag, ui }: Stores) {
  useEffect(() => {
    const onUp = () => {
      const d = drag.getState().draft;
      if (!d) return;
      const result = drag.getState().finish();
      if (result?.ok) ui.getState().select(d.instanceId);
    };
    const onBlur = () => drag.getState().cancel();
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [drag, ui]);
}
