import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

const directory = () => new Directory(Paths.document, 'fittrack-custom-exercises');

export async function persistCustomExerciseImage(asset: ImagePickerAsset, id: string) {
  const folder = directory();
  folder.create({ idempotent: true, intermediates: true });
  const source = new File(asset.uri);
  const destination = new File(folder, `${id}-${Date.now()}${source.extension || '.jpg'}`);
  source.copy(destination);
  return destination.uri;
}
