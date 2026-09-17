import { useLocalDate } from '../../hooks/use-local-date';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../constants/theme';
import { loadProfile } from '../../services/profile-storage';
import { loadVitamins, removeVitamin, saveVitamin } from '../../services/vitamin-storage';
import { VitaminEntry, VitaminFoodTiming } from '../../types/vitamin';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

type Preset = Pick<VitaminEntry, 'name' | 'time' | 'foodTiming' | 'guidance'>;
const PRESETS: Preset[] = [
  { name: 'Multivitamin', time: '08:00', foodTiming: 'with-food', guidance: 'Take with breakfast unless the product label says otherwise.' },
  { name: 'Vitamin D', time: '08:00', foodTiming: 'with-food', guidance: 'Take with a meal that contains some fat.' },
  { name: 'Vitamin B12', time: '08:00', foodTiming: 'either', guidance: 'May be taken with or without food; morning is an easy routine.' },
  { name: 'Vitamin C', time: '08:00', foodTiming: 'either', guidance: 'May be taken with or without food; use food if it bothers your stomach.' },
  { name: 'Vitamin A', time: '08:00', foodTiming: 'with-food', guidance: 'Take with a meal that contains some fat.' },
  { name: 'Vitamin E', time: '08:00', foodTiming: 'with-food', guidance: 'Take with a meal that contains some fat.' },
  { name: 'Vitamin K', time: '08:00', foodTiming: 'with-food', guidance: 'Take with a meal; ask a clinician if you use blood thinners.' },
];
const foodLabels: Record<VitaminFoodTiming, string> = {
  'with-food': 'With food', 'without-food': 'Without food', either: 'With or without food',
};

function friendlyTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export default function VitaminScreen() {
  const [profileId, setProfileId] = useState('');
  const [vitamins, setVitamins] = useState<VitaminEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(PRESETS[0].name);
  const [dose, setDose] = useState('');
  const [time, setTime] = useState(PRESETS[0].time);
  const [foodTiming, setFoodTiming] = useState<VitaminFoodTiming>(PRESETS[0].foodTiming);
  const [guidance, setGuidance] = useState(PRESETS[0].guidance);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      const profile = await loadProfile();
      if (!profile?.id) return;
      const saved = await loadVitamins(profile.id);
      if (active) { setProfileId(profile.id); setVitamins(saved); }
    })().catch((error) => {
      console.error('Failed to load vitamins:', error);
      if (active) Alert.alert('Unable to load vitamins', 'Your saved data has not been changed. Please try again.');
    });
    return () => { active = false; };
  }, []));

  const today = useLocalDate();
  const sorted = useMemo(() => [...vitamins].sort((a, b) => a.time.localeCompare(b.time)), [vitamins]);
  const completed = vitamins.filter((item) => item.takenDates.includes(today)).length;

  const choosePreset = (preset: Preset) => {
    setName(preset.name); setTime(preset.time); setFoodTiming(preset.foodTiming); setGuidance(preset.guidance);
  };
  const resetForm = () => {
    choosePreset(PRESETS[0]); setDose(''); setReminderEnabled(true); setShowForm(false);
  };

  const scheduleReminder = async (entry: VitaminEntry) => {
    if (!entry.reminderEnabled || Platform.OS === 'web') return undefined;
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Notifications are off', 'The vitamin was saved, but FitTrack cannot remind you until notifications are allowed in device settings.');
      return undefined;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('vitamin-reminders', {
        name: 'Vitamin reminders', importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const [hour, minute] = entry.time.split(':').map(Number);
    return Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${entry.name}`,
        body: `${entry.dose ? `${entry.dose} · ` : ''}${foodLabels[entry.foodTiming]}. Follow your label or clinician's instructions.`,
        sound: true, data: { url: '/vitamins', vitaminId: entry.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute,
        ...(Platform.OS === 'android' ? { channelId: 'vitamin-reminders' } : {}),
      },
    });
  };

  const handleSave = async () => {
    if (!profileId) return Alert.alert('Profile needed', 'Please save your Profile before adding vitamins.');
    if (!name.trim()) return Alert.alert('Vitamin name needed', 'Enter the vitamin or supplement name.');
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) {
      return Alert.alert('Check the time', 'Use 24-hour time such as 08:00 or 18:30.');
    }
    setSaving(true);
    try {
      const entry: VitaminEntry = {
        id: `vitamin-${Date.now()}`, profileId, name: name.trim(), dose: dose.trim(), time: time.trim(),
        foodTiming, guidance: guidance.trim(), reminderEnabled, takenDates: [], createdAt: new Date().toISOString(),
      };
      let notificationId: string | undefined;
      try {
        notificationId = await scheduleReminder(entry);
      } catch (error) {
        console.error('Failed to schedule reminder:', error);
        Alert.alert('Reminder unavailable', 'Your vitamin will be saved without a notification. Try again after allowing notifications in device settings.');
      }
      setVitamins(await saveVitamin({ ...entry, reminderEnabled: reminderEnabled && Boolean(notificationId), notificationId }));
      resetForm();
    } catch (error) {
      console.error('Failed to save vitamin:', error);
      Alert.alert('Could not save', 'Please try adding the vitamin again.');
    } finally { setSaving(false); }
  };

  const toggleTaken = async (item: VitaminEntry) => {
    const updated = { ...item, takenDates: item.takenDates.includes(today)
      ? item.takenDates.filter((date) => date !== today) : [...item.takenDates, today] };
    try {
      setVitamins(await saveVitamin(updated));
    } catch (error) {
      console.error('Failed to update vitamin:', error);
      Alert.alert('Unable to save', 'Please try again.');
    }
  };

  const confirmDelete = (item: VitaminEntry) => Alert.alert('Remove vitamin?', `${item.name} and its reminder will be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
      if (item.notificationId) await Notifications.cancelScheduledNotificationAsync(item.notificationId);
      setVitamins(await removeVitamin(profileId, item.id));
    })().catch((error) => {
      console.error('Failed to remove vitamin:', error);
      Alert.alert('Unable to remove vitamin', 'Please try again.');
    }) },
  ]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Daily Vitamins</Text><View style={styles.headerSpacer} />
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TODAY</Text>
        <Text style={styles.summaryValue}>{completed} of {vitamins.length} taken</Text>
        <Text style={styles.summaryNote}>Your list and history stay attached to this profile.</Text>
      </View>

      {sorted.map((item) => {
        const isTaken = item.takenDates.includes(today);
        return <View key={item.id} style={styles.vitaminCard}>
          <View style={styles.row}><View style={styles.flex}>
            <Text style={styles.vitaminName}>{item.name}</Text>
            <Text style={styles.meta}>{friendlyTime(item.time)}{item.dose ? ` · ${item.dose}` : ''}</Text>
          </View><Text style={styles.pill}>💊</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>{foodLabels[item.foodTiming]}</Text></View>
          {!!item.guidance && <Text style={styles.guidance}>{item.guidance}</Text>}
          <Text style={styles.reminderStatus}>{item.reminderEnabled ? `Reminder set for ${friendlyTime(item.time)}` : 'Reminder off'}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.takenButton, isTaken && styles.takenActive]} onPress={() => void toggleTaken(item)}>
              <Text style={[styles.takenText, isTaken && styles.takenTextActive]}>{isTaken ? '✓ Taken today' : 'Mark as taken'}</Text>
            </Pressable>
            <Pressable style={styles.removeButton} onPress={() => confirmDelete(item)}><Text style={styles.removeText}>Remove</Text></Pressable>
          </View>
        </View>;
      })}

      {!showForm ? <Pressable style={styles.addButton} onPress={() => setShowForm(true)}><Text style={styles.addText}>+ Add a vitamin</Text></Pressable> :
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add vitamin or supplement</Text>
          <Text style={styles.label}>Quick choices</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {PRESETS.map((preset) => <Pressable key={preset.name} style={[styles.preset, name === preset.name && styles.presetActive]} onPress={() => choosePreset(preset)}>
              <Text style={[styles.presetText, name === preset.name && styles.presetTextActive]}>{preset.name}</Text>
            </Pressable>)}
          </ScrollView>
          <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} returnKeyType="next" />
          <Text style={styles.label}>Dose (optional)</Text><TextInput style={styles.input} value={dose} onChangeText={setDose} placeholder="1 tablet or 1000 IU" placeholderTextColor={colors.lightMuted} returnKeyType="next" />
          <Text style={styles.label}>Reminder time (24-hour, for example 18:30)</Text><TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="08:00" placeholderTextColor={colors.lightMuted} keyboardType="numbers-and-punctuation" returnKeyType="done" />
          <Text style={styles.label}>Food timing</Text><View style={styles.foodOptions}>
            {(Object.keys(foodLabels) as VitaminFoodTiming[]).map((option) => <Pressable key={option} style={[styles.foodOption, foodTiming === option && styles.foodOptionActive]} onPress={() => setFoodTiming(option)}>
              <Text style={[styles.foodOptionText, foodTiming === option && styles.presetTextActive]}>{foodLabels[option]}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.label}>Helpful note</Text><TextInput style={[styles.input, styles.noteInput]} value={guidance} onChangeText={setGuidance} multiline />
          <Pressable style={[styles.reminderToggle, reminderEnabled && styles.reminderOn]} onPress={() => setReminderEnabled((value) => !value)}>
            <Text style={styles.reminderToggleText}>{reminderEnabled ? '✓ Daily reminder on' : 'Daily reminder off'}</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={resetForm}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable style={styles.saveButton} disabled={saving} onPress={() => void handleSave()}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save vitamin'}</Text></Pressable>
          </View>
        </View>}

      {Platform.OS === 'web' && <Text style={styles.guidance}>Phone notifications are available in the iPhone or Android app. You can still save and check off vitamins here.</Text>}
      <View style={styles.safetyCard}><Text style={styles.safetyTitle}>General guidance only</Text>
        <Text style={styles.safetyText}>Suggested times are editable routine ideas, not medical instructions. Always follow the product label and your doctor or pharmacist, especially for prescriptions, pregnancy, health conditions, or possible interactions.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 20, paddingTop: 58, paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { minWidth: 72, paddingVertical: 10 }, backText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 25, fontWeight: '900' }, headerSpacer: { width: 72 },
  summaryCard: { backgroundColor: colors.text, padding: 22, borderRadius: 22, marginBottom: 14 },
  summaryLabel: { color: colors.lightMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  summaryValue: { color: colors.surface, fontSize: 27, fontWeight: '900', marginTop: 5 }, summaryNote: { color: colors.lightMuted, fontSize: 12, marginTop: 5 },
  vitaminCard: { backgroundColor: colors.surface, padding: 18, borderRadius: 20, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' }, flex: { flex: 1 }, pill: { fontSize: 26 },
  vitaminName: { color: colors.text, fontSize: 20, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 3 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.soft2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 12 }, badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  guidance: { color: '#4B5563', fontSize: 13, lineHeight: 19, marginTop: 10 }, reminderStatus: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 }, takenButton: { flex: 1, backgroundColor: colors.soft, borderRadius: 13, padding: 13, alignItems: 'center' }, takenActive: { backgroundColor: '#DCFCE7' },
  takenText: { color: colors.text, fontWeight: '900' }, takenTextActive: { color: '#166534' }, removeButton: { paddingHorizontal: 14, justifyContent: 'center' }, removeText: { color: '#B91C1C', fontWeight: '800' },
  addButton: { backgroundColor: colors.text, borderRadius: 17, padding: 17, alignItems: 'center' }, addText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  formCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 19 }, formTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 7 }, presets: { gap: 7, paddingRight: 10 },
  preset: { backgroundColor: colors.soft2, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, presetActive: { backgroundColor: colors.text }, presetText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, presetTextActive: { color: colors.surface },
  input: { backgroundColor: colors.soft2, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 15 }, noteInput: { minHeight: 80, textAlignVertical: 'top' },
  foodOptions: { gap: 7 }, foodOption: { backgroundColor: colors.soft2, padding: 12, borderRadius: 12 }, foodOptionActive: { backgroundColor: colors.text }, foodOptionText: { color: colors.muted, fontWeight: '800', textAlign: 'center' },
  reminderToggle: { backgroundColor: colors.soft2, borderRadius: 13, padding: 14, marginTop: 16 }, reminderOn: { backgroundColor: '#DBEAFE' }, reminderToggleText: { color: colors.text, fontWeight: '900', textAlign: 'center' },
  cancelButton: { flex: 1, backgroundColor: colors.soft, borderRadius: 13, padding: 14, alignItems: 'center' }, cancelText: { color: colors.text, fontWeight: '900' },
  saveButton: { flex: 1.4, backgroundColor: colors.text, borderRadius: 13, padding: 14, alignItems: 'center' }, saveText: { color: colors.surface, fontWeight: '900' },
  safetyCard: { backgroundColor: '#FFF7ED', borderRadius: 18, padding: 17, marginTop: 14 }, safetyTitle: { color: '#9A3412', fontSize: 14, fontWeight: '900' }, safetyText: { color: '#7C2D12', fontSize: 12, lineHeight: 18, marginTop: 5 },
});
