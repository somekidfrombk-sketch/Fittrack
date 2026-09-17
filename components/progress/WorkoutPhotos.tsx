import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { addWorkoutPhoto, loadWorkoutPhotos, removeWorkoutPhoto, WorkoutPhoto } from '../../services/workout-photo-storage';
import { workoutPhotoUri } from '../../services/workout-photo-files';

export default function WorkoutPhotos({ profileId, workoutId }: { profileId: string; workoutId: string }) {
  const [photos, setPhotos] = useState<WorkoutPhoto[]>([]);
  const [selected, setSelected] = useState<WorkoutPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setPhotos([]);
    setError('');
    void loadWorkoutPhotos(profileId, workoutId).then((saved) => {
      if (active) setPhotos(saved);
    }).catch(() => { if (active) setError('Photos could not be loaded. Please reopen this screen.'); });
    return () => { active = false; };
  }, [profileId, workoutId]));

  const pick = async (camera: boolean) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Allow camera access in Settings, or choose a photo from your library.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], quality: 0.7, base64: Platform.OS === 'web',
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      setPhotos(await addWorkoutPhoto(profileId, workoutId, result.assets[0]));
    } catch {
      setError('Photo could not be saved. Check available storage and try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const remove = (photo: WorkoutPhoto) => {
    const commit = async () => {
      if (locked.current) return;
      locked.current = true;
      setBusy(true);
      try {
        setPhotos(await removeWorkoutPhoto(profileId, workoutId, photo.id));
        setSelected(null);
      } catch { setError('Photo could not be removed. Please try again.'); }
      finally { locked.current = false; setBusy(false); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this photo from FitTrack? Your original photo is unchanged.')) void commit();
    } else Alert.alert('Remove photo?', 'Your original photo is unchanged.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void commit() },
    ]);
  };

  return <View style={styles.container}>
    <Text style={styles.title}>Workout photos</Text>
    <Text style={styles.note}>Saved on this device with your profile and this workout.</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void pick(false)}><Text style={styles.buttonText}>Choose photo</Text></Pressable>
      {Platform.OS !== 'web' && <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void pick(true)}><Text style={styles.buttonText}>Take photo</Text></Pressable>}
      {busy && <ActivityIndicator />}
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {photos.map((photo) => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel="Open workout photo" onPress={() => setSelected(photo)}>
        <Image source={{ uri: workoutPhotoUri(photo.location) }} style={styles.thumbnail} />
      </Pressable>)}
    </ScrollView>
    <Modal visible={!!selected} animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={styles.viewer}>
        <Pressable style={styles.button} onPress={() => setSelected(null)}><Text style={styles.buttonText}>Close photo</Text></Pressable>
        {selected && <Image resizeMode="contain" source={{ uri: workoutPhotoUri(selected.location) }} style={styles.fullImage} />}
        <Pressable disabled={busy} style={styles.button} onPress={() => selected && remove(selected)}><Text style={styles.buttonText}>Remove photo</Text></Pressable>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { marginTop: 16 }, title: { fontSize: 16, fontWeight: '800', color: colors.text },
  note: { color: colors.muted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: { backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  buttonText: { color: colors.surface, fontWeight: '700', textAlign: 'center' },
  gallery: { gap: 10, paddingTop: 12 }, thumbnail: { width: 100, height: 130, borderRadius: 12, backgroundColor: colors.soft },
  error: { color: '#B91C1C', marginTop: 8 }, viewer: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60, paddingBottom: 40 },
  fullImage: { flex: 1, marginVertical: 16, width: '100%' },
});
