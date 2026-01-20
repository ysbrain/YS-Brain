
import type { ModuleItem } from '@/src/components/SelectApplianceTypeModal';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== mm ||
    d.getDate() !== dd
  ) {
    return null;
  }
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
  
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const windowHeight = Dimensions.get('window').height;
  
  const [dateDraft, setDateDraft] = useState<Date>(new Date());

  // Store values keyed by field name (assumes fields are unique)
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // Date picker control
  const [activeDateField, setActiveDateField] = useState<string | null>(null);
  const activeDateValue = useMemo(() => {
    if (!activeDateField) return new Date();
    const s = configValues[activeDateField];
    return parseYYYYMMDD(s) ?? new Date();
  }, [activeDateField, configValues]);

  // Reset form when opening/closing or module changes
  useEffect(() => {
    if (!visible) return;
    setApplianceName('');
    setConfigValues({});
    setSetupConfig(null);
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
          setSetupConfig(null);
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
        setSetupConfig(null);
        setLoadingConfig(false);
      }
    );

    return () => unsub();
  }, [visible, selectedModule?.id]);

  const icon = useMemo(() => {
    return getApplianceIcon(selectedModule?.id ?? '');
  }, [selectedModule?.id]);

  const onChangeConfig = (field: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [field]: value }));
  };

  const onPickDate = (field: string) => {    
    Keyboard.dismiss();

    // Initialize draft to existing value if present; otherwise today
    const existing = configValues[field];
    const initial = parseYYYYMMDD(existing) ?? new Date();
    setDateDraft(initial);

    setActiveDateField(field);
  };
  
  const onDateChange = (_evt: DateTimePickerEvent, date?: Date) => {
    if (!activeDateField) return;
    if (!date) return;

    // iOS overlay: only update draft; commit on Done
    if (Platform.OS === 'ios') {
      setDateDraft(date);
      return;
    }

    // Android: commit immediately (existing behavior)
    onChangeConfig(activeDateField, formatDateYYYYMMDD(date));
    setActiveDateField(null);
  };
  
  const closeDatePicker = () => {
    setActiveDateField(null);
  };
  const commitDatePicker = () => {
    if (activeDateField) {
      onChangeConfig(activeDateField, formatDateYYYYMMDD(dateDraft));
    }
    setActiveDateField(null);
  };

  const hasSetupConfig = !!setupConfig && setupConfig.length > 0;
  
  const FOOTER_HEIGHT = 72; // roughly your footer height; adjust if needed
  const SAFE_GAP = 12;

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  
  const scrollFieldIntoView = (key: string) => {
    // Only do this when keyboard is visible
    if (!keyboardHeight) return;
    if (activeDateField) return;

    // Small delay lets iOS finish keyboard animation / layout
    setTimeout(() => {
      const input = inputRefs.current[key];
      if (!input) return;

      input.measureInWindow((_x, y, _w, h) => {
        const inputBottom = y + h;

        // Footer sits just above keyboard (because KAV padding lifts it),
        // so the "safe bottom" is above footer + a small gap.
        const safeBottomY = windowHeight - keyboardHeight - FOOTER_HEIGHT - SAFE_GAP;

        // If input is already above safeBottomY, do nothing (prevents unnecessary scroll)
        if (inputBottom <= safeBottomY) return;

        const overlap = inputBottom - safeBottomY;

        scrollRef.current?.scrollTo({
          y: scrollYRef.current + overlap,
          animated: true,
        });
      });
    }, 50);
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
            {/* Module section */}
            <Text style={styles.sectionLabel}>Module</Text>

            <View style={styles.moduleChip}>
              {/* Tag pinned top-right */}
              <View
                style={[
                  styles.tagPinned,
                  selectedModule?.official ? styles.tagOfficial : styles.tagCustom,
                ]}
              >
                <Text style={styles.tagText}>
                  {selectedModule?.official ? 'OFFICIAL' : 'CUSTOM'}
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
                    {selectedModule?.moduleName ?? ''}
                  </Text>

                  {!!selectedModule?.description && (
                    <Text style={styles.moduleDesc} numberOfLines={2}>
                      {selectedModule.description}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Appliance name */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Appliance Name</Text>
            <TextInput              
              ref={(r) => {
                inputRefs.current['applianceName'] = r;
              }}
              value={applianceName}
              onChangeText={setApplianceName}
              placeholder="Enter appliance name"
              placeholderTextColor="#999"
              style={styles.textInput}
              returnKeyType="done"
              onFocus={() => scrollFieldIntoView('applianceName')}
            />

            {/* Setup Configuration (conditional) */}
            {hasSetupConfig && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                  Setup Configuration
                </Text>

                <View style={styles.setupBox}>
                  {loadingConfig ? (
                    <Text style={styles.loadingHint}>Loading setup fields...</Text>
                  ) : (
                    setupConfig!.map((item, idx) => {
                      const k = `setup:${idx}:${item.field}`;
                      const value = configValues[item.field] ?? '';

                      return (
                        <View key={`${idx}:${item.field}`} style={styles.setupItem}>
                          <Text style={styles.setupFieldLabel}>{item.field}</Text>

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
                                ]}
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
                                inputRefs.current[k] = r;
                              }}
                              value={value}
                              onChangeText={(t) => onChangeConfig(item.field, t)}
                              placeholder={item.type === 'number' ? 'Enter number' : 'Enter text'}
                              placeholderTextColor="#999"
                              style={styles.textInput}
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
          </ScrollView>

          {/* Footer buttons */}
          {!activeDateField && (
            <View style={styles.footerFixed}>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color="#111" />
                <Text style={styles.footerBtnText}>Back</Text>
              </Pressable>

              <Pressable
                onPress={() => console.log('Add later')}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.primaryBtnText}>Add to Room</Text>
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
        
        {/* iOS Date Picker Overlay (covers footer like keyboard) */}
        {Platform.OS === 'ios' && activeDateField && (
          <View style={styles.dateOverlayWrap} pointerEvents="box-none">
            {/* Backdrop: tap anywhere to dismiss */}
            <Pressable
              style={styles.dateOverlayBackdrop}
              onPress={() => closeDatePicker()}
            />

            {/* Panel: sits on bottom, above backdrop */}
            <View style={styles.dateOverlayPanel}>
              <View style={styles.dateOverlayHeader}>
                <Pressable                  
                  onPress={() => commitDatePicker()}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
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
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    padding: 8,
  },

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
  addToRoomLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  roomText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },

  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },

  // Module chip (same look as SelectApplianceTypeModal row)
  moduleChip: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    position: 'relative',
  },
  chipTopRow: {
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
  moduleName: {
    fontSize: 15,
    fontWeight: '900',
  },
  moduleDesc: {
    marginTop: 6,
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
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
  tagText: {
    fontSize: 12,
    fontWeight: '900',
  },

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
  setupItem: {
    gap: 8,
  },
  setupFieldLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  loadingHint: {
    color: '#666',
    fontWeight: '700',
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
  datePlaceholder: {
    color: '#999',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
  },
  
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    height: 72,              // must match FOOTER_HEIGHT
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
  footerBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
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
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  
  dateOverlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999, // ensure above footerFixed
  },

  dateOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)', // subtle like system overlays
  },

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

  dateDoneText: {
    fontWeight: '900',
  },

  iosPicker: {
    // Spinner height is usually ~216; leaving it flexible is fine
  },

  iosDateDoneRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'flex-end',
    backgroundColor: '#fff',
  },
  iosDoneBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  iosDoneText: {
    fontWeight: '900',
  },
});
