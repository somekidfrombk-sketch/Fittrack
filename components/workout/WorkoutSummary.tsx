import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutIntensity } from '../../types/workoutHistory';

type Props = {
  duration: string;
  volume: number;
  sets: number;
  calories: number | null;
  intensity: WorkoutIntensity;
  onIntensityChange: (intensity: WorkoutIntensity) => void;

  restTime: string;
  restActive: boolean;
  restComplete: boolean;
};

export default function WorkoutSummary({
  duration,
  volume,
  sets,
  calories,
  intensity,
  onIntensityChange,
  restTime,
  restActive,
  restComplete,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.statBlock}>
          <Text style={styles.label}>
            DURATION
          </Text>

          <Text style={styles.value}>
            {duration}
          </Text>

          <View style={styles.restSection}>
            <Text style={styles.restLabel}>
              REST
            </Text>

            <Text
              style={[
                styles.restValue,
                restActive &&
                  styles.restValueActive,
                restComplete &&
                  styles.restValueComplete,
              ]}
            >
              {restTime}
            </Text>

            {restComplete ? (
              <Text style={styles.nextSetText}>
                Rest complete — next set
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.label}>
            VOLUME
          </Text>

          <Text style={styles.value}>
            {Math.round(volume).toLocaleString()}
          </Text>

          <Text style={styles.unit}>
            lb
          </Text>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.label}>
            SETS
          </Text>

          <Text style={styles.value}>
            {sets}
          </Text>

          <Text style={styles.unit}>
            completed
          </Text>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.label}>CALORIES</Text>
          <Text style={styles.value}>
            {calories === null ? '—' : calories}
          </Text>
          <Text style={styles.unit}>
            {calories === null ? 'add profile weight' : 'estimated kcal'}
          </Text>
        </View>
      </View>

      <Text style={styles.effortLabel}>WORKOUT EFFORT</Text>
      <View style={styles.effortRow}>
        {(['light', 'moderate', 'vigorous'] as WorkoutIntensity[]).map(
          (option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: intensity === option }}
              style={[
                styles.effortButton,
                intensity === option && styles.effortButtonSelected,
              ]}
              onPress={() => onIntensityChange(option)}
            >
              <Text
                style={[
                  styles.effortText,
                  intensity === option && styles.effortTextSelected,
                ]}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          )
        )}
      </View>
      <Text style={styles.estimateNote}>
        Estimate uses your profile weight, workout time, and effort.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    marginTop: 18,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  statBlock: {
    flex: 1,
  },

  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.lightMuted,
  },

  value: {
    marginTop: 5,
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },

  unit: {
    marginTop: 2,
    fontSize: 11,
    color: colors.muted,
  },

  restSection: {
    marginTop: 14,
  },

  restLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.lightMuted,
  },

  restValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '900',
    color: colors.muted,
  },

  restValueActive: {
    color: colors.text,
  },

  restValueComplete: {
    color: colors.text,
  },

  nextSetText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    lineHeight: 15,
  },

  effortLabel: {
    marginTop: 18,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.lightMuted,
  },

  effortRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  effortButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.soft2,
  },

  effortButtonSelected: {
    backgroundColor: colors.text,
  },

  effortText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },

  effortTextSelected: {
    color: colors.surface,
  },

  estimateNote: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
});
