import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileData } from '../types/profile';
import { withStorageLock } from './storage-lock';

const PROFILE_STORAGE_KEY = 'fittrack_user_profile';
const ACTIVE_PROFILE_ID_KEY = 'fittrack_active_profile_id';

export function createProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Internal helpers run under the same lock so simultaneous screen loads cannot
// create different IDs or overwrite a profile while it is being saved.
async function readProfile(): Promise<Partial<ProfileData> | null> {
  const saved = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  if (!saved) return null;
  const parsed: unknown = JSON.parse(saved);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved profile could not be read. Original data was preserved.');
  }
  const profile = parsed as Partial<ProfileData>;
  const activeId = await AsyncStorage.getItem(ACTIVE_PROFILE_ID_KEY);
  if (typeof profile.id !== 'string' || !profile.id) {
    profile.id = activeId || createProfileId();
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }
  if (activeId !== profile.id) {
    await AsyncStorage.setItem(ACTIVE_PROFILE_ID_KEY, profile.id);
  }
  return profile;
}

async function resolveProfileId() {
  const profile = await readProfile();
  if (profile?.id) return profile.id;
  const activeId = await AsyncStorage.getItem(ACTIVE_PROFILE_ID_KEY);
  if (activeId) return activeId;
  const id = createProfileId();
  await AsyncStorage.setItem(ACTIVE_PROFILE_ID_KEY, id);
  return id;
}

export function loadProfile() {
  return withStorageLock(PROFILE_STORAGE_KEY, readProfile);
}

export function getOrCreateProfileId() {
  return withStorageLock(PROFILE_STORAGE_KEY, resolveProfileId);
}

export function saveProfile(profile: ProfileData) {
  return withStorageLock(PROFILE_STORAGE_KEY, async () => {
    const profileId = profile.id || await resolveProfileId();
    const saved = { ...profile, id: profileId };
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(saved));
    await AsyncStorage.setItem(ACTIVE_PROFILE_ID_KEY, profileId);
    return saved;
  });
}
