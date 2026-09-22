import { useState } from 'react';

import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';

import {
  ExerciseRecord,
  getEnglishInstructions,
  getEnglishInstructionText,
} from './exerciseData';

import {
  getExerciseGif,
  getExerciseImage,
  getExerciseProductUrl,
} from './exerciseMedia';

type Props = {
  exercise: ExerciseRecord;
  onBack: () => void;
  onAdd: (
    exercise: ExerciseRecord,
    sets: number,
    reps: number,
    restSeconds: number
  ) => void;
};

function getUniqueMetadata(exercise: ExerciseRecord) {
  const seen = new Set<string>();

  return [
    { label: 'Target', value: exercise.target },
    { label: 'Body', value: exercise.body_part },
    { label: 'Category', value: exercise.category },
    { label: 'Equipment', value: exercise.equipment },
    { label: 'Muscle', value: exercise.muscle_group },
  ].filter((item): item is { label: string; value: string } => {
    if (!item.value) return false;

    const normalized = item.value.trim().toLowerCase();
    if (seen.has(normalized)) return false;

    seen.add(normalized);
    return true;
  });
}

export default function ExerciseDetail({
  exercise,
  onBack,
  onAdd,
}: Props) {
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [restSeconds, setRestSeconds] =
    useState(60);

  const instructionSteps =
    getEnglishInstructions(exercise);

  const instructionText =
    getEnglishInstructionText(exercise);

  const exerciseImage =
    getExerciseImage(exercise.id);

  const exerciseGif =
    getExerciseGif(exercise.id);
  const tracksReps = !exercise.trackingMethod ||
    ['weight_reps', 'reps', 'bodyweight_reps'].includes(exercise.trackingMethod);

  const productUrl =
    getExerciseProductUrl(exercise.id);

  const mediaSource =
    exercise.isCustom && exercise.image ? { uri: exercise.image } : exerciseGif || exerciseImage;

  const metadata = getUniqueMetadata(exercise);

  const decreaseSets = () => {
    setSets((current) =>
      Math.max(1, current - 1)
    );
  };

  const increaseSets = () => {
    setSets((current) =>
      Math.min(99, current + 1)
    );
  };

  const decreaseReps = () => {
    setReps((current) =>
      Math.max(1, current - 1)
    );
  };

  const increaseReps = () => {
    setReps((current) =>
      Math.min(99, current + 1)
    );
  };

  const decreaseRest = () => {
    setRestSeconds((current) =>
      Math.max(0, current - 15)
    );
  };

  const increaseRest = () => {
    setRestSeconds((current) =>
      Math.min(600, current + 15)
    );
  };

  const handleAdd = () => {
    const safeSets = Math.min(
      99,
      Math.max(1, sets)
    );

    const safeReps = Math.min(
      99,
      Math.max(1, reps)
    );

    const safeRest = Math.min(
      600,
      Math.max(0, restSeconds)
    );

    onAdd(
      exercise,
      safeSets,
      safeReps,
      safeRest
    );
  };

  const formatRest = (
    seconds: number
  ) => {
    if (seconds === 0) {
      return 'Off';
    }

    if (seconds < 60) {
      return `${seconds} sec`;
    }

    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    if (remainingSeconds === 0) {
      return `${minutes} min`;
    }

    return `${minutes}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <Pressable
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          ← Back to Exercise Library
        </Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>
          {exercise.name}
        </Text>

        {mediaSource ? (
          <Image
            source={mediaSource}
            style={styles.exerciseMedia}
            resizeMode="contain"
          />
        ) : (
          <View
            style={styles.mediaFallback}
          >
            <Text
              style={
                styles.mediaFallbackText
              }
            >
              No exercise media available
            </Text>
          </View>
        )}

        {mediaSource ? <View style={styles.mediaBadge}>
          <Text
            style={styles.mediaBadgeText}
          >
            {exerciseGif
              ? 'Animated demonstration'
              : 'Exercise image'}
          </Text>
        </View> : null}

        {productUrl ? (
          <Pressable
            accessibilityRole="link"
            style={styles.officialSourceButton}
            onPress={() => void Linking.openURL(productUrl)}
          >
            <Text style={styles.officialSourceText}>Photo © Life Fitness · View official product</Text>
          </Pressable>
        ) : null}

        <View style={styles.metaWrap}>
          {metadata.map((item) => (
            <View key={item.label} style={styles.metaChip}>
              <Text style={styles.metaText}>
                {item.label}: {item.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.setupSection}>
          <Text
            style={styles.sectionTitle}
          >
            Workout setup
          </Text>

          <View style={styles.controlCard}>
            <Text style={styles.controlLabel}>
              Sets
            </Text>

            <View style={styles.counterRow}>
              <Pressable
                style={[
                  styles.counterButton,
                  sets <= 1 &&
                    styles.counterButtonDisabled,
                ]}
                onPress={decreaseSets}
                disabled={sets <= 1}
              >
                <Text
                  style={
                    styles.counterButtonText
                  }
                >
                  −
                </Text>
              </Pressable>

              <Text
                style={styles.counterValue}
              >
                {sets}
              </Text>

              <Pressable
                style={[
                  styles.counterButton,
                  sets >= 99 &&
                    styles.counterButtonDisabled,
                ]}
                onPress={increaseSets}
                disabled={sets >= 99}
              >
                <Text
                  style={
                    styles.counterButtonText
                  }
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View>

          {tracksReps ? <View style={styles.controlCard}>
            <Text style={styles.controlLabel}>
              Reps
            </Text>

            <View style={styles.counterRow}>
              <Pressable
                style={[
                  styles.counterButton,
                  reps <= 1 &&
                    styles.counterButtonDisabled,
                ]}
                onPress={decreaseReps}
                disabled={reps <= 1}
              >
                <Text
                  style={
                    styles.counterButtonText
                  }
                >
                  −
                </Text>
              </Pressable>

              <Text
                style={styles.counterValue}
              >
                {reps}
              </Text>

              <Pressable
                style={[
                  styles.counterButton,
                  reps >= 99 &&
                    styles.counterButtonDisabled,
                ]}
                onPress={increaseReps}
                disabled={reps >= 99}
              >
                <Text
                  style={
                    styles.counterButtonText
                  }
                >
                  +
                </Text>
              </Pressable>
            </View>
          </View> : null}

          <View style={styles.controlCard}>
            <Text style={styles.controlLabel}>
              Rest
            </Text>

            <View style={styles.counterRow}>
              <Pressable
                style={[
                  styles.counterButton,
                  restSeconds <= 0 &&
                    styles.counterButtonDisabled,
                ]}
                onPress={decreaseRest}
                disabled={restSeconds <= 0}
              >
                <Text
                  style={
                    styles.counterButtonText
                  }
                >
                  −
                </Text>
              </Pressable>

              <Text
                style={[
                  styles.counterValue,
                  styles.restValue,
                ]}
              >
                {formatRest(restSeconds)}
              </Text>

              <Pressable
                style={[
                  styles.counterButton,
                  restSeconds >= 600 &&
                    styles.counterButtonDisabled,
                ]}
                onPress={increaseRest}
                disabled={
                  restSeconds >= 600
                }
              >
                <Text
                  style={
                    styles.counterButtonText
                  }
                >
                  +
                </Text>
              </Pressable>
            </View>

            <Text
              style={styles.controlHint}
            >
              Adjusts in 15-second
              increments. Set to Off for
              no automatic rest timer.
            </Text>
          </View>
        </View>

        {exercise.secondary_muscles &&
        exercise.secondary_muscles
          .length > 0 ? (
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Secondary muscles
            </Text>

            <Text style={styles.mutedText}>
              {exercise.secondary_muscles.join(
                ', '
              )}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Instructions
          </Text>

          {instructionSteps.length > 0 ? (
            instructionSteps.map(
              (instruction, index) => (
                <View
                  key={`${index}-${instruction}`}
                  style={
                    styles.instructionRow
                  }
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

                  <Text
                    style={
                      styles.instructionText
                    }
                  >
                    {instruction}
                  </Text>
                </View>
              )
            )
          ) : instructionText ? (
            <Text
              style={
                styles.instructionText
              }
            >
              {instructionText}
            </Text>
          ) : (
            <Text
              style={styles.mutedText}
            >
              No instructions are
              available for this
              exercise.
            </Text>
          )}
        </View>

        {exercise.attribution ? (
          <Text
            style={styles.attribution}
          >
            {exercise.attribution}
          </Text>
        ) : null}

        <Pressable
          style={styles.addButton}
          onPress={handleAdd}
        >
          <Text
            style={styles.addButtonText}
          >
            Add to Workout
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },

  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 12,
  },
  backText: { color: colors.surface, fontWeight: '900', fontSize: 14 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },

  exerciseMedia: {
    width: '100%',
    height: 280,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: colors.soft2,
  },

  mediaFallback: {
    height: 240,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mediaFallbackText: {
    color: colors.muted,
    fontWeight: '700',
  },

  mediaBadge: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  mediaBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
  },

  officialSourceButton: {
    alignSelf: 'center',
    minHeight: 38,
    marginTop: 8,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: colors.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  officialSourceText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },

  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },

  metaChip: {
    backgroundColor: colors.soft2,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  metaText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 12,
  },

  setupSection: {
    marginTop: 24,
  },

  section: {
    marginTop: 24,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 12,
  },

  controlCard: {
    backgroundColor: colors.soft2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  controlLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.muted,
    marginBottom: 10,
  },

  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  counterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  counterButtonDisabled: {
    opacity: 0.25,
  },

  counterButtonText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '900',
  },

  counterValue: {
    minWidth: 70,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },

  restValue: {
    minWidth: 110,
    fontSize: 22,
  },

  controlHint: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: colors.lightMuted,
    textAlign: 'center',
  },

  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
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
    color: colors.muted,
    fontWeight: '900',
  },

  instructionText: {
    flex: 1,
    color: colors.text,
    lineHeight: 21,
    fontSize: 14,
  },

  mutedText: {
    color: colors.muted,
    lineHeight: 20,
  },

  attribution: {
    marginTop: 16,
    color: colors.lightMuted,
    fontSize: 11,
    lineHeight: 16,
  },

  addButton: {
    marginTop: 24,
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },

  addButtonText: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: 15,
  },
});
