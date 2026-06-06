// src/hooks/autoclave/useAutoclaveTestController.ts

import {
  AUTOCLAVE_RECORD_COLLECTIONS,
  AUTOCLAVE_SETUP_KEYS,
  AUTOCLAVE_STORAGE,
} from '@/src/constants/autoclave';
import { setupValueToString } from '@/src/hooks/autoclave/setupUtils';
import type { ApplianceDocShape } from '@/src/hooks/autoclave/types';
import { useValidationScroll } from '@/src/hooks/useValidationScroll';
import { db } from '@/src/lib/firebase';
import { formatTimeHHMM, parseHHMM } from '@/src/utils/dateTime';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import { uriToBlob } from '@/src/utils/photo';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  getStrictSerialIdPart,
  sanitizeIdPart,
} from './utils';

export type AutoclaveTestType = 'helix' | 'spore';

export type AutoclaveTestPickerField =
  | 'cycleStartTime'
  | 'cycleEndTime';

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
  applianceName?: string | null;
  serialNumber?: string | null;
  userUid?: string | null;
  userName?: string | null;
  loading: boolean;
  loadError: string | null;
  currentDateYYYYMMDD: string;
  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: SetUiLockedFn;
  setActivePicker: (value: AutoclaveTestActivePicker) => void;
  requestScroll: RequestScrollFn;
  routerBack: () => void;
};

type AutoclaveTestTypeCode = 'H' | 'S';

type CreatePendingAutoclaveTestRecordParams = {
  clinicId: string;
  roomId: string;
  applianceId: string;
  collectionName: string;
  testType: AutoclaveTestType;
  applianceKey: string;
  applianceName?: string | null;
  currentDateYYYYMMDD: string;
  performedBy: {
    userId: string;
    userName: string | null;
  };
  results: {
    cycleBeginTime: string;
    cycleEndTime: string;
    testResult: boolean;
  };
  outcome: 'pass' | 'fail';
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

function getTestTypeLabel(testType: AutoclaveTestType): 'Helix' | 'Spore' {
  return testType === 'helix' ? 'Helix' : 'Spore';
}

function getTestTypeCode(testType: AutoclaveTestType): AutoclaveTestTypeCode {
  return testType === 'helix' ? 'H' : 'S';
}

function getLastTestedFieldName(
  testType: AutoclaveTestType,
): 'lastTestedHelix' | 'lastTestedSpore' {
  return testType === 'helix'
    ? 'lastTestedHelix'
    : 'lastTestedSpore';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildAutoclaveTestRecordId(params: {
  serial: string;
  dateYYMMDD: string;
  typeCode: AutoclaveTestTypeCode;
  sequenceNumber: number;
}) {
  const { serial, dateYYMMDD, typeCode, sequenceNumber } = params;
  return `${serial}-${dateYYMMDD}-${typeCode}${pad2(sequenceNumber)}`;
}

/**
 * Creates a pending Helix/Spore test record using a transaction-safe
 * appliance-level counter map:
 *
 * lastTestedHelix: {
 *   dateExecuted: '260606',
 *   count: 1,
 *   recordId: 'SERIAL-260606-H01',
 *   updatedAt: serverTimestamp(),
 * }
 *
 * lastTestedSpore: {
 *   dateExecuted: '260606',
 *   count: 1,
 *   recordId: 'SERIAL-260606-S01',
 *   updatedAt: serverTimestamp(),
 * }
 */
async function createPendingAutoclaveTestRecordWithApplianceCounter({
  clinicId,
  roomId,
  applianceId,
  collectionName,
  testType,
  applianceKey,
  applianceName,
  currentDateYYYYMMDD,
  performedBy,
  results,
  outcome,
}: CreatePendingAutoclaveTestRecordParams) {
  if (!/^\d{8}$/.test(currentDateYYYYMMDD)) {
    throw new Error('Current date format is invalid.');
  }

  const dateYYMMDD = currentDateYYYYMMDD.slice(2);
  const typeCode = getTestTypeCode(testType);
  const lastTestedField = getLastTestedFieldName(testType);
  const testTypeLabel = getTestTypeLabel(testType);

  const applianceRef = doc(
    db,
    'clinics',
    clinicId,
    'rooms',
    roomId,
    'appliances',
    applianceId,
  );

  const recordsCol = collection(
    db,
    'clinics',
    clinicId,
    'rooms',
    roomId,
    'appliances',
    applianceId,
    collectionName,
  );

  return runTransaction(db, async (tx) => {
    const applianceSnap = await tx.get(applianceRef);

    if (!applianceSnap.exists()) {
      throw new Error('Autoclave appliance not found.');
    }

    const applianceData = (applianceSnap.data() as ApplianceDocShape) ?? {};

    const latestSetup =
      applianceData.setup && typeof applianceData.setup === 'object'
        ? applianceData.setup
        : {};

    const latestSerialNumber = setupValueToString(
      latestSetup,
      AUTOCLAVE_SETUP_KEYS.serialNumber,
      '',
    ).trim();

    if (!latestSerialNumber) {
      throw new Error('Missing serial number in appliance setup.');
    }

    const latestStrictSerial = getStrictSerialIdPart(latestSerialNumber);

    if (!latestStrictSerial) {
      throw new Error(
        'Serial number contains unsupported characters. Please update appliance setup.',
      );
    }

    const latestApplianceKey =
      typeof applianceData.applianceKey === 'string'
        ? applianceData.applianceKey.trim()
        : '';

    if (!latestApplianceKey) {
      throw new Error('Appliance key is missing.');
    }

    if (latestApplianceKey !== applianceKey.trim()) {
      throw new Error(
        'Appliance key changed. Please reload and try again.',
      );
    }

    const latestApplianceName =
      typeof applianceData.applianceName === 'string' &&
      applianceData.applianceName.trim().length > 0
        ? applianceData.applianceName.trim()
        : applianceName?.trim()
          ? applianceName.trim()
          : null;

    const latestTestMap = (applianceData as any)[lastTestedField];
    
    const latestDateYYMMDD =
      latestTestMap &&
      typeof latestTestMap === 'object' &&
      typeof latestTestMap.dateYYMMDD === 'string'
        ? latestTestMap.dateYYMMDD
        : '';

    const latestCount =
      latestTestMap &&
      typeof latestTestMap === 'object' &&
      typeof latestTestMap.count === 'number' &&
      Number.isFinite(latestTestMap.count)
        ? latestTestMap.count
        : 0;
    
    const nextSequenceNumber =
      latestDateYYMMDD === dateYYMMDD ? latestCount + 1 : 1;

    const recordId = buildAutoclaveTestRecordId({
      serial: latestStrictSerial,
      dateYYMMDD,
      typeCode,
      sequenceNumber: nextSequenceNumber,
    });

    const recordRef = doc(recordsCol, recordId);
    const recordSnap = await tx.get(recordRef);

    if (recordSnap.exists()) {
      throw new Error(
        'A test record with this ID already exists. Please try again.',
      );
    }

    const applianceSnapshot = {
      clinicId,
      roomId,
      applianceId,
      applianceKey: latestApplianceKey,
      applianceName: latestApplianceName,
      serialNumber: latestSerialNumber,
    };

    tx.set(recordRef, {
      _testType: testTypeLabel,
      _outcome: outcome,
      _uploadStatus: 'pending',

      dateExecuted: currentDateYYYYMMDD,
      sequenceNumber: nextSequenceNumber,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      applianceSnapshot,

      performedBy,

      results: {
        cycleBeginTime: results.cycleBeginTime,
        cycleEndTime: results.cycleEndTime,
        testResult: results.testResult,
        photoPath: null,
        photoUrl: null,
      },
    });

    tx.update(applianceRef, {
      [lastTestedField]: {
        dateYYMMDD,
        count: nextSequenceNumber,
        lastRecordId: recordId,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });

    return {
      recordRef,
      recordId,
      dateYYMMDD,
      sequenceNumber: nextSequenceNumber,
    };
  });
}

export function useAutoclaveTestController({
  testType,
  clinicId,
  roomId,
  applianceId,
  applianceKey,
  applianceName,
  serialNumber,
  userUid,
  userName,
  loading,
  loadError,
  currentDateYYYYMMDD,
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

  const title =
    testType === 'helix'
      ? 'Daily Helix Test'
      : 'Weekly Spore Test';

  const displayDate = useMemo(() => {
    if (!/^\d{8}$/.test(currentDateYYYYMMDD)) {
      return currentDateYYYYMMDD;
    }

    const year = Number(currentDateYYYYMMDD.slice(0, 4));
    const month = Number(currentDateYYYYMMDD.slice(4, 6));
    const day = Number(currentDateYYYYMMDD.slice(6, 8));

    const date = new Date(year, month - 1, day);

    const isValidDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    if (!isValidDate) {
      return currentDateYYYYMMDD;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }, [currentDateYYYYMMDD]);

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

    if (!applianceKey.trim()) {
      nextBlockers.push({
        key: 'missingApplianceKey',
        message: 'Appliance key is missing.',
      });
    }

    if (!serialNumber?.trim()) {
      nextBlockers.push({
        key: 'missingSerial',
        message: 'Serial number is missing.',
      });
    } else if (!getStrictSerialIdPart(serialNumber)) {
      nextBlockers.push({
        key: 'invalidSerial',
        message: 'Serial number contains unsupported characters.',
      });
    }

    return nextBlockers;
  }, [
    loading,
    loadError,
    clinicId,
    roomId,
    applianceId,
    userUid,
    applianceKey,
    serialNumber,
  ]);

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
      Alert.alert(
        'Not signed in',
        'Please sign in before saving the record.',
      );
      return;
    }

    if (loading) {
      Alert.alert(
        'Please wait',
        'Autoclave information is still loading.',
      );
      return;
    }

    if (loadError) {
      Alert.alert('Cannot save', loadError);
      return;
    }

    if (!applianceKey.trim()) {
      Alert.alert('Cannot save', 'Appliance key is missing.');
      return;
    }

    if (!serialNumber?.trim()) {
      Alert.alert('Cannot save', 'Serial number is missing.');
      return;
    }

    if (!getStrictSerialIdPart(serialNumber)) {
      Alert.alert(
        'Cannot save',
        'Serial number contains unsupported characters. Please update appliance setup.',
      );
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

    const trimmedPhotoUri = photoUri?.trim() ?? '';

    if (testResult === false && trimmedPhotoUri.length === 0) {
      setFormErrorField(AUTOCLAVE_TEST_FIELD_KEYS.photoEvidence);
      showValidationAlert({
        title: 'Validation',
        message: 'Photo evidence is required when the test result fails.',
        fieldKey: AUTOCLAVE_TEST_FIELD_KEYS.photoEvidence,
      });
      return;
    }

    if (saving) return;

    setSaving(true);
    setUiLocked(true, { scope: 'global' });

    let uploadedFileRef: ReturnType<typeof storageRef> | null = null;
    let pendingRecordRef:
      | Awaited<
          ReturnType<
            typeof createPendingAutoclaveTestRecordWithApplianceCounter
          >
        >['recordRef']
      | null = null;

    try {
      const collectionName = getCollectionName(testType);
      const outcome: 'pass' | 'fail' =
        testResult === false ? 'fail' : 'pass';

      const {
        recordRef,
      } = await createPendingAutoclaveTestRecordWithApplianceCounter({
        clinicId,
        roomId,
        applianceId,
        collectionName,
        testType,
        applianceKey,
        applianceName,
        currentDateYYYYMMDD,
        performedBy: {
          userId: userUid,
          userName: userName ?? null,
        },
        results: {
          cycleBeginTime: trimmedStartTime,
          cycleEndTime: trimmedEndTime,
          testResult,
        },
        outcome,
      });

      pendingRecordRef = recordRef;

      let photoUrl: string | null = null;
      let photoPath: string | null = null;

      if (trimmedPhotoUri.length > 0) {
        const storage = getStorage();
        const blob = await uriToBlob(trimmedPhotoUri);

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

      await updateDoc(recordRef, {
        _uploadStatus:
          trimmedPhotoUri.length > 0 ? 'uploaded' : 'not_required',
        updatedAt: serverTimestamp(),
        'results.photoPath': photoPath,
        'results.photoUrl': photoUrl,
      });

      setFormErrorField(null);

      Alert.alert(
        'Saved',
        getSuccessMessage(testType),
        [
          {
            text: 'OK',
            onPress: () => {
              routerBack();
            },
          },
        ],
        { cancelable: false },
      );
    } catch (e: any) {
      console.error(`${testType} autoclave test save error`, e);

      if (pendingRecordRef) {
        try {
          await updateDoc(pendingRecordRef, {
            _uploadStatus: 'failed',
            uploadError:
              e instanceof Error
                ? e.message
                : 'Unknown upload or save error',
            updatedAt: serverTimestamp(),
          });
        } catch (markFailedErr) {
          console.error(
            `${testType} mark pending record failed error`,
            markFailedErr,
          );
        }
      }

      if (uploadedFileRef) {
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
    applianceName,
    serialNumber,
    userUid,
    userName,
    loading,
    loadError,
    currentDateYYYYMMDD,
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
