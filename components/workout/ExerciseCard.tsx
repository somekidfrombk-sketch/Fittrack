import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutExercise } from '../../types/workout';

type Props = {
  exercise: WorkoutExercise;
  prSetIds?: string[];

  onAddSet: () => void;
  onRemove: () => void;

  onUpdateSet: (
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => void;

  onToggleSetComplete: (setId: string) => void;
};

export default function ExerciseCard({
  exercise,
  prSetIds = [],
  onAddSet,
  onRemove,
  onUpdateSet,
  onToggleSetComplete,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.exerciseName}>
            {exercise.name}
          </Text>

          <Text style={styles.setCount}>
            {exercise.sets.length}{' '}
            {exercise.sets.length === 1 ? 'set' : 'sets'}
          </Text>
        </View>

        <Pressable onPress={onRemove}>
          <Text style={styles.removeText}>
            Remove
          </Text>
        </Pressable>
      </View>

      <View style={styles.columnHeader}>
        <Text style={styles.setHeader}>SET</Text>
        <Text style={styles.inputHeader}>WEIGHT</Text>
        <Text style={styles.inputHeader}>REPS</Text>
        <Text style={styles.doneHeader}>DONE</Text>
      </View>

      {exercise.sets.map((set, index) => {
        const isCompleted = set.completed;
        const isPr = prSetIds.includes(set.id);

        return (
          <View key={set.id}>
            <View
              style={[
                styles.setRow,
                isCompleted && styles.completedRow,
              ]}
            >
              <View
                style={[
                  styles.setNumber,
                  isCompleted && styles.setNumberCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.setNumberText,
                    isCompleted &&
                      styles.setNumberTextCompleted,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>

              <TextInput
                value={set.weight}
                onChangeText={(value) =>
                  onUpdateSet(
                    set.id,
                    'weight',
                    value
                  )
                }
                placeholder="0"
                placeholderTextColor={colors.lightMuted}
                keyboardType="decimal-pad"
                editable={!isCompleted}
                style={[
                  styles.input,
                  isCompleted && styles.completedInput,
                ]}
              />

              <TextInput
                value={set.reps}
                onChangeText={(value) => {
                  const numeric =
                    value.replace(/[^0-9]/g, '');

                  if (
                    numeric === '' ||
                    Number(numeric) <= 99
                  ) {
                    onUpdateSet(
                      set.id,
                      'reps',
                      numeric
                    );
                  }
                }}
                placeholder="0"
                placeholderTextColor={colors.lightMuted}
                keyboardType="number-pad"
                editable={!isCompleted}
                style={[
                  styles.input,
                  isCompleted && styles.completedInput,
                ]}
              />

              <Pressable
                style={[
                  styles.checkButton,
                  isCompleted &&
                    styles.checkButtonCompleted,
                ]}
                onPress={() =>
                  onToggleSetComplete(set.id)
                }
              >
                <Text
                  style={[
                    styles.checkText,
                    isCompleted &&
                      styles.checkTextCompleted,
                  ]}
                >
                  {isCompleted ? '✓' : ''}
                </Text>
              </Pressable>
            </View>

            {isPr ? (
              <View style={styles.prRow}>
                <Text style={styles.prBadge}>
                  NEW PR
                </Text>

                <Text style={styles.prText}>
                  New heaviest completed set
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <Pressable
        style={styles.addSetButton}
        onPress={onAddSet}
      >
        <Text style={styles.addSetText}>
          + Add Set
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },

  headerInfo: {
    flex: 1,
  },

  exerciseName: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
  },

  setCount: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },

  removeText: {
    color: colors.lightMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },

  setHeader: {
    width: 38,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: colors.lightMuted,
  },

  inputHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: colors.lightMuted,
  },

  doneHeader: {
    width: 44,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: colors.lightMuted,
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderRadius: 12,
  },

  completedRow: {
    backgroundColor: colors.soft,
  },

  setNumber: {
    width: 38,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  setNumberCompleted: {
    backgroundColor: colors.text,
  },

  setNumberText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.muted,
  },

  setNumberTextCompleted: {
    color: colors.surface,
  },

  input: {
    flex: 1,
    height: 42,
    backgroundColor: colors.soft2,
    borderRadius: 11,
    paddingHorizontal: 8,
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },

  completedInput: {
    opacity: 0.55,
  },

  checkButton: {
    width: 44,
    height: 42,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkButtonCompleted: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },

  checkText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.surface,
  },

  checkTextCompleted: {
    color: colors.surface,
  },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -2,
    marginBottom: 10,
    marginLeft: 46,
  },

  prBadge: {
    backgroundColor: colors.text,
    color: colors.surface,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  prText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },

  addSetButton: {
    marginTop: 8,
    backgroundColor: colors.soft2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },

  addSetText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
});