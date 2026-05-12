// src/components/autoclave/DailyOpsTab.tsx

import { CameraCaptureModal } from '@/src/components/CameraCaptureModal';
import {
  IOS_PICKER_OVERLAY_HEIGHT,
  IosDateTimePickerOverlay,
} from '@/src/components/IosDateTimePickerOverlay';
import { DailyOpsView } from '@/src/components/autoclave/DailyOpsView';
import { DAILY_OPS_FIELD_KEYS } from '@/src/constants/autoclave';
import type {
  DailyOpsActivePicker,
  DailyOpsPickerField,
  SetupStoredItem,
} from '@/src/hooks/autoclave/types';
import { useAutoclaveDailyOpsCycle } from '@/src/hooks/autoclave/useAutoclaveDailyOpsCycle';
import { useDailyOpsController } from '@/src/hooks/autoclave/useDailyOpsController';
import { useKeyboardAwareFieldScroll } from '@/src/hooks/useKeyboardAwareFieldScroll';
import {
  formatTimeHHMM,
  parseHHMM,
} from '@/src/utils/dateTime';
import { cropToAspect } from '@/src/utils/photo';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';

const PHOTO_ASPECT = 4 / 3;

type UiLockScope = 'global' | 'modal';

type DailyOpsTabProps = {
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;
  userUid?: string | null;
  userName?: string | null;

  loading: boolean;
  loadError: string | null;

  setup: Record<string, SetupStoredItem | undefined>;
  lastCycle: {
    cycleNumber?: number;
    dateExecuted?: string;
  };

  applianceKey: string;
  isRunning: boolean;
  currentCycle: string;
  currentDate: string;

  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: (
    locked: boolean,
    options?: { scope?: UiLockScope },
  ) => void;
};

export function DailyOpsTab({
  clinicId,
  roomId,
  applianceId,
  userUid,
  userName,
  loading,
  loadError,
  setup,
  lastCycle,
  applianceKey,
  isRunning,
  currentCycle,
  currentDate,
  saving,
  setSaving,
  setUiLocked,
}: DailyOpsTabProps) {
  const router = useRouter();

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

  const [activePicker, setActivePicker] =
    useState<DailyOpsActivePicker>(null);

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
      ? `daily:${activePicker.field}`
      : null,
    overlayHeight: pickerOverlayHeight,
  });

  const dailyOps = useDailyOpsController({
    clinicId,
    roomId,
    applianceId,
    userUid: userUid ?? null,
    userName: userName ?? null,
    loading,
    loadError,
    setup,
    lastCycle,
    isRunning,
    currentCycle,
    applianceKey,
    cycleDocLoading,
    cycleDocError,
    cycleDoc,
    currentDate,
    saving,
    setSaving,
    setUiLocked,
    setActivePicker,
    requestScroll,
    routerBack: () => router.back(),
  });

  const activePickerValue = useMemo(() => {
    if (!activePicker) return new Date();

    if (activePicker.field === 'startTime') {
      return parseHHMM(dailyOps.startTime) ?? new Date();
    }

    if (activePicker.field === 'unloadTime') {
      return parseHHMM(dailyOps.unloadTime) ?? new Date();
    }

    return new Date();
  }, [activePicker, dailyOps.startTime, dailyOps.unloadTime]);

  const openPicker = useCallback(
    (field: DailyOpsPickerField, mode: 'time') => {
      Keyboard.dismiss();

      const initial =
        field === 'startTime'
          ? parseHHMM(dailyOps.startTime) ?? new Date()
          : parseHHMM(dailyOps.unloadTime) ?? new Date();

      setPickerDraft(initial);
      setActivePicker({ field, mode });
    },
    [dailyOps.startTime, dailyOps.unloadTime],
  );

  const blurActivePickerField = useCallback(() => {
    if (!activePicker) return;

    if (activePicker.field === 'startTime') {
      onFieldBlur(DAILY_OPS_FIELD_KEYS.startTime);
      return;
    }

    if (activePicker.field === 'unloadTime') {
      onFieldBlur(DAILY_OPS_FIELD_KEYS.unloadTime);
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

      if (activePicker.field === 'startTime') {
        dailyOps.setStartTime(formatTimeHHMM(date));
      } else if (activePicker.field === 'unloadTime') {
        dailyOps.setUnloadTime(formatTimeHHMM(date));
      }

      blurActivePickerField();
      setActivePicker(null);
    },
    [
      activePicker,
      dailyOps.setStartTime,
      dailyOps.setUnloadTime,
      blurActivePickerField,
    ],
  );

  const closePicker = useCallback(() => {
    blurActivePickerField();
    setActivePicker(null);
  }, [blurActivePickerField]);

  const commitPicker = useCallback(() => {
    if (activePicker?.field === 'startTime') {
      dailyOps.setStartTime(formatTimeHHMM(pickerDraft));
    } else if (activePicker?.field === 'unloadTime') {
      dailyOps.setUnloadTime(formatTimeHHMM(pickerDraft));
    }

    blurActivePickerField();
    setActivePicker(null);
  }, [
    activePicker,
    pickerDraft,
    dailyOps.setStartTime,
    dailyOps.setUnloadTime,
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

        dailyOps.setPhotoUri(croppedUri);

        if (dailyOps.formErrorField === DAILY_OPS_FIELD_KEYS.photoEvidence) {
          dailyOps.setFormErrorField(null);
        }
      } catch (err) {
        console.error('autoclave photo process error', err);
        Alert.alert('Photo error', 'Failed to process the captured photo.');
      } finally {
        closeCamera();
      }
    },
    [
      closeCamera,
      dailyOps.formErrorField,
      dailyOps.setFormErrorField,
      dailyOps.setPhotoUri,
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
        <DailyOpsView
          controller={dailyOps}
          registerFieldRef={registerFieldRef}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
          openPicker={openPicker}
          onOpenCamera={openCamera}
          saving={saving}
        />
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
});
