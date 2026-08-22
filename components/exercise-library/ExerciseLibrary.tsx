import { useMemo, useState } from 'react';
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

const muscleMapImage = require('../../assets/images/exercise-library/muscle-map.png');

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

export default function ExerciseLibrary({
  onSelectExercise,
}: Props) {
  const [query, setQuery] = useState('');

  const [selectedEquipment, setSelectedEquipment] =
    useState<string | null>(null);

  const [selectedMuscles, setSelectedMuscles] =
    useState<string[]>([]);

  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseRecord | null>(null);

  const filteredExercises = useMemo(() => {
    let results = searchExercises(query);

    if (selectedEquipment) {
      results = results.filter(
        (exercise) =>
          exercise.equipment === selectedEquipment
      );
    }

    if (selectedMuscles.length > 0) {
      results = results.filter((exercise) =>
        selectedMuscles.some((muscle) =>
          exerciseMatchesMuscle(exercise, muscle)
        )
      );
    }

    return results.slice(0, 100);
  }, [query, selectedEquipment, selectedMuscles]);

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

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises, muscles, or equipment"
        placeholderTextColor={
          colors.lightMuted
        }
        style={styles.searchInput}
      />

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
              onPress={() => setSelectedMuscles([])}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <Image
          source={muscleMapImage}
          resizeMode="contain"
          style={styles.muscleMap}
          accessibilityLabel="Front and back muscle map"
        />

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
                onPress={() =>
                  setSelectedMuscles((current) =>
                    selected
                      ? current.filter((item) => item !== muscle.label)
                      : [...current, muscle.label]
                  )
                }
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
            All
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

      {filteredExercises.map(
        (exercise) => (
          <Pressable
            key={exercise.id}
            style={styles.exerciseCard}
            onPress={() =>
              setSelectedExercise(exercise)
            }
          >
            <View style={{ flex: 1 }}>
              <Text
                style={styles.exerciseName}
              >
                {exercise.name}
              </Text>

              <Text
                style={styles.exerciseMeta}
              >
                {[
                  exercise.target,
                  exercise.body_part,
                  exercise.category,
                  exercise.equipment,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>

            <Text style={styles.detailsText}>
              View
            </Text>
          </Pressable>
        )
      )}
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

  clearText: {
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },

  muscleMap: {
    alignSelf: 'center',
    width: '100%',
    height: 270,
    marginTop: 10,
    borderRadius: 14,
  },

  muscleChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },

  muscleChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  muscleChipSelected: {
    backgroundColor: colors.text,
  },

  muscleChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },

  muscleChipTextSelected: {
    color: colors.surface,
  },

  filterRow: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 12,
  },

  filterChip: {
    backgroundColor: colors.soft2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
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

  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.soft2,
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
