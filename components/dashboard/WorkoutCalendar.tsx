import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { localDateKey } from '../../utils/date';

type Props = {
  workoutDates: string[];
  onAddWorkout: (date: string) => void;
};

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function WorkoutCalendar({ workoutDates, onAddWorkout }: Props) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => localDateKey());
  const workoutDateSet = useMemo(() => new Set(workoutDates), [workoutDates]);
  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1
  );
  const dateForDay = (day: number) => localDateKey(new Date(month.getFullYear(), month.getMonth(), day));
  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    if (next.getTime() > new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()) return;
    setMonth(next);
    setSelectedDate(localDateKey(next));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>WORKOUT CALENDAR</Text>
          <Text style={styles.title}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        </View>
        <View style={styles.monthActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.monthButton} onPress={() => changeMonth(-1)}>
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.monthButton} onPress={() => changeMonth(1)}>
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.weekRow}>
        {weekdays.map((day, index) => <Text key={index} style={styles.weekday}>{day}</Text>)}
      </View>
      <View style={styles.daysGrid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const date = dateForDay(day);
          const selected = date === selectedDate;
          const future = date > localDateKey();
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={new Date(`${date}T12:00:00`).toLocaleDateString()}
              accessibilityState={{ selected }}
              disabled={future}
              style={[styles.dayCell, selected && styles.selectedDay, future && styles.futureDay]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
              {workoutDateSet.has(date) ? <View style={[styles.workoutDot, selected && styles.selectedWorkoutDot]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable style={styles.addButton} onPress={() => onAddWorkout(selectedDate)}>
        <Text style={styles.addButtonText}>+ Add workout for {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
      </Pressable>
      <Text style={styles.hint}>Days with workouts have a dot.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 18, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.muted },
  title: { marginTop: 3, fontSize: 20, fontWeight: '900', color: colors.text },
  monthActions: { flexDirection: 'row', gap: 7 },
  monthButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.soft2, alignItems: 'center', justifyContent: 'center' },
  monthButtonText: { fontSize: 25, lineHeight: 28, fontWeight: '700', color: colors.text },
  weekRow: { flexDirection: 'row', marginTop: 16 },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '900', color: colors.lightMuted },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  dayCell: { width: '14.2857%', height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  selectedDay: { backgroundColor: colors.text },
  futureDay: { opacity: 0.3 },
  dayText: { fontSize: 13, fontWeight: '800', color: colors.text },
  selectedDayText: { color: colors.surface },
  workoutDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#B91C1C', marginTop: 2 },
  selectedWorkoutDot: { backgroundColor: colors.surface },
  addButton: { marginTop: 14, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.text },
  addButtonText: { color: colors.surface, fontWeight: '900' },
  hint: { marginTop: 9, textAlign: 'center', color: colors.lightMuted, fontSize: 11 },
});
