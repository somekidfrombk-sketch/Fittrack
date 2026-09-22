import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/theme';
import type { ExerciseRecord, ExerciseTrackingMethod } from './exerciseData';

type Props = {
  initial?: ExerciseRecord | null;
  onSave: (exercise: ExerciseRecord, imageAsset: ImagePicker.ImagePickerAsset | null) => Promise<void>;
  onCancel: () => void;
};

const trackingOptions: { value: ExerciseTrackingMethod; label: string }[] = [
  { value: 'weight_reps', label: 'Weight + reps' },
  { value: 'reps', label: 'Reps only' },
  { value: 'duration', label: 'Duration / time' },
  { value: 'distance', label: 'Distance' },
  { value: 'distance_time', label: 'Distance + time' },
  { value: 'bodyweight_reps', label: 'Bodyweight + reps' },
  { value: 'none', label: 'Custom / no measurement' },
];

export default function CustomExerciseForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [muscle, setMuscle] = useState(initial?.muscle_group ?? '');
  const [equipment, setEquipment] = useState(initial?.equipment ?? '');
  const [type, setType] = useState(initial?.category ?? '');
  const [notes, setNotes] = useState(initial?.instructions?.en ?? '');
  const [image, setImage] = useState(initial?.image ?? '');
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [trackingMethod, setTrackingMethod] = useState<ExerciseTrackingMethod>(initial?.trackingMethod ?? 'weight_reps');
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.4,
        base64: Platform.OS === 'web',
      });
      if (!result.canceled && result.assets[0]) {
        setImageAsset(result.assets[0]);
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Could not choose exercise image:', error);
      Alert.alert('Image unavailable', 'Please try choosing the image again.');
    }
  };

  const submit = async () => {
    if (!name.trim() || !muscle.trim() || !equipment.trim() || !type.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: name.trim(),
        muscle_group: muscle.trim(),
        equipment: equipment.trim(),
        category: type.trim(),
        instructions: notes.trim() ? { en: notes.trim() } : undefined,
        image: image || undefined,
        trackingMethod,
        isCustom: true,
        created_at: initial?.created_at ?? new Date().toISOString(),
      }, imageAsset);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{initial ? 'Edit Custom Exercise' : 'Create Custom Exercise'}</Text>
      <Text style={styles.hint}>Add it to the regular exercise library for future workouts.</Text>
      <Text style={styles.label}>Exercise name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Exercise name" placeholderTextColor={colors.lightMuted} style={styles.input} />
      <Text style={styles.label}>Muscle group</Text>
      <TextInput value={muscle} onChangeText={setMuscle} placeholder="e.g. Back" placeholderTextColor={colors.lightMuted} style={styles.input} />
      <Text style={styles.label}>Equipment type</Text>
      <TextInput value={equipment} onChangeText={setEquipment} placeholder="e.g. Dumbbell or None" placeholderTextColor={colors.lightMuted} style={styles.input} />
      <Text style={styles.label}>Exercise type</Text>
      <TextInput value={type} onChangeText={setType} placeholder="e.g. Strength or Cardio" placeholderTextColor={colors.lightMuted} style={styles.input} />
      <Text style={styles.label}>Tracking method</Text>
      <View style={styles.chips}>
        {trackingOptions.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: trackingMethod === option.value }}
            style={[styles.chip, trackingMethod === option.value && styles.selectedChip]}
            onPress={() => setTrackingMethod(option.value)}
          >
            <Text style={[styles.chipText, trackingMethod === option.value && styles.selectedChipText]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Notes / instructions (optional)</Text>
      <TextInput value={notes} onChangeText={setNotes} multiline placeholder="How to perform this exercise" placeholderTextColor={colors.lightMuted} style={[styles.input, styles.notes]} />
      <Text style={styles.label}>Image (optional)</Text>
      {image ? <Image source={{ uri: image }} resizeMode="contain" style={styles.image} /> : null}
      <View style={styles.imageActions}>
        <Pressable onPress={() => void pickImage()} style={styles.secondaryButton}><Text style={styles.secondaryText}>{image ? 'Change image' : 'Choose image'}</Text></Pressable>
        {image ? <Pressable onPress={() => { setImage(''); setImageAsset(null); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Remove image</Text></Pressable> : null}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
        <Pressable disabled={!name.trim() || !muscle.trim() || !equipment.trim() || !type.trim() || saving} onPress={() => void submit()} style={[styles.saveButton, (!name.trim() || !muscle.trim() || !equipment.trim() || !type.trim() || saving) && styles.disabled]}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Exercise'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 18, marginBottom: 20 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },
  label: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 14, marginBottom: 7 },
  input: { backgroundColor: colors.soft2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text },
  notes: { minHeight: 92, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.soft2 },
  selectedChip: { backgroundColor: colors.text },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  selectedChipText: { color: colors.surface },
  image: { width: '100%', height: 180, borderRadius: 14, backgroundColor: colors.soft2 },
  imageActions: { flexDirection: 'row', gap: 8, marginTop: 9 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 20 },
  secondaryButton: { backgroundColor: colors.soft2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  secondaryText: { color: colors.text, fontWeight: '900', fontSize: 12 },
  saveButton: { backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  saveText: { color: colors.surface, fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.4 },
});
