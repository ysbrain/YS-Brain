// src/components/autoclave/AutoclaveTestTab.tsx

import { ActionBlockerList } from '@/src/components/autoclave/ActionBlockerList';
import {
  AutoclavePassFailField,
  AutoclavePhotoField,
  AutoclaveTimeField,
} from '@/src/components/autoclave/DailyOpsFields';
import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import {
  IOS_PICKER_OVERLAY_HEIGHT,
  IosDateTimePickerOverlay,
} from '@/src/components/IosDateTimePickerOverlay';
import { AUTOCLAVE_SETUP_KEYS } from '@/src/constants/autoclave';
import { setupValueToString } from '@/src/hooks/autoclave/setupUtils';
import type { SetupStoredItem } from '@/src/hooks/autoclave/types';
import {
  AUTOCLAVE_TEST_FIELD_KEYS,
  type AutoclaveTestActivePicker,
  type AutoclaveTestPickerField,
  type AutoclaveTestType,
  useAutoclaveTestController,
} from '@/src/hooks/autoclave/useAutoclaveTestController';
import { useKeyboardAwareFieldScroll } from '@/src/hooks/useKeyboardAwareFieldScroll';
import { formatTimeHHMM, parseHHMM } from '@/src/utils/dateTime';
import { cropToAspect } from '@/src/utils/photo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PHOTO_ASPECT = 4 / 3;
const PHOTO_ASPECT_EMPTY = 16 / 9;

type UiLockScope = 'global' | 'modal';

type AutoclaveTestTabProps = {
  testType: AutoclaveTestType;
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;

  /**
   * Added for immutable appliance snapshot.
   * This should come from useAutoclaveAppliance() in AutoclaveScreen.
   */
  applianceName?: string | null;

  applianceKey: string;
  setup: Record<string, SetupStoredItem | undefined>;
  userUid?: string | null;
  userName?: string | null;
  loading: boolean;
  loadError: string | null;
  currentDateYYYYMMDD: string;
  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: (
    locked: boolean,
    options?: { scope?: UiLockScope },
  ) => void;
};

export function AutoclaveTestTab({
  testType,
  clinicId,
  roomId,
  applianceId,
  applianceName,
  applianceKey,
  setup,
  userUid,
  userName,
  loading,
  loadError,
  currentDateYYYYMMDD,
  saving,
  setSaving,
  setUiLocked,
}: AutoclaveTestTabProps) {
  const router = useRouter();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [activePicker, setActivePicker] =
    useState<AutoclaveTestActivePicker>(null);
  const [pickerDraft, setPickerDraft] = useState<Date>(new Date());

  const pickerOverlayHeight =
    Platform.OS === 'ios' && activePicker
      ? IOS_PICKER_OVERLAY_HEIGHT
      : 0;

  const {
    scrollRef,
    registerFieldRef,
    onFieldFocus,
    onFieldBlur,
    handleScroll,
    requestScroll,
    contentBottomPadding,
  } = useKeyboardAwareFieldScroll({
    activeOverlayFieldKey: activePicker
      ? `test:${activePicker.field}`
      : null,
    overlayHeight: pickerOverlayHeight,
  });

  /**
   * Serial number is part of the immutable appliance snapshot.
   * It is read from setup here, then passed to the controller so the saved
   * Helix/Spore record can include applianceSnapshot.serialNumber.
   */
  const serialNumber = useMemo(() => {
    return setupValueToString(
      setup,
      AUTOCLAVE_SETUP_KEYS.serialNumber,
      '',
    ).trim();
  }, [setup]);

  const controller = useAutoclaveTestController({
    testType,
    clinicId,
    roomId,
    applianceId,
    applianceName,
    applianceKey,
    serialNumber,
    userUid: userUid ?? null,
    userName: userName ?? null,
    loading,
    loadError,
    currentDateYYYYMMDD,
    saving,
    setSaving,
    setUiLocked,
    setActivePicker,
    requestScroll,
    routerBack: () => router.back(),
  });

  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();

    if (activePicker.field === 'cycleStartTime') {
      return parseHHMM(controller.cycleStartTime) ?? new Date();
    }

    if (activePicker.field === 'cycleEndTime') {
      return parseHHMM(controller.cycleEndTime) ?? new Date();
    }

    return new Date();
  }, [
    activePicker,
    controller.cycleStartTime,
    controller.cycleEndTime,
  ]);

  const openPicker = useCallback(
    (field: AutoclaveTestPickerField, mode: 'time') => {
      Keyboard.dismiss();

      const initial =
        field === 'cycleStartTime'
          ? parseHHMM(controller.cycleStartTime) ?? new Date()
          : parseHHMM(controller.cycleEndTime) ?? new Date();

      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [controller.cycleStartTime, controller.cycleEndTime],
  );

  const blurActivePickerField = useCallback(() => {
    if (!activePicker) return;

    if (activePicker.field === 'cycleStartTime') {
      onFieldBlur(AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime);
      return;
    }

    if (activePicker.field === 'cycleEndTime') {
      onFieldBlur(AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime);
    }
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

      if (activePicker.field === 'cycleStartTime') {
        controller.setCycleStartTime(formatTimeHHMM(date));
      } else if (activePicker.field === 'cycleEndTime') {
        controller.setCycleEndTime(formatTimeHHMM(date));
      }

      blurActivePickerField();
      setActivePicker(null);
    },
    [
      activePicker,
      controller.setCycleStartTime,
      controller.setCycleEndTime,
      blurActivePickerField,
    ],
  );

  const closePicker = useCallback(() => {
    blurActivePickerField();
    setActivePicker(null);
  }, [blurActivePickerField]);

  const commitPicker = useCallback(() => {
    if (activePicker?.field === 'cycleStartTime') {
      controller.setCycleStartTime(formatTimeHHMM(pickerDraft));
    } else if (activePicker?.field === 'cycleEndTime') {
      controller.setCycleEndTime(formatTimeHHMM(pickerDraft));
    }

    blurActivePickerField();
    setActivePicker(null);
  }, [
    activePicker,
    pickerDraft,
    controller.setCycleStartTime,
    controller.setCycleEndTime,
    blurActivePickerField,
  ]);

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

        controller.setPhotoUri(croppedUri);

        if (
          controller.formErrorField ===
          AUTOCLAVE_TEST_FIELD_KEYS.photoEvidence
        ) {
          controller.setFormErrorField(null);
        }
      } catch (err) {
        console.error(`${testType} photo process error`, err);
        Alert.alert('Photo error', 'Failed to process the captured photo.');
      } finally {
        closeCamera();
      }
    },
    [
      testType,
      closeCamera,
      controller.formErrorField,
      controller.setFormErrorField,
      controller.setPhotoUri,
    ],
  );

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{controller.title}</Text>
              <Text style={styles.dateText}>Date: {controller.displayDate}</Text>
            </View>

            <View style={styles.serialBadge}>
              <Text style={styles.serialLabel}>SN</Text>
              <Text style={styles.serialValue} numberOfLines={1}>
                {serialNumber || '--'}
              </Text>
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={styles.twoColItem}>
              <AutoclaveTimeField
                ref={registerFieldRef(
                  AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime,
                )}
                label="Cycle Start Time"
                required
                value={controller.cycleStartTime}
                error={
                  controller.formErrorField ===
                  AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime
                }
                onPress={() => {
                  onFieldFocus(AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime);

                  if (
                    controller.formErrorField ===
                    AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime
                  ) {
                    controller.setFormErrorField(null);
                  }

                  openPicker('cycleStartTime', 'time');
                }}
              />
            </View>

            <View style={styles.twoColItem}>
              <AutoclaveTimeField
                ref={registerFieldRef(
                  AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime,
                )}
                label="Cycle End Time"
                required
                value={controller.cycleEndTime}
                error={
                  controller.formErrorField ===
                  AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime
                }
                onPress={() => {
                  onFieldFocus(AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime);

                  if (
                    controller.formErrorField ===
                    AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime
                  ) {
                    controller.setFormErrorField(null);
                  }

                  openPicker('cycleEndTime', 'time');
                }}
              />
            </View>
          </View>

          <AutoclavePassFailField
            ref={registerFieldRef(AUTOCLAVE_TEST_FIELD_KEYS.testResult)}
            label="Test Result"
            value={controller.testResult}
            error={
              controller.formErrorField ===
              AUTOCLAVE_TEST_FIELD_KEYS.testResult
            }
            onChange={(value) => {
              controller.setTestResult(value);

              if (
                controller.formErrorField ===
                AUTOCLAVE_TEST_FIELD_KEYS.testResult
              ) {
                controller.setFormErrorField(null);
              }
            }}
          />

          <AutoclavePhotoField
            ref={registerFieldRef(AUTOCLAVE_TEST_FIELD_KEYS.photoEvidence)}
            label="Photo"
            required={controller.testResult === false}
            photoUri={controller.photoUri}
            error={
              controller.formErrorField ===
              AUTOCLAVE_TEST_FIELD_KEYS.photoEvidence
            }
            onPress={openCamera}
            aspectRatioFilled={PHOTO_ASPECT}
            aspectRatioEmpty={PHOTO_ASPECT_EMPTY}
            placeholderText={
              controller.testResult === false
                ? 'Attach Photo of Failed Indicator'
                : 'Attach Photo of Indicator (Optional)'
            }
          />

          <ActionBlockerList blockers={controller.blockers} />

          <Pressable
            onPress={controller.onSaveRecord}
            disabled={!controller.canPressSaveRecord}
            style={({ pressed }) => [
              styles.saveButton,
              !controller.canPressSaveRecord && styles.saveButtonDisabled,
              pressed && controller.canPressSaveRecord && { opacity: 0.92 },
            ]}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !controller.canPressSaveRecord,
            }}
          >
            <View style={styles.saveButtonInner}>
              {saving ? (
                <MaterialCommunityIcons
                  name="loading"
                  size={20}
                  color="#fff"
                />
              ) : null}

              <Text style={styles.saveButtonText}>
                {saving ? 'Saving…' : 'Save Record'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {Platform.OS !== 'ios' && activePicker && (
        <DateTimePicker
          value={activePickerValue}
          mode={activePicker.mode}
          display="default"
          onChange={onPickerChange}
        />
      )}

      <IosDateTimePickerOverlay
        visible={Platform.OS === 'ios' && !!activePicker}
        value={pickerDraft}
        mode={activePicker?.mode ?? 'time'}
        onChange={onPickerChange}
        onClose={closePicker}
        onDone={commitPicker}
      />

      <CameraCaptureModal
        visible={cameraOpen}
        onClose={closeCamera}
        onCaptured={onCapturedPhoto}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
  },
  dateText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  serialBadge: {
    maxWidth: 138,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serialLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
    alignSelf: 'center',
  },
  serialValue: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    alignSelf: 'flex-end',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  twoColItem: {
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
});
