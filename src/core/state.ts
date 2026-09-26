import { createProgress } from './progress';
import type { GameState } from './types';

export const STATE_SCHEMA = 1 as const;

export function createState(): GameState {
  return { schema: STATE_SCHEMA, progress: createProgress(), round: null, lastResult: null };
}
