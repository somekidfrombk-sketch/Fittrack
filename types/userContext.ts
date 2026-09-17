import { ProfileData } from './profile';

export type UserContextSnapshot = {
  capturedAt: string;
  profile: Omit<Partial<ProfileData>, 'avatarUri'>;
  settings: {
    phonePedometerEnabled: boolean;
    runNotificationMiles: number | null;
  };
};
