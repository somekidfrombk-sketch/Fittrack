import { useLocalDate } from '../../hooks/use-local-date';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../constants/theme';
import { NUTRIENT_LIBRARY, findNutrientReference, nutrientCategories, NutrientFilter } from '../../data/nutrient-library';
import { loadProfile } from '../../services/profile-storage';
import { loadVitamins, removeVitamin, saveVitamin } from '../../services/vitamin-storage';
import { NutrientReference, VitaminEntry, VitaminFoodTiming } from '../../types/vitamin';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

const foodLabels: Record<VitaminFoodTiming, string> = {
  'with-food': 'With food', 'without-food': 'Without food', either: 'With or without food',
};

const foodOptions = Object.keys(foodLabels) as VitaminFoodTiming[];

function friendlyTime(time: string) {
  const [hours = 8, minutes = 0] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function splitDoseAndUnit(dose: string, unit?: string) {
  const trimmedDose = dose.trim();
  if (unit) {
    const unitPattern = new RegExp(`\\s+${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    return { doseValue: trimmedDose.replace(unitPattern, ''), unitValue: unit };
  }
  const match = trimmedDose.match(/^([\d.,/]+)\s*(.*)$/);
  return { doseValue: match?.[1] ?? dose, unitValue: match?.[2] ?? '' };
}

function guidanceFor(reference?: NutrientReference, foodTiming?: VitaminFoodTiming) {
  if (reference) return `${reference.supplementationGuidance} ${reference.timing}`;
  return foodTiming === 'with-food'
    ? 'Take with food unless your product label or clinician says otherwise.'
    : 'Follow your product label or clinician instructions.';
}

function emptyEntry(profileId: string, reference?: NutrientReference): VitaminEntry {
  return {
    id: `vitamin-${Date.now()}`,
    profileId,
    name: reference?.name ?? '',
    dose: '',
    unit: reference?.units[0] ?? '',
    servings: '1',
    frequency: 'Daily',
    preferredTime: '08:00',
    time: '08:00',
    foodTiming: reference?.preferredAdministration ?? 'either',
    guidance: guidanceFor(reference, reference?.preferredAdministration),
    notes: '',
    referenceId: reference?.id,
    reminderEnabled: false,
    takenDates: [],
    createdAt: new Date().toISOString(),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.detailSection}><Text style={styles.detailTitle}>{title}</Text><Text style={styles.detailText}>{children}</Text></View>;
}

export default function VitaminScreen() {
  const [profileId, setProfileId] = useState('');
  const [vitamins, setVitamins] = useState<VitaminEntry[]>([]);
  const [selectedReference, setSelectedReference] = useState<NutrientReference | undefined>();
  const [editing, setEditing] = useState<VitaminEntry | undefined>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<NutrientFilter>('All');
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
      if (active) Alert.alert('Unable to load supplements', 'Your saved data has not been changed. Please try again.');
    });
    return () => { active = false; };
  }, []));

  const today = useLocalDate();
  const sorted = useMemo(() => [...vitamins].sort((a, b) => a.time.localeCompare(b.time)), [vitamins]);
  const completed = vitamins.filter((item) => item.takenDates.includes(today)).length;
  const trackedIds = useMemo(() => new Set(vitamins.map((item) => item.referenceId).filter(Boolean)), [vitamins]);

  const filteredReferences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return NUTRIENT_LIBRARY.filter((item) => {
      const matchesFilter = filter === 'All' || filter === item.category || filter === 'My Supplements';
      const matchesMySupplements = filter !== 'My Supplements' || trackedIds.has(item.id);
      const text = [item.name, item.category, ...item.alternativeNames].join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
      return matchesFilter && matchesMySupplements && matchesQuery;
    });
  }, [filter, query, trackedIds]);

  const scheduleReminder = async (entry: VitaminEntry) => {
    if (!entry.reminderEnabled || Platform.OS === 'web') return undefined;
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Notifications are off', 'The supplement was saved, but FitTrack cannot remind you until notifications are allowed in device settings.');
      return undefined;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('vitamin-reminders', { name: 'Supplement reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const [hour, minute] = entry.time.split(':').map(Number);
    return Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${entry.name}`,
        body: `${entry.dose ? `${entry.dose}${entry.unit ? ` ${entry.unit}` : ''} · ` : ''}${foodLabels[entry.foodTiming]}. Follow your label or clinician's instructions.`,
        sound: true,
        data: { url: '/vitamins', vitaminId: entry.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, ...(Platform.OS === 'android' ? { channelId: 'vitamin-reminders' } : {}) },
    });
  };

  const beginAdd = (reference?: NutrientReference) => {
    if (!profileId) return Alert.alert('Profile needed', 'Please save your Profile before adding supplements.');
    setSelectedReference(undefined);
    setEditing(emptyEntry(profileId, reference));
  };

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return Alert.alert('Name needed', 'Enter the vitamin, mineral, or supplement name.');
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(editing.time.trim())) return Alert.alert('Check the time', 'Use 24-hour time such as 08:00 or 18:30.');
    setSaving(true);
    try {
      if (editing.notificationId) await Notifications.cancelScheduledNotificationAsync(editing.notificationId).catch(() => undefined);
      let notificationId: string | undefined;
      try { notificationId = await scheduleReminder(editing); }
      catch (error) {
        console.error('Failed to schedule reminder:', error);
        Alert.alert('Reminder unavailable', 'Your supplement will be saved without a notification. Try again after allowing notifications in device settings.');
      }
      const dose = [editing.dose.trim(), editing.unit?.trim()].filter(Boolean).join(' ');
      const updated: VitaminEntry = { ...editing, name: editing.name.trim(), dose, reminderEnabled: editing.reminderEnabled && Boolean(notificationId), notificationId, updatedAt: new Date().toISOString() };
      setVitamins(await saveVitamin(updated));
      setEditing(undefined);
    } catch (error) {
      console.error('Failed to save supplement:', error);
      Alert.alert('Could not save', 'Please try saving again.');
    } finally { setSaving(false); }
  };

  const toggleTaken = async (item: VitaminEntry) => {
    const updated = { ...item, takenDates: item.takenDates.includes(today) ? item.takenDates.filter((date) => date !== today) : [...item.takenDates, today] };
    try { setVitamins(await saveVitamin(updated)); }
    catch (error) {
      console.error('Failed to update supplement:', error);
      Alert.alert('Unable to save', 'Please try again.');
    }
  };

  const confirmDelete = (item: VitaminEntry) => Alert.alert('Remove supplement?', `${item.name} and its reminder will be removed. Your other FitTrack data is unchanged.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
      if (item.notificationId) await Notifications.cancelScheduledNotificationAsync(item.notificationId).catch(() => undefined);
      setVitamins(await removeVitamin(profileId, item.id));
    })().catch((error) => {
      console.error('Failed to remove supplement:', error);
      Alert.alert('Unable to remove supplement', 'Please try again.');
    }) },
  ]);

  const renderEditor = () => {
    if (!editing) return null;
    const reference = findNutrientReference(editing.referenceId);
    const doseParts = splitDoseAndUnit(editing.dose, editing.unit);
    return <Modal visible transparent animationType="slide" onRequestClose={() => setEditing(undefined)}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editorCard}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editorContent}>
            <Text style={styles.formTitle}>{vitamins.some((item) => item.id === editing.id) ? 'Edit supplement' : 'Add to My Supplements'}</Text>
            {!!reference && <Text style={styles.referenceHint}>Reference: {reference.name}. Dietary intake guidance is separate from your supplement dose.</Text>}
            <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} returnKeyType="next" />
            <Text style={styles.label}>Custom dose</Text><View style={styles.inlineInputs}><TextInput style={[styles.input, styles.doseInput]} value={doseParts.doseValue} onChangeText={(dose) => setEditing({ ...editing, dose })} placeholder="Optional" placeholderTextColor={colors.lightMuted} keyboardType="decimal-pad" /><TextInput style={[styles.input, styles.unitInput]} value={doseParts.unitValue} onChangeText={(unit) => setEditing({ ...editing, unit })} placeholder="Unit" placeholderTextColor={colors.lightMuted} /></View>
            <Text style={styles.label}>Servings</Text><TextInput style={styles.input} value={editing.servings ?? '1'} onChangeText={(servings) => setEditing({ ...editing, servings })} keyboardType="decimal-pad" />
            <Text style={styles.label}>Frequency</Text><TextInput style={styles.input} value={editing.frequency ?? 'Daily'} onChangeText={(frequency) => setEditing({ ...editing, frequency })} placeholder="Daily, training days, weekly…" placeholderTextColor={colors.lightMuted} />
            <Text style={styles.label}>Preferred time / reminder time (24-hour)</Text><TextInput style={styles.input} value={editing.time} onChangeText={(time) => setEditing({ ...editing, time, preferredTime: time })} placeholder="08:00" placeholderTextColor={colors.lightMuted} keyboardType="numbers-and-punctuation" />
            <Text style={styles.label}>With food?</Text><View style={styles.foodOptions}>{foodOptions.map((option) => <Pressable key={option} style={[styles.foodOption, editing.foodTiming === option && styles.foodOptionActive]} onPress={() => setEditing({ ...editing, foodTiming: option })}><Text style={[styles.foodOptionText, editing.foodTiming === option && styles.activeLightText]}>{foodLabels[option]}</Text></Pressable>)}</View>
            <Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.noteInput]} value={editing.notes ?? ''} onChangeText={(notes) => setEditing({ ...editing, notes })} multiline placeholder="Your own notes, brand, clinician instructions…" placeholderTextColor={colors.lightMuted} />
            <Pressable style={[styles.reminderToggle, editing.reminderEnabled && styles.reminderOn]} onPress={() => setEditing({ ...editing, reminderEnabled: !editing.reminderEnabled })}><Text style={styles.reminderToggleText}>{editing.reminderEnabled ? '✓ Daily reminder on' : 'Daily reminder off'}</Text></Pressable>
            <View style={styles.actions}><Pressable style={styles.cancelButton} onPress={() => setEditing(undefined)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable style={styles.saveButton} disabled={saving} onPress={() => void saveEditing()}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable></View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>;
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Pressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹ Back</Text></Pressable><Text style={styles.title}>Supplements</Text><View style={styles.headerSpacer} /></View>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>TODAY</Text><Text style={styles.summaryValue}>{completed} of {vitamins.length} taken</Text><Text style={styles.summaryNote}>Track what you actually take. Reference intakes are guidance, not automatic supplement doses.</Text></View>
      <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search nutrients, common names, or categories" placeholderTextColor={colors.lightMuted} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{nutrientCategories.map((category) => <Pressable key={category} style={[styles.filterChip, filter === category && styles.filterChipActive]} onPress={() => setFilter(category)}><Text style={[styles.filterText, filter === category && styles.activeLightText]}>{category}</Text></Pressable>)}</ScrollView>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>My Supplements</Text><Pressable onPress={() => beginAdd()}><Text style={styles.linkText}>+ Custom</Text></Pressable></View>
      {sorted.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No tracked supplements yet</Text><Text style={styles.emptyText}>Add from the library or create a custom item. FitTrack will not assume you need every nutrient as a supplement.</Text></View> : sorted.map((item) => {
        const isTaken = item.takenDates.includes(today);
        const reference = findNutrientReference(item.referenceId);
        return <View key={item.id} style={styles.vitaminCard}>
          <View style={styles.row}><View style={styles.flex}><Text style={styles.vitaminName}>{item.name}</Text><Text style={styles.meta}>{friendlyTime(item.time)}{item.dose ? ` · ${item.dose}` : ''}{item.frequency ? ` · ${item.frequency}` : ''}</Text></View><Text style={styles.pill}>💊</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>{reference?.category ?? 'Custom'} · {foodLabels[item.foodTiming]}</Text></View>
          {!!item.notes && <Text style={styles.guidance}>{item.notes}</Text>}
          {!!item.guidance && <Text style={styles.guidance}>{item.guidance}</Text>}
          <Text style={styles.reminderStatus}>{item.reminderEnabled ? `Reminder set for ${friendlyTime(item.time)}` : 'Reminder off'}</Text>
          <View style={styles.actions}><Pressable style={[styles.takenButton, isTaken && styles.takenActive]} onPress={() => void toggleTaken(item)}><Text style={[styles.takenText, isTaken && styles.takenTextActive]}>{isTaken ? '✓ Taken today' : 'Mark as taken'}</Text></Pressable><Pressable style={styles.editButton} onPress={() => setEditing(item)}><Text style={styles.editText}>Edit</Text></Pressable><Pressable style={styles.removeButton} onPress={() => confirmDelete(item)}><Text style={styles.removeText}>Remove</Text></Pressable></View>
        </View>;
      })}
      <Text style={styles.sectionTitle}>Reference Library</Text>
      {filteredReferences.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No matching nutrients</Text><Text style={styles.emptyText}>Try clearing filters or searching a different name, category, or common name.</Text></View> : filteredReferences.map((item) => <Pressable key={item.id} style={styles.referenceCard} onPress={() => setSelectedReference(item)}><View style={styles.row}><View style={styles.flex}><Text style={styles.vitaminName}>{item.name}</Text><Text style={styles.meta}>{item.category} · {item.alternativeNames.slice(0, 2).join(', ')}</Text></View><Text style={styles.chevron}>›</Text></View><Text style={styles.guidance}>{item.shortDescription}</Text><View style={styles.actions}><Pressable style={styles.takenButton} onPress={(event) => { event.stopPropagation(); beginAdd(item); }}><Text style={styles.takenText}>{trackedIds.has(item.id) ? 'Add another' : '+ Add to My Supplements'}</Text></Pressable></View></Pressable>)}
      <View style={styles.safetyCard}><Text style={styles.safetyTitle}>Evidence-based guidance only</Text><Text style={styles.safetyText}>Essential nutrient does not mean everyone needs a pill. Use labels, diet, lab results, and clinician guidance for medical decisions, especially for iron, vitamin D, B12, vitamin A, vitamin B6, niacin, zinc and selenium.</Text></View>
      <Modal visible={Boolean(selectedReference)} animationType="slide" onRequestClose={() => setSelectedReference(undefined)}>{selectedReference && <ScrollView contentContainerStyle={styles.detailContainer}><Pressable style={styles.closeButton} onPress={() => setSelectedReference(undefined)}><Text style={styles.backText}>Close</Text></Pressable><Text style={styles.detailName}>{selectedReference.name}</Text><Text style={styles.categoryPill}>{selectedReference.category}</Text><Section title="What it does">{selectedReference.functions.join(' • ')}</Section><Section title="Training & Recovery">{selectedReference.trainingAndRecovery}</Section><Section title="Food Sources">{selectedReference.foodSources.join(', ')}</Section><Section title="Recommended Intake">{selectedReference.recommendedIntake}</Section><Section title="Best Way to Take">{selectedReference.preferredAdministration === 'with-food' ? 'With food' : selectedReference.preferredAdministration === 'without-food' ? 'Without food when tolerated' : 'With or without food'}</Section><Section title="Timing">{selectedReference.timing}</Section><Section title="Interactions">{selectedReference.interactions.join(' ')}</Section><Section title="Safety / Upper Limit">{selectedReference.safetyNotes.join(' ')} Upper limit: {selectedReference.upperLimit}</Section><Section title="Notes">{selectedReference.supplementationGuidance}</Section><Section title="Sources">{selectedReference.evidenceSources.map((source) => source.label).join(' • ')}</Section><Pressable style={styles.addButton} onPress={() => beginAdd(selectedReference)}><Text style={styles.addText}>+ Add to My Supplements</Text></Pressable></ScrollView>}</Modal>
      {renderEditor()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 20, paddingTop: 58, paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { minWidth: 72, paddingVertical: 10 }, backText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 25, fontWeight: '900' }, headerSpacer: { width: 72 },
  summaryCard: { backgroundColor: colors.text, padding: 22, borderRadius: 22, marginBottom: 14 },
  summaryLabel: { color: colors.lightMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, summaryValue: { color: colors.surface, fontSize: 27, fontWeight: '900', marginTop: 5 }, summaryNote: { color: colors.lightMuted, fontSize: 12, marginTop: 5, lineHeight: 17 },
  searchInput: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 13, color: colors.text, fontSize: 15, marginBottom: 10 },
  filterRow: { gap: 8, paddingBottom: 14 }, filterChip: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, filterChipActive: { backgroundColor: colors.text }, filterText: { color: colors.muted, fontWeight: '900', fontSize: 12 }, activeLightText: { color: colors.surface },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: 10 }, sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 8, marginBottom: 10 }, linkText: { color: colors.text, fontWeight: '900' },
  vitaminCard: { backgroundColor: colors.surface, padding: 18, borderRadius: 20, marginBottom: 12 }, referenceCard: { backgroundColor: colors.surface, padding: 17, borderRadius: 19, marginBottom: 11 },
  row: { flexDirection: 'row', alignItems: 'center' }, flex: { flex: 1 }, pill: { fontSize: 26 }, chevron: { fontSize: 32, color: colors.text },
  vitaminName: { color: colors.text, fontSize: 20, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 3 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.soft2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 12 }, badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  guidance: { color: '#4B5563', fontSize: 13, lineHeight: 19, marginTop: 10 }, reminderStatus: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 }, takenButton: { flex: 1, backgroundColor: colors.soft, borderRadius: 13, padding: 13, alignItems: 'center' }, takenActive: { backgroundColor: '#DCFCE7' },
  takenText: { color: colors.text, fontWeight: '900' }, takenTextActive: { color: '#166534' }, editButton: { paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.soft2, borderRadius: 12 }, editText: { color: colors.text, fontWeight: '900' }, removeButton: { paddingHorizontal: 12, justifyContent: 'center' }, removeText: { color: '#B91C1C', fontWeight: '800' },
  addButton: { backgroundColor: colors.text, borderRadius: 17, padding: 17, alignItems: 'center', marginTop: 12 }, addText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 17, marginBottom: 12 }, emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 16 }, emptyText: { color: colors.muted, marginTop: 5, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', justifyContent: 'flex-end' }, editorCard: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, editorContent: { padding: 20, paddingBottom: 38 },
  formTitle: { color: colors.text, fontSize: 22, fontWeight: '900' }, referenceHint: { color: colors.muted, marginTop: 8, lineHeight: 18 }, label: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 7 },
  input: { backgroundColor: colors.soft2, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 15 }, inlineInputs: { flexDirection: 'row', gap: 8 }, doseInput: { flex: 1.2 }, unitInput: { flex: 1 }, noteInput: { minHeight: 86, textAlignVertical: 'top' },
  foodOptions: { gap: 7 }, foodOption: { backgroundColor: colors.soft2, padding: 12, borderRadius: 12 }, foodOptionActive: { backgroundColor: colors.text }, foodOptionText: { color: colors.muted, fontWeight: '800', textAlign: 'center' },
  reminderToggle: { backgroundColor: colors.soft2, borderRadius: 13, padding: 14, marginTop: 16 }, reminderOn: { backgroundColor: '#DBEAFE' }, reminderToggleText: { color: colors.text, fontWeight: '900', textAlign: 'center' },
  cancelButton: { flex: 1, backgroundColor: colors.soft, borderRadius: 13, padding: 14, alignItems: 'center' }, cancelText: { color: colors.text, fontWeight: '900' }, saveButton: { flex: 1.4, backgroundColor: colors.text, borderRadius: 13, padding: 14, alignItems: 'center' }, saveText: { color: colors.surface, fontWeight: '900' },
  safetyCard: { backgroundColor: '#FFF7ED', borderRadius: 18, padding: 17, marginTop: 14 }, safetyTitle: { color: '#9A3412', fontSize: 14, fontWeight: '900' }, safetyText: { color: '#7C2D12', fontSize: 12, lineHeight: 18, marginTop: 5 },
  detailContainer: { backgroundColor: colors.background, padding: 20, paddingTop: 58, paddingBottom: 80 }, closeButton: { alignSelf: 'flex-start', paddingVertical: 10, marginBottom: 4 }, detailName: { color: colors.text, fontSize: 29, fontWeight: '900' }, categoryPill: { alignSelf: 'flex-start', color: colors.surface, backgroundColor: colors.text, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 7, marginTop: 10, marginBottom: 8, fontWeight: '900' },
  detailSection: { backgroundColor: colors.surface, borderRadius: 17, padding: 16, marginTop: 10 }, detailTitle: { color: colors.text, fontWeight: '900', fontSize: 15 }, detailText: { color: '#374151', lineHeight: 20, marginTop: 6 },
});
