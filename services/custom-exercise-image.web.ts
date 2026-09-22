import type { ImagePickerAsset } from 'expo-image-picker';

export async function persistCustomExerciseImage(asset: ImagePickerAsset, _id: string) {
  if (!asset.base64) throw new Error('The selected image could not be read.');
  return `data:image/jpeg;base64,${asset.base64}`;
}
