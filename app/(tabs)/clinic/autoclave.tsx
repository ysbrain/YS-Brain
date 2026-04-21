// app/(tabs)/clinic/autoclave.tsx

import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import {
  AutoclaveTabBar,
  type AutoclaveTabKey,
} from '@/src/components/autoclave/AutoclaveTabBar';
import { DailyOpsTab } from '@/src/components/autoclave/DailyOpsTab';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useUiLock } from '@/src/contexts/UiLockContext';
import type { SetupStoredItem } from '@/src/hooks/autoclave/types';
import { useAutoclaveAppliance } from '@/src/hooks/autoclave/useAutoclaveAppliance';
import { useAutoclaveDailyOpsActions } from '@/src/hooks/autoclave/useAutoclaveDailyOpsActions';
import { useAutoclaveDailyOpsCycle } from '@/src/hooks/autoclave/useAutoclaveDailyOpsCycle';
import { useDailyOpsForm } from '@/src/hooks/autoclave/useDailyOpsForm';
import { getStrictSerialIdPart } from '@/src/hooks/autoclave/utils';
import { useKeyboardAwareFieldScroll } from '@/src/hooks/useKeyboardAwareFieldScroll';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
const PHOTO_ASPECT_EMPTY = 16 / 9;

function normalizeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateYYYYMMDDCompact(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

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

function formatTimeHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseHHMM(s: string): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

function getSetupValue(
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
) {
  return setup?.[key]?.value;
}

function setupValueToString(
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
  fallback = '',
): string {
  const raw = getSetupValue(setup, key);
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return fallback;
}

function setupValueToNumberString(
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
  fallback = '',
): string {
  const raw = getSetupValue(setup, key);
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return fallback;
}

function validatePositiveIntUpTo3Digits(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return null;
  if (n <= 0) return null;
  return n;
}

async function cropToAspect(uri: string, width: number, height: number): Promise<string> {
  let cropW = width;
  let cropH = height;
  let originX = 0;
  let originY = 0;

  const currentRatio = width / height;

  if (currentRatio > PHOTO_ASPECT) {
    cropW = Math.round(height * PHOTO_ASPECT);
    originX = Math.round((width - cropW) / 2);
  } else if (currentRatio < PHOTO_ASPECT) {
    cropH = Math.round(width / PHOTO_ASPECT);
    originY = Math.round((height - cropH) / 2);
  }

  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop({ originX, originY, width: cropW, height: cropH });

  const rendered = await ctx.renderAsync();
  const result = await rendered.saveAsync({
    compress: 0.85,
    format: SaveFormat.JPEG,
  });

  return result.uri;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
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

  const defaultMaxTemp = useMemo(() => {
    return setupValueToNumberString(setup, 'default_temp_c', '');
  }, [setup]);

  const defaultPressure = useMemo(() => {
    return setupValueToNumberString(setup, 'default_pressure', '');
  }, [setup]);

  const {
    formErrorField,
    setFormErrorField,

    maxTemp,
    setMaxTemp,
    pressure,
    setPressure,
    startTime,
    setStartTime,

    unloadTime,
    setUnloadTime,
    internalIndicator,
    setInternalIndicator,
    externalIndicator,
    setExternalIndicator,
    photoUri,
    setPhotoUri,
    notes,
    setNotes,
  } = useDailyOpsForm({
    applianceId,
    currentCycle,
    defaultMaxTemp,
    defaultPressure,
  });

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

  const closeCamera = useCallback(() => {
    setCameraOpen(false);
  }, []);

  const onCapturedPhoto = useCallback(
    async (photo: { uri: string; width: number; height: number }) => {
      try {
        const croppedUri = await cropToAspect(photo.uri, photo.width, photo.height);
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

  const canStartMachine =
    !loading &&
    !saving &&
    !loadError &&
    !!clinicId &&
    !!roomId &&
    !!applianceId &&
    !!user?.uid &&
    hasValidSerialNumber &&
    !isRunning;

  const hasValidCurrentCycleId =
    !!currentCycle &&
    /^\d{8}-.+-\d+$/.test(currentCycle);

  const canFinishUnload =
    !loading &&
    !cycleDocLoading &&
    !saving &&
    !loadError &&
    !cycleDocError &&
    !!clinicId &&
    !!roomId &&
    !!applianceId &&
    !!user?.uid &&
    applianceKey.trim().length > 0 &&
    isRunning &&
    hasValidCurrentCycleId;

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
                onOpenCamera={() => setCameraOpen(true)}
                onStartMachine={onStartMachine}
                onFinishAndUnload={onFinishAndUnload}
                canStartMachine={canStartMachine}
                canFinishUnload={canFinishUnload}
                saving={saving}
                serialValidationMessage={
                  serialNumber.length > 0 && !hasValidSerialNumber
                    ? 'Serial number contains unsupported characters. Please update appliance setup.'
                    : null
                }
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
