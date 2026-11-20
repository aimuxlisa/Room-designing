/**
 * Общий контракт проверок (SPEC §9, D-21). Валидатор — чистая функция; новые проверки
 * (этап 5: наложения, проёмы, мебель) добавляются в реестр без изменения команд и истории.
 */
import type { Apartment, Id } from './types';

export interface Issue {
  /** Машинный код причины. */
  readonly code: string;
  /** Конкретное сообщение для пользователя (SPEC §9: без «Неверный размер»). */
  readonly message: string;
  readonly objectIds: readonly Id[];
}

export type Validator = (ap: Apartment) => readonly Issue[];

/**
 * Проверки по ступеням: следующая ступень запускается, только если предыдущая без замечаний.
 * Геометрия не считается на модели с битыми ссылками или NaN.
 */
export const staged =
  (...stages: readonly (readonly Validator[])[]): Validator =>
  (ap) => {
    for (const stage of stages) {
      const issues = runValidators(ap, stage);
      if (issues.length) return issues;
    }
    return [];
  };

export const runValidators =(ap: Apartment, validators: readonly Validator[]): Issue[] =>
  validators.flatMap((v) => v(ap));
