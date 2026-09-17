type Coordinate = { latitude: number; longitude: number };

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceBetweenMeters(from: Coordinate, to: Coordinate) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function estimateRunCalories(weightLb: number, distanceMeters: number) {
  if (weightLb <= 0 || distanceMeters <= 0) return 0;
  return Math.round(weightLb * 0.45359237 * (distanceMeters / 1000));
}

export function estimateCyclingCalories(
  weightLb: number,
  durationSeconds: number,
  distanceMeters: number
) {
  if (weightLb <= 0 || durationSeconds <= 0) return 0;
  const hours = durationSeconds / 3600;
  const speedMph = distanceMeters > 0 ? (distanceMeters / 1609.344) / hours : 0;
  const met = speedMph >= 20 ? 12 : speedMph >= 16 ? 10 : speedMph >= 12 ? 8 : speedMph >= 10 ? 6.8 : 4;
  return Math.round(met * weightLb * 0.45359237 * hours);
}
export function paceSecondsPerKilometer(durationSeconds: number, distanceMeters: number) {
  if (durationSeconds <= 0 || distanceMeters < 10) return null;
  return durationSeconds / (distanceMeters / 1000);
}

export function formatSpeedMph(durationSeconds: number, distanceMeters: number) {
  if (durationSeconds <= 0 || distanceMeters < 10) return '--.- mph';
  const hours = durationSeconds / 3600;
  return `${((distanceMeters / 1609.344) / hours).toFixed(1)} mph`;
}
export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return '--:-- /km';
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /km`;
}
