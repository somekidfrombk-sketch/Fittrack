import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

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

const WIDTH = 600;
const HEIGHT = 320;
const PADDING = 28;

export default function RouteMapCard({ route, distanceLabel, durationLabel, paceLabel }: Props) {
  if (route.length < 2) return null;
  const latitudes = route.map((point) => point.latitude);
  const longitudes = route.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.00001);
  const lonSpan = Math.max(maxLon - minLon, 0.00001);
  const projected = route.map((point) => ({
    x: PADDING + ((point.longitude - minLon) / lonSpan) * (WIDTH - PADDING * 2),
    y: HEIGHT - PADDING - ((point.latitude - minLat) / latSpan) * (HEIGHT - PADDING * 2),
    segment: point.segment ?? 0,
  }));
  const segmentPoints = [...new Set(projected.map((point) => point.segment))]
    .map((segment) => projected.filter((point) => point.segment === segment))
    .filter((points) => points.length > 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.mapFrame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {segmentPoints.map((segment, index) => (
            <Polyline
              key={`route-segment-${index}`}
              points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="#E53935"
              strokeWidth={7}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          <Circle cx={projected[0].x} cy={projected[0].y} r={10} fill="#18A66A" />
          <Circle cx={projected[projected.length - 1].x} cy={projected[projected.length - 1].y} r={10} fill="#E53935" />
        </Svg>
        <Text style={styles.previewLabel}>Route preview · green start · red finish</Text>
      </View>
      <View style={styles.summary}>
        <View><Text style={styles.value}>{distanceLabel}</Text><Text style={styles.label}>DISTANCE</Text></View>
        <View><Text style={styles.value}>{durationLabel}</Text><Text style={styles.label}>TIME</Text></View>
        <View><Text style={styles.value}>{paceLabel}</Text><Text style={styles.label}>AVG PACE</Text></View>
      </View>
      <Text style={styles.webNote}>Saving route images is available in the iPhone and Android app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14, padding: 10, borderRadius: 22, backgroundColor: colors.surface },
  mapFrame: { height: 260, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.soft2 },
  previewLabel: { position: 'absolute', left: 12, bottom: 10, color: colors.muted, fontSize: 10, fontWeight: '800' },
  summary: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14 },
  value: { color: colors.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  label: { marginTop: 3, color: colors.lightMuted, fontSize: 8, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  webNote: { paddingTop: 12, paddingBottom: 3, color: colors.lightMuted, fontSize: 10, textAlign: 'center' },
});