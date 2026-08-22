import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { Weekday, WorkoutPlan } from '../../types/workoutPlan';

import ExerciseLibrary from '../exercise-library/ExerciseLibrary';
import { ExerciseRecord } from '../exercise-library/exerciseData';

import { createId } from './workoutUtils';

const weekdays: Weekday[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

type ExerciseSelection = {
  exercise: ExerciseRecord;
  sets: number;
  reps: number;
  restSeconds: number;
};

type Props = {
  onSave: (plan: WorkoutPlan) => void;
  onCancel: () => void;
};

export default function WorkoutBuilder({
  onSave,
  onCancel,
}: Props) {
  const [planName, setPlanName] = useState('');
  const [selectedDays, setSelectedDays] =
    useState<Weekday[]>([]);

  const [draftExercises, setDraftExercises] =
    useState<WorkoutPlan['exercises']>([]);

  const toggleDay = (day: Weekday) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter(
            (item) => item !== day
          )
        : [...current, day]
    );
  };

  const addExerciseFromLibrary = (
    selection: ExerciseSelection
  ) => {
    const {
      exercise,
      sets,
      reps,
      restSeconds,
    } = selection;

    setDraftExercises((current) => [
      ...current,
      {
        id: createId(),
        name: exercise.name,
        targetSets: String(
          Math.min(
            99,
            Math.max(1, sets)
          )
        ),
        targetReps: String(
          Math.min(
            99,
            Math.max(1, reps)
          )
        ),
        restSeconds: Math.min(
          600,
          Math.max(0, restSeconds)
        ),
      },
    ]);
  };

  const removeExercise = (
    exerciseId: string
  ) => {
    setDraftExercises((current) =>
      current.filter(
        (exercise) =>
          exercise.id !== exerciseId
      )
    );
  };

  const saveWorkout = () => {
    const name = planName.trim();

    if (
      !name ||
      selectedDays.length === 0 ||
      draftExercises.length === 0
    ) {
      return;
    }

    onSave({
      id: createId(),
      name,
      days: selectedDays,
      exercises: draftExercises,
    });
  };

  const formatRest = (
    seconds: number
  ) => {
    if (seconds === 0) {
      return 'Rest off';
    }

    if (seconds < 60) {
      return `${seconds}s rest`;
    }

    const minutes =
      Math.floor(seconds / 60);

    const remaining =
      seconds % 60;

    if (remaining === 0) {
      return `${minutes}m rest`;
    }

    return `${minutes}:${String(
      remaining
    ).padStart(2, '0')} rest`;
  };

  const canSave =
    planName.trim().length > 0 &&
    selectedDays.length > 0 &&
    draftExercises.length > 0;

  return (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            NEW WORKOUT
          </Text>

          <Text style={styles.title}>
            Build a Workout
          </Text>
        </View>

        <Pressable
          onPress={onCancel}
        >
          <Text style={styles.cancelText}>
            Cancel
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>
          Workout name
        </Text>

        <TextInput
          value={planName}
          onChangeText={setPlanName}
          placeholder="Example: Push Day"
          placeholderTextColor={
            colors.lightMuted
          }
          style={styles.input}
        />

        <Text
          style={[
            styles.label,
            { marginTop: 18 },
          ]}
        >
          Days of the week
        </Text>

        <View style={styles.dayWrap}>
          {weekdays.map((day) => {
            const selected =
              selectedDays.includes(day);

            return (
              <Pressable
                key={day}
                onPress={() =>
                  toggleDay(day)
                }
                style={[
                  styles.dayChip,
                  selected &&
                    styles.dayChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    selected &&
                      styles.dayChipTextSelected,
                  ]}
                >
                  {day.slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Exercises
      </Text>

      {draftExercises.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No exercises added
          </Text>

          <Text style={styles.emptyText}>
            Choose exercises from the
            library below.
          </Text>
        </View>
      ) : (
        <View style={styles.exerciseList}>
          {draftExercises.map(
            (exercise, index) => (
              <View
                key={exercise.id}
                style={styles.exerciseRow}
              >
                <View
                  style={
                    styles.numberCircle
                  }
                >
                  <Text
                    style={
                      styles.numberText
                    }
                  >
                    {index + 1}
                  </Text>
                </View>

                <View
                  style={{ flex: 1 }}
                >
                  <Text
                    style={
                      styles.exerciseName
                    }
                  >
                    {exercise.name}
                  </Text>

                  <Text
                    style={
                      styles.exerciseMeta
                    }
                  >
                    {exercise.targetSets}{' '}
                    sets ×{' '}
                    {exercise.targetReps}{' '}
                    reps
                    {' • '}
                    {formatRest(
                      exercise.restSeconds
                    )}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    removeExercise(
                      exercise.id
                    )
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    Remove
                  </Text>
                </Pressable>
              </View>
            )
          )}
        </View>
      )}

      <ExerciseLibrary
        onSelectExercise={
          addExerciseFromLibrary
        }
      />

      <Pressable
        style={[
          styles.saveButton,
          !canSave &&
            styles.saveButtonDisabled,
        ]}
        onPress={saveWorkout}
        disabled={!canSave}
      >
        <Text
          style={styles.saveButtonText}
        >
          Save Workout Plan
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.lightMuted,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
  },

  cancelText: {
    color: colors.muted,
    fontWeight: '800',
    paddingTop: 8,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },

  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    marginBottom: 7,
  },

  input: {
    backgroundColor: colors.soft2,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.text,
    fontWeight: '700',
  },

  dayWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.soft2,
  },

  dayChipSelected: {
    backgroundColor: colors.text,
  },

  dayChipText: {
    color: '#374151',
    fontWeight: '800',
    fontSize: 12,
  },

  dayChipTextSelected: {
    color: colors.surface,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 10,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },

  emptyText: {
    marginTop: 5,
    color: colors.muted,
    lineHeight: 20,
  },

  exerciseList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.soft2,
  },

  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  numberText: {
    fontWeight: '900',
    color: colors.muted,
  },

  exerciseName: {
    fontWeight: '800',
    color: colors.text,
  },

  exerciseMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.muted,
  },

  removeText: {
    color: colors.lightMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  saveButton: {
    marginTop: 8,
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 30,
  },

  saveButtonDisabled: {
    opacity: 0.35,
  },

  saveButtonText: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: 15,
  },
});
