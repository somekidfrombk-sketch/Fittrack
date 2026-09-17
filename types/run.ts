import { UserContextSnapshot } from './userContext';

export type RunLap = {
  id: string;
  kind: 'manual' | 'mile';
  number: number;
  label?: string;
  elapsedSeconds: number;
  distanceMeters: number;
  splitDurationSeconds: number;
  splitDistanceMeters: number;
};

export type RunRoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  distanceMeters: number;
  segment?: number;
};

export type RunEntry = {
  id: string;
  profileId: string;
  activityType?: 'running' | 'cycling';
  mode?: 'outdoor' | 'treadmill' | 'indoor';
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  distanceMeters: number;
  caloriesBurned: number;
  averagePaceSecondsPerKm: number | null;
  averageHeartRateBpm?: number;
  laps?: RunLap[];
  route?: RunRoutePoint[];
  userContext?: UserContextSnapshot;
};
