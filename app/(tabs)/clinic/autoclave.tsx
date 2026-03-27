// app/(tabs)/clinic/autoclave.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';

type TabKey = 'dailyOps' | 'helix' | 'spore';

type SetupStoredValue = string | number;
type SetupStoredItem = {
  field?: string;
  value?: SetupStoredValue;
};

type ApplianceDocShape = {
  applianceKey?: string;
  applianceName?: string;
  typeKey?: string;
  typeName?: string;
  setup?: Record<string, SetupStoredItem | undefined>;
  lastCycle?: {
    cycleNumber?: number;
    dateExecuted?: string;
  };
};

type MeasurableRef = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [applianceName, setApplianceName] = useState('');
  const [setup, setSetup] = useState<Record<string, SetupStoredItem | undefined>>({});
  const [lastCycle, setLastCycle] = useState<{ cycleNumber?: number; dateExecuted?: string }>({});

  const [maxTemp, setMaxTemp] = useState('');
  const [pressure, setPressure] = useState('');
  const [startTime, setStartTime] = useState(formatTimeHHMM(new Date()));

  const [activePicker, setActivePicker] = useState<{ field: 'startTime'; mode: 'time' } | null>(
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

  // ----- Scroll behavior (same pattern as record.tsx)
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
    setMaxTemp('');
    setPressure('');
    setStartTime(formatTimeHHMM(new Date()));
  }, [applianceId]);

  useEffect(() => {
    if (!clinicId || !roomId || !applianceId) {
      setLoadError('Missing clinic, room, or appliance information.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const applianceRef = doc(db, 'clinics', clinicId, 'rooms', roomId, 'appliances', applianceId);

    const unsub = onSnapshot(
      applianceRef,
      (snap) => {
        if (!snap.exists()) {
          setLoadError('Autoclave appliance not found.');
          setLoading(false);
          return;
        }

        const data = (snap.data() as ApplianceDocShape) ?? {};

        setApplianceName(
          typeof data.applianceName === 'string' && data.applianceName.trim().length > 0
            ? data.applianceName
            : 'Autoclave',
        );

        const nextSetup =
          data.setup && typeof data.setup === 'object'
            ? data.setup
            : ({} as Record<string, SetupStoredItem | undefined>);
        setSetup(nextSetup);

        const nextLastCycle =
          data.lastCycle && typeof data.lastCycle === 'object'
            ? data.lastCycle
            : { cycleNumber: undefined, dateExecuted: undefined };
        setLastCycle(nextLastCycle);

        setMaxTemp((prev) =>
          prev.trim().length > 0
            ? prev
            : setupValueToNumberString(nextSetup, 'default_temp_c', ''),
        );

        setPressure((prev) =>
          prev.trim().length > 0
            ? prev
            : setupValueToNumberString(nextSetup, 'default_pressure', ''),
        );

        setLoading(false);
      },
      (err) => {
        console.error('autoclave appliance snapshot error', err);
        setLoadError('Failed to load autoclave appliance.');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [clinicId, roomId, applianceId]);

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

  const cycleId = useMemo(() => {
    const serialPart = serialNumber || 'unknown';
    return `${currentDate}-${serialPart}-${nextCycle}`;
  }, [currentDate, serialNumber, nextCycle]);

  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();
    if (activePicker.field === 'startTime') {
      return parseHHMM(startTime) ?? new Date();
    }
    return new Date();
  }, [activePicker, startTime]);

  const openPicker = useCallback(
    (field: 'startTime', mode: 'time') => {
      Keyboard.dismiss();

      const initial =
        field === 'startTime' ? parseHHMM(startTime) ?? new Date() : new Date();

      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [startTime],
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
      }

      setActivePicker(null);
    },
    [activePicker],
  );

  const closePicker = useCallback(() => setActivePicker(null), []);

  const commitPicker = useCallback(() => {
    if (activePicker?.field === 'startTime') {
      setStartTime(formatTimeHHMM(pickerDraft));
    }
    setActivePicker(null);
  }, [activePicker, pickerDraft]);

  const onStartMachine = useCallback(async () => {
    if (!clinicId || !roomId || !applianceId) {
      Alert.alert('Missing context', 'Clinic, room, or appliance information is missing.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Not signed in', 'Please sign in before starting the machine.');
      return;
    }

    if (loading) {
      Alert.alert('Please wait', 'Autoclave information is still loading.');
      return;
    }

    if (loadError) {
      Alert.alert('Cannot start', loadError);
      return;
    }

    if (!serialNumber) {
      Alert.alert('Cannot start', 'Missing serial number in appliance setup.');
      return;
    }

    const trimmedTemp = maxTemp.trim();
    const trimmedPressure = pressure.trim();
    const trimmedStartTime = startTime.trim();

    if (!trimmedTemp) {
      Alert.alert('Validation', 'Max Temp (°C) is required.');
      requestScroll('daily:maxTemp', 'validation', 0);
      return;
    }

    if (!trimmedPressure) {
      Alert.alert('Validation', 'Pressure is required.');
      requestScroll('daily:pressure', 'validation', 0);
      return;
    }

    if (!trimmedStartTime) {
      Alert.alert('Validation', 'Start Time is required.');
      requestScroll('daily:startTime', 'validation', 0);
      return;
    }

    const temperatureValue = validatePositiveIntUpTo3Digits(trimmedTemp);
    if (temperatureValue === null) {
      Alert.alert(
        'Validation',
        'Max Temp (°C) must be an integer greater than 0 and up to 3 digits.',
      );
      requestScroll('daily:maxTemp', 'validation', 0);
      return;
    }

    const pressureValue = validatePositiveIntUpTo3Digits(trimmedPressure);
    if (pressureValue === null) {
      Alert.alert(
        'Validation',
        'Pressure must be an integer greater than 0 and up to 3 digits.',
      );
      requestScroll('daily:pressure', 'validation', 0);
      return;
    }

    if (!parseHHMM(trimmedStartTime)) {
      Alert.alert('Validation', 'Start Time must be a valid time in HH:MM format.');
      requestScroll('daily:startTime', 'validation', 0);
      return;
    }

    if (saving) return;

    Keyboard.dismiss();
    setActivePicker(null);
    setSaving(true);

    try {
      const applianceRef = doc(db, 'clinics', clinicId, 'rooms', roomId, 'appliances', applianceId);
      const dailyOpsRef = collection(
        db,
        'clinics',
        clinicId,
        'rooms',
        roomId,
        'appliances',
        applianceId,
        'records_DailyOps',
      );
      const cycleRef = doc(dailyOpsRef, cycleId);

      const batch = writeBatch(db);

      batch.update(applianceRef, {
        _status: {
          isRunning: true,
          currentCycle: cycleId,
        },
        updatedAt: serverTimestamp(),
      });

      batch.set(cycleRef, {
        _isFinished: false,
        createdAt: serverTimestamp(),
        pressure: pressureValue,
        startTime: trimmedStartTime,
        startedBy: {
          userId: user.uid,
          userName: profile?.name ?? null,
        },
        temperature: temperatureValue,
      });

      await batch.commit();

      Alert.alert(
        'Started',
        'Autoclave cycle started successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ],
        { cancelable: false },
      );
    } catch (e: any) {
      console.error('start autoclave error', e);
      Alert.alert('Start failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    clinicId,
    roomId,
    applianceId,
    user?.uid,
    loading,
    loadError,
    serialNumber,
    maxTemp,
    pressure,
    startTime,
    saving,
    cycleId,
    profile?.name,
    requestScroll,
    router,
  ]);

  const canStartMachine =
    !loading &&
    !saving &&
    !loadError &&
    !!clinicId &&
    !!roomId &&
    !!applianceId &&
    !!user?.uid;

  const renderDailyOps = () => {
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
            <Text style={styles.readonlyValue}>{cycleId}</Text>
          </View>
        </View>

        <View style={styles.twoColRow}>
          <View style={[styles.fieldBlock, styles.twoColItem]}>
            <Text style={styles.fieldLabel}>Max Temp (°C)</Text>
            <TextInput
              ref={(r) => {
                inputRefs.current['daily:maxTemp'] = r as any;
              }}
              value={maxTemp}
              onChangeText={setMaxTemp}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder="Enter temp"
              placeholderTextColor="#94a3b8"
              style={styles.textInput}
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
            <Text style={styles.fieldLabel}>Pressure</Text>
            <TextInput
              ref={(r) => {
                inputRefs.current['daily:pressure'] = r as any;
              }}
              value={pressure}
              onChangeText={setPressure}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder="Enter pressure"
              placeholderTextColor="#94a3b8"
              style={styles.textInput}
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
          <Text style={styles.fieldLabel}>Start Time</Text>

          <Pressable
            ref={(r: any) => {
              inputRefs.current['daily:startTime'] = r as any;
            }}
            collapsable={false}
            onPress={() => {
              focusedKeyRef.current = 'daily:startTime';
              openPicker('startTime', 'time');
            }}
            style={({ pressed }) => [styles.timeField, pressed && { opacity: 0.88 }]}
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
    borderWidth: 1,
    borderColor: '#d1d5db',
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
