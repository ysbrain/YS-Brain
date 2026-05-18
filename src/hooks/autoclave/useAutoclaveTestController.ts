// src/hooks/autoclave/useAutoclaveTestController.ts

import { AUTOCLAVE_RECORD_COLLECTIONS, AUTOCLAVE_STORAGE } from '@/src/constants/autoclave';
import { useValidationScroll } from '@/src/hooks/useValidationScroll';
import { db } from '@/src/lib/firebase';
import { formatDateFullYYYYMMDD, formatTimeHHMM, parseHHMM } from '@/src/utils/dateTime';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import { uriToBlob } from '@/src/utils/photo';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { sanitizeIdPart } from './utils';

export type AutoclaveTestType = 'helix' | 'spore';

export type AutoclaveTestPickerField = 'cycleStartTime' | 'cycleEndTime';

export type AutoclaveTestActivePicker = {
  field: AutoclaveTestPickerField;
  mode: 'time';
} | null;

export const AUTOCLAVE_TEST_FIELD_KEYS = {
  cycleStartTime: 'test:cycleStartTime',
  cycleEndTime: 'test:cycleEndTime',
  testResult: 'test:testResult',
  photoEvidence: 'test:photoEvidence',
} as const;

export type AutoclaveTestFieldKey =
  (typeof AUTOCLAVE_TEST_FIELD_KEYS)[keyof typeof AUTOCLAVE_TEST_FIELD_KEYS];

type UiLockScope = 'global' | 'modal';

type SetUiLockedFn = (
  locked: boolean,
  options?: { scope?: UiLockScope },
) => void;

type RequestScrollFn = (
  key: string,
  reason: string,
  delayMs?: number,
) => void;

type UseAutoclaveTestControllerParams = {
  testType: AutoclaveTestType;
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;
  applianceKey: string;
  userUid?: string | null;
  userName?: string | null;
  loading: boolean;
  loadError: string | null;
  currentDate: string;
  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: SetUiLockedFn;
  setActivePicker: (value: AutoclaveTestActivePicker) => void;
  requestScroll: RequestScrollFn;
  routerBack: () => void;
};

function getCollectionName(testType: AutoclaveTestType) {
  return testType === 'helix'
    ? AUTOCLAVE_RECORD_COLLECTIONS.helix
    : AUTOCLAVE_RECORD_COLLECTIONS.spore;
}

function getStorageFolder(testType: AutoclaveTestType) {
  return testType === 'helix'
    ? AUTOCLAVE_STORAGE.helixFolder
    : AUTOCLAVE_STORAGE.sporeFolder;
}

function getSuccessMessage(testType: AutoclaveTestType) {
  return testType === 'helix'
    ? 'Helix test record saved successfully.'
    : 'Spore test record saved successfully.';
}

export function useAutoclaveTestController({
  testType,
  clinicId,
  roomId,
  applianceId,
  applianceKey,
  userUid,
  userName,
  loading,
  loadError,
  currentDate,
  saving,
  setSaving,
  setUiLocked,
  setActivePicker,
  requestScroll,
  routerBack,
}: UseAutoclaveTestControllerParams) {
  const { showValidationAlert } = useValidationScroll(requestScroll);

  const [formErrorField, setFormErrorField] =
    useState<AutoclaveTestFieldKey | null>(null);

  const DEFAULT_CYCLE_START_TIME = '00:00';

  const [cycleStartTime, setCycleStartTime] = useState(
    DEFAULT_CYCLE_START_TIME,
  );

  const [cycleEndTime, setCycleEndTime] = useState(
    formatTimeHHMM(new Date()),
  );

  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const title = testType === 'helix' ? 'Daily Helix Test' : 'Weekly Spore Test';

  const displayDate = useMemo(() => {
    const year = Number(currentDate.slice(0, 4));
    const monthIndex = Number(currentDate.slice(4, 6)) - 1;
    const day = Number(currentDate.slice(6, 8));

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(monthIndex) ||
      !Number.isFinite(day)
    ) {
      return currentDate;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(year, monthIndex, day));
  }, [currentDate]);

  const blockers = useMemo(() => {
    const nextBlockers: { key: string; message: string }[] = [];

    if (loading) {
      nextBlockers.push({
        key: 'loading',
        message: 'Autoclave information is still loading.',
      });
    }

    if (loadError) {
      nextBlockers.push({
        key: 'loadError',
        message: loadError,
      });
    }

    if (!clinicId || !roomId || !applianceId) {
      nextBlockers.push({
        key: 'missingContext',
        message: 'Clinic, room, or appliance information is missing.',
      });
    }

    if (!userUid) {
      nextBlockers.push({
        key: 'notSignedIn',
        message: 'Please sign in before saving the record.',
      });
    }

    return nextBlockers;
  }, [loading, loadError, clinicId, roomId, applianceId, userUid]);

  const canPressSaveRecord = !saving && blockers.length === 0;

  const onSaveRecord = useCallback(async () => {
    blurActiveInputAndDismissKeyboard();
    setActivePicker(null);

    if (!clinicId || !roomId || !applianceId) {
      Alert.alert(
        'Missing context',
        'Clinic, room, or appliance information is missing.',
      );
      return;
    }

    if (!userUid) {
      Alert.alert('Not signed in', 'Please sign in before saving the record.');
      return;
    }

    if (loading) {
      Alert.alert('Please wait', 'Autoclave information is still loading.');
      return;
    }

    if (loadError) {
      Alert.alert('Cannot save', loadError);
      return;
    }

    const trimmedStartTime = cycleStartTime.trim();
    const trimmedEndTime = cycleEndTime.trim();

    if (!trimmedStartTime) {
      setFormErrorField(AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime);
      showValidationAlert({
        title: 'Validation',
        message: 'Cycle Start Time is required.',
        fieldKey: AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime,
      });
      return;
    }

    if (!parseHHMM(trimmedStartTime)) {
      setFormErrorField(AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime);
      showValidationAlert({
        title: 'Validation',
        message: 'Cycle Start Time must be a valid time.',
        fieldKey: AUTOCLAVE_TEST_FIELD_KEYS.cycleStartTime,
      });
      return;
    }

    if (!trimmedEndTime) {
      setFormErrorField(AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime);
      showValidationAlert({
        title: 'Validation',
        message: 'Cycle End Time is required.',
        fieldKey: AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime,
      });
      return;
    }

    if (!parseHHMM(trimmedEndTime)) {
      setFormErrorField(AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime);
      showValidationAlert({
        title: 'Validation',
        message: 'Cycle End Time must be a valid time.',
        fieldKey: AUTOCLAVE_TEST_FIELD_KEYS.cycleEndTime,
      });
      return;
    }

    if (testResult === null) {
      setFormErrorField(AUTOCLAVE_TEST_FIELD_KEYS.testResult);
      showValidationAlert({
        title: 'Validation',
        message: 'Please select Test Result.',
        fieldKey: AUTOCLAVE_TEST_FIELD_KEYS.testResult,
      });
      return;
    }

    if (saving) return;

    setSaving(true);
    setUiLocked(true, { scope: 'global' });

    let uploadedFileRef: ReturnType<typeof storageRef> | null = null;
    let databaseCommitted = false;

    try {
      const collectionName = getCollectionName(testType);

      const recordRef = doc(
        collection(
          db,
          'clinics',
          clinicId,
          'rooms',
          roomId,
          'appliances',
          applianceId,
          collectionName,
        ),
      );

      let photoUrl: string | null = null;
      let photoPath: string | null = null;

      if (photoUri && photoUri.trim().length > 0) {
        const storage = getStorage();
        const blob = await uriToBlob(photoUri);

        const safeClinicId = sanitizeIdPart(clinicId, '');
        const safeRoomId = sanitizeIdPart(roomId, '');
        const safeAppliancePart = sanitizeIdPart(
          applianceKey.trim().length > 0 ? applianceKey : applianceId,
          '',
        );

        if (!safeClinicId || !safeRoomId || !safeAppliancePart) {
          throw new Error(
            'Storage path contains invalid clinic, room, or appliance information.',
          );
        }

        const folder = getStorageFolder(testType);

        photoPath =
          `clinics/${safeClinicId}/${safeRoomId}/${safeAppliancePart}` +
          `/${folder}` +
          `/${recordRef.id}.${AUTOCLAVE_STORAGE.photoExtension}`;

        uploadedFileRef = storageRef(storage, photoPath);

        await uploadBytes(uploadedFileRef, blob, {
          contentType: AUTOCLAVE_STORAGE.photoContentType,
        });

        photoUrl = await getDownloadURL(uploadedFileRef);
      }

      await setDoc(recordRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dateExecuted: currentDate || formatDateFullYYYYMMDD(new Date()),
        cycleStartTime: trimmedStartTime,
        cycleEndTime: trimmedEndTime,
        testResult,
        performedBy: {
          userId: userUid,
          userName: userName ?? null,
        },
        photoUrl,
        photoPath,
      });

      databaseCommitted = true;
      setFormErrorField(null);

      Alert.alert('Saved', getSuccessMessage(testType), [
        {
          text: 'OK',
          onPress: () => {
            routerBack();
          },
        },
      ], { cancelable: false });
    } catch (e: any) {
      console.error(`${testType} autoclave test save error`, e);

      if (!databaseCommitted && uploadedFileRef) {
        try {
          await deleteObject(uploadedFileRef);
        } catch (cleanupErr) {
          console.error(`${testType} photo cleanup error`, cleanupErr);
        }
      }

      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
      setUiLocked(false);
    }
  }, [
    testType,
    clinicId,
    roomId,
    applianceId,
    applianceKey,
    userUid,
    userName,
    loading,
    loadError,
    currentDate,
    cycleStartTime,
    cycleEndTime,
    testResult,
    photoUri,
    saving,
    setActivePicker,
    setSaving,
    setUiLocked,
    showValidationAlert,
    routerBack,
  ]);

  return {
    title,
    displayDate,
    formErrorField,
    setFormErrorField,
    cycleStartTime,
    setCycleStartTime,
    cycleEndTime,
    setCycleEndTime,
    testResult,
    setTestResult,
    photoUri,
    setPhotoUri,
    blockers,
    canPressSaveRecord,
    onSaveRecord,
  };
}

export type AutoclaveTestController =
  ReturnType<typeof useAutoclaveTestController>;
