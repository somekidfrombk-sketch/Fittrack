import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareExportFile(filename: string, contents: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is unavailable on this device.');
  }
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true, intermediates: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Share FitTrack data',
    UTI: 'public.json',
  });
}
