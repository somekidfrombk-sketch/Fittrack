import { ImagePickerAsset } from 'expo-image-picker';

// A durable data URL survives page reloads; picker blob URLs do not.
export async function persistWorkoutPhoto(asset: ImagePickerAsset, _id: string) {
  if (!asset.base64) throw new Error('Could not read the selected image. Please try another photo.');
  return `data:image/jpeg;base64,${asset.base64}`;
}

export function workoutPhotoUri(location: string) { return location; }
export async function deleteWorkoutPhotoFile(_location: string) {}
