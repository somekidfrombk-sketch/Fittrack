import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/theme';

const starterExercises = [
  'Bench Press',
  'Incline Dumbbell Press',
  'Lat Pulldown',
  'Seated Cable Row',
  'Shoulder Press',
  'Lateral Raise',
  'Biceps Curl',
  'Triceps Pushdown',
  'Squat',
  'Leg Press',
  'Romanian Deadlift',
];

type Props = {
  exerciseName: string;
  onChangeName: (value: string) => void;
  onAddExercise: (name?: string) => void;
};

export default function ExercisePicker({
  exerciseName,
  onChangeName,
  onAddExercise,
}: Props) {
  return (
    <>
      <Text style={styles.title}>Add exercise</Text>
      <View style={styles.row}>
        <TextInput
          value={exerciseName}
          onChangeText={onChangeName}
          placeholder="Exercise name"
          placeholderTextColor={colors.lightMuted}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => onAddExercise()}
        />
        <Pressable style={styles.button} onPress={() => onAddExercise()}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={starterExercises}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.chip} onPress={() => onAddExercise(item)}>
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '900', color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, fontSize: 15, color: colors.text },
  button: { backgroundColor: colors.text, paddingHorizontal: 18, borderRadius: 14, justifyContent: 'center' },
  buttonText: { color: colors.surface, fontWeight: '900' },
  list: { gap: 8, paddingTop: 12, paddingBottom: 18 },
  chip: { backgroundColor: colors.soft, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  chipText: { color: '#374151', fontWeight: '700', fontSize: 12 },
});
