// app/(tabs)/clinic/record.tsx

import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import {
  IOS_PICKER_OVERLAY_HEIGHT,
  IosDateTimePickerOverlay,
} from '@/src/components/IosDateTimePickerOverlay';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useUiLock } from '@/src/contexts/UiLockContext';
import { useKeyboardAwareFieldScroll } from '@/src/hooks/useKeyboardAwareFieldScroll';
import { useValidationScroll } from '@/src/hooks/useValidationScroll';
import { db } from '@/src/lib/firebase';
import { getApplianceIcon } from '@/src/utils/applianceIcons';
import {
  formatDateYYYYMMDDSlash,
  formatReadableTimestamp,
  formatTimeHHMM,
  parseHHMM,
  parseYYYYMMDDSlash
} from '@/src/utils/dateTime';
import { toFirestoreSafeKey } from '@/src/utils/firestoreKeys';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import {
  cropToAspect,
  uriToBlob,
} from '@/src/utils/photo';
import { normalizeParam } from '@/src/utils/routeParams';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

type RecordFieldType = 'string' | 'number' | 'date' | 'time' | 'boolean' | 'photo';

type RecordFieldItem = {
  field: string;
  type: RecordFieldType;
  required: boolean;
};

type ApplianceDocShape = {
  applianceKey?: string;
  applianceName?: string;
  typeKey?: string;
  typeName?: string;
  recordFields?: RecordFieldItem[];
};

type RecordValue = string | boolean | null;

const PHOTO_ASPECT = 4 / 3;
const PHOTO_ASPECT_EMPTY = 16 / 9;

export default function ClinicRecordScreen() {
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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [applianceName, setApplianceName] = useState('');
  const [applianceKey, setApplianceKey] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [typeName, setTypeName] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [activePhotoField, setActivePhotoField] = useState<string | null>(null);

  const [recordFields, setRecordFields] = useState<RecordFieldItem[]>([]);
  const [recordValues, setRecordValues] = useState<Record<string, RecordValue>>({});
  const [saving, setSaving] = useState(false);

  const { setUiLocked } = useUiLock();

  // Picker control (date/time)
  const [activePicker, setActivePicker] = useState<{ field: string; mode: 'date' | 'time' } | null>(
    null,
  );
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());

  const FOOTER_BASE_HEIGHT = 84;

  const pickerOverlayHeight =
    Platform.OS === 'ios' && activePicker ? IOS_PICKER_OVERLAY_HEIGHT : 0;

  const {
    scrollRef,
    registerFieldRef,
    onFieldFocus,
    onFieldBlur,
    handleScroll,
    requestScroll,
    contentBottomPadding,
  } = useKeyboardAwareFieldScroll({
    activeOverlayFieldKey: activePicker ? `record:${activePicker.field}` : null,
    overlayHeight: pickerOverlayHeight,
    baseBottomPadding: 24 + FOOTER_BASE_HEIGHT,
  });

  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();
    const raw = recordValues[activePicker.field];
    const s = typeof raw === 'string' ? raw : '';
    if (activePicker.mode === 'date') return parseYYYYMMDDSlash(s) ?? new Date();
    return parseHHMM(s) ?? new Date();
  }, [activePicker, recordValues]);

  const hasValidContext = Boolean(clinicId && roomId && applianceId);

  const applianceReady =
    !loading &&
    !loadError &&
    applianceName.trim().length > 0 &&
    recordFields.length > 0;

  const canSave =
    hasValidContext &&
    Boolean(user?.uid) &&
    applianceReady &&
    !saving;

  const icon = useMemo(() => getApplianceIcon(typeKey), [typeKey]);

  const onChangeField = useCallback((field: string, value: RecordValue) => {
    setRecordValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const openPicker = useCallback(
    (field: string, mode: 'date' | 'time') => {
      Keyboard.dismiss();
      const raw = recordValues[field];
      const s = typeof raw === 'string' ? raw : '';
      const initial = mode === 'date' ? parseYYYYMMDDSlash(s) ?? new Date() : parseHHMM(s) ?? new Date();
      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [recordValues],
  );

  const blurActivePickerField = useCallback(() => {
    if (!activePicker) return;

    onFieldBlur(`record:${activePicker.field}`);
  }, [activePicker, onFieldBlur]);

  const onPickerChange = useCallback(
    (evt: DateTimePickerEvent, date?: Date) => {
      if (!activePicker) return;

      if (Platform.OS !== 'ios' && evt.type === 'dismissed') {
        blurActivePickerField();
        setActivePicker(null);
        return;
      }

      if (!date) return;

      if (Platform.OS === 'ios') {
        setPickerDraft(date);
        return;
      }

      if (activePicker.mode === 'date') {
        onChangeField(activePicker.field, formatDateYYYYMMDDSlash(date));
      } else {
        onChangeField(activePicker.field, formatTimeHHMM(date));
      }

      blurActivePickerField();
      setActivePicker(null);
    },
    [activePicker, onChangeField, blurActivePickerField],
  );

  const closePicker = useCallback(() => {
    blurActivePickerField();
    setActivePicker(null);
  }, [blurActivePickerField]);

  const commitPicker = useCallback(() => {
    if (activePicker) {
      if (activePicker.mode === 'date') {
        onChangeField(activePicker.field, formatDateYYYYMMDDSlash(pickerDraft));
      } else {
        onChangeField(activePicker.field, formatTimeHHMM(pickerDraft));
      }
    }

    blurActivePickerField();
    setActivePicker(null);
  }, [activePicker, pickerDraft, onChangeField, blurActivePickerField]);

  const closeCamera = useCallback(() => {
    setCameraOpen(false);
    setActivePhotoField(null);
  }, []);

  const onCapturedPhoto = useCallback(
    async (photo: { uri: string; width: number; height: number }) => {
      if (!activePhotoField) {
        closeCamera();
        return;
      }

      try {
        const croppedUri = await cropToAspect({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          aspectRatio: PHOTO_ASPECT,
        });

        onChangeField(activePhotoField, croppedUri);
      } catch (err) {
        console.error('photo process error', err);
        Alert.alert('Photo error', 'Failed to process the captured photo.');
      } finally {
        closeCamera();
      }
    },
    [activePhotoField, closeCamera, onChangeField],
  );

  // Subscribe to appliance doc
  useEffect(() => {
    if (!clinicId || !roomId || !applianceId) {
      setLoading(false);
      setLoadError('Missing clinic, room, or appliance information.');
      setRecordFields([]);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const ref = doc(db, 'clinics', clinicId, 'rooms', roomId, 'appliances', applianceId);

    const unsub = onSnapshot(
      ref,
      (snap) => {        
        if (!snap.exists()) {
          setLoadError('Appliance not found.');
          setRecordFields([]);
          setLoading(false);
          return;
        }

        const data = (snap.data() as ApplianceDocShape) ?? {};

        setApplianceName(String(data.applianceName ?? ''));
        setApplianceKey(String(data.applianceKey ?? ''));
        setTypeKey(String(data.typeKey ?? ''));
        setTypeName(String(data.typeName ?? ''));

        const raw = Array.isArray(data.recordFields) ? data.recordFields : [];

        const seen = new Set<string>();

        const parsed: RecordFieldItem[] = raw
          .map((x) => ({
            field: String(x?.field ?? '').trim(),
            type: String(x?.type ?? 'string') as RecordFieldType,
            required: Boolean(x?.required ?? false),
          }))
          .filter((x) => {
            if (!x.field) return false;
            if (seen.has(x.field)) return false;
            seen.add(x.field);
            return true;
          })
          .map((x) => ({
            field: x.field,
            required: x.required,
            type:
              x.type === 'number' ||
              x.type === 'date' ||
              x.type === 'time' ||
              x.type === 'boolean' ||
              x.type === 'photo'
                ? x.type
                : 'string',
          }));

        setRecordFields(parsed);

        // Keep only current configured fields, and initialize any missing ones
        setRecordValues((prev) => {
          const next: Record<string, RecordValue> = {};

          for (const item of parsed) {
            const existing = prev[item.field];
            next[item.field] =
              existing !== undefined ? existing : item.type === 'boolean' ? null : '';
          }

          return next;
        });

        setLoading(false);
      },
      (err) => {
        console.error('appliance doc snapshot error', err);
        setLoadError('Failed to load appliance.');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [clinicId, roomId, applianceId]);

  const { showValidationAlert } = useValidationScroll(requestScroll);

  const onSaveRecord = useCallback(async () => {
    blurActiveInputAndDismissKeyboard();
    blurActivePickerField();
    setActivePicker(null);

    if (!clinicId || !roomId || !applianceId) {
      Alert.alert('Missing context', 'Clinic/Room/Appliance not available.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Not signed in', 'Please sign in before saving a record.');
      return;
    }

    if (loading) {
      Alert.alert('Please wait', 'Still loading appliance configuration.');
      return;
    }

    if (loadError) {
      Alert.alert('Cannot save', loadError);
      return;
    }

    if (!applianceName.trim()) {
      Alert.alert('Cannot save', 'Appliance information is incomplete.');
      return;
    }

    if (recordFields.length === 0) {
      Alert.alert('Cannot save', 'This appliance has no record fields configured.');
      return;
    }

    if (saving) return;

    type RecordValueItem = {
      field: string;
      value: string | number | boolean | null;
    };

    const errors: string[] = [];
    let firstInvalidField: string | null = null;
    const recordsArr: RecordValueItem[] = [];

    for (const item of recordFields) {
      const raw = recordValues[item.field];
      const markInvalid = (msg: string) => {
        errors.push(msg);
        if (!firstInvalidField) firstInvalidField = item.field;
      };

      let value: string | number | boolean | null = null;

      if (item.type === 'number') {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s.length === 0) {
          value = null;
        } else {
          const n = Number(s);
          if (!Number.isFinite(n)) {
            markInvalid(`${item.field} must be a valid number`);
            value = null;
          } else {
            value = n;
          }
        }
      } else if (item.type === 'boolean') {
        value = typeof raw === 'boolean' ? raw : null;
      } else if (item.type === 'date') {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s.length === 0) {
          value = null;
        } else if (!parseYYYYMMDDSlash(s)) {
          markInvalid(`${item.field} must be a valid date (YYYY/MM/DD)`);
          value = null;
        } else {
          value = s;
        }
      } else if (item.type === 'time') {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s.length === 0) {
          value = null;
        } else if (!parseHHMM(s)) {
          markInvalid(`${item.field} must be a valid time (HH:MM)`);
          value = null;
        } else {
          value = s;
        }
      } else if (item.type === 'photo') {
        const s = typeof raw === 'string' ? raw.trim() : '';
        value = s.length > 0 ? s : null;
      } else {
        const s = typeof raw === 'string' ? raw.trim() : '';
        value = s.length > 0 ? s : null;
      }

      if (item.required && value === null) {
        markInvalid(`${item.field} is required`);
      }

      recordsArr.push({ field: item.field, value });
    }

    if (errors.length) {
      showValidationAlert({
        title: 'Fix these issues',
        message: errors.join('\n'),
        fieldKey: firstInvalidField ? `record:${firstInvalidField}` : null,
      });
      return;
    }

    setSaving(true);
    setUiLocked(true, { scope: 'global' });

    try {
      const storage = getStorage();
      const ts = formatReadableTimestamp();

      for (let i = 0; i < recordFields.length; i++) {
        const rf = recordFields[i];
        if (rf.type !== 'photo') continue;

        const current = recordsArr[i]?.value;
        if (current === null) continue;

        if (
          typeof current === 'string' &&
          current.length > 0 &&
          !current.startsWith('http://') &&
          !current.startsWith('https://')
        ) {
          const safeField = toFirestoreSafeKey(rf.field, {
            maxLength: 40,
            fallback: 'photo',
          });
          const path = `clinics/${clinicId}/${roomId}/${applianceKey}/${ts}_${safeField}.jpg`;
          const blob = await uriToBlob(current);
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
          const url = await getDownloadURL(fileRef);
          recordsArr[i] = { field: rf.field, value: url };
        }
      }

      const recordsRef = collection(
        db,
        'clinics',
        clinicId,
        'rooms',
        roomId,
        'appliances',
        applianceId,
        'records',
      );

      const applianceSnapshot = {
        clinicId,
        roomId,
        applianceId,
        applianceKey: applianceKey.trim() || null,
        applianceName: applianceName.trim() || null,
        typeKey: typeKey.trim() || null,
        typeName: typeName.trim() || null,
      };

      const payload = {
        /**
         * Preferred immutable appliance metadata for this record.
         */
        applianceSnapshot,

        records: recordsArr,

        createdAt: serverTimestamp(),
        createdBy: {
          userId: user.uid,
          userName: profile?.name ?? null,
        },
      };

      await addDoc(recordsRef, payload);

      Alert.alert(
        'Saved',
        'Record saved successfully.',
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
      console.error('save record error', e);
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
      setUiLocked(false);
    }
  }, [
    clinicId,
    roomId,
    applianceId,
    applianceKey,
    applianceName,
    typeKey,
    typeName,
    recordFields,
    recordValues,
    loading,
    loadError,
    saving,
    user?.uid,
    profile?.name,
    router,
    blurActiveInputAndDismissKeyboard,
    blurActivePickerField,
    setActivePicker,
    setUiLocked,
    showValidationAlert,
  ]);

  return (
    <>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
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
                {!!typeName && (
                  <Text style={styles.applianceType} numberOfLines={1}>
                    {typeName}
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
                        ref={registerFieldRef(key)}
                        collapsable={false}
                        onPress={() => {
                          onFieldFocus(key);
                          openPicker(item.field, 'date');
                        }}
                        style={({ pressed }) => [styles.dateInput, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button"
                      >
                        <Text style={stringValue ? styles.dateText : styles.datePlaceholder}>
                          {stringValue || 'Select date'}
                        </Text>
                        <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#111" />
                      </Pressable>
                    ) : item.type === 'time' ? (
                      <Pressable
                        ref={registerFieldRef(key)}
                        collapsable={false}
                        onPress={() => {
                          onFieldFocus(key);
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
                      <View
                        ref={registerFieldRef(key)}
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
                    ) : item.type === 'photo' ? (
                      (() => {
                        const hasPhoto = typeof raw === 'string' && raw.trim().length > 0;

                        return (
                          <Pressable
                            ref={registerFieldRef(key)}
                            collapsable={false}
                            onPress={() => {
                              onFieldFocus(key);
                              setActivePhotoField(item.field);
                              setCameraOpen(true);
                            }}
                            style={({ pressed }) => [
                              styles.photoBox,
                              { aspectRatio: hasPhoto ? PHOTO_ASPECT : PHOTO_ASPECT_EMPTY, maxHeight: 280 },
                              pressed && { opacity: 0.9 },
                            ]}
                            accessibilityRole="button"
                          >
                            {hasPhoto ? (
                              <Image source={{ uri: raw as string }} style={styles.photoPreview} resizeMode="cover" />
                            ) : (
                              <View style={styles.photoPlaceholder}>
                                <MaterialCommunityIcons name="camera-outline" size={26} color="#94a3b8" />
                                <Text style={styles.photoPlaceholderText}>Tap to capture photo</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })()
                    ) : (
                      <TextInput
                        ref={registerFieldRef(key)}
                        value={stringValue}
                        onChangeText={(t) => onChangeField(item.field, t)}
                        placeholder={item.type === 'number' ? 'Enter number' : 'Enter text'}
                        placeholderTextColor="#999"
                        style={styles.textInput}
                        keyboardType={
                          item.type === 'number'
                            ? Platform.OS === 'ios'
                              ? 'decimal-pad'
                              : 'numeric'
                            : 'default'
                        }
                        returnKeyType="done"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => onFieldFocus(key)}
                        onBlur={() => onFieldBlur(key)}
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
              disabled={!canSave}
              style={({ pressed }) => [
                styles.primaryBtn,
                !canSave && styles.primaryBtnDisabled,
                pressed && canSave && { opacity: 0.9 },
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
          <DateTimePicker value={activePickerValue} mode={activePicker.mode} display="default" onChange={onPickerChange} />
        )}

        {/* iOS picker overlay */}
        <IosDateTimePickerOverlay
          visible={Platform.OS === 'ios' && !!activePicker}
          value={pickerDraft}
          mode={activePicker?.mode ?? 'date'}
          onChange={onPickerChange}
          onClose={closePicker}
          onDone={commitPicker}
        />
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
    fontSize: 16,
    fontWeight: '800',
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
  booleanRow: { flexDirection: 'row', gap: 10 },
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
  booleanBtnPassActive: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  booleanBtnFailActive: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  booleanBtnText: { fontSize: 14, fontWeight: '900', color: '#111' },
  booleanBtnTextPassActive: { color: '#15803d' },
  booleanBtnTextFailActive: { color: '#b91c1c' },

  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1', // slate-300
    borderRadius: 12,
    backgroundColor: '#f8fafc', // slate-50
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
    color: '#94a3b8', // slate-400
    fontWeight: '700',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
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
});
