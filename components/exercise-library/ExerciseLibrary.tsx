import { useDeferredValue, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import ExerciseDetail from './ExerciseDetail';
import InteractiveMuscleMap, { MuscleFocusLabel } from './InteractiveMuscleMap';
import { getExerciseImage } from './exerciseMedia';

import {
  ExerciseRecord,
  exercises,
  searchExercises,
} from './exerciseData';

type SelectedExerciseConfig = {
  exercise: ExerciseRecord;
  sets: number;
  reps: number;
  restSeconds: number;
};

type Props = {
  onSelectExercise: (
    config: SelectedExerciseConfig
  ) => void;
};

const muscleFocusOptions = [
  { label: 'Chest', terms: ['chest', 'pectorals'] },
  { label: 'Back', terms: ['back', 'lats', 'latissimus', 'rhomboids', 'traps', 'trapezius'] },
  { label: 'Shoulders', terms: ['shoulders', 'delts', 'deltoids', 'rotator cuff'] },
  { label: 'Biceps', terms: ['biceps'] },
  { label: 'Triceps', terms: ['triceps'] },
  { label: 'Forearms', terms: ['forearms', 'lower arms', 'wrist'] },
  { label: 'Core', terms: ['abs', 'abdominals', 'core', 'waist', 'obliques'] },
  { label: 'Glutes', terms: ['glutes', 'hip and glute'] },
  { label: 'Quadriceps', terms: ['quadriceps', 'quads'] },
  { label: 'Hamstrings', terms: ['hamstrings'] },
  { label: 'Calves', terms: ['calves', 'soleus', 'lower legs'] },
] as const;

type MuscleLabel = MuscleFocusLabel;

function exerciseMatchesMuscle(
  exercise: ExerciseRecord,
  muscleLabel: string
) {
  const option = muscleFocusOptions.find(
    (item) => item.label === muscleLabel
  );
  if (!option) return true;

  const muscleText = [
    exercise.target,
    exercise.muscle_group,
    exercise.body_part,
    ...(exercise.secondary_muscles ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return option.terms.some((term) => muscleText.includes(term));
}

function uniqueExerciseSummary(exercise: ExerciseRecord) {
  return Array.from(
    new Map(
      [exercise.target, exercise.body_part, exercise.category, exercise.equipment]
        .filter((value): value is string => Boolean(value))
        .map((value) => [value.trim().toLowerCase(), value])
    ).values()
  );
}
function ExerciseThumbnail({ exercise }: { exercise: ExerciseRecord }) {
  const source = getExerciseImage(exercise.id);

  if (!source) {
    return (
      <View accessibilityLabel="No exercise image available" style={styles.thumbnailFallback}>
        <Text style={styles.thumbnailFallbackText}>FIT</Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={`${exercise.name} demonstration`}
      resizeMode="contain"
      source={source}
      style={styles.exerciseThumbnail}
    />
  );
}
export default function ExerciseLibrary({
  onSelectExercise,
}: Props) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const [selectedEquipment, setSelectedEquipment] =
    useState<string | null>(null);

  const [selectedMuscles, setSelectedMuscles] =
    useState<string[]>([]);

  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseRecord | null>(null);

  const toggleMuscle = (muscle: MuscleLabel) => {
    setSelectedMuscles((current) =>
      current.includes(muscle)
        ? current.filter((item) => item !== muscle)
        : [...current, muscle]
    );
  };

  const filteredExercises = useMemo(() => {
    let results = searchExercises(deferredQuery);

    if (selectedMuscles.length > 0) {
      results = results.filter((exercise) =>
        selectedMuscles.some((muscle) =>
          exerciseMatchesMuscle(exercise, muscle)
        )
      );
    }

    if (selectedEquipment) {
      results = results.filter(
        (exercise) =>
          exercise.equipment === selectedEquipment
      );
    }

    return results.slice(0, 100);
  }, [deferredQuery, selectedEquipment, selectedMuscles]);

  const activeFilters = [
    ...selectedMuscles.map((muscle) => ({
      key: `muscle-${muscle}`,
      label: muscle,
      onClear: () => toggleMuscle(muscle as MuscleLabel),
    })),
    ...(selectedEquipment
      ? [
          {
            key: `equipment-${selectedEquipment}`,
            label: selectedEquipment,
            onClear: () => setSelectedEquipment(null),
          },
        ]
      : []),
  ];

  const clearAllFilters = () => {
    setQuery('');
    setSelectedMuscles([]);
    setSelectedEquipment(null);
  };

  const equipmentOptions = useMemo(() => {
    const options = exercises
      .map((exercise) => exercise.equipment)
      .filter(
        (value): value is string =>
          Boolean(value)
      );

    return Array.from(new Set(options)).sort((left, right) => {
      const leftHammer = left.startsWith('Hammer Strength');
      const rightHammer = right.startsWith('Hammer Strength');

      if (leftHammer !== rightHammer) {
        return leftHammer ? -1 : 1;
      }

      return left.localeCompare(right);
    });
  }, []);

  if (selectedExercise) {
    return (
      <ExerciseDetail
        exercise={selectedExercise}
        onBack={() =>
          setSelectedExercise(null)
        }
        onAdd={(
          exercise,
          sets,
          reps,
          restSeconds
        ) => {
          onSelectExercise({
            exercise,
            sets,
            reps,
            restSeconds,
          });

          setSelectedExercise(null);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Exercise Library
      </Text>

      <Text style={styles.subtitle}>
        Search {exercises.length} exercises
      </Text>

      <View style={styles.musclePickerCard}>
        <View style={styles.musclePickerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.musclePickerTitle}>Choose muscle focus</Text>
            <Text style={styles.musclePickerSubtitle}>
              Pick one or more areas to narrow the exercise list.
            </Text>
          </View>
          {selectedMuscles.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              style={styles.clearButton}
              onPress={() => setSelectedMuscles([])}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.muscleMapFrame}>
          <InteractiveMuscleMap
            selectedMuscles={selectedMuscles as MuscleFocusLabel[]}
            onToggleMuscle={toggleMuscle}
          />
        </View>

        <View style={styles.muscleChipGrid}>
          {muscleFocusOptions.map((muscle) => {
            const selected = selectedMuscles.includes(muscle.label);
            return (
              <Pressable
                key={muscle.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.muscleChip,
                  selected && styles.muscleChipSelected,
                ]}
                onPress={() => toggleMuscle(muscle.label)}
              >
                <Text
                  style={[
                    styles.muscleChipText,
                    selected && styles.muscleChipTextSelected,
                  ]}
                >
                  {muscle.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises, muscles, or equipment"
        placeholderTextColor={
          colors.lightMuted
        }
        returnKeyType="search"
        style={styles.searchInput}
      />

      {activeFilters.length > 0 || query.trim() ? (
        <View style={styles.activeFilterWrap}>
          {activeFilters.map((filter) => (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              style={styles.activeFilterChip}
              onPress={filter.onClear}
            >
              <Text style={styles.activeFilterText}>
                {filter.label} ×
              </Text>
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            style={styles.clearAllButton}
            onPress={clearAllFilters}
          >
            <Text style={styles.clearAllText}>
              Clear all
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.filterRow
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedEquipment === null }}
          style={[
            styles.filterChip,
            selectedEquipment === null &&
              styles.filterChipSelected,
          ]}
          onPress={() =>
            setSelectedEquipment(null)
          }
        >
          <Text
            style={[
              styles.filterText,
              selectedEquipment === null &&
                styles.filterTextSelected,
            ]}
          >
            All equipment
          </Text>
        </Pressable>

        {equipmentOptions.map(
          (equipment) => {
            const selected =
              selectedEquipment ===
              equipment;

            return (
              <Pressable
                key={equipment}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.filterChip,
                  selected &&
                    styles.filterChipSelected,
                ]}
                onPress={() =>
                  setSelectedEquipment(
                    selected
                      ? null
                      : equipment
                  )
                }
              >
                <Text
                  style={[
                    styles.filterText,
                    selected &&
                      styles.filterTextSelected,
                  ]}
                >
                  {equipment}
                </Text>
              </Pressable>
            );
          }
        )}
      </ScrollView>

      <Text style={styles.resultsText}>
        {filteredExercises.length} shown
      </Text>

      <View style={styles.exerciseList}>
        {filteredExercises.length === 0 ? (
          <View style={styles.emptyResultsCard}>
            <Text style={styles.emptyResultsTitle}>
              No exercises match those filters
            </Text>
            <Text style={styles.emptyResultsText}>
              Remove a filter or clear all to see more exercises.
            </Text>
          </View>
        ) : null}

        {filteredExercises.map(
          (exercise) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <ExerciseThumbnail exercise={exercise} />
            <Pressable
              accessibilityRole="button"
              style={styles.exerciseSummary}
              onPress={() => setSelectedExercise(exercise)}
            >
              <Text style={styles.exerciseName}>
                {exercise.name}
              </Text>

              <Text style={styles.exerciseMeta}>
                {uniqueExerciseSummary(exercise).join(' • ')}
              </Text>
            </Pressable>

            <View style={styles.exerciseActions}>
              <Pressable
                accessibilityLabel={`View ${exercise.name} details`}
                accessibilityRole="button"
                style={styles.viewButton}
                onPress={() => setSelectedExercise(exercise)}
              >
                <Text style={styles.detailsText}>View</Text>
              </Pressable>

              <Pressable
                accessibilityLabel={`Add ${exercise.name} to workout`}
                accessibilityRole="button"
                style={styles.quickAddButton}
                onPress={() => onSelectExercise({
                  exercise,
                  sets: 3,
                  reps: 10,
                  restSeconds: 60,
                })}
              >
                <Text style={styles.quickAddText}>Add</Text>
              </Pressable>
            </View>
          </View>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },

  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: colors.muted,
    fontSize: 13,
  },

  searchInput: {
    marginTop: 14,
    backgroundColor: colors.soft2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  musclePickerCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.soft2,
  },

  musclePickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  musclePickerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },

  musclePickerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },

  clearButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },

  muscleMapFrame: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    marginTop: 10,
    borderRadius: 14,
  },

  muscleChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  muscleChip: {
    minHeight: 40,
    minWidth: 92,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  muscleChipSelected: {
    backgroundColor: '#B91C1C',
  },

  muscleChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },

  muscleChipTextSelected: {
    color: colors.surface,
  },

  activeFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  activeFilterChip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeFilterText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '900',
  },

  clearAllButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearAllText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },

  filterRow: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },

  filterChip: {
    minHeight: 38,
    backgroundColor: colors.soft2,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterChipSelected: {
    backgroundColor: colors.text,
  },

  filterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },

  filterTextSelected: {
    color: colors.surface,
  },

  resultsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightMuted,
    marginBottom: 10,
  },

  exerciseList: {
    borderBottomWidth: 1,
    borderBottomColor: colors.soft2,
  },

  emptyResultsCard: {
    backgroundColor: colors.soft2,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },

  emptyResultsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },

  emptyResultsText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },

  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.soft2,
  },

  exerciseThumbnail: {
    backgroundColor: colors.soft2,
    borderRadius: 10,
    height: 64,
    width: 64,
  },

  thumbnailFallback: {
    alignItems: 'center',
    backgroundColor: colors.soft2,
    borderRadius: 10,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  thumbnailFallbackText: {
    color: colors.lightMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  exerciseSummary: {
    flex: 1,
  },

  exerciseActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  viewButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  quickAddButton: {
    backgroundColor: colors.text,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  quickAddText: {
    color: colors.surface,
    fontWeight: '900',
  },

  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  exerciseMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },

  detailsText: {
    fontWeight: '900',
    color: colors.text,
  },
});
