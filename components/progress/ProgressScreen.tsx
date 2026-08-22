import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';

export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>FITTRACK</Text>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>Your trends</Text>
      <View style={styles.card}>
        <Text style={styles.body}>Charts and progress history will be isolated here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: colors.background },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: colors.muted },
  title: { fontSize: 34, fontWeight: '900', color: colors.text, marginTop: 4 },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20 },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted },
});
