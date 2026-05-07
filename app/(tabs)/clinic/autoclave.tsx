// app/(tabs)/clinic/autoclave.tsx

import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import type { ActionBlocker } from '@/src/components/autoclave/ActionBlockerList';
import {
  AutoclaveTabBar,
  type AutoclaveTabKey,
} from '@/src/components/autoclave/AutoclaveTabBar';
import { DailyOpsTab } from '@/src/components/autoclave/DailyOpsTab';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useUiLock } from '@/src/contexts/UiLockContext';
import {
  setupValueToNumberString,
  setupValueToString,
  validatePositiveIntUpTo3Digits,
} from '@/src/hooks/autoclave/setupUtils';
import type { DailyOpsFieldKey } from '@/src/hooks/autoclave/types';
import { useAutoclaveAppliance } from '@/src/hooks/autoclave/useAutoclaveAppliance';
import { useAutoclaveDailyOpsActions } from '@/src/hooks/autoclave/useAutoclaveDailyOpsActions';
import { useAutoclaveDailyOpsCycle } from '@/src/hooks/autoclave/useAutoclaveDailyOpsCycle';
import { getStrictSerialIdPart } from '@/src/hooks/autoclave/utils';
import { useKeyboardAwareFieldScroll } from '@/src/hooks/useKeyboardAwareFieldScroll';
import {
  formatDateYYYYMMDDCompact,
  formatTimeHHMM,
  pad2,
  parseHHMM,
} from '@/src/utils/dateTime';
import {
  cropToAspect,
  uriToBlob,
} from '@/src/utils/photo';
import { normalizeParam } from '@/src/utils/routeParams';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
  View
} from 'react-native';

type PickerField = 'startTime' | 'unloadTime';

const PHOTO_ASPECT = 4 / 3;

function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() =>
    formatDateYYYYMMDDCompact(new Date())
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
      <MaterialCommunityIcons name="hammer-wrench" size={28} color="#64748b" />
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

  const [activeTab, setActiveTab] = useState<AutoclaveTabKey>('dailyOps');

  const [saving, setSaving] = useState(false);

  const { setUiLocked } = useUiLock();
  const [formErrorField, setFormErrorField] = useState<DailyOpsFieldKey | null>(null);

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

  // Start page state
  const [maxTemp, setMaxTemp] = useState('');
  const [pressure, setPressure] = useState('');
  const [startTime, setStartTime] = useState(formatTimeHHMM(new Date()));

  const [unloadTime, setUnloadTime] = useState(formatTimeHHMM(new Date()));
  const [internalIndicator, setInternalIndicator] = useState<boolean | null>(null);
  const [externalIndicator, setExternalIndicator] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false);

  const [activePicker, setActivePicker] = useState<{ field: PickerField; mode: 'time' } | null>(
    null,
  );
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pickerTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const overlayBg = isDark ? '#333' : '#fff';
  const overlayBorder = '#111';
  const overlayText = isDark ? '#fff' : '#111';
  const overlayBackdrop = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.15)';

  const IOS_PICKER_HEIGHT = 216;
  const IOS_PICKER_HEADER_HEIGHT = 44;
  const IOS_PICKER_TOTAL = IOS_PICKER_HEIGHT + IOS_PICKER_HEADER_HEIGHT + 12;

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
    activeOverlayFieldKey: activePicker ? `daily:${activePicker.field}` : null,
    overlayHeight: pickerOverlayHeight,
  });

  useEffect(() => {
    setMaxTemp((prev) =>
      prev.trim().length > 0
        ? prev
        : setupValueToNumberString(setup, 'default_temp_c', ''),
    );

    setPressure((prev) =>
      prev.trim().length > 0
        ? prev
        : setupValueToNumberString(setup, 'default_pressure', ''),
    );
  }, [setup]);

  // Reset start-page editable defaults when appliance changes
  useEffect(() => {
    setMaxTemp('');
    setPressure('');
    setStartTime(formatTimeHHMM(new Date()));
  }, [applianceId]);

  // Reset running-page form state when cycle changes
  useEffect(() => {
    setUnloadTime(formatTimeHHMM(new Date()));
    setInternalIndicator(null);
    setExternalIndicator(null);
    setPhotoUri(null);
    setNotes('');
  }, [currentCycle]);

  const serialNumber = useMemo(() => {
    return setupValueToString(setup, 'serial_number', '').trim();
  }, [setup]);

  const strictSerialIdPart = useMemo(() => {
    return getStrictSerialIdPart(serialNumber);
  }, [serialNumber]);

  const hasValidSerialNumber = !!strictSerialIdPart;

  const currentDate = useTodayKey();

  const nextCycle = useMemo(() => {
    const lastDate = typeof lastCycle?.dateExecuted === 'string' ? lastCycle.dateExecuted : '';
    const rawCycleNumber =
      typeof lastCycle?.cycleNumber === 'number' && Number.isFinite(lastCycle.cycleNumber)
        ? lastCycle.cycleNumber
        : 0;

    const nextNumber = lastDate === currentDate ? rawCycleNumber + 1 : 1;
    return pad2(nextNumber);
  }, [lastCycle, currentDate]);

  const cycleIdPreview = useMemo(() => {
    const serialPart = strictSerialIdPart ?? 'INVALID_SERIAL';
    return `${currentDate}-${serialPart}-${nextCycle}`;
  }, [currentDate, strictSerialIdPart, nextCycle]);

  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();

    if (activePicker.field === 'startTime') {
      return parseHHMM(startTime) ?? new Date();
    }

    if (activePicker.field === 'unloadTime') {
      return parseHHMM(unloadTime) ?? new Date();
    }

    return new Date();
  }, [activePicker, startTime, unloadTime]);

  const openPicker = useCallback(
    (field: PickerField, mode: 'time') => {
      Keyboard.dismiss();

      const initial =
        field === 'startTime'
          ? parseHHMM(startTime) ?? new Date()
          : parseHHMM(unloadTime) ?? new Date();

      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [startTime, unloadTime],
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
        setStartTime(formatTimeHHMM(date));
      } else if (activePicker.field === 'unloadTime') {
        setUnloadTime(formatTimeHHMM(date));
      }

      setActivePicker(null);
    },
    [activePicker],
  );

  const closePicker = useCallback(() => setActivePicker(null), []);

  const commitPicker = useCallback(() => {
    if (activePicker?.field === 'startTime') {
      setStartTime(formatTimeHHMM(pickerDraft));
    } else if (activePicker?.field === 'unloadTime') {
      setUnloadTime(formatTimeHHMM(pickerDraft));
    }

    setActivePicker(null);
  }, [activePicker, pickerDraft]);

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
        setPhotoUri(croppedUri);
        if (formErrorField === 'daily:photoEvidence') setFormErrorField(null);
      } catch (err) {
        console.error('autoclave photo process error', err);
        Alert.alert('Photo error', 'Failed to process the captured photo.');
      } finally {
        closeCamera();
      }
    },
    [closeCamera, formErrorField],
  );

  const { onStartMachine, onFinishAndUnload } = useAutoclaveDailyOpsActions({
    clinicId,
    roomId,
    applianceId,

    userUid: user?.uid ?? null,
    userName: profile?.name ?? null,

    loading,
    loadError,
    saving,
    setSaving,
    setUiLocked,

    isRunning,
    currentCycle,
    cycleDocLoading,
    cycleDocError,

    serialNumber,
    applianceKey,

    maxTemp,
    pressure,
    startTime,

    unloadTime,
    internalIndicator,
    externalIndicator,
    photoUri,
    notes,

    setFormErrorField,
    setActivePicker,

    requestScroll,
    routerBack: () => router.back(),

    parseHHMM,
    validatePositiveIntUpTo3Digits,
    uriToBlob,
    setupValueToString,
    formatDateYYYYMMDDCompact,
    pad2,
  });

  const startBlockers = useMemo<ActionBlocker[]>(() => {
    const blockers: ActionBlocker[] = [];

    if (loading) {
      blockers.push({
        key: 'loading',
        message: 'Autoclave information is still loading.',
      });
    }

    if (loadError) {
      blockers.push({
        key: 'loadError',
        message: loadError,
      });
    }

    if (!clinicId || !roomId || !applianceId) {
      blockers.push({
        key: 'missingContext',
        message: 'Clinic, room, or appliance information is missing.',
      });
    }

    if (!user?.uid) {
      blockers.push({
        key: 'notSignedIn',
        message: 'Please sign in before starting the machine.',
      });
    }

    if (!serialNumber.trim()) {
      blockers.push({
        key: 'missingSerial',
        message: 'Missing serial number in appliance setup.',
      });
    } else if (!hasValidSerialNumber) {
      blockers.push({
        key: 'invalidSerial',
        message: 'Serial number contains unsupported characters. Please update appliance setup.',
      });
    }

    if (isRunning) {
      blockers.push({
        key: 'alreadyRunning',
        message: 'This autoclave is already running a cycle.',
      });
    }

    return blockers;
  }, [
    loading,
    loadError,
    clinicId,
    roomId,
    applianceId,
    user?.uid,
    serialNumber,
    hasValidSerialNumber,
    isRunning,
  ]);

  const canPressStartMachine =
    !saving &&
    startBlockers.length === 0;

  const hasValidCurrentCycleId =
    !!currentCycle &&
    /^\d{8}-.+-\d+$/.test(currentCycle);

  const finishBlockers = useMemo<ActionBlocker[]>(() => {
    const blockers: ActionBlocker[] = [];

    if (loading || cycleDocLoading) {
      blockers.push({
        key: 'loading',
        message: 'Cycle information is still loading.',
      });
    }

    if (loadError) {
      blockers.push({
        key: 'loadError',
        message: loadError,
      });
    }

    if (cycleDocError) {
      blockers.push({
        key: 'cycleDocError',
        message: cycleDocError,
      });
    }

    if (!clinicId || !roomId || !applianceId) {
      blockers.push({
        key: 'missingContext',
        message: 'Clinic, room, or appliance information is missing.',
      });
    }

    if (!user?.uid) {
      blockers.push({
        key: 'notSignedIn',
        message: 'Please sign in before finishing the cycle.',
      });
    }

    if (!isRunning || !currentCycle) {
      blockers.push({
        key: 'noRunningCycle',
        message: 'No running cycle was found.',
      });
    }

    if (isRunning && currentCycle && !hasValidCurrentCycleId) {
      blockers.push({
        key: 'invalidCycleId',
        message: 'Current cycle ID format is invalid.',
      });
    }

    if (applianceKey.trim().length === 0) {
      blockers.push({
        key: 'missingApplianceKey',
        message: 'Appliance key is missing.',
      });
    }

    return blockers;
  }, [
    loading,
    cycleDocLoading,
    loadError,
    cycleDocError,
    clinicId,
    roomId,
    applianceId,
    user?.uid,
    isRunning,
    currentCycle,
    hasValidCurrentCycleId,
    applianceKey,
  ]);

  const canPressFinishUnload =
    !saving &&
    finishBlockers.length === 0;

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
            contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {activeTab === 'dailyOps' && (
              <DailyOpsTab
                isRunning={isRunning}
                cycleIdPreview={cycleIdPreview}
                currentCycle={currentCycle}
                cycleDocLoading={cycleDocLoading}
                cycleDocError={cycleDocError}
                cycleDoc={cycleDoc}
                formErrorField={formErrorField}
                setFormErrorField={setFormErrorField}
                maxTemp={maxTemp}
                setMaxTemp={setMaxTemp}
                pressure={pressure}
                setPressure={setPressure}
                startTime={startTime}
                unloadTime={unloadTime}
                internalIndicator={internalIndicator}
                setInternalIndicator={setInternalIndicator}
                externalIndicator={externalIndicator}
                setExternalIndicator={setExternalIndicator}
                photoUri={photoUri}
                notes={notes}
                setNotes={setNotes}
                registerFieldRef={registerFieldRef}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
                openPicker={openPicker}
                onOpenCamera={openCamera}
                onStartMachine={onStartMachine}
                onFinishAndUnload={onFinishAndUnload}
                canPressStartMachine={canPressStartMachine}
                canPressFinishUnload={canPressFinishUnload}
                startBlockers={startBlockers}
                finishBlockers={finishBlockers}
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
              style={[styles.dateOverlayBackdrop, { backgroundColor: overlayBackdrop }]}
              onPress={closePicker}
            />
            <View
              style={[
                styles.dateOverlayPanel,
                { backgroundColor: overlayBg, borderTopColor: overlayBorder },
              ]}
            >
              <View style={styles.dateOverlayHeader}>
                <Pressable
                  onPress={commitPicker}
                  style={({ pressed }) => [
                    styles.dateDoneBtn,
                    { borderColor: overlayBorder, backgroundColor: overlayBg },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.dateDoneText, { color: overlayText }]}>Done</Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={pickerDraft}
                mode={activePicker.mode}
                display="spinner"
                onChange={onPickerChange}
                themeVariant={pickerTheme}
                textColor={overlayText as any}
                style={[styles.iosPicker, { backgroundColor: overlayBg }]}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <CameraCaptureModal visible={cameraOpen} onClose={closeCamera} onCaptured={onCapturedPhoto} />
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
