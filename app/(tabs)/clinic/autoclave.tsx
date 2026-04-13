// app/(tabs)/clinic/autoclave.tsx

import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useUiLock } from '@/src/contexts/UiLockContext';
import type { SetupStoredItem } from '@/src/hooks/autoclave/types';
import { useAutoclaveAppliance } from '@/src/hooks/autoclave/useAutoclaveAppliance';
import { useAutoclaveDailyOpsActions } from '@/src/hooks/autoclave/useAutoclaveDailyOpsActions';
import { useAutoclaveDailyOpsCycle } from '@/src/hooks/autoclave/useAutoclaveDailyOpsCycle';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

type TabKey = 'dailyOps' | 'helix' | 'spore';
type PickerField = 'startTime' | 'unloadTime';

// Something measurable for auto-scroll
type MeasurableRef = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

type DailyFieldKey =
  | 'daily:maxTemp'
  | 'daily:pressure'
  | 'daily:startTime'
  | 'daily:unloadTime'
  | 'daily:internalIndicator'
  | 'daily:externalIndicator'
  | 'daily:photoEvidence'
  | 'daily:notes';

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

  const [activeTab, setActiveTab] = useState<TabKey>('dailyOps');

  const [saving, setSaving] = useState(false);

  const { setUiLocked } = useUiLock();
  const [formErrorField, setFormErrorField] = useState<DailyFieldKey | null>(null);

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

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const inputRefs = useRef<Record<string, MeasurableRef | null>>({});
  const focusedKeyRef = useRef<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ----- Scroll behavior -----
  const SAFE_GAP = 12;
  const FOCUS_ANCHOR_RATIO = 0.4;
  const SCROLL_DEBOUNCE_MS = 16;
  const SCROLL_COOLDOWN_MS = 120;
  const pendingScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollKeyRef = useRef<string | null>(null);
  const lastScrollAtRef = useRef(0);
  const scrollReqIdRef = useRef(0);

  const IOS_PICKER_HEIGHT = 216;
  const IOS_PICKER_HEADER_HEIGHT = 44;
  const IOS_PICKER_TOTAL = IOS_PICKER_HEIGHT + IOS_PICKER_HEADER_HEIGHT + 12;
  const pickerOverlayHeight = Platform.OS === 'ios' && activePicker ? IOS_PICKER_TOTAL : 0;
  const bottomObstruction = Math.max(keyboardHeight, pickerOverlayHeight);
  const contentBottomPadding = 24 + SAFE_GAP + bottomObstruction;

  const requestScroll = useCallback(
    (key: string, reason: string, delayMs = SCROLL_DEBOUNCE_MS) => {
      pendingScrollKeyRef.current = key;

      if (pendingScrollTimerRef.current) {
        clearTimeout(pendingScrollTimerRef.current);
        pendingScrollTimerRef.current = null;
      }

      pendingScrollTimerRef.current = setTimeout(() => {
        const latestKey = pendingScrollKeyRef.current;
        if (!latestKey) return;

        const now = Date.now();
        const elapsed = now - lastScrollAtRef.current;
        const bypassCooldown = reason === 'validation';

        if (!bypassCooldown && elapsed < SCROLL_COOLDOWN_MS) {
          const remaining = SCROLL_COOLDOWN_MS - elapsed;
          requestScroll(latestKey, reason, remaining);
          return;
        }

        lastScrollAtRef.current = now;
        const reqId = ++scrollReqIdRef.current;

        requestAnimationFrame(() => {
          const input = inputRefs.current[latestKey];
          if (!input?.measureInWindow) return;

          input.measureInWindow((_x, y, _w, _h) => {
            if (reqId !== scrollReqIdRef.current) return;

            const windowH = Dimensions.get('window').height;
            const targetY = windowH * FOCUS_ANCHOR_RATIO;

            if (y <= targetY) return;

            const delta = y - targetY;
            const nextY = Math.max(0, scrollYRef.current + delta);
            scrollRef.current?.scrollTo({ y: nextY, animated: true });
          });
        });
      }, delayMs);
    },
    [],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);

      const key = focusedKeyRef.current;
      if (key) requestScroll(key, 'keyboardShow', 50);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (pendingScrollTimerRef.current) clearTimeout(pendingScrollTimerRef.current);
    };
  }, [requestScroll]);

  useEffect(() => {
    if (!activePicker) return;
    const key = `daily:${activePicker.field}`;
    requestAnimationFrame(() => requestScroll(key, 'pickerOpen', 0));
  }, [activePicker, requestScroll]);

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

  const currentDate = useMemo(() => formatDateYYYYMMDDCompact(new Date()), []);

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
    const serialPart = serialNumber || 'unknown';
    return `${currentDate}-${serialPart}-${nextCycle}`;
  }, [currentDate, serialNumber, nextCycle]);

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
    serialNumber.trim().length > 0 &&
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

  const renderDailyOpsStart = () => {
    return (
      <View style={styles.card}>
        <View style={styles.heroWrap}>
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="play-outline" size={44} color="#4361ee" />
          </View>

          <Text style={styles.heroTitle}>Start New Cycle</Text>
          <Text style={styles.heroSubtitle}>Set parameters and begin sterilization.</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Cycle ID</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyValue}>{cycleIdPreview}</Text>
          </View>
        </View>

        <View style={styles.twoColRow}>
          <View style={[styles.fieldBlock, styles.twoColItem]}>
            <Text
              style={[
                styles.fieldLabel,
                formErrorField === 'daily:maxTemp' && styles.errorLabel,
              ]}
            >
              Max Temp (°C)
            </Text>
            <TextInput
              ref={(r) => {
                inputRefs.current['daily:maxTemp'] = r as any;
              }}
              value={maxTemp}
              onChangeText={(t) => {
                setMaxTemp(t);
                if (formErrorField === 'daily:maxTemp') setFormErrorField(null);
              }}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder="Enter temp"
              placeholderTextColor="#94a3b8"
              style={[
                styles.textInput,
                formErrorField === 'daily:maxTemp' && styles.errorBorder,
              ]}
              returnKeyType="done"
              maxLength={3}
              onFocus={() => {
                focusedKeyRef.current = 'daily:maxTemp';
                requestScroll('daily:maxTemp', 'focus');
              }}
              onBlur={() => {
                if (focusedKeyRef.current === 'daily:maxTemp') {
                  focusedKeyRef.current = null;
                }
              }}
            />
          </View>

          <View style={[styles.fieldBlock, styles.twoColItem]}>
            <Text
              style={[
                styles.fieldLabel,
                formErrorField === 'daily:pressure' && styles.errorLabel,
              ]}
            >
              Pressure
            </Text>
            <TextInput
              ref={(r) => {
                inputRefs.current['daily:pressure'] = r as any;
              }}
              value={pressure}
              onChangeText={(t) => {
                setPressure(t);
                if (formErrorField === 'daily:pressure') setFormErrorField(null);
              }}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder="Enter pressure"
              placeholderTextColor="#94a3b8"
              style={[
                styles.textInput,
                formErrorField === 'daily:pressure' && styles.errorBorder,
              ]}
              returnKeyType="done"
              maxLength={3}
              onFocus={() => {
                focusedKeyRef.current = 'daily:pressure';
                requestScroll('daily:pressure', 'focus');
              }}
              onBlur={() => {
                if (focusedKeyRef.current === 'daily:pressure') {
                  focusedKeyRef.current = null;
                }
              }}
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text
            style={[
              styles.fieldLabel,
              formErrorField === 'daily:startTime' && styles.errorLabel,
            ]}
          >
            Start Time
          </Text>

          <Pressable
            ref={(r: any) => {
              inputRefs.current['daily:startTime'] = r as any;
            }}
            collapsable={false}
            onPress={() => {
              focusedKeyRef.current = 'daily:startTime';
              if (formErrorField === 'daily:startTime') setFormErrorField(null);
              openPicker('startTime', 'time');
            }}
            style={({ pressed }) => [
              styles.timeField,
              formErrorField === 'daily:startTime' && styles.errorBorder,
              pressed && { opacity: 0.88 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.timeValue}>{startTime}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onStartMachine}
          disabled={!canStartMachine}
          style={({ pressed }) => [
            styles.startButton,
            !canStartMachine && styles.startButtonDisabled,
            pressed && canStartMachine && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.startButtonText}>
            {saving ? 'Starting…' : 'Start Machine'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderDailyOpsRunning = () => {
    if (cycleDocLoading) {
      return (
        <View style={styles.centerInline}>
          <ActivityIndicator />
          <Text style={styles.helperText}>Loading current cycle...</Text>
        </View>
      );
    }

    if (cycleDocError) {
      return (
        <View style={styles.centerInline}>
          <Text style={styles.errorText}>{cycleDocError}</Text>
        </View>
      );
    }

    const temperatureText =
      typeof cycleDoc?.settings?.temperature === 'number'
        ? `${cycleDoc.settings.temperature}°C`
        : '--';

    const pressureText =
      typeof cycleDoc?.settings?.pressure === 'number'
        ? String(cycleDoc.settings.pressure)
        : '--';

    const startedAtText =
      typeof cycleDoc?.cycleBeginTime === 'string' && cycleDoc.cycleBeginTime.trim().length > 0
        ? cycleDoc.cycleBeginTime
        : '--';

    const startedByText =
      typeof cycleDoc?.cycleBeganBy?.userName === 'string' &&
      cycleDoc.cycleBeganBy.userName.trim().length > 0
        ? cycleDoc.cycleBeganBy.userName
        : 'Unknown';

    return (
      <View style={styles.card}>
        <View style={styles.runningHeader}>
          <View style={styles.runningTitleRow}>
            <View style={styles.runningClockIcon}>
              <MaterialCommunityIcons name="clock-outline" size={22} color="#ea580c" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.runningTitle}>Cycle In Progress</Text>
              <Text style={styles.runningCycleId}>Cycle {currentCycle}</Text>
            </View>
          </View>

          <View style={styles.startedByWrap}>
            <Text style={styles.startedByLabel}>STARTED BY</Text>
            <Text style={styles.startedByValue} numberOfLines={1}>
              {startedByText}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>TEMP</Text>
            <Text style={styles.metricValue}>{temperatureText}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>PRESSURE</Text>
            <Text style={styles.metricValue}>{pressureText}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>STARTED AT</Text>
            <Text style={styles.metricValue}>{startedAtText}</Text>
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text
            style={[
              styles.fieldLabel,
              formErrorField === 'daily:unloadTime' && styles.errorLabel,
            ]}
          >
            Unload Time
          </Text>

          <Pressable
            ref={(r: any) => {
              inputRefs.current['daily:unloadTime'] = r as any;
            }}
            collapsable={false}
            onPress={() => {
              focusedKeyRef.current = 'daily:unloadTime';
              if (formErrorField === 'daily:unloadTime') setFormErrorField(null);
              openPicker('unloadTime', 'time');
            }}
            style={({ pressed }) => [
              styles.timeField,
              formErrorField === 'daily:unloadTime' && styles.errorBorder,
              pressed && { opacity: 0.88 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.timeValue}>{unloadTime}</Text>
          </Pressable>
        </View>

        <View style={styles.verifySection}>
          <Text style={styles.verifyTitle}>Verification Check</Text>

          <View style={styles.verifyDivider} />

          <View style={styles.fieldBlock}>
            <Text
              style={[
                styles.verifyFieldLabel,
                formErrorField === 'daily:internalIndicator' && styles.errorLabel,
              ]}
            >
              Internal Indicator<Text style={styles.required}> *</Text>
            </Text>

            <View
              ref={(r: any) => {
                inputRefs.current['daily:internalIndicator'] = r as any;
              }}
              collapsable={false}
            >
              <View style={styles.booleanRow}>
                <Pressable
                  onPress={() => {
                    setInternalIndicator(true);
                    if (formErrorField === 'daily:internalIndicator') setFormErrorField(null);
                  }}
                  style={({ pressed }) => [
                    styles.booleanBtn,
                    formErrorField === 'daily:internalIndicator' && styles.errorBorder,
                    internalIndicator === true && styles.booleanBtnPassActive,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={18}
                    color={internalIndicator === true ? '#15803d' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.booleanBtnText,
                      internalIndicator === true && styles.booleanBtnTextPassActive,
                    ]}
                  >
                    Pass
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setInternalIndicator(false);
                    if (formErrorField === 'daily:internalIndicator') setFormErrorField(null);
                  }}
                  style={({ pressed }) => [
                    styles.booleanBtn,
                    formErrorField === 'daily:internalIndicator' && styles.errorBorder,
                    internalIndicator === false && styles.booleanBtnFailActive,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="shield-alert-outline"
                    size={18}
                    color={internalIndicator === false ? '#b91c1c' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.booleanBtnText,
                      internalIndicator === false && styles.booleanBtnTextFailActive,
                    ]}
                  >
                    Fail
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text
              style={[
                styles.verifyFieldLabel,
                formErrorField === 'daily:externalIndicator' && styles.errorLabel,
              ]}
            >
              External Indicator<Text style={styles.required}> *</Text>
            </Text>

            <View
              ref={(r: any) => {
                inputRefs.current['daily:externalIndicator'] = r as any;
              }}
              collapsable={false}
            >
              <View style={styles.booleanRow}>
                <Pressable
                  onPress={() => {
                    setExternalIndicator(true);
                    if (formErrorField === 'daily:externalIndicator') setFormErrorField(null);
                  }}
                  style={({ pressed }) => [
                    styles.booleanBtn,
                    formErrorField === 'daily:externalIndicator' && styles.errorBorder,
                    externalIndicator === true && styles.booleanBtnPassActive,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={18}
                    color={externalIndicator === true ? '#15803d' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.booleanBtnText,
                      externalIndicator === true && styles.booleanBtnTextPassActive,
                    ]}
                  >
                    Pass
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setExternalIndicator(false);
                    if (formErrorField === 'daily:externalIndicator') setFormErrorField(null);
                  }}
                  style={({ pressed }) => [
                    styles.booleanBtn,
                    formErrorField === 'daily:externalIndicator' && styles.errorBorder,
                    externalIndicator === false && styles.booleanBtnFailActive,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="shield-alert-outline"
                    size={18}
                    color={externalIndicator === false ? '#b91c1c' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.booleanBtnText,
                      externalIndicator === false && styles.booleanBtnTextFailActive,
                    ]}
                  >
                    Fail
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text
              style={[
                styles.verifyFieldLabel,
                formErrorField === 'daily:photoEvidence' && styles.errorLabel,
              ]}
            >
              Photo Evidence<Text style={styles.required}> *</Text>
            </Text>

            <Pressable
              ref={(r: any) => {
                inputRefs.current['daily:photoEvidence'] = r as any;
              }}
              collapsable={false}
              onPress={() => {
                focusedKeyRef.current = 'daily:photoEvidence';
                if (formErrorField === 'daily:photoEvidence') setFormErrorField(null);
                setCameraOpen(true);
              }}
              style={({ pressed }) => [
                styles.photoBox,
                formErrorField === 'daily:photoEvidence' && styles.errorBorder,
                {
                  aspectRatio: photoUri ? PHOTO_ASPECT : PHOTO_ASPECT_EMPTY,
                  maxHeight: 280,
                },
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <MaterialCommunityIcons name="camera-outline" size={30} color="#94a3b8" />
                  <Text style={styles.photoPlaceholderText}>Tap to Capture Result</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.verifyFieldLabel}>Notes (Optional)</Text>

            <TextInput
              ref={(r) => {
                inputRefs.current['daily:notes'] = r as any;
              }}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any issues observed?"
              placeholderTextColor="#999"
              style={styles.notesInput}
              returnKeyType="done"
              onFocus={() => {
                focusedKeyRef.current = 'daily:notes';
                requestScroll('daily:notes', 'focus');
              }}
              onBlur={() => {
                if (focusedKeyRef.current === 'daily:notes') {
                  focusedKeyRef.current = null;
                }
              }}
            />
          </View>

          <Pressable
            onPress={onFinishAndUnload}
            disabled={!canFinishUnload}
            style={({ pressed }) => [
              styles.finishButton,
              !canFinishUnload && styles.finishButtonDisabled,
              pressed && canFinishUnload && { opacity: 0.92 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.finishButtonText}>
              {saving ? 'Finishing…' : 'Finish & Unload'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderDailyOps = () => {
    return isRunning ? renderDailyOpsRunning() : renderDailyOpsStart();
  };

  return (
    <>
      <Stack.Screen options={{ title: applianceName || 'Autoclave' }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab('dailyOps')}
            style={[styles.tabButton, activeTab === 'dailyOps' && styles.tabButtonActive]}
          >
            <MaterialCommunityIcons
              name="play-outline"
              size={20}
              color={activeTab === 'dailyOps' ? '#2c7a7b' : '#64748b'}
            />
            <Text style={[styles.tabText, activeTab === 'dailyOps' && styles.tabTextActive]}>
              Daily Ops
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('helix')}
            style={[styles.tabButton, activeTab === 'helix' && styles.tabButtonActive]}
          >
            <MaterialCommunityIcons
              name="timer-sand"
              size={20}
              color={activeTab === 'helix' ? '#2c7a7b' : '#64748b'}
            />
            <Text style={[styles.tabText, activeTab === 'helix' && styles.tabTextActive]}>
              Helix
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('spore')}
            style={[
              styles.tabButton,
              styles.tabButtonLast,
              activeTab === 'spore' && styles.tabButtonActive,
            ]}
          >
            <MaterialCommunityIcons
              name="test-tube"
              size={20}
              color={activeTab === 'spore' ? '#2c7a7b' : '#64748b'}
            />
            <Text style={[styles.tabText, activeTab === 'spore' && styles.tabTextActive]}>
              Spore
            </Text>
          </Pressable>
        </View>

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
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {activeTab === 'dailyOps' && renderDailyOps()}
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

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    backgroundColor: '#fff',
  },

  tabButton: {
    flex: 1,
    minHeight: 54,
    borderRightWidth: 1,
    borderRightColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
  },

  tabButtonLast: {
    borderRightWidth: 0,
  },

  tabButtonActive: {
    backgroundColor: '#f8fafc',
  },

  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },

  tabTextActive: {
    color: '#2c7a7b',
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

  centerInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
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

  card: {
    borderWidth: 1.5,
    borderColor: '#f0b86b',
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 18,
  },

  heroWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },

  heroIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#e8eefc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },

  heroSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },

  runningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },

  runningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  runningClockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#f0b86b',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
  },

  runningTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#334155',
  },

  runningCycleId: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },

  startedByWrap: {
    alignItems: 'flex-end',
    maxWidth: 120,
  },

  startedByLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },

  startedByValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 14,
  },

  metricBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  metricLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94a3b8',
  },

  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
  },

  metricDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },

  fieldBlock: {
    gap: 8,
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },

  readonlyField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  readonlyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },

  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },

  twoColItem: {
    flex: 1,
  },

  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 52,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },

  timeField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  timeValue: {
    fontSize: 24,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },

  startButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  startButtonDisabled: {
    opacity: 0.6,
  },

  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },

  verifySection: {
    marginTop: 8,
  },

  verifyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#334155',
  },

  verifyDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 10,
    marginBottom: 14,
  },

  verifyFieldLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#64748b',
  },

  required: {
    color: '#B00020',
  },

  booleanRow: {
    flexDirection: 'row',
    gap: 10,
  },

  booleanBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 6,
    flexDirection: 'row',
  },

  booleanBtnPassActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },

  booleanBtnFailActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },

  booleanBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94a3b8',
  },

  booleanBtnTextPassActive: {
    color: '#15803d',
  },

  booleanBtnTextFailActive: {
    color: '#b91c1c',
  },

  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },

  photoPlaceholderText: {
    color: '#94a3b8',
    fontWeight: '700',
  },

  photoPreview: {
    width: '100%',
    height: '100%',
  },

  notesInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },

  finishButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  finishButtonDisabled: {
    opacity: 0.6,
  },

  finishButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
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

  errorLabel: {
    color: '#B00020',
  },

  errorBorder: {
    borderColor: '#B00020',
    borderWidth: 2,
  },
});
