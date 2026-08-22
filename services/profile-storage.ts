import AsyncStorage from '@react-native-async-storage/async-storage';

import { ProfileData } from '../types/profile';

const PROFILE_STORAGE_KEY =
  'fittrack_user_profile';
const ACTIVE_PROFILE_ID_KEY =
  'fittrack_active_profile_id';

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

export async function loadProfile(): Promise<
  Partial<ProfileData> | null
> {
  const savedProfile =
    await AsyncStorage.getItem(
      PROFILE_STORAGE_KEY
    );

  if (!savedProfile) {
    return null;
  }

  const parsed: unknown =
    JSON.parse(savedProfile);

  if (!isRecord(parsed)) {
    return null;
  }

  const profile =
    parsed as Partial<ProfileData>;

  if (
    typeof profile.id !== 'string' ||
    !profile.id
  ) {
    profile.id = createProfileId();
    await AsyncStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify(profile)
    );
  }

  await AsyncStorage.setItem(
    ACTIVE_PROFILE_ID_KEY,
    profile.id
  );

  return profile;
}

export function createProfileId() {
  return `profile-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function getOrCreateProfileId() {
  const savedProfile = await loadProfile();

  if (savedProfile?.id) {
    return savedProfile.id;
  }

  const activeId = await AsyncStorage.getItem(
    ACTIVE_PROFILE_ID_KEY
  );

  if (activeId) {
    return activeId;
  }

  const profileId = createProfileId();
  await AsyncStorage.setItem(
    ACTIVE_PROFILE_ID_KEY,
    profileId
  );
  return profileId;
}

export async function saveProfile(
  profile: ProfileData
) {
  const profileId =
    profile.id ||
    (await getOrCreateProfileId());
  const profileToSave = {
    ...profile,
    id: profileId,
  };

  await AsyncStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(profileToSave)
  );
  await AsyncStorage.setItem(
    ACTIVE_PROFILE_ID_KEY,
    profileId
  );

  return profileToSave;
}
