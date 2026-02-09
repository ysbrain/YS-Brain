// app/(tabs)/clinic/record.tsx

import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RecordFieldType = 'string' | 'number' | 'date' | 'time' | 'boolean';

type RecordFieldItem = {
  field: string;
  type: RecordFieldType;
  required: boolean;
};

type ApplianceDocShape = {
  key?: string;
  applianceName?: string;
  typeKey?: string;
  typeLabel?: string;
  recordFields?: any[];
};

type RecordValue = string | boolean | null;

// Something "measurable" (TextInput and View/Pressable support measureInWindow)
type MeasurableRef = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateYYYYMMDD(d: Date) {
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function parseYYYYMMDD(s: string): Date | null {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const dd = Number(m[3]);
  const d = new Date(y, mm, dd);
  // Validate exact match (avoid 2026/02/31 rolling to March)
  if (d.getFullYear() !== y || d.getMonth() !== mm || d.getDate() !== dd) return null;
  return d;
}

function formatTimeHHMM(d: Date) {
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

export default function ClinicRecordScreen() {
  const router = useRouter();
  const profile = useProfile();
  const user = useAuth().user;
  const clinicId = profile?.clinic;

  const params = useLocalSearchParams<{ roomId: string; applianceId: string }>();
  const roomId = params.roomId;
  const applianceId = params.applianceId;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [applianceName, setApplianceName] = useState('');
  const [applianceKey, setApplianceKey] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [typeLabel, setTypeLabel] = useState('');

  const [recordFields, setRecordFields] = useState<RecordFieldItem[]>([]);
  const [recordValues, setRecordValues] = useState<Record<string, RecordValue>>({});

  const [saving, setSaving] = useState(false);

  // Picker control (date/time)
  const [activePicker, setActivePicker] = useState<{ field: string; mode: 'date' | 'time' } | null>(
    null,
  );
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());

  // Theme for iOS picker overlay
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pickerTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const overlayBg = isDark ? '#333' : '#fff';
  const overlayBorder = '#111';
  const overlayText = isDark ? '#fff' : '#111';
  const overlayBackdrop = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.15)';

  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const inputRefs = useRef<Record<string, MeasurableRef | null>>({});

  const focusedKeyRef = useRef<string | null>(null);

  const keyboardHeightRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ----- Scroll behavior (ported from improved modal) -----
  const FOOTER_BASE_HEIGHT = 84;
  const SAFE_GAP = 12;
  const FOCUS_ANCHOR_RATIO = 0.4;
  
  // Only use safe-area inset for the footer itself,
  // not for ScrollView bottom padding. This avoids double-counting with tab layout.
  const footerInset = Platform.OS === 'ios' ? insets.bottom : 0;
  const footerHeight = FOOTER_BASE_HEIGHT + footerInset;

  const SCROLL_DEBOUNCE_MS = 16;
  const SCROLL_COOLDOWN_MS = 120;
  const pendingScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollKeyRef = useRef<string | null>(null);
  const lastScrollAtRef = useRef(0);
  const scrollReqIdRef = useRef(0);
  
  // iOS picker overlay height should NOT include tab bar or insets.bottom
  // because the tab bar is outside this screen's layout.
  const IOS_PICKER_HEIGHT = 216;
  const IOS_PICKER_HEADER_HEIGHT = 44;
  const IOS_PICKER_TOTAL = IOS_PICKER_HEIGHT + IOS_PICKER_HEADER_HEIGHT + 12;

  const pickerOverlayHeight =
    Platform.OS === 'ios' && activePicker ? IOS_PICKER_TOTAL : 0;

  const bottomObstruction = Math.max(keyboardHeight, pickerOverlayHeight);

  const contentBottomPadding = 24 + footerHeight + SAFE_GAP + bottomObstruction;

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

          input.measureInWindow((_x, y, _w, h) => {
            if (reqId !== scrollReqIdRef.current) return;

            const windowH = Dimensions.get('window').height;

            // Aim to place the field around mid-screen-ish
            const targetY = windowH * FOCUS_ANCHOR_RATIO;

            // If field is already above target, don't move
            if (y <= targetY) return;

            // Extra bottom padding already accounts for:
            // footer + tab bar + safe area + keyboard/picker overlay
            // So we only need to shift up to target.
            const delta = y - targetY;
            const nextY = Math.max(0, scrollYRef.current + delta);

            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.log('[record scroll]', { reason, key: latestKey, y, h, nextY });
            }

            scrollRef.current?.scrollTo({ y: nextY, animated: true });
          });
        });
      }, delayMs);
    },
    [],
  );

  // Keyboard listeners: match modal behavior
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = h;
      setKeyboardHeight(h);

      const key = focusedKeyRef.current;
      if (key) requestScroll(key, 'keyboardShow', 50);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      if (pendingScrollTimerRef.current) clearTimeout(pendingScrollTimerRef.current);
    };
  }, [requestScroll]);

  // When picker opens, auto-scroll to its field after layout updates
  useEffect(() => {
    if (!activePicker) return;
    const key = `record:${activePicker.field}`;
    requestAnimationFrame(() => requestScroll(key, 'pickerOpen', 0));
  }, [activePicker, requestScroll]);

  // ----- Picker helpers -----
  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();
    const raw = recordValues[activePicker.field];
    const s = typeof raw === 'string' ? raw : '';

    if (activePicker.mode === 'date') return parseYYYYMMDD(s) ?? new Date();
    return parseHHMM(s) ?? new Date();
  }, [activePicker, recordValues]);

  const icon = useMemo(() => getApplianceIcon(typeKey), [typeKey]);

  const onChangeField = useCallback((field: string, value: RecordValue) => {
    setRecordValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const openPicker = useCallback(
    (field: string, mode: 'date' | 'time') => {
      Keyboard.dismiss();

      const raw = recordValues[field];
      const s = typeof raw === 'string' ? raw : '';

      const initial =
        mode === 'date'
          ? parseYYYYMMDD(s) ?? new Date()
          : parseHHMM(s) ?? new Date();

      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [recordValues],
  );

  const onPickerChange = useCallback(
    (evt: DateTimePickerEvent, date?: Date) => {
      if (!activePicker) return;

      // Android: user can dismiss picker
      if (Platform.OS !== 'ios' && evt.type === 'dismissed') {
        setActivePicker(null);
        return;
      }

      if (!date) return;

      // iOS overlay: update draft only; commit on Done
      if (Platform.OS === 'ios') {
        setPickerDraft(date);
        return;
      }

      // Android: commit immediately
      if (activePicker.mode === 'date') {
        onChangeField(activePicker.field, formatDateYYYYMMDD(date));
      } else {
        onChangeField(activePicker.field, formatTimeHHMM(date));
      }

      setActivePicker(null);
    },
    [activePicker, onChangeField],
  );

  const closePicker = useCallback(() => setActivePicker(null), []);

  const commitPicker = useCallback(() => {
    if (activePicker) {
      if (activePicker.mode === 'date') {
        onChangeField(activePicker.field, formatDateYYYYMMDD(pickerDraft));
      } else {
        onChangeField(activePicker.field, formatTimeHHMM(pickerDraft));
      }
    }
    setActivePicker(null);
  }, [activePicker, pickerDraft, onChangeField]);

  // Subscribe to appliance doc
  useEffect(() => {
    if (!clinicId || !roomId || !applianceId) return;

    setLoading(true);
    setLoadError(null);

    const ref = doc(db, 'clinics', clinicId, 'rooms', roomId, 'appliances', applianceId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as ApplianceDocShape) ?? {};

        setApplianceName(String(data.applianceName ?? ''));
        setApplianceKey(String(data.key ?? ''));
        setTypeKey(String(data.typeKey ?? ''));
        setTypeLabel(String(data.typeLabel ?? ''));

        const raw = Array.isArray(data.recordFields) ? data.recordFields : [];
        const parsed: RecordFieldItem[] = raw
          .map((x: any) => ({
            field: String(x?.field ?? '').trim(),
            type: String(x?.type ?? 'string') as RecordFieldType,
            required: Boolean(x?.required ?? false),
          }))
          .filter((x: RecordFieldItem) => x.field.length > 0)
          .map((x: RecordFieldItem) => ({
            field: x.field,
            required: x.required,
            type:
              x.type === 'number' ||
              x.type === 'date' ||
              x.type === 'time' ||
              x.type === 'boolean'
                ? x.type
                : 'string',
          }));

        setRecordFields(parsed);

        // Initialize missing values (do not wipe existing)
        setRecordValues((prev) => {
          const next = { ...prev };
          for (const item of parsed) {
            if (next[item.field] === undefined) {
              next[item.field] = item.type === 'boolean' ? null : '';
            }
          }
          return next;
        });

        setLoading(false);
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.error('appliance doc snapshot error', err);
        setLoadError('Failed to load appliance.');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [clinicId, roomId, applianceId]);

  const onSaveRecord = useCallback(async () => {
    if (!clinicId || !roomId || !applianceId) {
      Alert.alert('Missing context', 'Clinic/Room/Appliance not available.');
      return;
    }
    if (loading) {
      Alert.alert('Please wait', 'Still loading appliance configuration.');
      return;
    }
    if (saving) return;

    // ---- Validate + normalize ----
    const errors: string[] = [];
    const normalized: Record<string, any> = {};

    for (const item of recordFields) {
      const raw = recordValues[item.field];

      // Required check
      const isEmptyString = typeof raw === 'string' && raw.trim().length === 0;
      const isNullish = raw === null || raw === undefined;
      if (item.required && (isNullish || isEmptyString)) {
        errors.push(`${item.field} is required`);
        continue;
      }

      // Normalize by type
      if (item.type === 'number') {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (!s) {
          normalized[item.field] = null;
        } else {
          const n = Number(s);
          if (Number.isNaN(n)) {
            errors.push(`${item.field} must be a valid number`);
          } else {
            normalized[item.field] = n;
          }
        }
      } else if (item.type === 'boolean') {
        normalized[item.field] = typeof raw === 'boolean' ? raw : null;
      } else {
        // string/date/time stored as string (as your UI already formats)
        normalized[item.field] = typeof raw === 'string' ? raw.trim() : '';
      }
    }

    if (errors.length) {
      Alert.alert('Fix these issues', errors.join('\n'));
      // Optional: auto-scroll to first invalid field
      const first = errors[0]?.split(' is required')[0];
      if (first) requestScroll(`record:${first}`, 'validation', 0);
      return;
    }

    try {
      setSaving(true);

      const recordsRef = collection(
        db,
        'clinics', clinicId,
        'rooms', roomId,
        'appliances', applianceId,
        'records'
      );

      const payload = {
        clinicId,
        roomId,
        applianceId,
        applianceKeySnapshot: applianceKey || null,
        applianceNameSnapshot: applianceName || null,
        values: normalized,
        createdAt: serverTimestamp(),        
        createdBy: {
          userId: user?.uid ?? null,
          userName: profile?.name ?? null,
        }
      };

      await addDoc(recordsRef, payload);

      Alert.alert('Saved', 'Record saved successfully.');
      // Option: go back after save
      router.back();

      // Or: reset the form (choose one)
      // setRecordValues({});
    } catch (e: any) {
      console.error('save record error', e);
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    clinicId,
    roomId,
    applianceId,
    applianceName,
    typeKey,
    typeLabel,
    recordFields,
    recordValues,
    loading,
    saving,
    router,
    requestScroll,
  ]);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {/* Appliance details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Appliance Details</Text>

            <View style={styles.detailsRow}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={icon.name} size={26} color={icon.color ?? '#111'} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.applianceName} numberOfLines={1}>
                  {applianceName || (loading ? 'Loading…' : 'Unnamed appliance')}
                </Text>

                {!!typeLabel && (
                  <Text style={styles.applianceType} numberOfLines={1}>
                    {typeLabel}
                  </Text>
                )}
              </View>

              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backMiniBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color="#111" />
                <Text style={styles.backMiniText}>Back</Text>
              </Pressable>
            </View>

            {!!loadError && <Text style={styles.errorText}>{loadError}</Text>}
          </View>

          {/* Record fields */}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Record Fields</Text>

            {!loading && recordFields.length === 0 ? (
              <Text style={styles.hintText}>No record fields configured for this appliance.</Text>
            ) : (
              recordFields.map((item) => {
                const key = `record:${item.field}`;
                const raw = recordValues[item.field];

                const stringValue = typeof raw === 'string' ? raw : '';
                const boolValue = typeof raw === 'boolean' ? raw : null;

                return (
                  <View key={key} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      {item.field}
                      {item.required ? <Text style={styles.required}> *</Text> : null}
                    </Text>

                    {item.type === 'date' ? (
                      <Pressable
                        ref={(r: any) => {
                          inputRefs.current[key] = r as any;
                        }}
                        collapsable={false}
                        onPress={() => {
                          focusedKeyRef.current = key;
                          openPicker(item.field, 'date');
                        }}
                        style={({ pressed }) => [styles.dateInput, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button"
                      >
                        <Text style={stringValue ? styles.dateText : styles.datePlaceholder}>
                          {stringValue || 'Select date'}
                        </Text>
                        <MaterialCommunityIcons
                          name="calendar-month-outline"
                          size={20}
                          color="#111"
                        />
                      </Pressable>
                    ) : item.type === 'time' ? (
                      <Pressable
                        ref={(r: any) => {
                          inputRefs.current[key] = r as any;
                        }}
                        collapsable={false}
                        onPress={() => {
                          focusedKeyRef.current = key;
                          openPicker(item.field, 'time');
                        }}
                        style={({ pressed }) => [styles.dateInput, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button"
                      >
                        <Text style={stringValue ? styles.dateText : styles.datePlaceholder}>
                          {stringValue || 'Select time'}
                        </Text>
                        <MaterialCommunityIcons name="clock-outline" size={20} color="#111" />
                      </Pressable>
                    ) : item.type === 'boolean' ? (
                      // Boolean does NOT require auto-scroll
                      <View
                        ref={(r: any) => {
                          inputRefs.current[key] = r as any;
                        }}
                        collapsable={false}
                      >
                        <View style={styles.booleanRow}>
                          <Pressable
                            onPress={() => onChangeField(item.field, true)}
                            style={({ pressed }) => [
                              styles.booleanBtn,
                              boolValue === true && styles.booleanBtnPassActive,
                              pressed && { opacity: 0.9 },
                            ]}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.booleanBtnText,
                                boolValue === true && styles.booleanBtnTextPassActive,
                              ]}
                            >
                              PASS
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => onChangeField(item.field, false)}
                            style={({ pressed }) => [
                              styles.booleanBtn,
                              boolValue === false && styles.booleanBtnFailActive,
                              pressed && { opacity: 0.9 },
                            ]}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.booleanBtnText,
                                boolValue === false && styles.booleanBtnTextFailActive,
                              ]}
                            >
                              FAIL
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <TextInput
                        ref={(r) => {
                          inputRefs.current[key] = r as any;
                        }}
                        value={stringValue}
                        onChangeText={(t) => onChangeField(item.field, t)}
                        placeholder={item.type === 'number' ? 'Enter number' : 'Enter text'}
                        placeholderTextColor="#999"
                        style={styles.textInput}
                        keyboardType={item.type === 'number' ? 'number-pad' : 'default'}
                        returnKeyType="done"
                        onFocus={() => {
                          focusedKeyRef.current = key;
                          requestScroll(key, 'focus');
                        }}
                      />
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Footer button (hide while picker overlay is active) */}
        {!activePicker && (
          <View style={styles.footerFixed}>            
            <Pressable
              onPress={onSaveRecord}
              disabled={loading || saving}
              style={({ pressed }) => [
                styles.primaryBtn,
                (loading || saving) && styles.primaryBtnDisabled,
                pressed && !(loading || saving) && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>
                {saving ? 'Saving…' : 'Save Record'}
              </Text>
            </Pressable>
          </View>
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
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
  },
  detailsTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  applianceName: {
    fontSize: 16,
    fontWeight: '900',
  },
  applianceType: {
    marginTop: 6,
    fontSize: 13,
    color: '#444',
    fontWeight: '700',
  },
  backMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  backMiniText: {
    fontSize: 12,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 10,
    color: '#B00020',
    fontWeight: '800',
  },
  formCard: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  hintText: { color: '#666', fontWeight: '700' },
  fieldBlock: { gap: 8, marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '900' },
  required: { color: '#B00020' },
  textInput: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    backgroundColor: '#fff',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePlaceholder: { color: '#999', fontSize: 14, fontWeight: '700' },
  dateText: { color: '#111', fontSize: 14, fontWeight: '700' },
  booleanRow: {
    flexDirection: 'row',
    gap: 10,
  },
  booleanBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
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
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  booleanBtnTextPassActive: {
    color: '#15803d',
  },
  booleanBtnTextFailActive: {
    color: '#b91c1c',
  },
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
    borderTopWidth: 1,
    borderTopColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0fff4ff',
    justifyContent: 'center',
  },
  primaryBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  primaryBtnDisabled: { opacity: 0.6 },

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
  dateDoneText: { fontWeight: '900' },
  iosPicker: {
    width: '100%',
    minWidth: 280,
    height: 216,
  },
});
