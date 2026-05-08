// app/(tabs)/clinic/autoclave.tsx

import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import {
  AutoclaveTabBar,
  type AutoclaveTabKey,
} from '@/src/components/autoclave/AutoclaveTabBar';
import { DailyOpsView } from '@/src/components/autoclave/DailyOpsView';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useUiLock } from '@/src/contexts/UiLockContext';
import type {
  DailyOpsActivePicker,
  DailyOpsPickerField,
} from '@/src/hooks/autoclave/types';
import { useAutoclaveAppliance } from '@/src/hooks/autoclave/useAutoclaveAppliance';
import { useAutoclaveDailyOpsCycle } from '@/src/hooks/autoclave/useAutoclaveDailyOpsCycle';
import { useDailyOpsController } from '@/src/hooks/autoclave/useDailyOpsController';
import { useKeyboardAwareFieldScroll } from '@/src/hooks/useKeyboardAwareFieldScroll';
import {
  formatDateYYYYMMDDCompact,
  formatTimeHHMM,
  parseHHMM,
} from '@/src/utils/dateTime';
import { cropToAspect } from '@/src/utils/photo';
import { normalizeParam } from '@/src/utils/routeParams';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

const PHOTO_ASPECT = 4 / 3;

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

function PlaceholderTab({ label }: { label: string }) {
  return (
    <View style={styles.placeholderCard}>
      <MaterialCommunityIcons
        name="hammer-wrench"
        size={28}
        color="#64748b"
      />
      <Text style={styles.placeholderTitle}>{label}</Text>
      <Text style={styles.placeholderText}>This tab will be built next.</Text>
    </View>
  );
}

export default function AutoclaveScreen() {
  const router = useRouter();
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

  const {
    cycleDocLoading,
    cycleDocError,
    cycleDoc,
  } = useAutoclaveDailyOpsCycle({
    clinicId,
    roomId,
    applianceId,
    isRunning,
    currentCycle,
  });

  const [cameraOpen, setCameraOpen] = useState(false);

  const [activePicker, setActivePicker] =
    useState<DailyOpsActivePicker>(null);

  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const pickerTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const overlayBg = isDark ? '#333' : '#fff';
  const overlayBorder = '#111';
  const overlayText = isDark ? '#fff' : '#111';
  const overlayBackdrop = isDark
    ? 'rgba(0,0,0,0.45)'
    : 'rgba(0,0,0,0.15)';

  const IOS_PICKER_HEIGHT = 216;
  const IOS_PICKER_HEADER_HEIGHT = 44;
  const IOS_PICKER_TOTAL =
    IOS_PICKER_HEIGHT + IOS_PICKER_HEADER_HEIGHT + 12;

  const pickerOverlayHeight =
    Platform.OS === 'ios' && activePicker ? IOS_PICKER_TOTAL : 0;

  const {
    scrollRef,
    registerFieldRef,
    onFieldFocus,
    onFieldBlur,
    handleScroll,
    requestScroll,
    contentBottomPadding,
  } = useKeyboardAwareFieldScroll({
    activeOverlayFieldKey: activePicker
      ? `daily:${activePicker.field}`
      : null,
    overlayHeight: pickerOverlayHeight,
  });

  const currentDate = useTodayKey();

  const dailyOps = useDailyOpsController({
    clinicId,
    roomId,
    applianceId,

    userUid: user?.uid ?? null,
    userName: profile?.name ?? null,

    loading,
    loadError,
    setup,
    lastCycle,
    isRunning,
    currentCycle,
    applianceKey,

    cycleDocLoading,
    cycleDocError,
    cycleDoc,

    currentDate,

    saving,
    setSaving,
    setUiLocked,
    setActivePicker,
    requestScroll,
    routerBack: () => router.back(),
  });

  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();

    if (activePicker.field === 'startTime') {
      return parseHHMM(dailyOps.startTime) ?? new Date();
    }

    if (activePicker.field === 'unloadTime') {
      return parseHHMM(dailyOps.unloadTime) ?? new Date();
    }

    return new Date();
  }, [activePicker, dailyOps.startTime, dailyOps.unloadTime]);

  const openPicker = useCallback(
    (field: DailyOpsPickerField, mode: 'time') => {
      Keyboard.dismiss();

      const initial =
        field === 'startTime'
          ? parseHHMM(dailyOps.startTime) ?? new Date()
          : parseHHMM(dailyOps.unloadTime) ?? new Date();

      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [dailyOps.startTime, dailyOps.unloadTime],
  );

  const onPickerChange = useCallback(
    (evt: DateTimePickerEvent, date?: Date) => {
      if (!activePicker) return;

      if (Platform.OS !== 'ios' && evt.type === 'dismissed') {
        setActivePicker(null);
        return;
      }

      if (!date) return;

      if (Platform.OS === 'ios') {
        setPickerDraft(date);
        return;
      }

      if (activePicker.field === 'startTime') {
        dailyOps.setStartTime(formatTimeHHMM(date));
      } else if (activePicker.field === 'unloadTime') {
        dailyOps.setUnloadTime(formatTimeHHMM(date));
      }

      setActivePicker(null);
    },
    [
      activePicker,
      dailyOps.setStartTime,
      dailyOps.setUnloadTime,
    ],
  );

  const closePicker = useCallback(() => {
    setActivePicker(null);
  }, []);

  const commitPicker = useCallback(() => {
    if (activePicker?.field === 'startTime') {
      dailyOps.setStartTime(formatTimeHHMM(pickerDraft));
    } else if (activePicker?.field === 'unloadTime') {
      dailyOps.setUnloadTime(formatTimeHHMM(pickerDraft));
    }

    setActivePicker(null);
  }, [
    activePicker,
    pickerDraft,
    dailyOps.setStartTime,
    dailyOps.setUnloadTime,
  ]);

  const openCamera = useCallback(() => {
    setCameraOpen(true);
  }, []);

  const closeCamera = useCallback(() => {
    setCameraOpen(false);
  }, []);

  const onCapturedPhoto = useCallback(
    async (photo: { uri: string; width: number; height: number }) => {
      try {
        const croppedUri = await cropToAspect({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          aspectRatio: PHOTO_ASPECT,
        });

        dailyOps.setPhotoUri(croppedUri);

        if (dailyOps.formErrorField === 'daily:photoEvidence') {
          dailyOps.setFormErrorField(null);
        }
      } catch (err) {
        console.error('autoclave photo process error', err);
        Alert.alert('Photo error', 'Failed to process the captured photo.');
      } finally {
        closeCamera();
      }
    },
    [
      closeCamera,
      dailyOps.formErrorField,
      dailyOps.setFormErrorField,
      dailyOps.setPhotoUri,
    ],
  );

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
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: contentBottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {activeTab === 'dailyOps' && (
              <DailyOpsView
                controller={dailyOps}
                registerFieldRef={registerFieldRef}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
                openPicker={openPicker}
                onOpenCamera={openCamera}
                saving={saving}
              />
            )}

            {activeTab === 'helix' && <PlaceholderTab label="Helix" />}
            {activeTab === 'spore' && <PlaceholderTab label="Spore" />}
          </ScrollView>
        )}

        {/* Android native picker */}
        {Platform.OS !== 'ios' && activePicker && (
          <DateTimePicker
            value={activePickerValue}
            mode={activePicker.mode}
            display="default"
            onChange={onPickerChange}
          />
        )}

        {/* iOS picker overlay */}
        {Platform.OS === 'ios' && activePicker && (
          <View style={styles.dateOverlayWrap} pointerEvents="auto">
            <Pressable
              style={[
                styles.dateOverlayBackdrop,
                { backgroundColor: overlayBackdrop },
              ]}
              onPress={closePicker}
            />

            <View
              style={[
                styles.dateOverlayPanel,
                {
                  backgroundColor: overlayBg,
                  borderTopColor: overlayBorder,
                },
              ]}
            >
              <View style={styles.dateOverlayHeader}>
                <Pressable
                  onPress={commitPicker}
                  style={({ pressed }) => [
                    styles.dateDoneBtn,
                    {
                      borderColor: overlayBorder,
                      backgroundColor: overlayBg,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dateDoneText,
                      { color: overlayText },
                    ]}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={pickerDraft}
                mode={activePicker.mode}
                display="spinner"
                onChange={onPickerChange}
                themeVariant={pickerTheme}
                textColor={overlayText as any}
                style={[
                  styles.iosPicker,
                  { backgroundColor: overlayBg },
                ]}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <CameraCaptureModal
        visible={cameraOpen}
        onClose={closeCamera}
        onCaptured={onCapturedPhoto}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
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
  dateOverlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
  },
  dateOverlayBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  dateOverlayPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingBottom: 12,
  },
  dateOverlayHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dateDoneBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  dateDoneText: {
    fontWeight: '900',
  },
  iosPicker: {
    width: '100%',
    minWidth: 280,
    height: 216,
  },
});
