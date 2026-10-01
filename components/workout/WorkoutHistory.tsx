import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { getExerciseMeasurement } from './exerciseMeasurement';

function formatSet(exercise: WorkoutHistoryEntry['exercises'][number], set: WorkoutHistoryEntry['exercises'][number]['sets'][number]) {
  const measurement = getExerciseMeasurement(exercise.name, exercise.trackingMethod);
  if (measurement.kind === 'none') return 'No measurement';
  if (measurement.kind === 'duration') return `${set.reps || '0'} sec`;
  if (measurement.kind === 'bodyweight' || measurement.kind === 'reps') return `${set.reps || '0'} reps`;
  if (measurement.kind === 'distance') {
    return measurement.secondaryLabel
      ? `${set.weight || '0'} mi · ${set.reps || '0'} min`
      : `${set.weight || '0'} mi`;
  }
  return `${set.weight || '0'} lb × ${set.reps || '0'} reps`;
}

type Props = {
  history: WorkoutHistoryEntry[];
  onDeleteEntry: (entryId: string) => void;
  onUseAsTemplate: (entry: WorkoutHistoryEntry) => void;
  onSaveAsTemplate: (entry: WorkoutHistoryEntry) => void;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatWorkoutDate(date: string) {
  const parsedDate = new Date(date);

  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WorkoutHistory({
  history,
  onDeleteEntry,
  onUseAsTemplate,
  onSaveAsTemplate,
}: Props) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>
          Workout History
        </Text>

        <Text style={styles.subtitle}>
          {history.length === 0
            ? 'Completed workouts will appear here.'
            : `${history.length} completed workout${
                history.length === 1 ? '' : 's'
              }`}
        </Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No workout history yet
          </Text>

          <Text style={styles.emptyText}>
            Finish a workout and it will be saved here with your sets,
            reps, weight, duration, volume, and estimated calories.
          </Text>
        </View>
      ) : (
        history.map((entry) => (
          <View
            key={entry.id}
            style={styles.card}
          >
            <Pressable
              style={styles.cardHeader}
              onPress={() => setExpandedEntryId((current) => current === entry.id ? null : entry.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedEntryId === entry.id }}
              accessibilityLabel={`${formatWorkoutDate(entry.date)}, ${entry.exercises.length} exercises, ${entry.completedSets} completed sets. ${expandedEntryId === entry.id ? 'Hide' : 'Show'} workout details`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.date}>
                  {formatWorkoutDate(entry.date)}
                </Text>

                <Text style={styles.summary}>
                  {entry.exercises.length}{' '}
                  exercise
                  {entry.exercises.length === 1 ? '' : 's'}
                  {' • '}
                  {entry.completedSets} completed sets
                  {' • '}
                  {formatDuration(entry.durationSeconds)}
                </Text>
              </View>
              <Text style={styles.expandArrow}>{expandedEntryId === entry.id ? '⌃' : '⌄'}</Text>
            </Pressable>

            <Pressable
              onPress={() => onDeleteEntry(entry.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete workout from ${formatWorkoutDate(entry.date)}`}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete workout</Text>
            </Pressable>

            {expandedEntryId === entry.id ? <>
              <View style={styles.cardActions}>
                <Pressable accessibilityRole="button" onPress={() => onUseAsTemplate(entry)} style={styles.templateButton}>
                  <Text style={styles.templateButtonText}>Use as template</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onSaveAsTemplate(entry)} style={styles.saveTemplateButton}>
                  <Text style={styles.saveTemplateButtonText}>Save as template</Text>
                </Pressable>
              </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>
                  DURATION
                </Text>

                <Text style={styles.statValue}>
                  {formatDuration(entry.durationSeconds)}
                </Text>
              </View>

              <View style={styles.stat}>
                <Text style={styles.statLabel}>
                  VOLUME
                </Text>

                <Text style={styles.statValue}>
                  {Math.round(entry.totalVolume).toLocaleString()}
                </Text>

                <Text style={styles.statUnit}>
                  lb
                </Text>
              </View>

              <View style={styles.stat}>
                <Text style={styles.statLabel}>
                  SETS
                </Text>

                <Text style={styles.statValue}>
                  {entry.completedSets}
                </Text>

                <Text style={styles.statUnit}>
                  completed
                </Text>
              </View>

              <View style={styles.stat}>
                <Text style={styles.statLabel}>CALORIES</Text>
                <Text style={styles.statValue}>
                  {entry.caloriesBurned ?? '—'}
                </Text>
                <Text style={styles.statUnit}>
                  {entry.caloriesBurned === undefined
                    ? 'older workout'
                    : 'estimated kcal'}
                </Text>
              </View>
            </View>

            <View style={styles.exerciseList}>
              {entry.exercises.map((exercise, index) => (
                <View
                  key={exercise.id}
                  style={styles.exerciseBlock}
                >
                  <Text style={styles.exerciseName}>
                    {index + 1}. {exercise.name}
                  </Text>
                  {exercise.comment ? <Text style={styles.exerciseComment}>{exercise.comment}</Text> : null}

                  {exercise.sets.map((set, setIndex) => (
                    <Text
                      key={set.id}
                      style={[
                        styles.setText,
                        !set.completed &&
                          styles.incompleteSetText,
                      ]}
                    >
                      Set {setIndex + 1}:{' '}
                      {formatSet(exercise, set)}
                      {set.completed
                        ? ''
                        : ' • not completed'}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
            </> : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 22,
    marginBottom: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },

  emptyText: {
    marginTop: 6,
    color: colors.muted,
    lineHeight: 20,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 14 },
  expandArrow: { color: colors.muted, fontSize: 22, fontWeight: '800' },
  deleteButton: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 5 },
  templateButton: { backgroundColor: colors.text, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  templateButtonText: { color: colors.surface, fontSize: 11, fontWeight: '900' },
  saveTemplateButton: { backgroundColor: colors.soft, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  saveTemplateButtonText: { color: colors.text, fontSize: 11, fontWeight: '900' },

  date: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },

  summary: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },

  deleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.lightMuted,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.soft2,
  },

  stat: {
    flex: 1,
  },

  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.lightMuted,
  },

  statValue: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
  },

  statUnit: {
    marginTop: 1,
    fontSize: 10,
    color: colors.muted,
  },

  exerciseList: {
    marginTop: 18,
  },

  exerciseBlock: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.soft2,
  },

  exerciseName: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },
  exerciseComment: { color: colors.text, fontSize: 12, lineHeight: 18, marginBottom: 7 },

  setText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },

  incompleteSetText: {
    opacity: 0.5,
  },
});
