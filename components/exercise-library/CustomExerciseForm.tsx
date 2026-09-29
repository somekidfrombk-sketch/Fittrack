import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/theme';
import type { ExerciseRecord, ExerciseTrackingMethod } from './exerciseData';
import { muscleFocusOptions } from './exerciseMuscleFilter';

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

const muscleChoices: string[] = [...muscleFocusOptions.map((option) => option.label), 'Other'];

export default function CustomExerciseForm({ initial, onSave, onCancel }: Props) {
  const initialMuscles = initial?.muscleGroups?.length ? initial.muscleGroups : [initial?.muscle_group ?? 'Other'];
  const [name, setName] = useState(initial?.name ?? '');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(initialMuscles.filter((muscle) => muscleChoices.includes(muscle)));
  const [otherMuscle, setOtherMuscle] = useState(initialMuscles.find((muscle) => !muscleChoices.includes(muscle)) ?? '');
  const [equipment, setEquipment] = useState(initial?.equipment ?? 'None');
  const [type, setType] = useState(initial?.category ?? 'Strength');
  const [notes, setNotes] = useState(initial?.instructions?.en ?? '');
  const [image, setImage] = useState(initial?.image ?? '');
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [trackingMethod, setTrackingMethod] = useState<ExerciseTrackingMethod>(initial?.trackingMethod ?? 'weight_reps');
  const [saving, setSaving] = useState(false);

  const toggleMuscle = (muscle: string) => {
    if (muscle === 'Other') {
      setSelectedMuscles(['Other']);
      setOtherMuscle('');
      return;
    }
    setSelectedMuscles((current) => {
      const next = current.includes(muscle)
        ? current.filter((item) => item !== muscle)
        : [...current.filter((item) => item !== 'Other'), muscle];
      return next.length || otherMuscle.trim() ? next : ['Other'];
    });
  };

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
    if (!name.trim() || saving) return;
    const muscleGroups = [...selectedMuscles.filter((muscle) => muscle !== 'Other'), ...(otherMuscle.trim() ? [otherMuscle.trim()] : [])];
    if (muscleGroups.length === 0) muscleGroups.push('Other');
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: name.trim(),
        muscle_group: muscleGroups[0],
        muscleGroups,
        equipment: equipment.trim() || 'None',
        category: type.trim() || 'Strength',
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
      <Text style={styles.hint}>{initial ? 'Update this exercise in your library.' : 'Save it to your library and add it to this workout.'}</Text>
      <Text style={styles.label}>Exercise name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Exercise name" placeholderTextColor={colors.lightMuted} style={styles.input} />
      <Text style={styles.label}>Muscles worked</Text>
      <Text style={styles.hint}>Tap one or more muscles. These labels appear in filters and your dashboard.</Text>
      <View style={styles.chips}>
        {muscleChoices.map((muscle) => (
          <Pressable
            key={muscle}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedMuscles.includes(muscle) }}
            style={[styles.chip, selectedMuscles.includes(muscle) && styles.selectedChip]}
            onPress={() => toggleMuscle(muscle)}
          >
            <Text style={[styles.chipText, selectedMuscles.includes(muscle) && styles.selectedChipText]}>{muscle}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={otherMuscle}
        onChangeText={(value) => {
          setOtherMuscle(value);
          setSelectedMuscles((current) => value.trim()
            ? current.filter((muscle) => muscle !== 'Other')
            : current.length ? current : ['Other']);
        }}
        placeholder="Other muscle (optional)"
        placeholderTextColor={colors.lightMuted}
        style={[styles.input, styles.otherMuscleInput]}
      />
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
        <Pressable disabled={!name.trim() || saving} onPress={() => void submit()} style={[styles.saveButton, (!name.trim() || saving) && styles.disabled]}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : initial ? 'Save Changes' : 'Save & Add Exercise'}</Text>
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
  otherMuscleInput: { marginTop: 8 },
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
