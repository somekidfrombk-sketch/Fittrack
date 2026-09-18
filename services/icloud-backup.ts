import type { ICloudBackupResult, ICloudBackupStatus } from '../types/icloudBackup';

export async function getICloudBackupStatus(): Promise<ICloudBackupStatus> {
  return { available: false, exists: false, lastBackupAt: null, fileCount: 0 };
}

export async function createICloudBackup(): Promise<ICloudBackupResult> {
  throw new Error('iCloud backup is available only on iPhone and iPad.');
}

export async function createAutomaticICloudBackup(): Promise<ICloudBackupResult | null> {
  return null;
}

export async function restoreICloudBackup(): Promise<ICloudBackupResult> {
  throw new Error('iCloud restore is available only on iPhone and iPad.');
}
