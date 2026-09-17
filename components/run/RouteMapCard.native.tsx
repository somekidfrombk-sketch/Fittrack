import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';

import { colors } from '../../constants/theme';
import { RunLap, RunRoutePoint } from '../../types/run';

type Props = {
  route: RunRoutePoint[];
  laps?: RunLap[];
  distanceLabel: string;
  durationLabel: string;
  paceLabel: string;
  shareable?: boolean;
};

const closestPoint = (route: RunRoutePoint[], distanceMeters: number) =>
  route.reduce((best, point) =>
    Math.abs(point.distanceMeters - distanceMeters) < Math.abs(best.distanceMeters - distanceMeters)
      ? point
      : best
  );

export default function RouteMapCard({
  route,
  laps = [],
  distanceLabel,
  durationLabel,
  paceLabel,
  shareable = true,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const coordinates = useMemo(
    () => route.map(({ latitude, longitude }) => ({ latitude, longitude })),
    [route]
  );
  const routeSegments = useMemo(() => {
    const grouped = new Map<number, typeof coordinates>();
    route.forEach((point, index) => {
      const segment = point.segment ?? 0;
      grouped.set(segment, [...(grouped.get(segment) ?? []), coordinates[index]]);
    });
    return [...grouped.values()].filter((points) => points.length > 1);
  }, [coordinates, route]);
  const manualLaps = laps.filter((lap) => lap.kind === 'manual');

  useEffect(() => {
    if (coordinates.length < 2) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 42, right: 42, bottom: 42, left: 42 },
        animated: false,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [coordinates]);

  const shareRoute = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const imageUri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Route Image Ready', `Saved temporarily at ${imageUri}`);
        return;
      }
      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: 'Save or share your FitTrack route',
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Route image failed:', error);
      Alert.alert('Image Could Not Be Created', 'Please wait for the map to finish loading and try again.');
    } finally {
      setSharing(false);
    }
  };

  if (route.length < 2) return null;

  const fitRoute = () => mapRef.current?.fitToCoordinates(coordinates, {
    edgePadding: { top: 42, right: 42, bottom: 42, left: 42 },
    animated: false,
  });

  return (
    <View style={styles.wrapper}>
      <View ref={cardRef} collapsable={false} style={styles.captureCard}>
        <View style={styles.mapFrame}>
          <MapView ref={mapRef} style={styles.map} onMapReady={fitRoute}>
            {routeSegments.map((segment, index) => (
              <Polyline key={`route-segment-${index}`} coordinates={segment} strokeColor="#E53935" strokeWidth={5} />
            ))}
            <Marker coordinate={coordinates[0]} title="Start" pinColor="#18A66A" />
            {manualLaps.map((lap) => {
              const point = closestPoint(route, lap.distanceMeters);
              return <Marker key={lap.id} coordinate={point} title={`Lap ${lap.number}`} pinColor="#F5A623" />;
            })}
            <Marker coordinate={coordinates[coordinates.length - 1]} title="Finish" pinColor="#E53935" />
          </MapView>
        </View>
        <View style={styles.summary}>
          <View><Text style={styles.value}>{distanceLabel}</Text><Text style={styles.label}>DISTANCE</Text></View>
          <View><Text style={styles.value}>{durationLabel}</Text><Text style={styles.label}>TIME</Text></View>
          <View><Text style={styles.value}>{paceLabel}</Text><Text style={styles.label}>AVG PACE</Text></View>
        </View>
        <Text style={styles.brand}>FITTRACK · RUN ROUTE</Text>
      </View>
      {shareable ? (
        <Pressable accessibilityRole="button" disabled={sharing} style={[styles.shareButton, sharing && styles.disabled]} onPress={shareRoute}>
          <Text style={styles.shareText}>{sharing ? 'Creating Image…' : 'Save / Share Route'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14 },
  captureCard: { padding: 10, borderRadius: 22, backgroundColor: colors.surface },
  mapFrame: { height: 260, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.soft2 },
  map: { flex: 1 },
  summary: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14 },
  value: { color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  label: { marginTop: 3, color: colors.lightMuted, fontSize: 8, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  brand: { paddingTop: 12, paddingBottom: 3, color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  shareButton: { minHeight: 48, marginTop: 9, borderRadius: 15, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});