import { loadPhonePedometerEnabled } from './health-connection-storage';
import { loadProfile } from './profile-storage';
import { loadRunNotificationDistance } from './run-notification-settings';
import { UserContextSnapshot } from '../types/userContext';

export async function createUserContextSnapshot(profileId: string): Promise<UserContextSnapshot> {
  const [profile, phonePedometerEnabled, runNotificationMiles] = await Promise.all([
    loadProfile(),
    loadPhonePedometerEnabled(),
    loadRunNotificationDistance(profileId),
  ]);
  const { avatarUri: _avatarUri, ...savedProfile } = profile ?? {};
  return {
    capturedAt: new Date().toISOString(),
    profile: { ...savedProfile, id: profileId },
    settings: { phonePedometerEnabled, runNotificationMiles },
  };
}
