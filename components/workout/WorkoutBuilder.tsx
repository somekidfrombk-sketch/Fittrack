import { useState } from 'react';
import {
    Alert,
    Platform,
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
  initialPlan?: WorkoutPlan;
  onSave: (plan: WorkoutPlan) => Promise<boolean>;
  onCancel: () => void;
};

export default function WorkoutBuilder({
  initialPlan,
  onSave,
  onCancel,
}: Props) {
  const [planName, setPlanName] = useState(initialPlan?.name ?? '');
  const [selectedDays, setSelectedDays] =
    useState<Weekday[]>(initialPlan?.days ?? []);

  const [draftExercises, setDraftExercises] =
    useState<WorkoutPlan['exercises']>(() => initialPlan?.exercises.map((exercise) => ({ ...exercise })) ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);

  const cancelEditing = () => {
    if (isSaving) return;
    const changed = planName !== (initialPlan?.name ?? '') ||
      JSON.stringify(selectedDays) !== JSON.stringify(initialPlan?.days ?? []) ||
      JSON.stringify(draftExercises) !== JSON.stringify(initialPlan?.exercises ?? []);
    if (!changed) { onCancel(); return; }
    if (Platform.OS === 'web') {
      if (window.confirm('Discard unsaved plan changes?')) onCancel();
      return;
    }
    Alert.alert('Discard unsaved changes?', 'Your saved plan will stay as it was.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  };

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
        exerciseLibraryId: exercise.id,
        muscleGroup: exercise.isCustom ? exercise.muscle_group : exercise.target,
        muscleGroups: exercise.isCustom ? exercise.muscleGroups : undefined,
        trackingMethod: exercise.trackingMethod,
        image: exercise.isCustom ? exercise.image : undefined,
        targetSets: String(
          Math.min(
            99,
            Math.max(1, sets)
          )
        ),
        targetReps: exercise.trackingMethod && !['weight_reps', 'reps', 'bodyweight_reps'].includes(exercise.trackingMethod) ? '' : String(
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
    setLibraryOpen(false);
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

  const updateExercise = (
    exerciseId: string,
    updates: Partial<WorkoutPlan['exercises'][number]>
  ) => {
    setDraftExercises((current) => current.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, ...updates } : exercise
    ));
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    setDraftExercises((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const saveWorkout = async () => {
    const name = planName.trim();

    if (
      !name ||
      draftExercises.length === 0
    ) {
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const saved = await onSave({
        ...initialPlan,
        id: initialPlan?.id ?? createId(),
        name,
        days: selectedDays,
        exercises: draftExercises,
      });
      if (!saved) setSaveError('Your plan could not be saved. Your edits are still here; please try again.');
    } catch {
      setSaveError('Your plan could not be saved. Your edits are still here; please try again.');
    } finally {
      setIsSaving(false);
    }
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
    draftExercises.length > 0;

  return (
    <View pointerEvents={isSaving ? 'none' : 'auto'}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {initialPlan ? 'EDIT WORKOUT' : 'NEW WORKOUT'}
          </Text>

          <Text style={styles.title}>
            {initialPlan ? 'Edit Workout Plan' : 'Build a Workout'}
          </Text>
        </View>

        <Pressable
          onPress={cancelEditing}
          disabled={isSaving}
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
          Days of the week (optional)
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
        <Text style={styles.scheduleHint}>Leave all days unselected to use this plan any day.</Text>
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
            Tap Add exercise to choose from the library or create your own.
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
                    sets
                    {exercise.targetReps ? ` × ${exercise.targetReps} reps` : ''}
                    {' • '}
                    {formatRest(
                      exercise.restSeconds
                    )}
                  </Text>
                  <View style={styles.exerciseControls}>
                    <Pressable onPress={() => updateExercise(exercise.id, { targetSets: String(Math.max(1, Number(exercise.targetSets) - 1)) })} style={styles.controlButton} accessibilityLabel={`Decrease sets for ${exercise.name}`}><Text style={styles.controlText}>−</Text></Pressable>
                    <Text style={styles.controlLabel}>{exercise.targetSets} sets</Text>
                    <Pressable onPress={() => updateExercise(exercise.id, { targetSets: String(Math.min(99, Number(exercise.targetSets) + 1)) })} style={styles.controlButton} accessibilityLabel={`Increase sets for ${exercise.name}`}><Text style={styles.controlText}>+</Text></Pressable>
                    {exercise.targetReps ? <>
                      <Pressable onPress={() => updateExercise(exercise.id, { targetReps: String(Math.max(1, Number(exercise.targetReps) - 1)) })} style={styles.controlButton} accessibilityLabel={`Decrease reps for ${exercise.name}`}><Text style={styles.controlText}>−</Text></Pressable>
                      <Text style={styles.controlLabel}>{exercise.targetReps} reps</Text>
                      <Pressable onPress={() => updateExercise(exercise.id, { targetReps: String(Math.min(99, Number(exercise.targetReps) + 1)) })} style={styles.controlButton} accessibilityLabel={`Increase reps for ${exercise.name}`}><Text style={styles.controlText}>+</Text></Pressable>
                    </> : null}
                  </View>
                  <View style={styles.exerciseControls}>
                    <Pressable onPress={() => updateExercise(exercise.id, { restSeconds: Math.max(0, exercise.restSeconds - 15) })} style={styles.controlButton} accessibilityLabel={`Decrease rest for ${exercise.name}`}><Text style={styles.controlText}>−</Text></Pressable>
                    <Text style={styles.controlLabel}>{formatRest(exercise.restSeconds)}</Text>
                    <Pressable onPress={() => updateExercise(exercise.id, { restSeconds: Math.min(600, exercise.restSeconds + 15) })} style={styles.controlButton} accessibilityLabel={`Increase rest for ${exercise.name}`}><Text style={styles.controlText}>+</Text></Pressable>
                    <Pressable onPress={() => moveExercise(index, -1)} disabled={index === 0} style={styles.controlButton} accessibilityLabel={`Move ${exercise.name} up`}><Text style={styles.controlText}>↑</Text></Pressable>
                    <Pressable onPress={() => moveExercise(index, 1)} disabled={index === draftExercises.length - 1} style={styles.controlButton} accessibilityLabel={`Move ${exercise.name} down`}><Text style={styles.controlText}>↓</Text></Pressable>
                  </View>
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

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: libraryOpen }} style={styles.addExerciseButton} onPress={() => setLibraryOpen((current) => !current)}>
        <Text style={styles.controlLabel}>{libraryOpen ? 'Close exercise picker' : '+ Add exercise'}</Text>
      </Pressable>
      {libraryOpen ? <ExerciseLibrary
        onSelectExercise={
          addExerciseFromLibrary
        }
      /> : null}

      {saveError ? <Text accessibilityRole="alert" style={styles.saveError}>{saveError}</Text> : null}
      <Pressable
        style={[
          styles.saveButton,
          (!canSave || isSaving) &&
            styles.saveButtonDisabled,
        ]}
        onPress={saveWorkout}
        disabled={!canSave || isSaving}
      >
        <Text
          style={styles.saveButtonText}
        >
          {isSaving ? 'Saving…' : initialPlan ? 'Save Changes' : 'Save Workout Plan'}
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
  exerciseControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  controlButton: { minWidth: 44, minHeight: 44, borderRadius: 8, backgroundColor: colors.soft2, alignItems: 'center', justifyContent: 'center' },
  scheduleHint: { color: colors.muted, fontSize: 12, marginTop: 10, lineHeight: 18 },
  addExerciseButton: { backgroundColor: colors.surface, borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  saveError: { color: colors.text, marginVertical: 12, lineHeight: 20 },
  controlText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  controlLabel: { color: colors.muted, fontWeight: '800', fontSize: 12 },

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
