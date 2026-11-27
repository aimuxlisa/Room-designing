/**
 * Доступ браузерных проверок к хранилищам и сцене (window.__stores, __scene и т. п.).
 * В режиме разработки — всегда; в сборке — только для замеров (`VITE_PROBE=1`, этап 18.3), обычная сборка их не содержит.
 */
export const PROBE = import.meta.env.DEV || import.meta.env.VITE_PROBE === '1';
