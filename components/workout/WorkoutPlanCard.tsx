import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutPlan } from '../../types/workoutPlan';
import { MuscleRecency } from './muscleRecency';

type Props = {
  plan: WorkoutPlan;
  onStart: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  saved?: boolean;
  getExerciseRecency?: (
    exerciseName: string
  ) => MuscleRecency | null;
};

function formatRest(seconds: number) {
  if (seconds === 0) {
    return 'Rest off';
  }

  if (seconds < 60) {
    return `${seconds}s rest`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  if (remaining === 0) {
    return `${minutes}m rest`;
  }

  return `${minutes}:${String(remaining).padStart(2, '0')} rest`;
}

export default function WorkoutPlanCard({
  plan,
  onStart,
  onDelete,
  onEdit,
  onSave,
  saved = false,
  getExerciseRecency,
}: Props) {
  const [showAllExercises, setShowAllExercises] = useState(false);
  const hasMoreExercises = plan.exercises.length > 3;
  const visibleExercises = showAllExercises
    ? plan.exercises
    : plan.exercises.slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>
            {plan.name}
          </Text>

          <Text style={styles.days}>
            {plan.days.length ? plan.days.join(' • ') : 'Any day'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {onEdit ? <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${plan.name}`}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable> : null}
          {onDelete ? <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete ${plan.name}`}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable> : null}
        </View>
      </View>

      <Text style={styles.summary}>
        {plan.exercises.length}{' '}
        exercise
        {plan.exercises.length === 1 ? '' : 's'}
      </Text>

      {visibleExercises.map((exercise, index) => {
        const recency = getExerciseRecency?.(exercise.name);

        return (
        <View
          key={exercise.id}
          style={styles.exerciseRow}
        >
          <View style={styles.numberCircle}>
            <Text style={styles.numberText}>
              {index + 1}
            </Text>
          </View>

          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>
              {exercise.name}
            </Text>

            <Text style={styles.exerciseMeta}>
              {exercise.targetSets} sets
              {exercise.targetReps ? ` × ${exercise.targetReps} reps` : ''}
              {' • '}
              {formatRest(exercise.restSeconds)}
            </Text>

            {recency ? (
              <Text style={styles.exerciseRecency}>
                {recency.label}
              </Text>
            ) : null}
          </View>
        </View>
        );
      })}

      {hasMoreExercises ? (
        <Pressable
          onPress={() => setShowAllExercises((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={showAllExercises ? `Show fewer exercises in ${plan.name}` : `Show all exercises in ${plan.name}`}
          style={styles.showMoreButton}
        >
          <Text style={styles.showMoreText}>
            {showAllExercises
              ? 'Show less'
              : `Show all ${plan.exercises.length} exercises`}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.startButton}
        onPress={onStart}
      >
        <Text style={styles.startButtonText}>
          Start Workout
        </Text>
      </Pressable>
      {onSave ? <Pressable disabled={saved} onPress={onSave} style={[styles.saveButton, saved && styles.savedButton]}>
        <Text style={styles.saveButtonText}>{saved ? 'Saved to My Plans' : 'Save to My Plans'}</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  headerInfo: {
    flex: 1,
  },
  headerActions: { flexDirection: 'row', gap: 16 },
  editText: { color: colors.text, fontSize: 12, fontWeight: '800' },

  name: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },

  days: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },

  deleteText: {
    color: colors.lightMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  summary: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
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

  exerciseInfo: {
    flex: 1,
  },

  exerciseName: {
    fontWeight: '800',
    color: colors.text,
  },

  exerciseMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },

  exerciseRecency: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },

  startButton: {
    marginTop: 18,
    backgroundColor: colors.text,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },

  startButtonText: {
    color: colors.surface,
    fontWeight: '900',
  },
  showMoreButton: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 6 },
  showMoreText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  saveButton: { marginTop: 9, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.soft },
  savedButton: { opacity: 0.6 },
  saveButtonText: { color: colors.text, fontWeight: '900' },
});
