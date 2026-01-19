import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';

export type RoomOption = {
  id: string;         // room document id
  roomName: string;
  roomIndex: number;
};

export type ModuleItem = {
  id: string;               // module document id (typeKey)
  moduleIndex: number;
  moduleName: string;
  description: string;
  official: boolean;
};

type SetupField = {
  field: string;
  type: 'string' | 'date' | 'number';
};

type Props = {
  visible: boolean;
  clinicId: string;
  roomId: string;
  roomName: string;
  selectedModule: ModuleItem | null;  // module chosen in Modal A
  onBack: () => void;                 // back -> show Modal A again
  onCloseAll: () => void;             // close -> close both modals
};

function formatYYYYMMDD(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

export default function AddApplianceModal({
  visible,
  clinicId,
  roomId,
  roomName,
  selectedModule,
  onBack,
  onCloseAll,
}: Props) {
  const [applianceName, setApplianceName] = useState('');

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [setupConfig, setSetupConfig] = useState<SetupField[]>([]);
  const [setupValues, setSetupValues] = useState<Record<string, string>>({});

  // Date picker state
  const [datePickerField, setDatePickerField] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

  // Reset defaults each time this modal opens / module changes
  useEffect(() => {
    if (!visible) return;
    setApplianceName('');
    setSetupConfig([]);
    setSetupValues({});
    setDatePickerField(null);
  }, [visible]);

  // Load setupConfig from module doc when modal is visible and module is selected
  useEffect(() => {
    const load = async () => {
      if (!visible || !selectedModule?.id) return;

      setLoadingConfig(true);
      try {
        const moduleRef = doc(db, 'clinics', '_common', 'modules', selectedModule.id);
        const snap = await getDoc(moduleRef);

        if (snap.exists()) {
          const data = snap.data() as any;
          
          const cfgRaw: unknown[] = Array.isArray((data as any).setupConfig) ? (data as any).setupConfig : [];
          const cfg: SetupField[] = cfgRaw
            .map((x: unknown) => {
              if (!x || typeof x !== 'object') return null;

              const obj = x as { field?: unknown; type?: unknown };

              const field = typeof obj.field === 'string' ? obj.field : '';
              const type = typeof obj.type === 'string' ? obj.type : '';

              if (!field) return null;
              if (type !== 'string' && type !== 'date' && type !== 'number') return null;

              return { field, type } as SetupField;
            })
            .filter((v): v is SetupField => v !== null);

          setSetupConfig(cfg);

          // initialize values for new fields
          const init: Record<string, string> = {};
          cfg.forEach((f) => {
            init[f.field] = '';
          });
          setSetupValues(init);
        } else {
          setSetupConfig([]);
          setSetupValues({});
        }
      } catch (e) {
        console.error('load module setupConfig error', e);
        setSetupConfig([]);
        setSetupValues({});
      } finally {
        setLoadingConfig(false);
      }
    };

    load();
  }, [visible, selectedModule?.id]);

  const moduleIcon = useMemo(() => {
    return getApplianceIcon(selectedModule?.id);
  }, [selectedModule?.id]);

  const canSubmit = useMemo(() => {
    if (!selectedModule?.id) return false;
    if (!applianceName.trim()) return false;

    // if setupConfig exists, require all fields filled (you can relax later)
    for (const f of setupConfig) {
      if (!setupValues[f.field]?.toString().trim()) return false;
    }
    return true;
  }, [selectedModule?.id, applianceName, setupConfig, setupValues]);

  const updateSetupValue = (field: string, value: string) => {
    setSetupValues((prev) => ({ ...prev, [field]: value }));
  };

  const onPickDate = (field: string) => {
    setDatePickerField(field);
    setTempDate(new Date());
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') {
      // Android closes on selection
      setDatePickerField(null);
    }
    if (date && datePickerField) {
      updateSetupValue(datePickerField, formatYYYYMMDD(date));
    }
  };

  const handleAddToRoom = async () => {
    if (!selectedModule) return;

    const name = applianceName.trim();
    if (!name) {
      Alert.alert('Missing info', 'Please enter appliance name.');
      return;
    }

    try {
      // Create new appliance doc ID now so we can store it in room applianceList
      const appliancesCol = collection(db, 'clinics', clinicId, 'rooms', roomId, 'appliances');
      const newApplianceRef = doc(appliancesCol); // auto-id but known before writing
      const newId = newApplianceRef.id;

      const applianceDocData = {
        applianceName: name,
        typeKey: selectedModule.id,
        typeLabel: selectedModule.moduleName,
        moduleIndex: selectedModule.moduleIndex,
        official: selectedModule.official,
        setupConfigValues: setupValues, // store keyed by label
        createdAt: serverTimestamp(),
      };

      const roomRef = doc(db, 'clinics', clinicId, 'rooms', roomId);

      // Transaction: write appliance doc + append to room.applianceList
      await runTransaction(db, async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists()) {
          throw new Error('Room does not exist.');
        }

        const roomData = roomSnap.data() as any;
        const currentList = Array.isArray(roomData.applianceList) ? roomData.applianceList : [];

        const newListItem = {
          id: newId,
          name,
          typeKey: selectedModule.id,
          typeLabel: selectedModule.moduleName,
        };

        tx.set(newApplianceRef, applianceDocData);
        tx.update(roomRef, {
          applianceList: [...currentList, newListItem],
        });
      });

      Alert.alert('Success', `Added "${name}" to ${roomName || 'room'}.`);
      onCloseAll();
    } catch (e: any) {
      console.error('Add to room error', e);
      Alert.alert('Error', e?.message ?? 'Failed to add appliance.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCloseAll}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onCloseAll} />

      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Add Appliance</Text>
          <Pressable onPress={onCloseAll} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="close" size={22} color="#111" />
          </Pressable>
        </View>

        {/* Scrollable content */}          
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={40}
          scrollEventThrottle={16}
          keyboardOpeningTime={0}
        >
          {/* Module chip */}
          <Text style={styles.label}>Module</Text>
          <View style={styles.moduleChip}>
            {/* Tag pinned top-right */}
            {!!selectedModule && (
              <View style={[styles.tagPinned, selectedModule.official ? styles.tagOfficial : styles.tagCustom]}>
                <Text style={styles.tagText}>{selectedModule.official ? 'OFFICIAL' : 'CUSTOM'}</Text>
              </View>
            )}

            <View style={styles.moduleRow}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={moduleIcon.name} size={26} color={moduleIcon.color ?? '#111'} />
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

          {/* Appliance Name */}
          <Text style={styles.label}>Appliance Name</Text>
          <TextInput
            value={applianceName}
            onChangeText={setApplianceName}
            placeholder="Enter appliance name"
            style={styles.input}    
          />

          {/* Setup Configuration */}
          {loadingConfig ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading setup configuration…</Text>
            </View>
          ) : setupConfig.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Setup Configuration</Text>

              {setupConfig.map((f) => {
                const val = setupValues[f.field] ?? '';
                if (f.type === 'string') {
                  return (
                    <View key={f.field} style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>{f.field}</Text>
                      <TextInput
                        value={val}
                        onChangeText={(t) => updateSetupValue(f.field, t)}
                        placeholder={`Enter ${f.field}`}
                        style={styles.input}
                      />
                    </View>
                  );
                }

                if (f.type === 'number') {
                  return (
                    <View key={f.field} style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>{f.field}</Text>
                      <TextInput
                        value={val}
                        onChangeText={(t) => updateSetupValue(f.field, t.replace(/[^0-9.]/g, ''))}
                        placeholder={`Enter ${f.field}`}
                        keyboardType="numeric"                          
                        returnKeyType="done"
                        submitBehavior='blurAndSubmit'
                        style={styles.input}
                      />
                    </View>
                  );
                }

                // date
                return (
                  <View key={f.field} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{f.field}</Text>
                    <Pressable
                      onPress={() => onPickDate(f.field)}
                      style={({ pressed }) => [styles.input, styles.dateInput, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={{ fontWeight: '700', color: val ? '#111' : '#777' }}>
                        {val || 'Select date'}
                      </Text>
                      <MaterialCommunityIcons name="calendar" size={20} color="#111" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Footer Buttons */}
          <View style={styles.footerInner}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.footerBtn, pressed && { opacity: 0.8 }]}>
              <Text style={styles.footerBtnText}>← Back</Text>
            </Pressable>
            <Pressable
              onPress={handleAddToRoom}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.footerBtn,
                styles.primaryBtn,
                (!canSubmit || pressed) && { opacity: !canSubmit ? 0.45 : 0.85 },
              ]}
            >
              <Text style={[styles.footerBtnText, styles.primaryBtnText]}>Add to Room</Text>
            </Pressable>
          </View>
        </KeyboardAwareScrollView>        

        {/* DateTimePicker overlay (only when needed) */}
        {datePickerField && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
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
    height: '85%',
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

  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 200, // CRITICAL: Must be large enough for footer + keyboard breathing room
  },

  label: { fontSize: 13, fontWeight: '900' },

  input: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pickerBox: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 14,
    overflow: 'hidden',
  },

  moduleChip: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    position: 'relative',
  },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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

  section: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fff',
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 8 },
  fieldBlock: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '900', marginBottom: 6 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { color: '#666', fontWeight: '700' },

  footerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20, // Add space before footer
    borderTopWidth: 1,
    borderTopColor: '#111',
    paddingTop: 14,
  },
  
  footerBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    flex: 1,
    alignItems: 'center',
  },
  footerBtnText: { fontSize: 14, fontWeight: '900' },
  primaryBtn: { backgroundColor: '#111' },
  primaryBtnText: { color: '#fff' },
});
