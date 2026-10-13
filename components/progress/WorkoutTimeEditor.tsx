import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/theme';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { editWorkoutTime, workoutTimeFields } from '../../utils/workout-time';

export default function WorkoutTimeEditor({ entry, onSave, onCancel }: {
  entry: WorkoutHistoryEntry;
  onSave: (updated: WorkoutHistoryEntry) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = workoutTimeFields(entry);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(initial.durationMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (saving) return;
    try {
      const updated = editWorkoutTime(entry, day, time, duration);
      setSaving(true);
      setError('');
      await onSave(updated);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the workout time. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.card}>
    <Text style={styles.title}>Edit workout time</Text>
    <Text style={styles.hint}>Change when this session happened and how long it lasted.</Text>
    <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
    <TextInput accessibilityLabel="Workout date" value={day} onChangeText={setDay} style={styles.input} placeholder="2026-10-12" keyboardType="numbers-and-punctuation" editable={!saving} />
    <Text style={styles.label}>Start time (24-hour HH:MM)</Text>
    <TextInput accessibilityLabel="Workout start time" value={time} onChangeText={setTime} style={styles.input} placeholder="18:30" keyboardType="numbers-and-punctuation" editable={!saving} />
    <Text style={styles.label}>Duration (minutes)</Text>
    <TextInput accessibilityLabel="Workout duration in minutes" value={duration} onChangeText={setDuration} style={styles.input} placeholder="45" keyboardType="decimal-pad" editable={!saving} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={styles.button}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.soft2, borderRadius: 12, marginTop: 14, padding: 14 },
  title: { color: colors.text, fontWeight: '900', fontSize: 16 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 5 },
  input: { minHeight: 44, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, color: colors.text },
  error: { color: '#B91C1C', marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  cancelText: { color: colors.muted, fontWeight: '800' },
  button: { minHeight: 44, backgroundColor: colors.text, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
  buttonText: { color: colors.surface, fontWeight: '900' },
});
