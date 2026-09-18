import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutExercise } from '../../types/workout';
import { ExerciseMeasurement } from './exerciseMeasurement';

type Props = {
  exercise: WorkoutExercise;
  measurement: ExerciseMeasurement;
  prSetIds?: string[];
  muscleRecencyLabel?: string | null;
  canMoveUp?: boolean;
  canMoveDown?: boolean;

  onAddSet: () => void;
  onRemove: () => void;
  onViewMedia: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemoveSet: (setId: string) => void;
  onMoveSetUp: (setId: string) => void;
  onMoveSetDown: (setId: string) => void;

  onUpdateSet: (
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => void;

  onToggleSetComplete: (setId: string) => void;
};

function cleanValue(
  value: string,
  keyboard: 'decimal-pad' | 'number-pad'
) {
  if (keyboard === 'number-pad') {
    return value.replace(/[^0-9]/g, '');
  }

  const decimal = value
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1');

  return decimal;
}

export default function ExerciseCard({
  exercise,
  measurement,
  prSetIds = [],
  muscleRecencyLabel,
  canMoveUp = false,
  canMoveDown = false,
  onAddSet,
  onRemove,
  onViewMedia,
  onMoveUp,
  onMoveDown,
  onRemoveSet,
  onMoveSetUp,
  onMoveSetDown,
  onUpdateSet,
  onToggleSetComplete,
}: Props) {
  const hasSecondaryInput = Boolean(
    measurement.secondaryLabel
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${exercise.name} media`}
          style={styles.headerInfo}
          onPress={onViewMedia}
        >
          <Text style={styles.exerciseName}>
            {exercise.name}
          </Text>

          <Text style={styles.setCount}>
            {exercise.sets.length}{' '}
            {exercise.sets.length === 1 ? 'set' : 'sets'}
            {' • '}
            Tap to view demo
          </Text>

          {muscleRecencyLabel ? (
            <Text style={styles.muscleRecency}>
              {muscleRecencyLabel}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.headerActions}>
          <View style={styles.moveRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${exercise.name} up`}
              disabled={!canMoveUp}
              onPress={onMoveUp}
              style={[
                styles.iconButton,
                !canMoveUp && styles.iconButtonDisabled,
              ]}
            >
              <Text style={styles.iconButtonText}>↑</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${exercise.name} down`}
              disabled={!canMoveDown}
              onPress={onMoveDown}
              style={[
                styles.iconButton,
                !canMoveDown && styles.iconButtonDisabled,
              ]}
            >
              <Text style={styles.iconButtonText}>↓</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.name}`}
            hitSlop={8}
            onPress={onRemove}
            style={styles.removeButton}
          >
            <Text style={styles.removeText}>
              Remove
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.columnHeader}>
        <Text style={styles.setHeader}>SET</Text>
        <Text style={styles.inputHeader}>
          {measurement.primaryLabel}
        </Text>
        {hasSecondaryInput ? (
          <Text style={styles.inputHeader}>
            {measurement.secondaryLabel}
          </Text>
        ) : null}
        <Text style={styles.doneHeader}>DONE</Text>
        <Text style={styles.editHeader}>EDIT</Text>
      </View>

      {exercise.sets.map((set, index) => {
        const isCompleted = set.completed;
        const isPr = prSetIds.includes(set.id);
        const canMoveSetUp = index > 0;
        const canMoveSetDown = index < exercise.sets.length - 1;
        const canRemoveSet = exercise.sets.length > 1;
        const primaryField =
          measurement.kind === 'weighted' ||
          measurement.kind === 'distance'
            ? 'weight'
            : 'reps';
        const primaryValue = set[primaryField];
        const secondaryValue = set.reps;

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
                value={primaryValue}
                onChangeText={(value) => {
                  onUpdateSet(
                    set.id,
                    primaryField,
                    cleanValue(
                      value,
                      measurement.primaryKeyboard
                    )
                  );
                }}
                placeholder={measurement.primaryPlaceholder}
                placeholderTextColor={colors.lightMuted}
                keyboardType={measurement.primaryKeyboard}
                returnKeyType="done"
                editable={!isCompleted}
                style={[
                  styles.input,
                  !hasSecondaryInput && styles.singleInput,
                  isCompleted && styles.completedInput,
                ]}
              />

              {hasSecondaryInput && measurement.secondaryKeyboard ? (
                <TextInput
                  value={secondaryValue}
                  onChangeText={(value) => {
                    onUpdateSet(
                      set.id,
                      'reps',
                      cleanValue(
                        value,
                        measurement.secondaryKeyboard ?? 'number-pad'
                      )
                    );
                  }}
                  placeholder={measurement.secondaryPlaceholder ?? '0'}
                  placeholderTextColor={colors.lightMuted}
                  keyboardType={measurement.secondaryKeyboard}
                  returnKeyType="done"
                  editable={!isCompleted}
                  style={[
                    styles.input,
                    isCompleted && styles.completedInput,
                  ]}
                />
              ) : null}

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

              <View style={styles.setActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move set ${index + 1} up`}
                  disabled={!canMoveSetUp}
                  onPress={() => onMoveSetUp(set.id)}
                  style={[
                    styles.smallIconButton,
                    !canMoveSetUp && styles.iconButtonDisabled,
                  ]}
                >
                  <Text style={styles.smallIconText}>↑</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move set ${index + 1} down`}
                  disabled={!canMoveSetDown}
                  onPress={() => onMoveSetDown(set.id)}
                  style={[
                    styles.smallIconButton,
                    !canMoveSetDown && styles.iconButtonDisabled,
                  ]}
                >
                  <Text style={styles.smallIconText}>↓</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove set ${index + 1}`}
                  disabled={!canRemoveSet}
                  onPress={() => onRemoveSet(set.id)}
                  style={[
                    styles.smallRemoveButton,
                    !canRemoveSet && styles.iconButtonDisabled,
                  ]}
                >
                  <Text style={styles.smallRemoveText}>×</Text>
                </Pressable>
              </View>
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
    minHeight: 48,
  },

  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },

  moveRow: {
    flexDirection: 'row',
    gap: 6,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconButtonDisabled: {
    opacity: 0.28,
  },

  iconButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
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

  muscleRecency: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },

  removeButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeText: {
    color: colors.lightMuted,
    fontSize: 12,
    fontWeight: '900',
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

  editHeader: {
    width: 42,
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

  singleInput: {
    flex: 2,
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

  setActions: {
    width: 42,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
  },

  smallIconButton: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallIconText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },

  smallRemoveButton: {
    width: 39,
    height: 18,
    borderRadius: 6,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallRemoveText: {
    color: colors.lightMuted,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
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