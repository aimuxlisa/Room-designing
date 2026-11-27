/**
 * Состояние загрузки моделей (13.6, SPEC §12): ошибка одного предмета не останавливает редактор.
 * Хранит причину по адресу модели и счётчик попыток — повтор сбрасывает кеш загрузчика и перемонтирует модель.
 */
import { useGLTF } from '@react-three/drei';
import { create } from 'zustand';

export interface AssetStatusState {
  readonly errors: Readonly<Record<string, { readonly name: string; readonly message: string }>>;
  readonly attempts: Readonly<Record<string, number>>;
  report(url: string, name: string, message: string): void;
  retry(url: string): void;
}

/** Понятная причина по технической строке загрузчика (18.1); исходная строка остаётся в подсказке. */
export function assetErrorReason(message: string): string {
  if (/\b404\b|Not Found/i.test(message)) return 'файл модели не найден на сервере';
  if (/Failed to fetch|NetworkError|net::/i.test(message)) return 'нет связи с сервером';
  if (/responded with 5\d\d/.test(message)) return 'сервер не отдал файл модели';
  return 'файл модели повреждён или не читается';
}

export const useAssetStatus = create<AssetStatusState>()((set, get) => ({
  errors: {},
  attempts: {},
  report: (url, name, message) => {
    if (get().errors[url]) return;
    set({ errors: { ...get().errors, [url]: { name, message } } });
  },
  retry: (url) => {
    useGLTF.clear(url);
    const errors = { ...get().errors };
    delete errors[url];
    set({ errors, attempts: { ...get().attempts, [url]: (get().attempts[url] ?? 0) + 1 } });
  },
}));
