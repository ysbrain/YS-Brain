// app/(tabs)/clinic/record.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';

import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/src/contexts/ProfileContext';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';

type RecordFieldType = 'string' | 'number' | 'date';

type RecordFieldItem = {
  field: string;
  type: RecordFieldType;
  required: boolean;
};

type ApplianceDocShape = {
  applianceName?: string;
  typeKey?: string;
  typeLabel?: string;
  recordFields?: any[];
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
  if (d.getFullYear() !== y || d.getMonth() !== mm || d.getDate() !== dd) return null;
  return d;
}

export default function ClinicRecordScreen() {
  const router = useRouter();
  const profile = useProfile();
  const clinicId = profile?.clinic;

  const params = useLocalSearchParams<{ roomId: string; applianceId: string }>();
  const roomId = params.roomId;
  const applianceId = params.applianceId;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [applianceName, setApplianceName] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [typeLabel, setTypeLabel] = useState('');
  const [recordFields, setRecordFields] = useState<RecordFieldItem[]>([]);

  // Store record input values keyed by field name
  const [recordValues, setRecordValues] = useState<Record<string, string>>({});

  // Date picker control
  const [activeDateField, setActiveDateField] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<Date>(new Date());

  const { height: windowHeight } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const inputRefs = useRef<Record<string, any>>({});
  const focusedKeyRef = useRef<string | null>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);  
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = h;      // immediate
      setKeyboardHeight(h);               // UI state

      const key = focusedKeyRef.current;
      if (key) {
        // No need for long delays anymore, but keep a tiny one for layout settle
        setTimeout(() => scrollFieldIntoView(key), 30);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;      // immediate
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const activeDateValue = useMemo(() => {
    if (!activeDateField) return new Date();
    const s = recordValues[activeDateField] ?? '';
    return parseYYYYMMDD(s) ?? new Date();
  }, [activeDateField, recordValues]);

  const icon = useMemo(() => getApplianceIcon(typeKey), [typeKey]);

  // Subscribe to appliance document
  useEffect(() => {
    if (!clinicId || !roomId || !applianceId) return;

    setLoading(true);
    setLoadError(null);

    const ref = doc(db, 'clinics', clinicId, 'rooms', roomId, 'appliances', applianceId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as ApplianceDocShape) ?? {};

        const nextName = String(data.applianceName ?? '');
        const nextTypeKey = String(data.typeKey ?? '');
        const nextTypeLabel = String(data.typeLabel ?? '');

        setApplianceName(nextName);
        setTypeKey(nextTypeKey);
        setTypeLabel(nextTypeLabel);

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
            type: x.type === 'number' || x.type === 'date' ? x.type : 'string',
          }));

        setRecordFields(parsed);

        // Initialize missing values (do not wipe existing)
        setRecordValues((prev) => {
          const next = { ...prev };
          for (const item of parsed) {
            if (next[item.field] === undefined) next[item.field] = '';
          }
          return next;
        });

        setLoading(false);
      },
      (err) => {
        console.error('appliance doc snapshot error', err);
        setLoadError('Failed to load appliance.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clinicId, roomId, applianceId]);

  const FOOTER_HEIGHT = 84;
  const SAFE_GAP = 12;

  const FOCUS_ANCHOR_RATIO = 0.40; // 0.35–0.45 usually feels good
  const EXTRA_GAP = 12;            // small breathing room

  const scrollFieldIntoView = (key: string) => {
    if (activeDateField) return;

    setTimeout(() => {
      const input = inputRefs.current[key];
      if (!input?.measureInWindow) return;

      input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        const inputTop = y;
        const inputBottom = y + h;

        const kb = keyboardHeightRef.current;

        const bottomObstruction =
          kb > 0
            ? kb + SAFE_GAP
            : FOOTER_HEIGHT + tabBarHeight + insets.bottom + SAFE_GAP;

        const safeBottomY = windowHeight - bottomObstruction;

        // 1) Must be above keyboard-safe bottom
        const maxTopYAllowed = safeBottomY - h - EXTRA_GAP;

        // 2) Prefer a nice position around mid screen
        const desiredTopY = windowHeight * FOCUS_ANCHOR_RATIO;

        // Final target: as close to desiredTopY as possible,
        // but never so low that it would be hidden by keyboard.
        const targetTopY = Math.min(desiredTopY, maxTopYAllowed);

        // Only scroll if the input is below the target area or still hidden.
        const needsLift =
          inputTop > targetTopY || inputBottom > safeBottomY - EXTRA_GAP;

        if (!needsLift) return;

        const delta = inputTop - targetTopY;
        const nextY = Math.max(0, scrollYRef.current + delta);

        scrollRef.current?.scrollTo({ y: nextY, animated: true });
      });
    }, 50);
  };

  const onChangeField = (field: string, value: string) => {
    setRecordValues((prev) => ({ ...prev, [field]: value }));
  };

  const onPickDate = (field: string) => {
    Keyboard.dismiss();
    const existing = recordValues[field] ?? '';
    const initial = parseYYYYMMDD(existing) ?? new Date();
    setDateDraft(initial);
    setActiveDateField(field);
  };

  const onDateChange = (evt: DateTimePickerEvent, date?: Date) => {
    if (!activeDateField) return;

    if (Platform.OS !== 'ios' && evt.type === 'dismissed') {
      setActiveDateField(null);
      return;
    }

    if (!date) return;

    // iOS overlay: only update draft; commit on Done
    if (Platform.OS === 'ios') {
      setDateDraft(date);
      return;
    }

    // Android: commit immediately
    onChangeField(activeDateField, formatDateYYYYMMDD(date));
    setActiveDateField(null);
  };

  const closeDatePicker = () => setActiveDateField(null);
  const commitDatePicker = () => {
    if (activeDateField) {
      onChangeField(activeDateField, formatDateYYYYMMDD(dateDraft));
    }
    setActiveDateField(null);
  };

  const onSaveRecord = () => {
    // Display-only for now
    Alert.alert('Coming soon', 'Save Record will be implemented in a later step.');
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}          
          contentContainerStyle={[
            styles.content,            
            {
              paddingBottom:
                24 +
                FOOTER_HEIGHT +
                tabBarHeight +
                insets.bottom +
                SAFE_GAP +
                (keyboardHeight > 0 ? keyboardHeight : 0),
            },
          ]}
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
                <MaterialCommunityIcons
                  name={icon.name}
                  size={26}
                  color={icon.color ?? '#111'}
                />
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
                const value = recordValues[item.field] ?? '';

                return (
                  <View key={key} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      {item.field}
                      {item.required ? <Text style={styles.required}> *</Text> : null}
                    </Text>

                    {item.type === 'date' ? (
                      <View
                        ref={(r: any) => {
                          inputRefs.current[key] = r;
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            scrollFieldIntoView(key);
                            onPickDate(item.field);
                          }}
                          style={({ pressed }) => [styles.dateInput, pressed && { opacity: 0.85 }]}
                          accessibilityRole="button"
                        >
                          <Text style={value ? styles.dateText : styles.datePlaceholder}>
                            {value || 'Select date'}
                          </Text>
                          <MaterialCommunityIcons
                            name="calendar-month-outline"
                            size={20}
                            color="#111"
                          />
                        </Pressable>
                      </View>
                    ) : (
                      <TextInput
                        ref={(r) => {
                          inputRefs.current[key] = r as any;
                        }}
                        value={value}
                        onChangeText={(t) => onChangeField(item.field, t)}
                        placeholder={item.type === 'number' ? 'Enter number' : 'Enter text'}
                        placeholderTextColor="#999"
                        style={styles.textInput}
                        keyboardType={item.type === 'number' ? 'number-pad' : 'default'}
                        returnKeyType="done"                        
                        onFocus={() => {
                          focusedKeyRef.current = key;
                          scrollFieldIntoView(key);
                        }}
                      />
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Footer button (display-only for now) */}
        {!activeDateField && (
          <View style={styles.footerFixed}>
            <Pressable
              onPress={onSaveRecord}
              style={({ pressed }) => [
                styles.primaryBtn,
                styles.primaryBtnDisabled,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Save Record</Text>
            </Pressable>
          </View>
        )}

        {/* Android Date picker */}
        {Platform.OS !== 'ios' && activeDateField && (
          <DateTimePicker
            value={activeDateValue}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {/* iOS Date Picker Overlay */}
        {Platform.OS === 'ios' && activeDateField && (
          <View style={styles.dateOverlayWrap} pointerEvents="box-none">
            <Pressable style={styles.dateOverlayBackdrop} onPress={closeDatePicker} />
            <View style={styles.dateOverlayPanel}>
              <View style={styles.dateOverlayHeader}>
                <Pressable
                  onPress={commitDatePicker}
                  style={({ pressed }) => [styles.dateDoneBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.dateDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={dateDraft}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                style={styles.iosPicker}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
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
    backgroundColor: '#fff',
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

  // Display-only styling: slightly dim to indicate not yet active
  primaryBtnDisabled: { opacity: 0.6 },

  dateOverlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
  },
  dateOverlayBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  dateOverlayPanel: {
    borderTopWidth: 1,
    borderTopColor: '#111',
    backgroundColor: '#fff',
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
  iosPicker: {},
});
