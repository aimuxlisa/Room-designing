/** История отмены и повтора (D-18): один шаг — одно атомарно применённое изменение. */
import { LIMITS } from '../domain/limits';

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export const commit = <T>(h: History<T>, next: T, limit: number = LIMITS.historySteps): History<T> => ({
  past: [...h.past, h.present].slice(-limit),
  present: next,
  future: [],
});

export const undo = <T>(h: History<T>): History<T> =>
  h.past.length === 0
    ? h
    : { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };

export const redo = <T>(h: History<T>): History<T> =>
  h.future.length === 0 ? h : { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
