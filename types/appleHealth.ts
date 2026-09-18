export type AppleHealthConnectionStatus =
  | 'checking'
  | 'unavailable'
  | 'not-requested'
  | 'connected'
  | 'error';

export type AppleHealthAuthorizationStatus = {
  available: boolean;
  requestNeeded: boolean;
  hasRequested: boolean;
  status: AppleHealthConnectionStatus;
};

export type HeartRateSample = {
  beatsPerMinute: number;
  timestamp: string;
};

export type SleepStage =
  | 'in-bed'
  | 'asleep'
  | 'awake'
  | 'core'
  | 'deep'
  | 'rem'
  | 'unknown';

export type SleepSession = {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  stage: SleepStage;
};

export type SleepData = {
  sessions: SleepSession[];
  latestSleepDurationMinutes: number | null;
};
