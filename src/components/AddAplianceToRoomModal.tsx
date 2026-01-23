// src/components/AddAplianceToRoomModal.tsx

import type { ModuleItem } from '@/src/components/SelectApplianceTypeModal';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { safeTypeKeyFromLabel } from '@/src/utils/slugify';

type SetupFieldType = 'string' | 'number' | 'date';
type SetupConfigItem = { field: string; type: SetupFieldType };

type Props = {
  visible: boolean;
  clinicId: string;
  roomId: string;
  roomName: string;
  selectedModule: ModuleItem | null;
  onBack: () => void;
  onCloseAll: () => void;
};

// Something "measurable" (TextInput and View both support measureInWindow)
type MeasurableRef = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

type FieldKey = 'applianceName' | `setup:${string}`;

type FormErrorCode =
  | 'NO_MODULE'
  | 'MISSING_NAME'
  | 'MISSING_FIELD'
  | 'INVALID_NUMBER'
  | 'INVALID_DATE'
  | 'NAME_COLLISION'
  | 'ROOM_NOT_FOUND'
  | 'UNKNOWN';

type FormError = {
  code: FormErrorCode;
  fieldKey?: FieldKey;
  meta?: Record<string, any>;
};

class FormAppError extends Error {
  code: FormErrorCode;
  fieldKey?: FieldKey;
  meta?: Record<string, any>;

  constructor(code: FormErrorCode, opts?: { fieldKey?: FieldKey; meta?: Record<string, any>; message?: string }) {
    super(opts?.message ?? code);
    this.code = code;
    this.fieldKey = opts?.fieldKey;
    this.meta = opts?.meta;
  }
}

function isFormAppError(e: any): e is FormAppError {
  return !!e && typeof e === 'object' && typeof e.code === 'string';
}

function getFormErrorMessage(err: FormError): string {
  switch (err.code) {
    case 'NO_MODULE':
      return 'No module selected.';
    case 'MISSING_NAME':
      return 'Please enter an appliance name.';
    case 'MISSING_FIELD':
      return `Please fill in “${err.meta?.field ?? 'this field'}”.`;
    case 'INVALID_NUMBER':
      return `“${err.meta?.field ?? 'This field'}” must be a number.`;
    case 'INVALID_DATE':
      return `“${err.meta?.field ?? 'This field'}” must be a valid date (YYYY/MM/DD).`;
    case 'NAME_COLLISION':
      return 'This appliance name is already used. Please choose a different name.';
    case 'ROOM_NOT_FOUND':
      return 'Room does not exist.';
    default:
      return 'Failed to add appliance.';
  }
}

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

export default function AddApplianceToRoomModal({
  visible,
  clinicId,
  roomId,
  roomName,
  selectedModule,
  onBack,
  onCloseAll,
}: Props) {
  const [applianceName, setApplianceName] = useState('');
  const [setupConfig, setSetupConfig] = useState<SetupConfigItem[] | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formError, setFormError] = useState<FormError | null>(null);
  const errorText = useMemo(() => (formError ? getFormErrorMessage(formError) : null), [formError]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const inputRefs = useRef<Record<string, MeasurableRef | null>>({});

  const windowHeight = Dimensions.get('window').height;

  // Store values keyed by field name (assumes fields are unique)
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // Date picker control
  const [activeDateField, setActiveDateField] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<Date>(new Date());

  const activeDateValue = useMemo(() => {
    if (!activeDateField) return new Date();
    const s = configValues[activeDateField];
    return parseYYYYMMDD(s) ?? new Date();
  }, [activeDateField, configValues]);
  
  const allFieldsFilled = useMemo(() => {
    if (!selectedModule) return false;

    // Must have a name
    if (!applianceName.trim()) return false;

    // While loading config, keep disabled
    if (loadingConfig) return false;

    // If config hasn't been loaded into state yet, keep disabled
    if (setupConfig === null) return false;

    // Require all setup fields filled
    for (const item of setupConfig) {
      const v = (configValues[item.field] ?? '').trim();
      if (!v) return false;
    }

    return true;
  }, [selectedModule, applianceName, loadingConfig, setupConfig, configValues]);
  
  const applianceNameInputRef = useRef<TextInput>(null);

  const focusApplianceName = () => {
    // Small delay helps ensure layout is stable before measuring/scrolling
    requestAnimationFrame(() => {
      applianceNameInputRef.current?.focus();
      scrollFieldIntoView('applianceName');
    });
  };

  // Reset form when opening/closing or module changes
  useEffect(() => {
    if (!visible) return;
    setApplianceName('');
    setConfigValues({});
    setSetupConfig(null);
    setFormError(null);
    setSaving(false);
    setActiveDateField(null);
    setDateDraft(new Date());
  }, [visible, selectedModule?.id]);

  // Subscribe to module doc to fetch setupConfig
  useEffect(() => {
    if (!visible) return;
    if (!selectedModule?.id) return;

    setLoadingConfig(true);
    const ref = doc(db, 'clinics', '_common', 'modules', selectedModule.id);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data: any = snap.data() ?? {};
        const raw = Array.isArray(data.setupConfig) ? data.setupConfig : null;

        if (!raw) {
          setSetupConfig([]);
          setLoadingConfig(false);
          return;
        }

        const parsed: SetupConfigItem[] = raw
          .map((x: any) => ({
            field: String(x?.field ?? '').trim(),
            type: String(x?.type ?? 'string') as SetupFieldType,
          }))
          .filter((x: SetupConfigItem) => x.field.length > 0)
          .map((x: SetupConfigItem) => ({
            field: x.field,
            type: x.type === 'number' || x.type === 'date' ? x.type : 'string',
          }));

        setSetupConfig(parsed);

        // Initialize missing values (do not wipe existing)
        setConfigValues((prev) => {
          const next = { ...prev };
          for (const item of parsed) {
            if (next[item.field] === undefined) next[item.field] = '';
          }
          return next;
        });

        setLoadingConfig(false);
      },
      (err) => {
        console.error('setupConfig snapshot error:', err);
        setSetupConfig([]);
        setLoadingConfig(false);
      }
    );

    return () => unsub();
  }, [visible, selectedModule?.id]);

  const icon = useMemo(() => getApplianceIcon(selectedModule?.id ?? ''), [selectedModule?.id]);
  
  const onChangeConfig = (field: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [field]: value }));
    const k = `setup:${field}` as FieldKey;
    if (formError?.fieldKey === k) setFormError(null);
  };

  const onPickDate = (field: string) => {
    Keyboard.dismiss();
    const existing = configValues[field];
    const initial = parseYYYYMMDD(existing) ?? new Date();
    setDateDraft(initial);
    setActiveDateField(field);
  };

  const onDateChange = (evt: DateTimePickerEvent, date?: Date) => {
    if (!activeDateField) return;

    // Android: user can dismiss picker
    // (iOS uses overlay + Done button; we ignore cancel there via closeDatePicker)
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
    onChangeConfig(activeDateField, formatDateYYYYMMDD(date));
    setActiveDateField(null);
  };

  const closeDatePicker = () => setActiveDateField(null);

  const commitDatePicker = () => {
    if (activeDateField) {
      onChangeConfig(activeDateField, formatDateYYYYMMDD(dateDraft));
    }
    setActiveDateField(null);
  };

  const showSetupSection = loadingConfig || ((setupConfig?.length ?? 0) > 0);

  const FOOTER_HEIGHT = 72;
  const SAFE_GAP = 12;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollFieldIntoView = (key: string) => {
    if (!keyboardHeight) return;
    if (activeDateField) return;

    setTimeout(() => {
      const input = inputRefs.current[key];
      if (!input) return;

      input.measureInWindow((_x, y, _w, h) => {
        const inputBottom = y + h;
        const safeBottomY = windowHeight - keyboardHeight - FOOTER_HEIGHT - SAFE_GAP;
        if (inputBottom <= safeBottomY) return;

        const overlap = inputBottom - safeBottomY;
        scrollRef.current?.scrollTo({
          y: scrollYRef.current + overlap,
          animated: true,
        });
      });
    }, 50);
  };
  
  const validateAndBuildSetup = () => {
    const cfg = setupConfig ?? [];
    const setup: Record<string, any> = {};

    for (const item of cfg) {
      const raw = (configValues[item.field] ?? '').trim();

      // Require all setup fields filled
      if (!raw) {
        return {
          ok: false as const,
          error: {
            code: 'MISSING_FIELD' as const,
            fieldKey: `setup:${item.field}` as FieldKey,
            meta: { field: item.field },
          },
        };
      }

      if (item.type === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_NUMBER' as const,
              fieldKey: `setup:${item.field}` as FieldKey,
              meta: { field: item.field },
            },
          };
        }
        setup[item.field] = n;
      } else if (item.type === 'date') {
        const d = parseYYYYMMDD(raw);
        if (!d) {
          return {
            ok: false as const,
            error: {
              code: 'INVALID_DATE' as const,
              fieldKey: `setup:${item.field}` as FieldKey,
              meta: { field: item.field },
            },
          };
        }
        setup[item.field] = raw; // keep string
      } else {
        setup[item.field] = raw;
      }
    }

    return { ok: true as const, setup };
  };  
  
  const onAddToRoom = async () => {
    setFormError(null);

    if (!selectedModule?.id) {
      setFormError({ code: 'NO_MODULE' });
      return;
    }

    const name = applianceName.trim();
    if (!name) {
      setFormError({ code: 'MISSING_NAME', fieldKey: 'applianceName' });
      focusApplianceName();
      return;
    }

    // Safety: even though button is disabled until filled, keep guard
    if (!allFieldsFilled) {
      // Find first missing field and target it
      if (!name) {
        setFormError({ code: 'MISSING_NAME', fieldKey: 'applianceName' });
        focusApplianceName();
        return;
      }

      const cfg = setupConfig ?? [];
      for (const item of cfg) {
        const v = (configValues[item.field] ?? '').trim();
        if (!v) {
          const fk = `setup:${item.field}` as FieldKey;
          setFormError({ code: 'MISSING_FIELD', fieldKey: fk, meta: { field: item.field } });
          scrollFieldIntoView(fk);
          return;
        }
      }
    }

    const res = validateAndBuildSetup();
    if (!res.ok) {
      setFormError(res.error);
      if (res.error.fieldKey) {
        scrollFieldIntoView(res.error.fieldKey);
        if (res.error.fieldKey === 'applianceName') focusApplianceName();
      }
      return;
    }

    try {
      setSaving(true);

      const applianceId = safeTypeKeyFromLabel(name);
      const roomRef = doc(db, 'clinics', clinicId, 'rooms', roomId);
      const appliancesColRef = collection(db, 'clinics', clinicId, 'rooms', roomId, 'appliances');
      const applianceRef = doc(appliancesColRef, applianceId);

      await runTransaction(db, async (tx) => {
        const applianceSnap = await tx.get(applianceRef);
        if (applianceSnap.exists()) {
          throw new FormAppError('NAME_COLLISION', { fieldKey: 'applianceName' });
        }

        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists()) {
          throw new FormAppError('ROOM_NOT_FOUND');
        }

        const data: any = roomSnap.data() ?? {};
        const list = Array.isArray(data.applianceList) ? data.applianceList : [];

        const newListItem = {
          id: applianceId,
          name,
          typeKey: selectedModule.id,
          typeLabel: selectedModule.moduleName,
        };

        tx.update(roomRef, { applianceList: [...list, newListItem] });

        tx.set(applianceRef, {
          applianceName: name,
          typeKey: selectedModule.id,
          typeLabel: selectedModule.moduleName,
          setup: res.setup,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      
      // Success message AFTER all writes are done
      Alert.alert(
        '✅ Success',
        `“${name}” has been added to “${roomName}”.`,
        [
          {
            text: 'OK',
            onPress: () => onCloseAll(),
          },
        ],
        { cancelable: true }
      );
    } catch (e: any) {
      console.error('Add appliance error:', e);

      if (isFormAppError(e)) {
        setFormError({ code: e.code, fieldKey: e.fieldKey, meta: e.meta });
        if (e.fieldKey) {
          scrollFieldIntoView(e.fieldKey);
          if (e.fieldKey === 'applianceName') focusApplianceName();
        }
        return;
      }

      // fallback
      setFormError({ code: 'UNKNOWN' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onCloseAll}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onCloseAll} />

      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Add Appliance</Text>
          <Pressable
            onPress={onCloseAll}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={20} color="#111" />
          </Pressable>
        </View>

        {/* Add to room row */}
        <View style={styles.addToRoomRow}>
          <Text style={styles.addToRoomLabel}>Add to Room:</Text>
          <MaterialCommunityIcons name="door" size={18} color="#111" />
          <Text style={styles.roomText} numberOfLines={1}>
            {roomName}
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: FOOTER_HEIGHT + 16 + keyboardHeight },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {/* Defensive: selectedModule missing */}
            {!selectedModule ? (
              <View style={{ paddingVertical: 8, gap: 10 }}>
                <Text style={styles.loadingHint}>No module selected.</Text>
                <Pressable
                  onPress={onBack}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color="#111" />
                  <Text style={styles.footerBtnText}>Back</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Module section */}
                <Text style={styles.sectionLabel}>Module</Text>
                <View style={styles.moduleChip}>
                  {/* Tag pinned top-right */}
                  <View
                    style={[
                      styles.tagPinned,
                      selectedModule.official ? styles.tagOfficial : styles.tagCustom,
                    ]}
                  >
                    <Text style={styles.tagText}>
                      {selectedModule.official ? 'OFFICIAL' : 'CUSTOM'}
                    </Text>
                  </View>

                  <View style={styles.chipTopRow}>
                    <View style={styles.iconWrap}>
                      <MaterialCommunityIcons
                        name={icon.name}
                        size={26}
                        color={icon.color ?? '#111'}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 88 }}>
                      <Text style={styles.moduleName} numberOfLines={1}>
                        {selectedModule.moduleName}
                      </Text>

                      {/* ✅ FIX: show description only when it exists */}
                      {!!selectedModule.description && (
                        <Text style={styles.moduleDesc} numberOfLines={2}>
                          {selectedModule.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Appliance name */}                
                <Text
                  style={[
                    styles.sectionLabel,
                    { marginTop: 14 },
                    formError?.fieldKey === 'applianceName' && styles.errorLabel,
                  ]}
                >
                  Appliance Name
                </Text>
                <TextInput
                  ref={(r) => {
                    applianceNameInputRef.current = r;
                    inputRefs.current['applianceName'] = r as any;
                  }}
                  value={applianceName}                  
                  onChangeText={(t) => {
                    setApplianceName(t);
                    if (formError?.fieldKey === 'applianceName') setFormError(null);
                  }}
                  placeholder="Enter appliance name"
                  placeholderTextColor="#999"                  
                  style={[
                    styles.textInput,
                    formError?.fieldKey === 'applianceName' && styles.errorBorder,
                  ]}
                  returnKeyType="done"
                  onFocus={() => scrollFieldIntoView('applianceName')}
                />

                {/* Inline error */}
                {!!errorText && (
                  <Text style={{ color: '#B00020', fontWeight: '700', marginTop: 10 }}>
                    {errorText}
                  </Text>
                )}

                {/* Setup Configuration */}
                {showSetupSection && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                      Setup Configuration
                    </Text>

                    <View style={styles.setupBox}>
                      {loadingConfig ? (
                        <Text style={styles.loadingHint}>Loading setup fields...</Text>
                      ) : (
                        (setupConfig ?? []).map((item) => {
                          const k = `setup:${item.field}`;
                          const value = configValues[item.field] ?? '';

                          return (
                            <View key={k} style={styles.setupItem}>                              
                              <Text
                                style={[
                                  styles.setupFieldLabel,
                                  formError?.fieldKey === k && styles.errorLabel,
                                ]}
                              >
                                {item.field}
                              </Text>

                              {item.type === 'date' ? (
                                <View
                                  ref={(r: any) => {
                                    inputRefs.current[k] = r as any;
                                  }}
                                >
                                  <Pressable
                                    onPress={() => {
                                      scrollFieldIntoView(k);
                                      onPickDate(item.field);
                                    }}                                    
                                    style={({ pressed }) => [
                                      styles.dateInput,
                                      pressed && { opacity: 0.85 },
                                      formError?.fieldKey === k && styles.errorBorder,
                                    ]}
                                    accessibilityRole="button"
                                  >
                                    <Text
                                      style={value ? styles.dateText : styles.datePlaceholder}
                                    >
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
                                    inputRefs.current[k] = r as any;
                                  }}
                                  value={value}
                                  onChangeText={(t) => onChangeConfig(item.field, t)}
                                  placeholder={item.type === 'number' ? 'Enter number' : 'Enter text'}
                                  placeholderTextColor="#999"                                  
                                  style={[
                                    styles.textInput,
                                    formError?.fieldKey === k && styles.errorBorder,
                                  ]}
                                  keyboardType={item.type === 'number' ? 'number-pad' : 'default'}
                                  returnKeyType="done"
                                  onFocus={() => scrollFieldIntoView(k)}
                                />
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer buttons (hide while date overlay is active) */}
          {!activeDateField && (
            <View style={styles.footerFixed}>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]}
                disabled={saving}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color="#111" />
                <Text style={styles.footerBtnText}>Back</Text>
              </Pressable>

              <Pressable
                onPress={onAddToRoom}                
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.9 },
                  (saving || !allFieldsFilled) && styles.primaryBtnDisabled,
                  saving && { opacity: 0.6 },
                ]}
                disabled={saving || !selectedModule || !allFieldsFilled}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? 'Adding…' : 'Add to Room'}
                </Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Android Date picker (native) */}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#111',
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 16, fontWeight: '900' },
  closeBtn: { borderWidth: 1, borderColor: '#111', borderRadius: 12, padding: 8 },
  addToRoomRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  addToRoomLabel: { fontSize: 13, fontWeight: '900' },
  roomText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  body: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '900', marginBottom: 8 },
  moduleChip: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    position: 'relative',
  },
  chipTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  moduleName: { fontSize: 15, fontWeight: '900' },
  moduleDesc: { marginTop: 6, fontSize: 13, color: '#444', fontWeight: '600' },
  tagPinned: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagOfficial: { backgroundColor: '#EAF7EA' },
  tagCustom: { backgroundColor: '#F3F3F3' },
  tagText: { fontSize: 12, fontWeight: '900' },
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
  setupBox: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  setupItem: { gap: 8 },
  setupFieldLabel: { fontSize: 13, fontWeight: '900' },
  loadingHint: { color: '#666', fontWeight: '700' },
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
    height: 72,
    borderTopWidth: 1,
    borderTopColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#fff',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    flex: 1,
  },
  footerBtnText: { fontSize: 14, fontWeight: '900' },
  primaryBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#111',
    flex: 1,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },

  errorLabel: {
    color: '#B00020',
  },
  errorBorder: {
    borderColor: '#B00020',
    borderWidth: 2
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },

  dateOverlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
  },
  dateOverlayBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  dateOverlayPanel: { borderTopWidth: 1, borderTopColor: '#111', backgroundColor: '#fff', paddingBottom: 12 },
  dateOverlayHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, flexDirection: 'row', justifyContent: 'flex-end' },
  dateDoneBtn: { borderWidth: 1, borderColor: '#111', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#fff' },
  dateDoneText: { fontWeight: '900' },
  iosPicker: {},
});
