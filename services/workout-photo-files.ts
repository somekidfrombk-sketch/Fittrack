import { Directory, File, Paths } from 'expo-file-system';
import { ImagePickerAsset } from 'expo-image-picker';

const directory = () => new Directory(Paths.document, 'fittrack-workout-photos');

export async function persistWorkoutPhoto(asset: ImagePickerAsset, id: string) {
  const folder = directory();
  folder.create({ idempotent: true, intermediates: true });
  const source = new File(asset.uri);
  const name = id + (source.extension || '.jpg');
  source.copy(new File(folder, name));
  return name;
}

export function workoutPhotoUri(location: string) {
  return new File(directory(), location).uri;
}

export async function deleteWorkoutPhotoFile(location: string) {
  const file = new File(directory(), location);
  if (file.exists) file.delete();
}
