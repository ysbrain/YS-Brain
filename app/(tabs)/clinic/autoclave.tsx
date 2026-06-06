// app/(tabs)/clinic/autoclave.tsx

import {
  AutoclaveTabBar,
  type AutoclaveTabKey,
} from '@/src/components/autoclave/AutoclaveTabBar';
import { AutoclaveTestTab } from '@/src/components/autoclave/AutoclaveTestTab';
import { DailyOpsTab } from '@/src/components/autoclave/DailyOpsTab';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useUiLock } from '@/src/contexts/UiLockContext';
import { useAutoclaveAppliance } from '@/src/hooks/autoclave/useAutoclaveAppliance';
import {
  formatDateFullYYYYMMDD,
  formatDateShortYYMMDD,
} from '@/src/utils/dateTime';
import { normalizeParam } from '@/src/utils/routeParams';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function useTodayDateKeys(): {
  dateYYYYMMDD: string;
  dateYYMMDD: string;
} {
  const buildKeys = () => {
    const now = new Date();

    return {
      dateYYYYMMDD: formatDateFullYYYYMMDD(now),
      dateYYMMDD: formatDateShortYYMMDD(now),
    };
  };

  const [dateKeys, setDateKeys] = useState(buildKeys);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const sync = () => {
      setDateKeys(buildKeys());
    };

    const now = new Date();
    const delayToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const timeoutId = setTimeout(() => {
      sync();
      intervalId = setInterval(sync, 60_000);
    }, delayToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return dateKeys;
}

export default function AutoclaveScreen() {
  const profile = useProfile();
  const user = useAuth().user;
  const clinicId = profile?.clinic;
  const router = useRouter();

  const params = useLocalSearchParams<{
    roomId?: string | string[];
    applianceId?: string | string[];
  }>();

  const roomId = normalizeParam(params.roomId);
  const applianceId = normalizeParam(params.applianceId);

  const openApplianceLog = () => {
    if (!roomId || !applianceId) return;

    router.push({
      pathname: '/clinic/appliance-log',
      params: {
        roomId: String(roomId),
        applianceId: String(applianceId),
        applianceName: applianceName || 'Autoclave',
        typeKey: 'autoclave',
        typeName: 'Autoclave',
      },
    });
  };

  const [activeTab, setActiveTab] =
    useState<AutoclaveTabKey>('dailyOps');

  const [saving, setSaving] = useState(false);
  const { setUiLocked } = useUiLock();

  const { dateYYYYMMDD, dateYYMMDD } = useTodayDateKeys();

  const {
    loading,
    loadError,
    applianceName,
    applianceKey,
    setup,
    lastStartedCycle,
    lastFinishedCycle,
    isRunning,
    currentCycle,
  } = useAutoclaveAppliance({
    clinicId,
    roomId,
    applianceId,
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: applianceName || 'Autoclave',
          headerRight: () => (
            <Pressable
              onPress={openApplianceLog}
              disabled={!roomId || !applianceId}
              style={({ pressed }) => [
                styles.headerLogButton,
                pressed && { opacity: 0.8 },
                (!roomId || !applianceId) && styles.headerLogButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open appliance log"
            >
              <MaterialCommunityIcons
                name="history"
                size={17}
                color="#fff"
              />
              <Text style={styles.headerLogButtonText}>Log</Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AutoclaveTabBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          disabled={saving}
        />

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator />
            <Text style={styles.helperText}>Loading autoclave...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.centerWrap}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
          <>
            {activeTab === 'dailyOps' && (
              <DailyOpsTab
                clinicId={clinicId}
                roomId={roomId}
                applianceId={applianceId}
                userUid={user?.uid ?? null}
                userName={profile?.name ?? null}
                loading={loading}
                loadError={loadError}
                setup={setup}
                lastStartedCycle={lastStartedCycle}
                lastFinishedCycle={lastFinishedCycle}
                applianceKey={applianceKey}
                isRunning={isRunning}
                currentCycle={currentCycle}
                currentDateYYMMDD={dateYYMMDD}
                saving={saving}
                setSaving={setSaving}
                setUiLocked={setUiLocked}
              />
            )}

            {activeTab === 'helix' && (
              <AutoclaveTestTab
                testType="helix"
                clinicId={clinicId}
                roomId={roomId}
                applianceId={applianceId}
                applianceName={applianceName}
                applianceKey={applianceKey}
                setup={setup}
                userUid={user?.uid ?? null}
                userName={profile?.name ?? null}
                loading={loading}
                loadError={loadError}
                currentDateYYYYMMDD={dateYYYYMMDD}
                saving={saving}
                setSaving={setSaving}
                setUiLocked={setUiLocked}
              />
            )}

            {activeTab === 'spore' && (
              <AutoclaveTestTab
                testType="spore"
                clinicId={clinicId}
                roomId={roomId}
                applianceId={applianceId}
                applianceName={applianceName}
                applianceKey={applianceKey}
                setup={setup}
                userUid={user?.uid ?? null}
                userName={profile?.name ?? null}
                loading={loading}
                loadError={loadError}
                currentDateYYYYMMDD={dateYYYYMMDD}
                saving={saving}
                setSaving={setSaving}
                setUiLocked={setUiLocked}
              />
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  helperText: {
    color: '#666',
    fontWeight: '600',
  },
  errorText: {
    color: '#B00020',
    fontWeight: '700',
    textAlign: 'center',
  },

  headerLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  headerLogButtonDisabled: {
    opacity: 0.5,
  },

  headerLogButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});
