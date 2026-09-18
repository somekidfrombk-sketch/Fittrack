import { router } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { reloadAsync } from 'expo-updates';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../constants/theme';
import type { ICloudBackupStatus } from '../types/icloudBackup';
import { createFitTrackExport } from '../services/data-export';
import {
  createICloudBackup,
  getICloudBackupStatus,
  restoreICloudBackup,
} from '../services/icloud-backup';
import { shareExportFile } from '../services/export-file';
import {
  loadPhonePedometerEnabled,
  savePhonePedometerEnabled,
} from '../services/health-connection-storage';
import { loadProfile } from '../services/profile-storage';
import {
  loadRunNotificationDistance,
  saveRunNotificationDistance,
} from '../services/run-notification-settings';

export default function SettingsScreen() {
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [runNoticeMiles, setRunNoticeMiles] = useState<number | null>(1);
  const [customDistance, setCustomDistance] = useState('');
  const [exporting, setExporting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<ICloudBackupStatus>({
    available: false,
    exists: false,
    lastBackupAt: null,
    fileCount: 0,
  });

  useEffect(() => {
    const loadSettings = async () => {
      const [connected, profile] = await Promise.all([
        loadPhonePedometerEnabled(),
        loadProfile(),
      ]);
      setPhoneConnected(connected);
      if (profile?.id) {
        setProfileId(profile.id);
        setRunNoticeMiles(await loadRunNotificationDistance(profile.id));
      }
    };
    void loadSettings();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void getICloudBackupStatus().then(setBackupStatus);
  }, []);

  const chooseRunNoticeDistance = async (distanceMiles: number | null) => {
    if (!profileId) {
      Alert.alert('Save Your Profile', 'Save your Profile before changing run notifications.');
      return;
    }
    setRunNoticeMiles(await saveRunNotificationDistance(profileId, distanceMiles));
  };

  const saveCustomRunDistance = async () => {
    const distance = Number(customDistance);
    if (!Number.isFinite(distance) || distance < 0.1 || distance > 26.2) {
      Alert.alert('Invalid Distance', 'Enter a distance from 0.1 to 26.2 miles.');
      return;
    }
    await chooseRunNoticeDistance(distance);
    setCustomDistance('');
  };

  const togglePhonePedometer = async () => {
    if (phoneConnected) {
      await savePhonePedometerEnabled(false);
      setPhoneConnected(false);
      return;
    }

    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'Pedometer unavailable',
          'This device cannot provide step data to FitTrack.'
        );
        return;
      }

      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Motion access needed',
          'Allow motion access in your device settings to count steps.'
        );
        return;
      }

      await savePhonePedometerEnabled(true);
      setPhoneConnected(true);
    } catch (error) {
      console.error('Failed to connect phone pedometer:', error);
      Alert.alert('Could not connect', 'Please try again on your phone.');
    }
  };

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const file = await createFitTrackExport();
      await shareExportFile(file.filename, file.contents);
    } catch (error) {
      console.error('Failed to export FitTrack data:', error);
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const backupToICloud = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await createICloudBackup();
      setBackupStatus({
        available: true,
        exists: true,
        lastBackupAt: result.completedAt,
        fileCount: result.fileCount,
      });
      Alert.alert('Backup complete', 'Your FitTrack data and photos are saved in iCloud.');
    } catch (error) {
      console.error('iCloud backup failed:', error);
      Alert.alert('Backup failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreFromICloud = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await restoreICloudBackup();
      Alert.alert(
        'Restore complete',
        'Your FitTrack data and photos were restored. FitTrack will reload now.',
        [{ text: 'Reload FitTrack', onPress: () => { void reloadAsync().catch(() => Alert.alert('Restart FitTrack', 'Close and reopen FitTrack to load your restored data.')); } }]
      );
    } catch (error) {
      console.error('iCloud restore failed:', error);
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const confirmRestore = () => {
    Alert.alert(
      'Restore FitTrack from iCloud?',
      'Saved iCloud data will replace matching FitTrack data on this phone. Current data is not removed until the backup downloads successfully.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => void restoreFromICloud() },
      ]
    );
  };

  const confirmExport = () => {
    const message = 'The export contains personal health, nutrition, and exercise data. Share it only where you choose.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void exportData();
      return;
    }
    Alert.alert('Export private FitTrack data?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create File', onPress: () => void exportData() },
    ]);
  };

  const explainWearableConnection = () => {
    const source = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
    Alert.alert(
      `${source} integration`,
      `This connection is prepared for a future native build. Once enabled, Apple Watch can sync through Apple Health and Amazfit can sync through the Zepp app into ${source}.`
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>

        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.sectionTitle}>Run notifications</Text>
      <Text style={styles.sectionIntro}>
        Choose how often FitTrack alerts you during a GPS run. This preference is saved to your Profile.
      </Text>
      <View style={styles.connectionCard}>
        <Text style={styles.cardTitle}>Distance alert</Text>
        <Text style={styles.body}>
          {runNoticeMiles === null
            ? 'Distance notifications are off.'
            : `Notify every ${runNoticeMiles} mile${runNoticeMiles === 1 ? '' : 's'}.`}
        </Text>
        <View style={styles.distanceOptions}>
          {[0.25, 0.5, 1, 2, 5].map((distance) => (
            <Pressable
              key={distance}
              style={[
                styles.distanceButton,
                runNoticeMiles === distance && styles.distanceButtonSelected,
              ]}
              onPress={() => void chooseRunNoticeDistance(distance)}
            >
              <Text style={[
                styles.distanceButtonText,
                runNoticeMiles === distance && styles.distanceButtonTextSelected,
              ]}>
                {distance} mi
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.distanceButton, runNoticeMiles === null && styles.distanceButtonSelected]}
            onPress={() => void chooseRunNoticeDistance(null)}
          >
            <Text style={[
              styles.distanceButtonText,
              runNoticeMiles === null && styles.distanceButtonTextSelected,
            ]}>Off</Text>
          </Pressable>
        </View>
        <Text style={styles.customLabel}>CUSTOM MILES</Text>
        <View style={styles.customRow}>
          <TextInput
            value={customDistance}
            onChangeText={(value) => setCustomDistance(value.replace(/[^0-9.]/g, ''))}
            placeholder="Example: 0.75"
            placeholderTextColor={colors.lightMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => void saveCustomRunDistance()}
            style={styles.customInput}
          />
          <Pressable style={styles.customSaveButton} onPress={() => void saveCustomRunDistance()}>
            <Text style={styles.customSaveText}>Save</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your data</Text>
      <Text style={styles.sectionIntro}>
        Create a readable JSON file containing your FitTrack profile, meals, workouts, activities, steps, vitamins, and preferences. You can attach this file to ChatGPT.
      </Text>
      {Platform.OS === 'ios' ? (
        <View style={styles.connectionCard}>
          <Text style={styles.cardTitle}>iCloud Backup</Text>
          <Text style={styles.body}>
            {backupStatus.exists && backupStatus.lastBackupAt
              ? `Last backup: ${new Date(backupStatus.lastBackupAt).toLocaleString()} · ${backupStatus.fileCount} photo file${backupStatus.fileCount === 1 ? '' : 's'}`
              : backupStatus.available
                ? 'No FitTrack backup has been created yet.'
                : 'iCloud Drive is unavailable. Make sure you are signed in and iCloud Drive is enabled.'}
          </Text>
          <View style={styles.backupButtons}>
            <Pressable
              accessibilityRole="button"
              disabled={backupBusy || !backupStatus.available}
              style={[styles.connectButton, styles.backupButton, (backupBusy || !backupStatus.available) && styles.disabledButton]}
              onPress={() => void backupToICloud()}
            >
              <Text style={styles.connectButtonText}>{backupBusy ? 'Working…' : 'Back Up Now'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={backupBusy || !backupStatus.exists}
              style={[styles.connectButton, styles.backupButton, styles.restoreButton, (backupBusy || !backupStatus.exists) && styles.disabledButton]}
              onPress={confirmRestore}
            >
              <Text style={styles.connectButtonText}>Restore</Text>
            </Pressable>
          </View>
          <Text style={styles.backupNote}>
            FitTrack also attempts a safe backup when the app moves to the background. Apple Health information stays in Apple Health and is not copied.
          </Text>
        </View>
      ) : null}

      <View style={styles.connectionCard}>
        <Text style={styles.cardTitle}>Export for ChatGPT</Text>
        <Text style={styles.body}>
          Workout photo files and your profile picture are not included. The file still contains private health data.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={exporting}
          style={[styles.connectButton, exporting && styles.disabledButton]}
          onPress={confirmExport}
        >
          <Text style={styles.connectButtonText}>{exporting ? 'Preparing file…' : 'Export My Data'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Health connections</Text>
      <Text style={styles.sectionIntro}>
        Choose where FitTrack gets steps and heart-rate data. You stay in
        control of device permissions.
      </Text>

      <ConnectionCard
        title="Phone pedometer"
        detail="Counts steps using this phone. No heart-rate access."
        status={phoneConnected ? 'Connected' : 'Not connected'}
        connected={phoneConnected}
        buttonLabel={phoneConnected ? 'Disconnect' : 'Connect'}
        onPress={togglePhonePedometer}
      />

      <ConnectionCard
        title={Platform.OS === 'android' ? 'Health Connect' : 'Apple Health'}
        detail={
          Platform.OS === 'android'
            ? 'For Amazfit/Zepp steps and heart rate on Android.'
            : 'For Apple Watch or Amazfit/Zepp steps and heart rate.'
        }
        status="Native integration next"
        buttonLabel="Learn more"
        onPress={explainWearableConnection}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How Amazfit connects</Text>
        <Text style={styles.body}>
          In Zepp, enable sharing with Apple Health on iPhone or Health
          Connect on Android. FitTrack will read the approved data from that
          health service when native syncing is enabled.
        </Text>
      </View>
    </ScrollView>
  );
}

function ConnectionCard({
  title,
  detail,
  status,
  connected = false,
  buttonLabel,
  onPress,
}: {
  title: string;
  detail: string;
  status: string;
  connected?: boolean;
  buttonLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.connectionCard}>
      <View style={styles.connectionHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.status, connected && styles.statusConnected]}>
          {status}
        </Text>
      </View>
      <Text style={styles.body}>{detail}</Text>
      <Pressable
        accessibilityRole="button"
        style={[styles.connectButton, connected && styles.disconnectButton]}
        onPress={onPress}
      >
        <Text style={styles.connectButtonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  headerSpacer: {
    width: 48,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  sectionIntro: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  distanceButton: {
    minWidth: 70,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft2,
  },
  distanceButtonSelected: { backgroundColor: colors.text },
  distanceButtonText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  distanceButtonTextSelected: { color: colors.surface },
  customLabel: {
    marginTop: 18,
    marginBottom: 7,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.lightMuted,
  },
  customRow: { flexDirection: 'row', gap: 10 },
  customInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    paddingHorizontal: 13,
    backgroundColor: colors.soft2,
    color: colors.text,
    fontWeight: '800',
  },
  customSaveButton: {
    minWidth: 82,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  customSaveText: { color: colors.surface, fontSize: 13, fontWeight: '900' },
  connectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  status: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    backgroundColor: colors.soft2,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusConnected: {
    color: colors.text,
    backgroundColor: colors.soft,
  },
  connectButton: {
    minHeight: 46,
    marginTop: 16,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  disconnectButton: {
    backgroundColor: colors.muted,
  },
  backupButtons: { flexDirection: 'row', gap: 10 },
  backupButton: { flex: 1 },
  restoreButton: { backgroundColor: colors.muted },
  backupNote: { marginTop: 12, fontSize: 11, lineHeight: 16, color: colors.lightMuted },
  disabledButton: { opacity: 0.55 },
  connectButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '900',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
});
