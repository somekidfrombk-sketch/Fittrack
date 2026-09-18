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
  onDelete: () => void;
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
  getExerciseRecency,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>
            {plan.name}
          </Text>

          <Text style={styles.days}>
            {plan.days.join(' • ')}
          </Text>
        </View>

        <Pressable onPress={onDelete}>
          <Text style={styles.deleteText}>
            Delete
          </Text>
        </Pressable>
      </View>

      <Text style={styles.summary}>
        {plan.exercises.length}{' '}
        exercise
        {plan.exercises.length === 1 ? '' : 's'}
      </Text>

      {plan.exercises.map((exercise, index) => {
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
              {exercise.targetSets} sets ×{' '}
              {exercise.targetReps} reps
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

      <Pressable
        style={styles.startButton}
        onPress={onStart}
      >
        <Text style={styles.startButtonText}>
          Start Workout
        </Text>
      </Pressable>
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
});
