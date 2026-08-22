import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { useDailySteps } from '../../hooks/use-daily-steps';
import { loadPhonePedometerEnabled } from '../../services/health-connection-storage';
import { loadFoodLogs } from '../../services/food-log-storage';
import { loadProfile } from '../../services/profile-storage';
import { loadWorkoutHistory } from '../../services/workout-history-storage';
import { FoodLogEntry } from '../../types/foodLog';
import { ProfileData } from '../../types/profile';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { isToday, localDateKey } from '../../utils/date';
import { estimateStepCalories } from '../../utils/step-calories';
import MetricCard from './MetricCard';

export default function DashboardScreen() {
  const [profile, setProfile] = useState<Partial<ProfileData> | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [phoneStepsEnabled, setPhoneStepsEnabled] = useState(false);
  const { steps, status: stepStatus } = useDailySteps(
    profile?.id ?? '',
    phoneStepsEnabled
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadDashboard = async () => {
        try {
          const savedProfile = await loadProfile();
          const profileId = savedProfile?.id;
          const [savedFood, savedWorkouts, pedometerEnabled] = profileId
            ? await Promise.all([
                loadFoodLogs(profileId),
                loadWorkoutHistory(profileId),
                loadPhonePedometerEnabled(),
              ])
            : [[], [], false];

          if (active) {
            setProfile(savedProfile);
            setFoodLogs(savedFood);
            setWorkouts(savedWorkouts);
            setPhoneStepsEnabled(pedometerEnabled);
          }
        } catch (error) {
          console.error('Failed to load dashboard:', error);
        }
      };

      void loadDashboard();
      return () => {
        active = false;
      };
    }, [])
  );

  const today = localDateKey();
  const caloriesEaten = useMemo(
    () =>
      Math.round(
        foodLogs
          .filter((entry) => entry.date === today)
          .reduce((total, entry) => total + entry.calories, 0)
      ),
    [foodLogs, today]
  );
  const proteinEaten = useMemo(
    () =>
      Math.round(
        foodLogs
          .filter((entry) => entry.date === today)
          .reduce((total, entry) => total + entry.protein, 0)
      ),
    [foodLogs, today]
  );
  const workoutCalories = useMemo(
    () =>
      workouts
        .filter((entry) => isToday(entry.date))
        .reduce((total, entry) => total + (entry.caloriesBurned ?? 0), 0),
    [workouts]
  );

  const weightLb = Number(profile?.weight) || 0;
  const heightInches =
    (Number(profile?.heightFeet) || 0) * 12 +
    (Number(profile?.heightInches) || 0);
  const stepCalories = estimateStepCalories({
    steps,
    weightLb,
    heightInches,
    gender: profile?.gender ?? 'male',
  });
  const caloriesBurned = workoutCalories + stepCalories;
  const netCalories = caloriesEaten - caloriesBurned;
  const calorieTarget = Number(profile?.calorieTarget) || 0;
  const proteinTarget = Number(profile?.proteinTarget) || 0;

  const stepNote =
    !phoneStepsEnabled
      ? 'Connect in Settings'
      : stepStatus === 'active'
      ? 'Device pedometer'
      : stepStatus === 'denied'
        ? 'Motion access denied'
        : stepStatus === 'checking'
          ? 'Checking device…'
          : 'Pedometer unavailable';

  const openProfile = () => {
    router.push('/profile');
  };

  const openSettings = () => {
    router.push('/settings');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* TOP HEADER */}

      <View style={styles.topHeader}>
        {/* PROFILE */}

        <Pressable
          style={styles.iconButton}
          onPress={openProfile}
        >
          <Text style={styles.icon}>
            👤
          </Text>
        </Pressable>

        {/* CENTER TITLE */}

        <View style={styles.centerHeader}>
          <Text style={styles.brand}>
            FITTRACK
          </Text>

          <Text style={styles.title}>
            Dashboard
          </Text>
        </View>

        {/* SETTINGS */}

        <Pressable
          style={styles.iconButton}
          onPress={openSettings}
        >
          <Text style={styles.icon}>
            ⚙️
          </Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Today
      </Text>

      {/* CALORIES */}

      <View style={styles.heroCard}>
        <Text style={styles.label}>
          Net calories today
        </Text>

        <Text style={styles.heroValue}>
          {netCalories.toLocaleString()}
        </Text>

        <Text style={styles.note}>
          {caloriesEaten.toLocaleString()} eaten −{' '}
          {caloriesBurned.toLocaleString()} active calories burned
        </Text>
        <Text style={styles.targetNote}>
          {calorieTarget > 0
            ? `${calorieTarget.toLocaleString()} kcal food target`
            : 'Save your calorie target in Profile'}
        </Text>
      </View>

      {/* METRICS */}

      <View style={styles.grid}>
        <MetricCard
          label="Protein"
          value={`${proteinEaten.toLocaleString()} g`}
          note={proteinTarget > 0 ? `${proteinTarget} g goal` : 'Add profile goal'}
        />

        <MetricCard
          label="Calories eaten"
          value={`${caloriesEaten.toLocaleString()} kcal`}
          note="Food logged today"
        />

        <MetricCard
          label="Workout burn"
          value={`${workoutCalories.toLocaleString()} kcal`}
          note="Completed workouts"
        />

        <MetricCard
          label="Step burn"
          value={`${stepCalories.toLocaleString()} kcal`}
          note="Height + weight estimate"
        />

        <MetricCard
          label="Steps"
          value={steps.toLocaleString()}
          note={stepNote}
        />

        <MetricCard
          label="Total active burn"
          value={`${caloriesBurned.toLocaleString()} kcal`}
          note="Workout + steps"
        />
      </View>

      {/* HEALTH DATA RULE */}

      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>
          No double counting
        </Text>

        <Text style={styles.ruleText}>
          FitTrack calculates workout and step calories separately. It does
          not add another calorie total from the phone, preventing duplicate
          active calories.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 110,
    backgroundColor: colors.background,
  },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  centerHeader: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    fontSize: 26,
  },

  brand: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.muted,
    textAlign: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    marginTop: 3,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 18,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 18,
    textAlign: 'center',
  },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },

  heroValue: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.text,
    marginTop: 4,
  },

  note: {
    fontSize: 12,
    color: colors.lightMuted,
    marginTop: 4,
  },

  targetNote: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 10,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  ruleCard: {
    backgroundColor: colors.soft,
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
  },

  ruleTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },

  ruleText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
});
