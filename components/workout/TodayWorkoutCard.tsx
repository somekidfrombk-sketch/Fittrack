import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutPlan } from '../../types/workoutPlan';

type Props = {
  today: string;
  plans: WorkoutPlan[];
  onStartPlan: (plan: WorkoutPlan) => void;
};

export default function TodayWorkoutCard({
  today,
  plans,
  onStartPlan,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>
        TODAY
      </Text>

      <Text style={styles.day}>
        {today}
      </Text>

      {plans.length === 0 ? (
        <Text style={styles.emptyText}>
          No workout planned for today.
        </Text>
      ) : (
        plans.map((plan) => (
          <View
            key={plan.id}
            style={styles.planRow}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planName}>
                {plan.name}
              </Text>

              <Text style={styles.planMeta}>
                {plan.exercises.length}{' '}
                exercise
                {plan.exercises.length === 1
                  ? ''
                  : 's'}
              </Text>
            </View>

            <Pressable
              style={styles.startButton}
              onPress={() =>
                onStartPlan(plan)
              }
            >
              <Text
                style={styles.startButtonText}
              >
                Start
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.lightMuted,
  },

  day: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
    marginBottom: 12,
  },

  emptyText: {
    color: colors.muted,
    lineHeight: 20,
  },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.soft2,
  },

  planInfo: {
    flex: 1,
  },

  planName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },

  planMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },

  startButton: {
    backgroundColor: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },

  startButtonText: {
    color: colors.surface,
    fontWeight: '900',
  },
});
