import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';

type Props = {
  label: string;
  value: string;
  note: string;
};

export default function MetricCard({ label, value, note }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48.5%',
    minHeight: 110,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  value: { fontSize: 23, fontWeight: '900', color: colors.text, marginTop: 8 },
  note: { fontSize: 12, color: colors.lightMuted, marginTop: 4 },
});
