import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { loadWorkoutPhotos, WorkoutPhoto } from '../../services/workout-photo-storage';
import { workoutPhotoUri } from '../../services/workout-photo-files';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';

type DatedPhoto = WorkoutPhoto & { workoutDate: string };

export default function ProgressPhotoGallery({ history, revision }: { history: WorkoutHistoryEntry[]; revision: number }) {
  const [photos, setPhotos] = useState<DatedPhoto[]>([]);
  const [loadedSource, setLoadedSource] = useState<{ history: WorkoutHistoryEntry[]; revision: number } | null>(null);
  const loading = loadedSource?.history !== history || loadedSource?.revision !== revision;
  const [error, setError] = useState('');
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const list = useRef<FlatList<DatedPhoto>>(null);

  useEffect(() => {
    let active = true;
    void Promise.all(history.map(async (workout) =>
      (await loadWorkoutPhotos(workout.profileId, workout.id)).map(photo => ({ ...photo, workoutDate: workout.date }))
    )).then(groups => {
      if (!active) return;
      setError('');
      setPhotos(groups.flat().sort((a, b) => a.workoutDate.localeCompare(b.workoutDate) || a.createdAt.localeCompare(b.createdAt)));
      setIndex(0);
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }).catch(() => { if (active) setError('Photos could not be loaded. Reopen Progress to retry.'); })
      .finally(() => { if (active) setLoadedSource({ history, revision }); });
    return () => { active = false; };
  }, [history, revision]);

  useEffect(() => {
    if (!playing || loading || photos.length < 2 || width <= 0) return;
    const timer = setInterval(() => {
      setIndex(current => {
        const next = (current + 1) % photos.length;
        list.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [playing, loading, photos.length, width]);

  const move = (next: number) => {
    if (next < 0 || next >= photos.length) return;
    setIndex(next);
    list.current?.scrollToOffset({ offset: next * width, animated: true });
  };

  return <View style={styles.card}>
    <Text style={styles.title}>Compare progress photos</Text>
    <Text style={styles.hint}>Swipe between workout photos, or play them as a slideshow from oldest to newest.</Text>
    {loading ? <ActivityIndicator style={styles.loading} /> : error ? <Text accessibilityRole="alert" style={styles.hint}>{error}</Text> : photos.length === 0 ? <Text style={styles.hint}>Open a workout below and add photos to start comparing.</Text> : null}
    <View onLayout={event => {
      const nextWidth = event.nativeEvent.layout.width;
      if (nextWidth !== width) { setWidth(nextWidth); setIndex(0); }
    }}>
      {!loading && !error && width > 0 && photos.length > 0 && <>
        <FlatList
          key={width}
          ref={list}
          data={photos}
          keyExtractor={photo => `${photo.workoutId}:${photo.id}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialNumToRender={2}
          windowSize={3}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
          renderItem={({ item }) => <View style={{ width }}>
            <Image source={{ uri: workoutPhotoUri(item.location) }} resizeMode="contain" accessibilityLabel={`Progress photo for workout on ${new Date(item.workoutDate).toLocaleDateString()}`} style={[styles.photo, { height: Math.min(width * 1.25, 480) }]} />
            <Text style={styles.date}>Workout: {new Date(item.workoutDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          </View>}
        />
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" disabled={index === 0} onPress={() => move(index - 1)} style={[styles.button, index === 0 && styles.disabled]}><Text style={styles.buttonText}>‹ Previous</Text></Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.count}>{index + 1} / {photos.length}</Text>
          <Pressable accessibilityRole="button" disabled={index === photos.length - 1} onPress={() => move(index + 1)} style={[styles.button, index === photos.length - 1 && styles.disabled]}><Text style={styles.buttonText}>Next ›</Text></Pressable>
        </View>
        {photos.length > 1 && <Pressable accessibilityRole="button" onPress={() => setPlaying(value => !value)} style={styles.playButton}>
          <Text style={styles.playButtonText}>{playing ? 'Pause slideshow' : 'Play slideshow'}</Text>
        </Pressable>}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 20, backgroundColor: colors.surface, marginBottom: 22 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 6 },
  loading: { marginVertical: 16 },
  photo: { width: '100%', backgroundColor: colors.soft2, borderRadius: 12, marginTop: 14 },
  date: { color: colors.text, fontWeight: '800', fontSize: 13, marginTop: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.soft2, borderRadius: 10 },
  buttonText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.35 },
  count: { color: colors.muted, fontSize: 12 },
  playButton: { minHeight: 44, marginTop: 10, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  playButtonText: { color: colors.surface, fontWeight: '900' },
});
