import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { getOrCreateProfileId } from '../../services/profile-storage';
import { loadWorkoutHistory } from '../../services/workout-history-storage';
import { loadRunHistory } from '../../services/run-storage';
import { RunEntry } from '../../types/run';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';
import { localDateKey } from '../../utils/date';
import { calculateProgressCalorieAverages } from '../../utils/progress-calories';
import WorkoutPhotos from './WorkoutPhotos';

export default function WorkoutProgressScreen() {
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [activities, setActivities] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    void (async () => {
      const profileId = await getOrCreateProfileId();
      const [saved, savedActivities] = await Promise.all([
        loadWorkoutHistory(profileId),
        loadRunHistory(profileId),
      ]);
      if (active) {
        setHistory(saved.sort((a, b) => b.date.localeCompare(a.date)));
        setActivities(savedActivities);
      }
    })().catch(() => {
      if (active) setError('Unable to load workout history. Please reopen Progress to try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const days = useMemo(() => {
    const grouped = new Map<string, WorkoutHistoryEntry[]>();
    for (const entry of history) {
      const key = localDateKey(new Date(entry.date));
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    return [...grouped].map(([date, workouts]) => ({ date, workouts }));
  }, [history]);

  const calorieAverages = useMemo(
    () => calculateProgressCalorieAverages([
      ...history,
      ...activities.map((entry) => ({
        date: entry.completedAt,
        caloriesBurned: entry.caloriesBurned,
      })),
    ]),
    [activities, history]
  );

  return <FlatList
    style={styles.screen}
    contentContainerStyle={styles.container}
    data={days}
    keyExtractor={(day) => day.date}
    initialNumToRender={3}
    maxToRenderPerBatch={3}
    windowSize={5}
    ListHeaderComponent={<View>
      <Text style={styles.brand}>FITTRACK</Text>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>Your workouts, lifting results, and photos</Text>
      <View style={styles.dashboard}>
        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardLabel}>THIS WEEK</Text>
          <Text style={styles.dashboardValue}>{calorieAverages.week.average?.toLocaleString() ?? '—'}</Text>
          <Text style={styles.dashboardUnit}>avg kcal per activity</Text>
          <Text style={styles.dashboardCount}>{calorieAverages.week.workoutCount} tracked activit{calorieAverages.week.workoutCount === 1 ? 'y' : 'ies'}</Text>
        </View>
        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardLabel}>THIS MONTH</Text>
          <Text style={styles.dashboardValue}>{calorieAverages.month.average?.toLocaleString() ?? '—'}</Text>
          <Text style={styles.dashboardUnit}>avg kcal per activity</Text>
          <Text style={styles.dashboardCount}>{calorieAverages.month.workoutCount} tracked activit{calorieAverages.month.workoutCount === 1 ? 'y' : 'ies'}</Text>
        </View>
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>}
    ListEmptyComponent={loading ? <ActivityIndicator /> : !error ? <View style={styles.card}><Text style={styles.body}>Finish your first workout to see your lifting results and add progress photos here.</Text></View> : null}
    renderItem={({ item: day }) => <View>
      <Text style={styles.date}>{new Date(day.workouts[0].date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      <Text style={styles.dayTotal}>{Math.round(day.workouts.reduce((sum, entry) => sum + entry.totalVolume, 0)).toLocaleString()} lb total volume that day</Text>
      {day.workouts.map((entry) => <View key={entry.id} style={styles.card}>
        <Text style={styles.workoutTitle}>Workout · {new Date(entry.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.body}>{Math.round(entry.durationSeconds / 60)} min · {entry.completedSets} completed sets</Text>
        <Text style={styles.volume}>{Math.round(entry.totalVolume).toLocaleString()} lb lifted</Text>
        <Text style={styles.caption}>Total volume = weight × reps across completed sets</Text>
        {entry.weightLbAtWorkout !== undefined && <Text style={styles.body}>Body weight: {entry.weightLbAtWorkout} lb</Text>}
        {entry.caloriesBurned !== undefined && <Text style={styles.body}>Estimated exercise calories: {entry.caloriesBurned} kcal</Text>}
        {entry.exercises.map((exercise) => <View key={exercise.id} style={styles.exercise}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {exercise.sets.map((set, index) => <Text key={set.id} style={[styles.body, !set.completed && styles.incomplete]}>
            Set {index + 1}: {set.weight || '0'} lb × {set.reps || '0'} reps{set.completed ? '' : ' · incomplete'}
          </Text>)}
        </View>)}
        <WorkoutPhotos profileId={entry.profileId} workoutId={entry.id} />
      </View>)}
    </View>}
  />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, container: { padding: 20, paddingTop: 60, paddingBottom: 110 },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: colors.muted },
  title: { fontSize: 34, fontWeight: '900', color: colors.text, marginTop: 4 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6, marginBottom: 22 },
  dashboard: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dashboardCard: { flex: 1, minHeight: 142, backgroundColor: colors.text, borderRadius: 20, padding: 16 },
  dashboardLabel: { color: colors.lightMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  dashboardValue: { color: colors.surface, fontSize: 34, fontWeight: '900', marginTop: 8 },
  dashboardUnit: { color: colors.surface, fontSize: 11, fontWeight: '700', marginTop: 1 },
  dashboardCount: { color: colors.lightMuted, fontSize: 10, marginTop: 9 },
  date: { fontSize: 19, fontWeight: '800', color: colors.text }, dayTotal: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 20 },
  workoutTitle: { fontSize: 17, fontWeight: '800', color: colors.text }, body: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 20 },
  volume: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 12 }, caption: { fontSize: 11, color: colors.muted, marginTop: 3 },
  exercise: { borderTopWidth: 1, borderTopColor: colors.soft, marginTop: 14, paddingTop: 10 },
  exerciseName: { fontSize: 14, fontWeight: '800', color: colors.text }, incomplete: { opacity: 0.55 }, error: { color: '#B91C1C', marginBottom: 15 },
});
