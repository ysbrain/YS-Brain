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
import { formatDateYYYYMMDDCompact } from '@/src/utils/dateTime';
import { normalizeParam } from '@/src/utils/routeParams';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() =>
    formatDateYYYYMMDDCompact(new Date()),
  );

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const sync = () => {
      setTodayKey(formatDateYYYYMMDDCompact(new Date()));
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

  return todayKey;
}

export default function AutoclaveScreen() {
  const profile = useProfile();
  const user = useAuth().user;
  const clinicId = profile?.clinic;

  const params = useLocalSearchParams<{
    roomId?: string | string[];
    applianceId?: string | string[];
  }>();

  const roomId = normalizeParam(params.roomId);
  const applianceId = normalizeParam(params.applianceId);

  const [activeTab, setActiveTab] =
    useState<AutoclaveTabKey>('dailyOps');

  const [saving, setSaving] = useState(false);
  const { setUiLocked } = useUiLock();

  const currentDate = useTodayKey();

  const {
    loading,
    loadError,
    applianceName,
    applianceKey,
    setup,
    lastCycle,
    isRunning,
    currentCycle,
  } = useAutoclaveAppliance({
    clinicId,
    roomId,
    applianceId,
  });

  return (
    <>
      <Stack.Screen options={{ title: applianceName || 'Autoclave' }} />

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
                lastCycle={lastCycle}
                applianceKey={applianceKey}
                isRunning={isRunning}
                currentCycle={currentCycle}
                currentDate={currentDate}
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
                applianceKey={applianceKey}
                setup={setup}
                userUid={user?.uid ?? null}
                userName={profile?.name ?? null}
                loading={loading}
                loadError={loadError}
                currentDate={currentDate}
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
                applianceKey={applianceKey}
                setup={setup}
                userUid={user?.uid ?? null}
                userName={profile?.name ?? null}
                loading={loading}
                loadError={loadError}
                currentDate={currentDate}
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
  placeholderWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  placeholderCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 240,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#334155',
  },
  placeholderText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
