import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/theme';
import { getOrCreateProfileId, loadProfile, logBodyWeight } from '../../services/profile-storage';
import { ProfileData } from '../../types/profile';

export default function BodyWeightLog() {
  const [profileId, setProfileId] = useState('');
  const [entries, setEntries] = useState<NonNullable<ProfileData['weightEntries']>>([]);
  const [currentWeight, setCurrentWeight] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const busy = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setProfileId('');
    void (async () => {
      const id = await getOrCreateProfileId();
      const profile = await loadProfile();
      if (!active) return;
      setProfileId(id);
      setCurrentWeight(profile?.weight ?? '');
      setEntries(profile?.weightEntries ?? []);
      setError('');
    })().catch(() => { if (active) setError('Unable to load weight history. Reopen Progress to retry.'); });
    return () => { active = false; };
  }, []));

  const save = async () => {
    if (!profileId || busy.current) return;
    const text = input.trim().replace(',', '.');
    const weight = Number(text);
    if (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(weight) || weight <= 0) {
      setError('Enter a weight greater than zero in pounds.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await logBodyWeight(profileId, weight);
      setEntries(saved.weightEntries ?? []);
      setCurrentWeight(saved.weight);
      setInput('');
      setMessage('Weight saved. Your current profile weight is updated.');
      Keyboard.dismiss();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Weight could not be saved. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return <View style={styles.card}>
    <Text style={styles.title}>Body weight</Text>
    <Text style={styles.caption}>{currentWeight ? `Current weight: ${currentWeight} lb` : 'Log your weight to track changes over time.'}</Text>
    <View style={styles.row}>
      <TextInput accessibilityLabel="Body weight in pounds" value={input} onChangeText={(value) => { setInput(value); setMessage(''); }} editable={!saving} keyboardType="decimal-pad" placeholder="Weight (lb)" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => void save()} />
      <Pressable accessibilityRole="button" disabled={saving || !profileId || !input.trim()} onPress={() => void save()} style={[styles.button, (saving || !profileId || !input.trim()) && styles.disabled]}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Log weight'}</Text>
      </Pressable>
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.caption}>{message}</Text>}
    {(showAll ? entries : entries.slice(0, 3)).map((entry) => <View key={entry.id} style={styles.entry}>
      <Text style={styles.caption}>{new Date(entry.date).toLocaleDateString()} · {new Date(entry.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
      <Text style={styles.value}>{entry.weightLb} lb</Text>
    </View>)}
    {entries.length > 3 && <Pressable accessibilityRole="button" onPress={() => setShowAll((value) => !value)} style={styles.more}><Text style={styles.value}>{showAll ? 'Show less' : `Show all ${entries.length} weigh-ins`}</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, padding: 18, borderRadius: 20, marginBottom: 22 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  input: { flex: 1, minWidth: 0, backgroundColor: colors.soft2, borderRadius: 12, padding: 12, color: colors.text },
  button: { backgroundColor: colors.text, borderRadius: 12, padding: 12, justifyContent: 'center', minHeight: 44 },
  buttonText: { color: colors.surface, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  error: { color: '#B91C1C', marginTop: 10 },
  entry: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.soft2, paddingTop: 10, marginTop: 10 },
  value: { color: colors.text, fontWeight: '800', fontSize: 12 },
  more: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
