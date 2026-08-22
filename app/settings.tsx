import { router } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../constants/theme';
import {
  loadPhonePedometerEnabled,
  savePhonePedometerEnabled,
} from '../services/health-connection-storage';

export default function SettingsScreen() {
  const [phoneConnected, setPhoneConnected] = useState(false);

  useEffect(() => {
    void loadPhonePedometerEnabled().then(setPhoneConnected);
  }, []);

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
