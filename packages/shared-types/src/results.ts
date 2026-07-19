import type {
  Agent,
  Commitment,
  Interaction,
  Project,
  Session,
  TemporalReference,
  TemporalResolution,
} from './entities.js';
import type { CommitmentDisplayStatus } from './enums.js';

export interface CurrentTimeResult {
  utcTime: string;
  localIsoTime: string;
  timezone: string;
  utcOffset: string;
  utcOffsetMinutes: number;
  date: string;
  dayOfWeek: string;
  unixTimestamp: number;
}

export interface ElapsedTimeResult {
  startUtc: string;
  endUtc: string;
  timezone: string;
  totalMilliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  exactDays: number;
  exactDayBreakdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  };
  calendarDayDifference: number;
  humanReadable: string;
  endBeforeStart: boolean;
}

export interface RecordedInteractionResult {
  interactionId: string;
  sessionId: string;
  duplicate: boolean;
  privacyMode: string;
  temporalReferences: TemporalResolution[];
}

export interface LastInteractionResult {
  interactionId: string;
  timestamp: string;
  timezone: string;
  elapsed: ElapsedTimeResult;
  project: Pick<Project, 'id' | 'name' | 'normalizedPath'> | null;
  agent: Pick<Agent, 'id' | 'name' | 'platform' | 'version'>;
  session: Pick<Session, 'id' | 'externalSessionId' | 'generatedSession'>;
  role: string;
  rawText?: string;
}

export interface CommitmentView extends Commitment {
  displayStatus: CommitmentDisplayStatus;
  overdueCalendarDays: number | null;
}

export interface CommitmentListResult {
  commitments: CommitmentView[];
  counts: Record<CommitmentDisplayStatus, number>;
}

export interface TemporalContextResult {
  currentTime: CurrentTimeResult;
  lastInteraction: LastInteractionResult | null;
  elapsed: Pick<ElapsedTimeResult, 'totalMilliseconds' | 'humanReadable' | 'calendarDayDifference'> | null;
  resumedSession: boolean;
  previousSession: Pick<Session, 'id' | 'externalSessionId' | 'lastInteractionAt'> | null;
  unresolvedTemporalReferences: Array<
    Pick<
      TemporalReference,
      'id' | 'originalExpression' | 'resolutionType' | 'resolvedStartUtc' | 'resolvedEndUtc' | 'confidence'
    >
  >;
  commitments: CommitmentView[];
  timezoneChange: {
    changed: boolean;
    previousTimezone: string | null;
    currentTimezone: string;
  };
}

export interface RecordedCommitmentResult {
  commitment: CommitmentView;
  resolution: TemporalResolution | null;
}

export interface UpdatedCommitmentResult extends RecordedCommitmentResult {
  action: 'completed' | 'cancelled' | 'pending' | 'rescheduled';
}

export interface InteractionWithRelations {
  interaction: Interaction;
  agent: Agent;
  project: Project | null;
  session: Session;
}

export interface ExportBundle {
  exportedAt: string;
  formatVersion: 1;
  privacyNotice: string;
  agents: Agent[];
  projects: Project[];
  sessions: Session[];
  interactions: Interaction[];
  temporalReferences: TemporalReference[];
  commitments: Commitment[];
}

export interface PurgeResult {
  deleted: {
    agents: number;
    projects: number;
    sessions: number;
    interactions: number;
    temporalReferences: number;
    commitments: number;
  };
}

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DoctorResult {
  ok: boolean;
  checks: DoctorCheck[];
}
