import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, InputAccessoryView, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../constants/theme';
import RouteMapCard from './RouteMapCard';
import { loadProfile } from '../../services/profile-storage';
import { loadRunNotificationDistance } from '../../services/run-notification-settings';
import { loadRunHistory, saveRun } from '../../services/run-storage';
import { createUserContextSnapshot } from '../../services/user-context-snapshot';
import { ProfileData } from '../../types/profile';
import { RunEntry, RunLap, RunRoutePoint } from '../../types/run';
import {
  distanceBetweenMeters,
  estimateCyclingCalories,
  estimateRunCalories,
  formatDuration,
  formatPace,
  formatSpeedMph,
  paceSecondsPerKilometer,
} from '../../utils/run-metrics';

const MILE_METERS = 1609.344;
const RUN_INPUT_ACCESSORY_ID = 'run-input-accessory';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function prepareMileNotifications() {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('run-miles', {
      name: 'Run mile updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

async function notifyMile(lap: RunLap) {
  if (Platform.OS === 'web') return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const pace = paceSecondsPerKilometer(lap.splitDurationSeconds, lap.splitDistanceMeters);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${lap.label ?? `Mile ${lap.number}`} complete`,
      body: `Split ${formatDuration(lap.splitDurationSeconds)} · ${formatPace(pace)}`,
      sound: true,
    },
    trigger: null,
  });
}

type RunStatus = 'idle' | 'starting' | 'running' | 'paused';
type ActivityType = 'running' | 'cycling';
type RunMode = 'outdoor' | 'treadmill' | 'indoor';

type RunLocation = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};

export default function RunScreen() {
  const [profile, setProfile] = useState<Partial<ProfileData> | null>(null);
  const [history, setHistory] = useState<RunEntry[]>([]);
  const [laps, setLaps] = useState<RunLap[]>([]);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [gpsMessage, setGpsMessage] = useState('Ready for GPS');
  const [recordMessage, setRecordMessage] = useState('');
  const [lapFeedback, setLapFeedback] = useState('');
  const [currentRoute, setCurrentRoute] = useState<RunRoutePoint[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [modePromptVisible, setModePromptVisible] = useState(false);
  const [runMode, setRunMode] = useState<RunMode>('outdoor');
  const [activityType, setActivityType] = useState<ActivityType>('running');
  const [treadmillDistanceInput, setTreadmillDistanceInput] = useState('');
  const [treadmillTimeInput, setTreadmillTimeInput] = useState('');
  const [heartRateInput, setHeartRateInput] = useState('');
  const gpsGeneration = useRef(0);
  const savingRun = useRef(false);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const previousLocationRef = useRef<RunLocation | null>(null);
  const webWatcherRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const elapsedBeforeSegmentRef = useRef(0);
  const segmentStartedAtRef = useRef<number | null>(null);
  const runStartedAtRef = useRef<string | null>(null);
  const lapsRef = useRef<RunLap[]>([]);
  const routeRef = useRef<RunRoutePoint[]>([]);
  const routeSegmentRef = useRef(0);
  const notificationIntervalMilesRef = useRef<number | null>(1);
  const nextNotificationDistanceRef = useRef(MILE_METERS);
  const bestLapPaceRef = useRef<number | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lapFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopGpsUpdates = () => {
    gpsGeneration.current += 1;
    if (Platform.OS === 'web') {
      if (webWatcherRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(webWatcherRef.current);
        webWatcherRef.current = null;
      }
    } else {
      watcherRef.current?.remove();
      watcherRef.current = null;
    }
    previousLocationRef.current = null;
  };
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const savedProfile = await loadProfile();
        const savedHistory = savedProfile?.id ? await loadRunHistory(savedProfile.id) : [];
        if (active) {
          const savedLapPaces = savedHistory
            .flatMap((run) => run.laps ?? [])
            .map((lap) => paceSecondsPerKilometer(
              lap.splitDurationSeconds,
              lap.splitDistanceMeters
            ))
            .filter((pace): pace is number => pace !== null);
          bestLapPaceRef.current = savedLapPaces.length > 0
            ? Math.min(...savedLapPaces)
            : null;
          setProfile(savedProfile);
          setHistory(savedHistory);
        }
      };
      void load().catch((error) => {
        console.error('Failed to load activities:', error);
        if (active) Alert.alert('Unable to load activities', 'Please try again.');
      });
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => {
      const segmentStart = segmentStartedAtRef.current;
      if (segmentStart) {
        setElapsedSeconds(
          elapsedBeforeSegmentRef.current + Math.floor((Date.now() - segmentStart) / 1000)
        );
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => () => {
    stopGpsUpdates();
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    if (lapFeedbackTimerRef.current) clearTimeout(lapFeedbackTimerRef.current);
  }, []);

  const currentElapsedSeconds = () => {
    const segmentStart = segmentStartedAtRef.current;
    return elapsedBeforeSegmentRef.current +
      (segmentStart ? Math.floor((Date.now() - segmentStart) / 1000) : 0);
  };

  const recordLap = (
    kind: RunLap['kind'],
    cumulativeDistance = distanceRef.current,
    cumulativeElapsed = currentElapsedSeconds(),
    label?: string
  ) => {
    const sameKindLaps = lapsRef.current.filter((lap) => lap.kind === kind);
    const previousLap = sameKindLaps.at(-1);
    const splitDistance = cumulativeDistance - (previousLap?.distanceMeters ?? 0);
    const splitDuration = cumulativeElapsed - (previousLap?.elapsedSeconds ?? 0);
    if (splitDistance < 2 || splitDuration < 1) return null;

    const lap: RunLap = {
      id: `lap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      number: sameKindLaps.length + 1,
      label,
      elapsedSeconds: cumulativeElapsed,
      distanceMeters: cumulativeDistance,
      splitDurationSeconds: splitDuration,
      splitDistanceMeters: splitDistance,
    };
    lapsRef.current = [...lapsRef.current, lap];
    setLaps(lapsRef.current);

    const lapPace = paceSecondsPerKilometer(splitDuration, splitDistance);
    const previousBest = bestLapPaceRef.current;
    if (lapPace !== null && previousBest !== null && lapPace < previousBest - 0.5) {
      setRecordMessage(`New lap record! ${formatPace(lapPace)}`);
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      recordTimerRef.current = setTimeout(() => setRecordMessage(''), 6000);
      if (kind === 'manual') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    if (lapPace !== null && (previousBest === null || lapPace < previousBest)) {
      bestLapPaceRef.current = lapPace;
    }
    return lap;
  };

  const addManualLap = () => {
    if (status !== 'running') {
      setLapFeedback('Resume the run before recording a lap.');
      return;
    }

    const lap = recordLap('manual');
    const message = lap
      ? `Lap ${lap.number} recorded · ${formatDuration(lap.splitDurationSeconds)} · ${(lap.splitDistanceMeters / MILE_METERS).toFixed(2)} mi`
      : 'Run at least 2 meters for 1 second before recording a lap.';

    setLapFeedback(message);
    if (lapFeedbackTimerRef.current) clearTimeout(lapFeedbackTimerRef.current);
    lapFeedbackTimerRef.current = setTimeout(() => setLapFeedback(''), 5000);

    if (lap) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  };

  const handleLocationUpdate = (location: RunLocation) => {
    const accuracy = location.coords.accuracy ?? 999;
    if (accuracy > 35) {
      setGpsMessage(`Finding a stronger GPS signal… ±${Math.round(accuracy)} m`);
      return;
    }

    const previous = previousLocationRef.current;
    let acceptedForRoute = previous === null && routeRef.current.length === 0;
    if (previous) {
      const segmentDistance = distanceBetweenMeters(previous.coords, location.coords);
      const seconds = Math.max(1, (location.timestamp - previous.timestamp) / 1000);
      const speedMetersPerSecond = segmentDistance / seconds;
      if (segmentDistance >= 2 && speedMetersPerSecond <= 25) {
        distanceRef.current += segmentDistance;
        setDistanceMeters(distanceRef.current);
        acceptedForRoute = true;
        const intervalMiles = notificationIntervalMilesRef.current;
        while (
          intervalMiles !== null &&
          distanceRef.current >= nextNotificationDistanceRef.current
        ) {
          const completedDistanceMiles = nextNotificationDistanceRef.current / MILE_METERS;
          const distanceLabel = `${Number(completedDistanceMiles.toFixed(2))} mi`;
          const distanceLap = recordLap(
            'mile',
            nextNotificationDistanceRef.current,
            currentElapsedSeconds(),
            distanceLabel
          );
          nextNotificationDistanceRef.current += intervalMiles * MILE_METERS;
          if (distanceLap) {
            void notifyMile(distanceLap).catch((error) =>
              console.warn('Distance notification failed:', error)
            );
          }
        }
      }
    }
    if (acceptedForRoute) {
      routeRef.current = [...routeRef.current, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        distanceMeters: distanceRef.current,
        segment: routeSegmentRef.current,
      }];
      setCurrentRoute(routeRef.current);
    }
    previousLocationRef.current = location;
    setGpsMessage(`GPS locked · ±${Math.round(accuracy)} m`);
  };

  const beginGpsUpdates = async () => {
    stopGpsUpdates();
    const generation = gpsGeneration.current;

    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new Error('Location is unavailable in this browser.');
      }
      webWatcherRef.current = navigator.geolocation.watchPosition(
        (position) => handleLocationUpdate({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          timestamp: position.timestamp,
        }),
        () => setGpsMessage('Browser location access was denied or unavailable.'),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
      return;
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      throw new Error('Turn on Location Services before starting a run.');
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new Error('FitTrack needs location permission to track a run.');
    }

    if (generation !== gpsGeneration.current) throw new Error('Activity was cancelled.');
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 2000,
      },
      (location) => {
        if (generation === gpsGeneration.current) handleLocationUpdate(location);
      }
    );
    if (generation !== gpsGeneration.current) {
      subscription.remove();
      throw new Error('Activity was cancelled.');
    }
    watcherRef.current = subscription;
  };
  const cleanDecimalInput = (value: string) =>
    value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

  const updateTreadmillDistance = (value: string) => {
    const cleaned = cleanDecimalInput(value);
    setTreadmillDistanceInput(cleaned);
    const miles = Number(cleaned);
    const meters = Number.isFinite(miles) && miles >= 0 ? miles * MILE_METERS : 0;
    distanceRef.current = meters;
    setDistanceMeters(meters);
  };

  const updateTreadmillTime = (value: string) => {
    const cleaned = cleanDecimalInput(value);
    setTreadmillTimeInput(cleaned);
    if (!cleaned) return;
    const minutes = Number(cleaned);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    const seconds = Math.round(minutes * 60);
    elapsedBeforeSegmentRef.current = seconds;
    segmentStartedAtRef.current = status === 'running' ? Date.now() : null;
    setElapsedSeconds(seconds);
  };

  const startRun = async (activity: ActivityType, mode: RunMode) => {
    setModePromptVisible(false);
    if (!profile?.id) {
      Alert.alert('Save Your Profile', 'Save your Profile before starting an activity.');
      return;
    }
    setRunMode(mode);
    setActivityType(activity);
    setStatus('starting');
    setGpsMessage(mode === 'outdoor' ? 'Connecting to GPS…' : (activity === 'cycling' ? 'Indoor bike ready · enter distance below' : 'Treadmill ready · enter distance below'));
    distanceRef.current = 0;
    elapsedBeforeSegmentRef.current = 0;
    lapsRef.current = [];
    routeRef.current = [];
    routeSegmentRef.current = 0;
    nextNotificationDistanceRef.current = MILE_METERS;
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setLaps([]);
    setCurrentRoute([]);
    setSelectedRunId(null);
    setTreadmillDistanceInput('');
    setTreadmillTimeInput('');
    setHeartRateInput('');
    setRecordMessage('');
    setLapFeedback('');
    try {
      if (mode === 'outdoor') {
        const notificationMiles = await loadRunNotificationDistance(profile.id);
        notificationIntervalMilesRef.current = notificationMiles;
        nextNotificationDistanceRef.current = notificationMiles === null
          ? Number.POSITIVE_INFINITY
          : notificationMiles * MILE_METERS;
        if (notificationMiles !== null) {
          void prepareMileNotifications().catch((error) =>
            console.warn('Notification permission unavailable:', error)
          );
        }
        await beginGpsUpdates();
      } else {
        notificationIntervalMilesRef.current = null;
        nextNotificationDistanceRef.current = Number.POSITIVE_INFINITY;
      }
      segmentStartedAtRef.current = Date.now();
      runStartedAtRef.current = new Date().toISOString();
      setStatus('running');
    } catch (error) {
      setStatus('idle');
      setGpsMessage(mode === 'outdoor' ? 'GPS unavailable' : 'Indoor activity unavailable');
      Alert.alert('Activity Could Not Start', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const pauseRun = () => {
    const segmentStart = segmentStartedAtRef.current;
    if (segmentStart) {
      elapsedBeforeSegmentRef.current += Math.floor((Date.now() - segmentStart) / 1000);
    }
    segmentStartedAtRef.current = null;
    setElapsedSeconds(elapsedBeforeSegmentRef.current);
    stopGpsUpdates();
    setStatus('paused');
    setGpsMessage(activityType === 'cycling' ? 'Ride paused' : 'Run paused');
  };

  const resumeRun = async () => {
    routeSegmentRef.current += 1;
    setStatus('starting');
    setGpsMessage(runMode === 'outdoor' ? 'Reconnecting to GPS…' : (activityType === 'cycling' ? 'Indoor ride resumed' : 'Treadmill run resumed'));
    try {
      if (runMode === 'outdoor') await beginGpsUpdates();
      segmentStartedAtRef.current = Date.now();
      setStatus('running');
    } catch (error) {
      setStatus('paused');
      Alert.alert('Activity Could Not Resume', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const finishRun = async () => {
    if (savingRun.current || !profile?.id || !runStartedAtRef.current) return;
    const segmentStart = segmentStartedAtRef.current;
    const duration = elapsedBeforeSegmentRef.current +
      (segmentStart ? Math.floor((Date.now() - segmentStart) / 1000) : 0);
    stopGpsUpdates();
    segmentStartedAtRef.current = null;
    elapsedBeforeSegmentRef.current = duration;

    const distance = distanceRef.current;
    const heartRate = Number(heartRateInput);
    if (heartRateInput && (!Number.isFinite(heartRate) || heartRate < 30 || heartRate > 240)) {
      setStatus('paused');
      setGpsMessage('Check the heart-rate value before finishing');
      Alert.alert('Heart Rate Looks Incorrect', 'Enter an average heart rate between 30 and 240 BPM, or leave it blank.');
      return;
    }
    if (runMode !== 'outdoor' && distance <= 0) {
      setStatus('paused');
      setGpsMessage('Enter the treadmill distance before finishing');
      Alert.alert('Distance Needed', 'Enter the distance shown on the machine, then tap Finish again.');
      return;
    }
    const entry: RunEntry = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      profileId: profile.id,
      activityType,
      mode: runMode,
      startedAt: runStartedAtRef.current,
      completedAt: new Date().toISOString(),
      durationSeconds: duration,
      distanceMeters: Math.round(distance),
      caloriesBurned: activityType === 'cycling'
        ? estimateCyclingCalories(Number(profile.weight) || 0, duration, distance)
        : estimateRunCalories(Number(profile.weight) || 0, distance),
      averagePaceSecondsPerKm: paceSecondsPerKilometer(duration, distance),
      averageHeartRateBpm: heartRate >= 30 && heartRate <= 240 ? Math.round(heartRate) : undefined,
      laps: lapsRef.current,
      route: runMode === 'outdoor' ? routeRef.current : undefined,
    };

    savingRun.current = true;
    setStatus('paused');
    setElapsedSeconds(duration);
    try {
      entry.userContext = await createUserContextSnapshot(profile.id);
      setHistory(await saveRun(entry));
      setSelectedRunId(entry.id);
      setStatus('idle');
      setElapsedSeconds(duration);
      setGpsMessage(`${runMode === 'outdoor' ? 'Outdoor' : 'Indoor'} ${activityType === 'cycling' ? 'ride' : 'run'} saved`);
      runStartedAtRef.current = null;
      Alert.alert(activityType === 'cycling' ? 'Ride Saved' : 'Run Saved', `${(distance / 1609.344).toFixed(2)} mi in ${formatDuration(duration)}.`);
    } catch (error) {
      console.error('Failed to save run:', error);
      setStatus('paused');
      Alert.alert('Save Failed', 'Your run could not be saved.');
    } finally {
      savingRun.current = false;
    }
  };

  const calories = activityType === 'cycling'
    ? estimateCyclingCalories(Number(profile?.weight) || 0, elapsedSeconds, distanceMeters)
    : estimateRunCalories(Number(profile?.weight) || 0, distanceMeters);
  const pace = paceSecondsPerKilometer(elapsedSeconds, distanceMeters);
  const active = status !== 'idle';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.brand}>FITTRACK</Text>
          <Text style={styles.title}>Run &amp; Cycle</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <Modal visible={modePromptVisible} transparent animationType="fade" onRequestClose={() => setModePromptVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modeCard}>
            <Text style={styles.modeTitle}>Choose your activity</Text>
            <Text style={styles.modeNote}>Outdoor activities use GPS and save a route. Indoor activities use the machine display.</Text>
            <Pressable style={styles.modeButtonPrimary} onPress={() => void startRun('running', 'outdoor')}>
              <Text style={styles.modeButtonPrimaryText}>Outdoor Run</Text>
              <Text style={styles.modeButtonPrimaryNote}>GPS distance and route map</Text>
            </Pressable>
            <Pressable style={styles.modeButtonSecondary} onPress={() => void startRun('running', 'treadmill')}>
              <Text style={styles.modeButtonSecondaryText}>Indoor Treadmill</Text>
              <Text style={styles.modeButtonSecondaryNote}>No GPS map needed</Text>
            </Pressable>
            <Pressable style={styles.modeButtonSecondary} onPress={() => void startRun('cycling', 'outdoor')}>
              <Text style={styles.modeButtonSecondaryText}>Outdoor Cycling</Text>
              <Text style={styles.modeButtonSecondaryNote}>GPS distance, speed, and route map</Text>
            </Pressable>
            <Pressable style={styles.modeButtonSecondary} onPress={() => void startRun('cycling', 'indoor')}>
              <Text style={styles.modeButtonSecondaryText}>Indoor Cycling</Text>
              <Text style={styles.modeButtonSecondaryNote}>Enter bike distance, time, and heart rate</Text>
            </Pressable>
            <Pressable style={styles.cancelModeButton} onPress={() => setModePromptVisible(false)}>
              <Text style={styles.cancelModeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.heroCard}>
        <Text style={styles.status}>{gpsMessage}</Text>
        <Text style={styles.distance}>{(distanceMeters / 1609.344).toFixed(2)}</Text>
        <Text style={styles.distanceUnit}>MILES</Text>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>TIME</Text>
            <Text style={styles.metricValue}>{formatDuration(elapsedSeconds)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>{activityType === 'cycling' ? 'AVG SPEED' : 'AVG PACE'}</Text>
            <Text style={styles.metricValue}>{activityType === 'cycling' ? formatSpeedMph(elapsedSeconds, distanceMeters) : formatPace(pace)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>CALORIES</Text>
            <Text style={styles.metricValue}>{calories}</Text>
          </View>
        </View>
      </View>

      {active && runMode !== 'outdoor' ? (
        <View style={styles.treadmillCard}>
          <Text style={styles.treadmillTitle}>{activityType === 'cycling' ? 'Indoor Cycling' : 'Indoor Treadmill'}</Text>
          <Text style={styles.treadmillNote}>Copy these readings from the {activityType === 'cycling' ? 'bike' : 'treadmill'} or your watch. You can update them anytime before finishing.</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DISTANCE (MILES)</Text>
              <TextInput
                value={treadmillDistanceInput}
                onChangeText={updateTreadmillDistance}
                placeholder="0.00"
                placeholderTextColor={colors.lightMuted}
                keyboardType="decimal-pad"
                returnKeyType="done"
                inputAccessoryViewID={RUN_INPUT_ACCESSORY_ID}
                onSubmitEditing={Keyboard.dismiss}
                style={styles.runInput}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TIME (MINUTES)</Text>
              <TextInput
                value={treadmillTimeInput}
                onChangeText={updateTreadmillTime}
                placeholder="0.0"
                placeholderTextColor={colors.lightMuted}
                keyboardType="decimal-pad"
                returnKeyType="done"
                inputAccessoryViewID={RUN_INPUT_ACCESSORY_ID}
                onSubmitEditing={Keyboard.dismiss}
                style={styles.runInput}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AVG HEART RATE</Text>
              <TextInput
                value={heartRateInput}
                onChangeText={(value) => setHeartRateInput(value.replace(/\D/g, '').slice(0, 3))}
                placeholder="BPM"
                placeholderTextColor={colors.lightMuted}
                keyboardType="number-pad"
                returnKeyType="done"
                inputAccessoryViewID={RUN_INPUT_ACCESSORY_ID}
                onSubmitEditing={Keyboard.dismiss}
                style={styles.runInput}
              />
            </View>
          </View>
          <Text style={styles.treadmillHelp}>Automatic heart rate will become available when Apple Watch or Zepp syncing is connected.</Text>
        </View>
      ) : null}

      {active && runMode === 'outdoor' && currentRoute.length > 1 ? (
        <RouteMapCard
          route={currentRoute}
          laps={laps}
          distanceLabel={`${(distanceMeters / MILE_METERS).toFixed(2)} mi`}
          durationLabel={formatDuration(elapsedSeconds)}
          paceLabel={activityType === 'cycling' ? formatSpeedMph(elapsedSeconds, distanceMeters) : formatPace(pace)}
          shareable={false}
        />
      ) : null}

      {recordMessage ? (
        <View style={styles.recordCard}>
          <Text style={styles.recordIcon}>🏆</Text>
          <View style={styles.recordDetails}>
            <Text style={styles.recordTitle}>Congratulations!</Text>
            <Text style={styles.recordText}>{recordMessage}</Text>
          </View>
        </View>
      ) : null}

      {lapFeedback ? (
        <View style={styles.lapFeedbackCard}>
          <Text style={styles.lapFeedbackIcon}>🏁</Text>
          <Text style={styles.lapFeedbackText}>{lapFeedback}</Text>
        </View>
      ) : null}

      {!active ? (
        <Pressable style={styles.startButton} onPress={() => setModePromptVisible(true)}>
          <Text style={styles.startButtonText}>Start Running or Cycling</Text>
        </Pressable>
      ) : (
        <View style={styles.controlRow}>
          <Pressable disabled={status === 'starting'} style={styles.pauseButton}
            onPress={status === 'paused' ? resumeRun : pauseRun}>
            <Text style={styles.pauseButtonText}>{status === 'paused' ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: status !== 'running' }}
            disabled={status !== 'running'}
            hitSlop={8}
            style={[styles.lapButton, status !== 'running' && styles.controlButtonDisabled]}
            onPress={addManualLap}
          >
            <Text style={styles.lapButtonText}>Lap</Text>
          </Pressable>
          <Pressable disabled={status === 'starting'} style={styles.finishButton} onPress={finishRun}>
            <Text style={styles.finishButtonText}>Finish</Text>
          </Pressable>
        </View>
      )}

      {laps.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Laps & Mile Splits</Text>
          {laps.map((lap) => (
            <View key={lap.id} style={styles.lapCard}>
              <View>
                <Text style={styles.historyDate}>
                  {lap.kind === 'mile' ? (lap.label ?? `Distance ${lap.number}`) : `Lap ${lap.number}`}
                </Text>
                <Text style={styles.historyNote}>
                  {(lap.splitDistanceMeters / 1609.344).toFixed(2)} mi
                </Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyDistance}>{formatDuration(lap.splitDurationSeconds)}</Text>
                <Text style={styles.historyNote}>
                  {formatPace(paceSecondsPerKilometer(lap.splitDurationSeconds, lap.splitDistanceMeters))}
                </Text>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Recent Activities</Text>
      {history.length === 0 ? (
        <View style={styles.historyCard}>
          <Text style={styles.historyNote}>Your completed runs and rides will appear here.</Text>
        </View>
      ) : history.slice(0, 10).map((run) => (
        <View key={run.id} style={styles.historyGroup}>
          <View style={styles.historyCard}>
            <View style={styles.historyMain}>
              <Text style={styles.historyDate}>{new Date(run.completedAt).toLocaleDateString()}</Text>
              <Text style={styles.historyNote}>{formatDuration(run.durationSeconds)} · {run.activityType === 'cycling' ? formatSpeedMph(run.durationSeconds, run.distanceMeters) : formatPace(run.averagePaceSecondsPerKm)} · {run.laps?.length ?? 0} splits</Text>
              <Text style={styles.runModeLabel}>{run.activityType === 'cycling' ? 'CYCLING' : 'RUNNING'} · {run.mode === 'treadmill' ? 'INDOOR TREADMILL' : run.mode === 'indoor' ? 'INDOOR BIKE' : run.mode === 'outdoor' ? 'OUTDOOR' : 'RUN'}</Text>
              {run.averageHeartRateBpm ? <Text style={styles.historyNote}>♥ {run.averageHeartRateBpm} BPM average</Text> : null}
              {run.mode !== 'outdoor' ? (
                <Text style={styles.indoorHistoryNote}>Indoor {run.activityType === 'cycling' ? 'ride' : 'run'} · route map not needed</Text>
              ) : run.route && run.route.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.routeButton}
                  onPress={() => setSelectedRunId(selectedRunId === run.id ? null : run.id)}
                >
                  <Text style={styles.routeButtonText}>{selectedRunId === run.id ? 'Hide Route' : 'View Route'}</Text>
                </Pressable>
              ) : (
                <Text style={styles.routeUnavailable}>Route unavailable for this earlier run</Text>
              )}
            </View>
            <View style={styles.historyRight}>
              <Text style={styles.historyDistance}>{(run.distanceMeters / MILE_METERS).toFixed(2)} mi</Text>
              <Text style={styles.historyNote}>{run.caloriesBurned} kcal</Text>
            </View>
          </View>
          {selectedRunId === run.id && run.route && run.route.length > 1 ? (
            <RouteMapCard
              route={run.route}
              laps={run.laps}
              distanceLabel={`${(run.distanceMeters / MILE_METERS).toFixed(2)} mi`}
              durationLabel={formatDuration(run.durationSeconds)}
              paceLabel={run.activityType === 'cycling' ? formatSpeedMph(run.durationSeconds, run.distanceMeters) : formatPace(run.averagePaceSecondsPerKm)}
            />
          ) : null}
        </View>
      ))}

      <Text style={styles.safetyNote}>Outdoor GPS distance and calorie burn are estimates. Indoor distance comes from the treadmill or bike value entered by the user. This version tracks while FitTrack remains open.</Text>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={RUN_INPUT_ACCESSORY_ID}>
          <View style={styles.keyboardToolbar}>
            <Pressable style={styles.keyboardDoneButton} onPress={Keyboard.dismiss}>
              <Text style={styles.keyboardDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 80, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 38, lineHeight: 40, color: colors.text },
  headerTitle: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 50 },
  brand: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: colors.muted },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(8, 15, 28, 0.58)', alignItems: 'center', justifyContent: 'center' },
  modeCard: { width: '100%', maxWidth: 440, padding: 22, borderRadius: 24, backgroundColor: colors.surface },
  modeTitle: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  modeNote: { marginTop: 8, marginBottom: 18, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modeButtonPrimary: { minHeight: 68, padding: 14, borderRadius: 17, backgroundColor: colors.text, justifyContent: 'center' },
  modeButtonPrimaryText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  modeButtonPrimaryNote: { marginTop: 3, color: colors.lightMuted, fontSize: 10, fontWeight: '700' },
  modeButtonSecondary: { minHeight: 68, marginTop: 10, padding: 14, borderRadius: 17, backgroundColor: colors.soft, justifyContent: 'center' },
  modeButtonSecondaryText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  modeButtonSecondaryNote: { marginTop: 3, color: colors.muted, fontSize: 10, fontWeight: '700' },
  cancelModeButton: { minHeight: 42, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
  cancelModeText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  heroCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 22, alignItems: 'center' },
  status: { fontSize: 12, fontWeight: '800', color: colors.muted },
  distance: { marginTop: 14, fontSize: 64, fontWeight: '900', color: colors.text },
  distanceUnit: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: colors.lightMuted },
  metricRow: { flexDirection: 'row', width: '100%', marginTop: 24, gap: 8 },
  metric: { flex: 1, alignItems: 'center', backgroundColor: colors.soft2, borderRadius: 14, paddingVertical: 13 },
  metricLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.lightMuted },
  metricValue: { marginTop: 5, fontSize: 15, fontWeight: '900', color: colors.text },
  treadmillCard: { marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.surface },
  treadmillTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  treadmillNote: { marginTop: 5, color: colors.muted, fontSize: 11, lineHeight: 16 },
  inputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  inputGroup: { flexGrow: 1, flexBasis: 110 },
  inputLabel: { marginBottom: 6, color: colors.lightMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  runInput: { minHeight: 50, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.soft2, color: colors.text, fontSize: 17, fontWeight: '900' },
  treadmillHelp: { marginTop: 11, color: colors.lightMuted, fontSize: 10, lineHeight: 15 },
  recordCard: { marginTop: 14, borderRadius: 18, padding: 16, backgroundColor: colors.soft, flexDirection: 'row', alignItems: 'center' },
  recordIcon: { fontSize: 30 },
  recordDetails: { flex: 1, marginLeft: 12 },
  recordTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  recordText: { marginTop: 3, fontSize: 12, fontWeight: '800', color: colors.muted },
  lapFeedbackCard: { marginTop: 12, borderRadius: 16, padding: 14, backgroundColor: colors.soft2, flexDirection: 'row', alignItems: 'center' },
  lapFeedbackIcon: { fontSize: 22, marginRight: 10 },
  lapFeedbackText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  startButton: { marginTop: 16, minHeight: 58, borderRadius: 18, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  startButtonText: { color: colors.surface, fontSize: 18, fontWeight: '900' },
  controlRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pauseButton: { flex: 1, minHeight: 58, borderRadius: 18, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  pauseButtonText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  lapButton: { flex: 1, minHeight: 58, borderRadius: 18, backgroundColor: colors.soft2, alignItems: 'center', justifyContent: 'center' },
  lapButtonText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  controlButtonDisabled: { opacity: 0.4 },
  finishButton: { flex: 1, minHeight: 58, borderRadius: 18, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  finishButtonText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  sectionTitle: { marginTop: 28, marginBottom: 10, fontSize: 20, fontWeight: '900', color: colors.text },
  historyGroup: { marginBottom: 12 },
  historyCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between' },
  historyMain: { flex: 1, paddingRight: 10 },
  routeButton: { alignSelf: 'flex-start', minHeight: 34, marginTop: 10, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  routeButtonText: { color: colors.surface, fontSize: 11, fontWeight: '900' },
  runModeLabel: { marginTop: 7, color: colors.lightMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  indoorHistoryNote: { marginTop: 8, color: colors.muted, fontSize: 10, fontStyle: 'italic' },
  routeUnavailable: { marginTop: 8, color: colors.lightMuted, fontSize: 10, fontStyle: 'italic' },
  lapCard: { backgroundColor: colors.soft, borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  historyDate: { fontSize: 14, fontWeight: '900', color: colors.text },
  historyNote: { marginTop: 4, fontSize: 11, color: colors.muted },
  historyRight: { alignItems: 'flex-end' },
  historyDistance: { fontSize: 16, fontWeight: '900', color: colors.text },
  keyboardToolbar: { minHeight: 48, paddingHorizontal: 16, backgroundColor: colors.surface, alignItems: 'flex-end', justifyContent: 'center' },
  keyboardDoneButton: { minHeight: 38, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  keyboardDoneText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  safetyNote: { marginTop: 10, fontSize: 11, lineHeight: 17, color: colors.lightMuted },
});
