export type ICloudBackupStatus = {
  error?: string;
  available: boolean;
  exists: boolean;
  lastBackupAt: string | null;
  fileCount: number;
};

export type ICloudBackupResult = {
  completedAt: string;
  fileCount: number;
};
