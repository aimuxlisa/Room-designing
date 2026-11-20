/**
 * Контракт изменения (SPEC §9): построить кандидат → проверить → применить целиком
 * либо оставить прежнее состояние. Команда — чистая функция и не знает о проверках и истории (DIP).
 */
import type { Apartment } from '../domain/types';
import { runValidators, type Issue, type Validator } from '../domain/validation';

export interface Command {
  readonly label: string;
  readonly apply: (ap: Apartment) => Apartment;
}

export type Proposal =
  | { readonly ok: true; readonly candidate: Apartment }
  | { readonly ok: false; readonly issues: readonly Issue[] };

export function proposeChange(ap: Apartment, command: Command, validators: readonly Validator[]): Proposal {
  let candidate: Apartment;
  try {
    candidate = command.apply(ap);
  } catch (e) {
    return { ok: false, issues: [{ code: 'command-failed', message: (e as Error).message, objectIds: [] }] };
  }
  const issues = runValidators(candidate, validators);
  return issues.length ? { ok: false, issues } : { ok: true, candidate };
}
