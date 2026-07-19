import type { RecordedInteractionResult, TemporalContextResult } from './results.js';
import type { GetTemporalContextInput, RecordInteractionInput } from './schemas.js';

/** Stable adapter surface for hosts that cannot use lifecycle hooks directly. */
export interface TemporalThreadAdapter {
  recordInteraction(input: RecordInteractionInput): Promise<RecordedInteractionResult>;
  getTemporalContext(input: GetTemporalContextInput): Promise<TemporalContextResult>;
}
