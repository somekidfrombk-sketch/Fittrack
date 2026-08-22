import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { WorkoutPlan } from '../../types/workoutPlan';

import TodayWorkoutCard from './TodayWorkoutCard';
import WorkoutBuilder from './WorkoutBuilder';
import WorkoutPlanCard from './WorkoutPlanCard';

type Props = {
  plans: WorkoutPlan[];
  onPlansChange: (plans: WorkoutPlan[]) => void;
  onStartPlan: (plan: WorkoutPlan) => void;
};

const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function WorkoutPlanner({
  plans,
  onPlansChange,
  onStartPlan,
}: Props) {
  const [buildingWorkout, setBuildingWorkout] =
    useState(false);

  const today =
    weekdays[new Date().getDay()];

  const todaysPlans = useMemo(
    () =>
      plans.filter((plan) =>
        plan.days.includes(today as any)
      ),
    [plans, today]
  );

  const saveNewPlan = (
    plan: WorkoutPlan
  ) => {
    onPlansChange([
      ...plans,
      plan,
    ]);

    setBuildingWorkout(false);
  };

  const deletePlan = (
    planId: string
  ) => {
    onPlansChange(
      plans.filter(
        (plan) => plan.id !== planId
      )
    );
  };

  if (buildingWorkout) {
    return (
      <WorkoutBuilder
        onSave={saveNewPlan}
        onCancel={() =>
          setBuildingWorkout(false)
        }
      />
    );
  }

  return (
    <View>
      <TodayWorkoutCard
        today={today}
        plans={todaysPlans}
        onStartPlan={onStartPlan}
      />

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            Your Workout Plans
          </Text>

          <Text style={styles.sectionSubtitle}>
            {plans.length === 0
              ? 'Build your first workout routine.'
              : `${plans.length} saved workout${
                  plans.length === 1
                    ? ''
                    : 's'
                }`}
          </Text>
        </View>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No workout plans yet
          </Text>

          <Text style={styles.emptyText}>
            Create a workout, choose the
            days you want to train, and
            add exercises from the
            exercise library.
          </Text>
        </View>
      ) : (
        plans.map((plan) => (
          <WorkoutPlanCard
            key={plan.id}
            plan={plan}
            onStart={() =>
              onStartPlan(plan)
            }
            onDelete={() =>
              deletePlan(plan.id)
            }
          />
        ))
      )}

      <Pressable
        style={styles.createButton}
        onPress={() =>
          setBuildingWorkout(true)
        }
      >
        <Text
          style={styles.createButtonIcon}
        >
          +
        </Text>

        <View style={{ flex: 1 }}>
          <Text
            style={styles.createButtonTitle}
          >
            Create Workout
          </Text>

          <Text
            style={styles.createButtonSubtitle}
          >
            Build a routine and assign it
            to your training days
          </Text>
        </View>

        <Text
          style={styles.createButtonArrow}
        >
          ›
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
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

  createButton: {
    backgroundColor: colors.text,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 30,
  },

  createButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      'rgba(255,255,255,0.14)',
    color: colors.surface,
    textAlign: 'center',
    lineHeight: 40,
    fontSize: 27,
    fontWeight: '500',
  },

  createButtonTitle: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '900',
  },

  createButtonSubtitle: {
    color:
      'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  createButtonArrow: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '400',
  },
});
