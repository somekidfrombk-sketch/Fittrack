import { useLocalDate } from '../../hooks/use-local-date';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { useAppleHealth } from '../../hooks/use-apple-health';
import { useDailySteps } from '../../hooks/use-daily-steps';
import { loadPhonePedometerEnabled } from '../../services/health-connection-storage';
import { loadFoodLogs } from '../../services/food-log-storage';
import { loadProfile } from '../../services/profile-storage';
import { loadRunHistory } from '../../services/run-storage';
import { loadWorkoutHistory } from '../../services/workout-history-storage';
import { loadVitamins } from '../../services/vitamin-storage';
import { FoodLogEntry } from '../../types/foodLog';
import { ProfileData } from '../../types/profile';
import { RunEntry } from '../../types/run';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { VitaminEntry } from '../../types/vitamin';
import { localDateKey } from '../../utils/date';
import { estimateStepCalories } from '../../utils/step-calories';
import MetricCard from './MetricCard';
import WorkoutCalendar from './WorkoutCalendar';

export default function DashboardScreen() {
  const [profile, setProfile] = useState<Partial<ProfileData> | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [vitamins, setVitamins] = useState<VitaminEntry[]>([]);
  const [phoneStepsEnabled, setPhoneStepsEnabled] = useState(false);
  const {
    status: appleHealthStatus,
    steps: appleHealthSteps,
    heartRate,
    sleep,
    loading: appleHealthLoading,
    initialize: initializeAppleHealth,
    connect: connectAppleHealth,
    refresh: refreshAppleHealth,
  } = useAppleHealth();
  const useAppleHealthSteps = appleHealthStatus === 'connected' && appleHealthSteps !== null;
  const { steps: phoneSteps, status: stepStatus } = useDailySteps(
    profile?.id ?? '',
    phoneStepsEnabled && !useAppleHealthSteps
  );
  const steps = useAppleHealthSteps ? appleHealthSteps : phoneSteps;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadDashboard = async () => {
        try {
          const savedProfile = await loadProfile();
          const profileId = savedProfile?.id;
          const [savedFood, savedWorkouts, savedRuns, savedVitamins, pedometerEnabled] = profileId
            ? await Promise.all([
                loadFoodLogs(profileId),
                loadWorkoutHistory(profileId),
                loadRunHistory(profileId),
                loadVitamins(profileId),
                loadPhonePedometerEnabled(),
              ])
            : [[], [], [], [], false];

          if (active) {
            setProfile(savedProfile);
            setFoodLogs(savedFood);
            setWorkouts(savedWorkouts);
            setRuns(savedRuns);
            setVitamins(savedVitamins);
            setPhoneStepsEnabled(pedometerEnabled);
          }
        } catch (error) {
          console.error('Failed to load dashboard:', error);
        }
      };

      void loadDashboard();
      void initializeAppleHealth();
      return () => {
        active = false;
      };
    }, [initializeAppleHealth])
  );

  const today = useLocalDate();
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
        .filter((entry) => localDateKey(new Date(entry.date)) === today)
        .reduce((total, entry) => total + (entry.caloriesBurned ?? 0), 0),
    [workouts, today]
  );
  const todayRuns = useMemo(
    () => runs.filter((entry) => localDateKey(new Date(entry.completedAt)) === today),
    [runs, today]
  );
  const runCalories = todayRuns
    .filter((entry) => entry.activityType !== 'cycling')
    .reduce((total, entry) => total + entry.caloriesBurned, 0);
  const cyclingCalories = todayRuns
    .filter((entry) => entry.activityType === 'cycling')
    .reduce((total, entry) => total + entry.caloriesBurned, 0);
  const activityDistanceMeters = todayRuns.reduce(
    (total, entry) => total + entry.distanceMeters,
    0
  );
  const runDistanceMeters = todayRuns
    .filter((entry) => entry.activityType !== 'cycling')
    .reduce((total, entry) => total + entry.distanceMeters, 0);

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
  const weightKg = weightLb * 0.45359237;
  const runWalkingBaseline = Math.round(
    weightKg * (runDistanceMeters / 1000) * 0.5
  );
  const hasActiveStepSource = useAppleHealthSteps || stepStatus === 'active';
  const runCalorieAdjustment = hasActiveStepSource
    ? Math.max(0, runCalories - runWalkingBaseline)
    : runCalories;
  const caloriesBurned = workoutCalories + stepCalories + runCalorieAdjustment + cyclingCalories;
  const netCalories = caloriesEaten - caloriesBurned;
  const calorieTarget = Number(profile?.calorieTarget) || 0;
  const proteinTarget = Number(profile?.proteinTarget) || 0;
  const vitaminsTaken = vitamins.filter((item) => item.takenDates.includes(today)).length;
  const vitaminsDue = Math.max(0, vitamins.length - vitaminsTaken);

  const stepNote = useAppleHealthSteps
    ? 'Apple Health total'
    : !phoneStepsEnabled
      ? 'Connect Apple Health or enable steps in Settings'
      : stepStatus === 'active'
        ? 'Device pedometer'
        : stepStatus === 'denied'
          ? 'Motion access denied'
          : stepStatus === 'checking'
            ? 'Checking device…'
            : 'Pedometer unavailable';

  const sleepMinutes = sleep.latestSleepDurationMinutes;
  const sleepLabel = sleepMinutes === null
    ? 'No sleep data'
    : `${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m`;
  const heartRateTime = heartRate
    ? new Date(heartRate.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  const appleHealthStatusLabel =
    appleHealthStatus === 'connected'
      ? 'Connected'
      : appleHealthStatus === 'not-requested'
        ? 'Not connected'
        : appleHealthStatus === 'checking'
          ? 'Checking…'
          : appleHealthStatus === 'unavailable'
            ? 'Unavailable on this device'
            : 'Could not connect';

  const openProfile = () => {
    router.push('/profile');
  };

  const openSettings = () => {
    router.push('/settings');
  };

  const openRun = () => {
    router.push('/run');
  };

  const openVitamins = () => {
    router.push('/vitamins');
  };

  const addWorkoutForDate = (date: string) => {
    router.push({ pathname: '/(tabs)/workout', params: { date, requestId: String(Date.now()) } });
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

      <WorkoutCalendar
        workoutDates={workouts.map((workout) => localDateKey(new Date(workout.date)))}
        onAddWorkout={addWorkoutForDate}
      />

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

      <Pressable style={styles.runCard} onPress={openRun}>
        <View>
          <Text style={styles.runLabel}>RUNNING & CYCLING</Text>
          <Text style={styles.runTitle}>Start an Activity</Text>
          <Text style={styles.runNote}>Indoor or outdoor distance, time, heart rate, and calories</Text>
        </View>
        <Text style={styles.runArrow}>›</Text>
      </Pressable>

      <Pressable style={styles.vitaminCard} onPress={openVitamins}>
        <View style={styles.vitaminIcon}><Text style={styles.vitaminEmoji}>💊</Text></View>
        <View style={styles.vitaminContent}>
          <Text style={styles.vitaminLabel}>DAILY VITAMINS</Text>
          <Text style={styles.vitaminTitle}>
            {vitamins.length === 0 ? 'Set vitamin reminders' : vitaminsDue > 0 ? `${vitaminsDue} due today` : 'All taken today'}
          </Text>
          <Text style={styles.vitaminNote}>
            {vitamins.length === 0 ? 'Add timing and food guidance' : `${vitaminsTaken} of ${vitamins.length} completed`}
          </Text>
        </View>
        <Text style={styles.vitaminArrow}>›</Text>
      </Pressable>

      {Platform.OS === 'ios' ? (
        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <View style={styles.healthTitleGroup}>
              <Text style={styles.healthEyebrow}>APPLE HEALTH</Text>
              <Text style={styles.healthTitle}>{appleHealthStatusLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={appleHealthLoading || appleHealthStatus === 'unavailable'}
              onPress={() => void (appleHealthStatus === 'connected' ? refreshAppleHealth() : connectAppleHealth())}
              style={[styles.healthButton, appleHealthLoading && styles.healthButtonDisabled]}
            >
              <Text style={styles.healthButtonText}>
                {appleHealthLoading ? 'Loading…' : appleHealthStatus === 'connected' ? 'Refresh' : 'Connect Apple Health'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.healthMetrics}>
            <View style={styles.healthMetric}>
              <Text style={styles.healthMetricLabel}>STEPS</Text>
              <Text style={styles.healthMetricValue}>{appleHealthSteps?.toLocaleString() ?? '—'}</Text>
            </View>
            <View style={styles.healthMetric}>
              <Text style={styles.healthMetricLabel}>LATEST HEART RATE</Text>
              <Text style={styles.healthMetricValue}>{heartRate ? `${heartRate.beatsPerMinute} bpm` : '—'}</Text>
              {heartRateTime ? <Text style={styles.healthMetricNote}>{heartRateTime}</Text> : null}
            </View>
            <View style={styles.healthMetric}>
              <Text style={styles.healthMetricLabel}>LAST SLEEP</Text>
              <Text style={styles.healthMetricValue}>{sleepLabel}</Text>
            </View>
          </View>
          {appleHealthStatus === 'connected' &&
          (appleHealthSteps === null || heartRate === null || sleepMinutes === null) ? (
            <Text style={styles.healthPermissionNote}>
              Missing a metric? Apple keeps read denials private. Enable Steps, Heart Rate, and Sleep for FitTrack in iPhone Settings or the Health app.
            </Text>
          ) : null}
        </View>
      ) : null}

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
          label="Run + Cycle"
          value={`${(activityDistanceMeters / 1609.344).toFixed(2)} mi`}
          note={`${(runCalories + cyclingCalories).toLocaleString()} kcal today`}
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
          FitTrack uses one step source at a time. Apple Health totals take priority
          over the phone pedometer, and GPS running calories replace the walking portion
          already represented by steps. Cycling and strength workouts remain separate.
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

  healthCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 14 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  healthTitleGroup: { flex: 1 },
  healthEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.muted },
  healthTitle: { marginTop: 3, fontSize: 19, fontWeight: '900', color: colors.text },
  healthButton: { backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  healthButtonDisabled: { opacity: 0.55 },
  healthButtonText: { color: colors.surface, fontSize: 12, fontWeight: '900' },
  healthMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  healthMetric: { flexGrow: 1, minWidth: 95, backgroundColor: colors.soft, borderRadius: 14, padding: 12 },
  healthMetricLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: colors.muted },
  healthMetricValue: { marginTop: 5, fontSize: 17, fontWeight: '900', color: colors.text },
  healthMetricNote: { marginTop: 2, fontSize: 10, color: colors.muted },
  healthPermissionNote: { marginTop: 13, fontSize: 12, lineHeight: 17, color: colors.muted },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  runCard: {
    backgroundColor: colors.text,
    borderRadius: 20,
    padding: 19,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  runLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, color: colors.lightMuted },
  runTitle: { marginTop: 4, fontSize: 21, fontWeight: '900', color: colors.surface },
  runNote: { marginTop: 4, fontSize: 11, color: colors.lightMuted },
  runArrow: { fontSize: 38, color: colors.surface },

  vitaminCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  vitaminIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  vitaminEmoji: { fontSize: 24 },
  vitaminContent: { flex: 1, paddingHorizontal: 13 },
  vitaminLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.muted },
  vitaminTitle: { marginTop: 3, fontSize: 18, fontWeight: '900', color: colors.text },
  vitaminNote: { marginTop: 3, fontSize: 11, color: colors.muted },
  vitaminArrow: { fontSize: 34, color: colors.text },

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
