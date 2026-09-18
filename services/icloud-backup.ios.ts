import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { CloudStorage, CloudStorageScope } from 'react-native-cloud-storage';

import type { ICloudBackupResult, ICloudBackupStatus } from '../types/icloudBackup';

const BACKUP_ROOT = '/FitTrack';
const MANIFEST_PATH = `${BACKUP_ROOT}/backup.json`;
const FILES_ROOT = `${BACKUP_ROOT}/files`;
const FORMAT = 'FitTrack iCloud backup';
const SCHEMA_VERSION = 1;
const LOCAL_DIRECTORIES = [
  'fittrack-avatars',
  'fittrack-products',
  'fittrack-workout-photos',
] as const;

type BackupFile = {
  relativePath: string;
  mimeType: string;
};

type BackupManifest = {
  format: typeof FORMAT;
  schemaVersion: typeof SCHEMA_VERSION;
  createdAt: string;
  storage: Record<string, string>;
  files: BackupFile[];
  // Optional so backups created before snapshot directories remain readable.
  snapshotId?: string;
};

let activeBackup: Promise<ICloudBackupResult> | null = null;
let restoring = false;

function localPath(file: File) {
  return decodeURIComponent(file.uri.replace(/^file:\/\//, ''));
}

function mimeTypeFor(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function isSafeRelativePath(path: string) {
  return !/[\\%]/.test(path) && !/\p{Cc}/u.test(path) &&
    path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..') &&
    LOCAL_DIRECTORIES.some((directory) => path.startsWith(`${directory}/`));
}

function collectFiles(directory: Directory, relativeDirectory: string): BackupFile[] {
  if (!directory.exists) return [];

  return directory.list().flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry instanceof Directory) return collectFiles(entry, relativePath);
    return [{ relativePath, mimeType: mimeTypeFor(entry.name) }];
  });
}

async function collectStorage() {
  const keys = (await AsyncStorage.getAllKeys())
    .filter((key) => key.startsWith('fittrack_'))
    .sort();
  const pairs = await AsyncStorage.multiGet(keys);
  return Object.fromEntries(
    pairs.filter((pair): pair is [string, string] => pair[1] !== null)
  );
}

function validateManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The iCloud backup is not a valid FitTrack backup.');
  }

  const manifest = value as Partial<BackupManifest>;
  if (
    manifest.format !== FORMAT ||
    manifest.schemaVersion !== SCHEMA_VERSION ||
    typeof manifest.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    (manifest.snapshotId !== undefined &&
      (typeof manifest.snapshotId !== 'string' || !/^[a-z0-9-]+$/.test(manifest.snapshotId))) ||
    !manifest.storage ||
    typeof manifest.storage !== 'object' ||
    Array.isArray(manifest.storage) ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error('This FitTrack backup version cannot be restored.');
  }

  for (const [key, storedValue] of Object.entries(manifest.storage)) {
    if (!key.startsWith('fittrack_') || typeof storedValue !== 'string') {
      throw new Error('The iCloud backup contains invalid FitTrack data.');
    }
  }
  const paths = new Set<string>();
  for (const file of manifest.files) {
    if (
      !file ||
      typeof file.relativePath !== 'string' ||
      typeof file.mimeType !== 'string' ||
      !isSafeRelativePath(file.relativePath) || paths.has(file.relativePath)
    ) {
      throw new Error('The iCloud backup contains an invalid photo path.');
    }
    paths.add(file.relativePath);
  }

  return manifest as BackupManifest;
}

function restoredFileUri(relativePath: string) {
  return new File(Paths.document, ...relativePath.split('/')).uri;
}

function rewriteDocumentUris(value: unknown): unknown {
  if (typeof value === 'string') {
    const marker = '/Documents/';
    const markerIndex = value.indexOf(marker);
    if (!value.startsWith('file://') || markerIndex < 0) return value;
    const relativePath = decodeURIComponent(value.slice(markerIndex + marker.length));
    return isSafeRelativePath(relativePath) ? restoredFileUri(relativePath) : value;
  }
  if (Array.isArray(value)) return value.map(rewriteDocumentUris);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteDocumentUris(item)])
    );
  }
  return value;
}

function rewriteStoredValue(value: string) {
  try {
    return JSON.stringify(rewriteDocumentUris(JSON.parse(value)));
  } catch {
    return value;
  }
}

// iCloud may expose a placeholder before its bytes are downloaded on this device.
async function readCloudFile<T>(path: string, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (initialError) {
    try {
      await CloudStorage.triggerSync(path, CloudStorageScope.AppData);
    } catch {
      throw initialError;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        return await read();
      } catch (error) {
        if (attempt === 7) throw error;
      }
    }
    throw initialError;
  }
}

async function readManifest(): Promise<BackupManifest | null> {
  if (!(await CloudStorage.exists(MANIFEST_PATH, CloudStorageScope.AppData))) {
    try {
      await CloudStorage.triggerSync(MANIFEST_PATH, CloudStorageScope.AppData);
    } catch {
      return null;
    }
  }
  const content = await readCloudFile(MANIFEST_PATH, () =>
    CloudStorage.readFile(MANIFEST_PATH, CloudStorageScope.AppData));
  return validateManifest(JSON.parse(content));
}

export async function getICloudBackupStatus(): Promise<ICloudBackupStatus> {
  try {
    const available = await CloudStorage.isCloudAvailable();
    if (!available) return { available: false, exists: false, lastBackupAt: null, fileCount: 0 };

    const manifest = await readManifest();
    if (!manifest) return { available: true, exists: false, lastBackupAt: null, fileCount: 0 };
    return {
      available: true,
      exists: true,
      lastBackupAt: manifest.createdAt,
      fileCount: manifest.files.length,
    };
  } catch (error) {
    console.warn('Unable to read iCloud backup status:', error);
    return { available: false, exists: false, lastBackupAt: null, fileCount: 0 };
  }
}

async function performBackup(): Promise<ICloudBackupResult> {
  if (!(await CloudStorage.isCloudAvailable())) {
    throw new Error('iCloud Drive is unavailable. Sign in to iCloud and enable iCloud Drive, then try again.');
  }

  const storage = await collectStorage();
  const files = LOCAL_DIRECTORIES.flatMap((name) =>
    collectFiles(new Directory(Paths.document, name), name)
  );
  const snapshotId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const staging = new Directory(Paths.cache, 'fittrack-backup-' + snapshotId);
  staging.create({ intermediates: true });
  try {
    // Freeze photo bytes before awaiting uploads; each remote generation is immutable.
    for (const file of files) {
      const segments = file.relativePath.split('/');
      const name = segments.pop()!;
      const folder = new Directory(staging, ...segments);
      folder.create({ idempotent: true, intermediates: true });
      new File(Paths.document, ...file.relativePath.split('/')).copy(new File(folder, name));
    }
    await CloudStorage.mkdir(BACKUP_ROOT, CloudStorageScope.AppData);
    for (const file of files) {
      await CloudStorage.uploadFile(
        FILES_ROOT + '/' + snapshotId + '/' + file.relativePath,
        localPath(new File(staging, ...file.relativePath.split('/'))),
        { mimeType: file.mimeType },
        CloudStorageScope.AppData
      );
    }
    const completedAt = new Date().toISOString();
    const manifest: BackupManifest = {
      format: FORMAT, schemaVersion: SCHEMA_VERSION, createdAt: completedAt,
      storage, files, snapshotId,
    };
    // Native writeFile uses an atomic write. Publish only after all files succeed.
    await CloudStorage.writeFile(MANIFEST_PATH, JSON.stringify(manifest), CloudStorageScope.AppData);
    return { completedAt, fileCount: files.length };
  } finally {
    if (staging.exists) staging.delete();
  }
}

export function createICloudBackup(): Promise<ICloudBackupResult> {
  if (restoring) return Promise.reject(new Error('A restore is in progress. Try again after reloading FitTrack.'));
  if (activeBackup) return activeBackup;
  activeBackup = performBackup().finally(() => {
    activeBackup = null;
  });
  return activeBackup;
}

export async function createAutomaticICloudBackup(): Promise<ICloudBackupResult | null> {
  if (restoring || activeBackup) return null;
  const localProfile = await AsyncStorage.getItem('fittrack_user_profile');
  if (!localProfile || !(await CloudStorage.isCloudAvailable())) return null;

  const remote = await readManifest();
  if (remote) {
    const localProfileId = JSON.parse(localProfile)?.id;
    const remoteProfileValue = remote.storage.fittrack_user_profile;
    const remoteProfileId = remoteProfileValue ? JSON.parse(remoteProfileValue)?.id : null;
    if (remoteProfileId && localProfileId !== remoteProfileId) return null;
  }

  return createICloudBackup();
}

async function performRestore(): Promise<ICloudBackupResult> {
  if (!(await CloudStorage.isCloudAvailable())) {
    throw new Error('iCloud Drive is unavailable. Sign in to iCloud and enable iCloud Drive, then try again.');
  }
  const manifest = await readManifest();
  if (!manifest) throw new Error('No FitTrack iCloud backup was found.');
  const staging = new Directory(Paths.cache, 'fittrack-icloud-restore');
  if (staging.exists) staging.delete();
  staging.create({ intermediates: true });

  try {
    for (const backupFile of manifest.files) {
      const segments = backupFile.relativePath.split('/');
      const filename = segments.pop();
      if (!filename) throw new Error('The iCloud backup contains an invalid filename.');
      const destinationDirectory = new Directory(staging, ...segments);
      destinationDirectory.create({ idempotent: true, intermediates: true });
      const destination = new File(destinationDirectory, filename);
      const remotePath = FILES_ROOT + '/' + (manifest.snapshotId ? manifest.snapshotId + '/' : '') + backupFile.relativePath;
      await readCloudFile(remotePath, async () => {
        if (destination.exists) destination.delete();
        await CloudStorage.downloadFile(remotePath, localPath(destination), CloudStorageScope.AppData);
      });
    }

    const entries: [string, string][] = Object.entries(manifest.storage)
      .map(([key, value]) => [key, rewriteStoredValue(value)]);
    const previousStorage = await AsyncStorage.multiGet(entries.map(([key]) => key));
    const rollback = new Directory(staging, 'rollback');
    rollback.create();
    const changedFiles: { destination: File; original: File | null }[] = [];
    try {
      for (const [index, backupFile] of manifest.files.entries()) {
        const segments = backupFile.relativePath.split('/');
        const filename = segments.pop()!;
        const destinationDirectory = new Directory(Paths.document, ...segments);
        destinationDirectory.create({ idempotent: true, intermediates: true });
        const destination = new File(destinationDirectory, filename);
        const original = destination.exists ? new File(rollback, String(index)) : null;
        if (original) destination.copy(original);
        changedFiles.push({ destination, original });
        if (destination.exists) destination.delete();
        new File(staging, ...backupFile.relativePath.split('/')).copy(destination);
      }
      await AsyncStorage.multiSet(entries);
    } catch (error) {
      for (const { destination, original } of changedFiles.reverse()) {
        if (destination.exists) destination.delete();
        if (original) original.copy(destination);
      }
      await AsyncStorage.multiSet(previousStorage.filter((pair): pair is [string, string] => pair[1] !== null));
      await AsyncStorage.multiRemove(previousStorage.filter(([, value]) => value === null).map(([key]) => key));
      throw error;
    }
  } finally {
    if (staging.exists) staging.delete();
  }

  return { completedAt: manifest.createdAt, fileCount: manifest.files.length };
}

export async function restoreICloudBackup(): Promise<ICloudBackupResult> {
  if (restoring || activeBackup) throw new Error('Another backup or restore is in progress. Please try again.');
  restoring = true;
  try {
    const result = await performRestore();
    // Keep background backup disabled until reload, while screens may hold old data.
    return result;
  } catch (error) {
    restoring = false;
    throw error;
  }
}
