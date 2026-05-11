// src/hooks/autoclave/useAutoclaveDailyOpsActions.ts

import { useValidationScroll } from '@/src/hooks/useValidationScroll';
import { db } from '@/src/lib/firebase';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import type {
  ApplianceDocShape,
  DailyOpsActivePicker,
  DailyOpsCycleDoc,
  DailyOpsFieldKey,
  SetupStoredItem,
} from './types';
import { getStrictSerialIdPart, sanitizeIdPart } from './utils';

type RequestScrollFn = (
  key: string,
  reason: string,
  delayMs?: number,
) => void;

type ParseHHMMFn = (value: string) => Date | null;

type ValidatePositiveIntUpTo3DigitsFn = (value: string) => number | null;

type UriToBlobFn = (uri: string) => Promise<Blob>;

type SetupValueToStringFn = (
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
  fallback?: string,
) => string;

type FormatDateYYYYMMDDCompactFn = (date: Date) => string;

type Pad2Fn = (value: number) => string;

type UiLockScope = 'global' | 'modal';

type SetUiLockedFn = (
  locked: boolean,
  options?: { scope?: UiLockScope },
) => void;

type UseAutoclaveDailyOpsActionsParams = {
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;

  userUid?: string | null;
  userName?: string | null;

  loading: boolean;
  loadError: string | null;

  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: SetUiLockedFn;

  isRunning: boolean;
  currentCycle: string;

  cycleDocLoading: boolean;
  cycleDocError: string | null;

  serialNumber: string;
  applianceKey: string;

  maxTemp: string;
  pressure: string;
  startTime: string;
  unloadTime: string;

  internalIndicator: boolean | null;
  externalIndicator: boolean | null;
  photoUri: string | null;
  notes: string;

  setFormErrorField: (field: DailyOpsFieldKey | null) => void;
  setActivePicker: (value: DailyOpsActivePicker) => void;

  requestScroll: RequestScrollFn;
  routerBack: () => void;

  parseHHMM: ParseHHMMFn;
  validatePositiveIntUpTo3Digits: ValidatePositiveIntUpTo3DigitsFn;
  uriToBlob: UriToBlobFn;
  setupValueToString: SetupValueToStringFn;
  formatDateYYYYMMDDCompact: FormatDateYYYYMMDDCompactFn;
  pad2: Pad2Fn;
};

export function useAutoclaveDailyOpsActions({
  clinicId,
  roomId,
  applianceId,
  userUid,
  userName,

  loading,
  loadError,

  saving,
  setSaving,
  setUiLocked,

  isRunning,
  currentCycle,

  cycleDocLoading,
  cycleDocError,

  serialNumber,
  applianceKey,

  maxTemp,
  pressure,
  startTime,
  unloadTime,

  internalIndicator,
  externalIndicator,
  photoUri,
  notes,

  setFormErrorField,
  setActivePicker,

  requestScroll,
  routerBack,

  parseHHMM,
  validatePositiveIntUpTo3Digits,
  uriToBlob,
  setupValueToString,
  formatDateYYYYMMDDCompact,
  pad2,
}: UseAutoclaveDailyOpsActionsParams) {
  const { showValidationAlert } = useValidationScroll(requestScroll);

  const onStartMachine = useCallback(async () => {
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
      Alert.alert('Not signed in', 'Please sign in before starting the machine.');
      return;
    }

    if (loading) {
      Alert.alert('Please wait', 'Autoclave information is still loading.');
      return;
    }

    if (loadError) {
      Alert.alert('Cannot start', loadError);
      return;
    }

    if (!serialNumber.trim()) {
      Alert.alert('Cannot start', 'Missing serial number in appliance setup.');
      return;
    }

    const strictInputSerialIdPart = getStrictSerialIdPart(serialNumber);

    if (!strictInputSerialIdPart) {
      Alert.alert(
        'Cannot start',
        'Serial number contains unsupported characters. Please update appliance setup.',
      );
      return;
    }

    const trimmedTemp = maxTemp.trim();
    const trimmedPressure = pressure.trim();
    const trimmedStartTime = startTime.trim();

    if (!trimmedTemp) {
      setFormErrorField('daily:maxTemp');

      showValidationAlert({
        title: 'Validation',
        message: 'Max Temp (°C) is required.',
        fieldKey: 'daily:maxTemp',
      });

      return;
    }

    if (!trimmedPressure) {
      setFormErrorField('daily:pressure');

      showValidationAlert({
        title: 'Validation',
        message: 'Pressure is required.',
        fieldKey: 'daily:pressure',
      });

      return;
    }

    if (!trimmedStartTime) {
      setFormErrorField('daily:startTime');

      showValidationAlert({
        title: 'Validation',
        message: 'Start Time is required.',
        fieldKey: 'daily:startTime',
      });

      return;
    }

    const temperatureValue = validatePositiveIntUpTo3Digits(trimmedTemp);

    if (temperatureValue === null) {
      setFormErrorField('daily:maxTemp');

      showValidationAlert({
        title: 'Validation',
        message: 'Max Temp (°C) invalid.',
        fieldKey: 'daily:maxTemp',
      });

      return;
    }

    const pressureValue = validatePositiveIntUpTo3Digits(trimmedPressure);

    if (pressureValue === null) {
      setFormErrorField('daily:pressure');

      showValidationAlert({
        title: 'Validation',
        message: 'Pressure invalid.',
        fieldKey: 'daily:pressure',
      });

      return;
    }

    if (!parseHHMM(trimmedStartTime)) {
      setFormErrorField('daily:startTime');

      showValidationAlert({
        title: 'Validation',
        message: 'Start Time must be a valid time.',
        fieldKey: 'daily:startTime',
      });

      return;
    }

    if (saving) return;

    setSaving(true);
    setUiLocked(true, { scope: 'global' });

    try {
      const applianceRef = doc(
        db,
        'clinics',
        clinicId,
        'rooms',
        roomId,
        'appliances',
        applianceId,
      );

      const committedCycleId = await runTransaction(db, async (tx) => {
        const applianceSnap = await tx.get(applianceRef);

        if (!applianceSnap.exists()) {
          throw new Error('Autoclave appliance not found.');
        }

        const applianceData = (applianceSnap.data() as ApplianceDocShape) ?? {};
        const latestStatus = applianceData._status ?? {};

        if (latestStatus.isRunning) {
          throw new Error('This autoclave is already running a cycle.');
        }

        const latestSetup =
          applianceData.setup && typeof applianceData.setup === 'object'
            ? applianceData.setup
            : {};

        const latestSerialNumber = setupValueToString(
          latestSetup,
          'serial_number',
          '',
        ).trim();

        if (!latestSerialNumber) {
          throw new Error('Missing serial number in appliance setup.');
        }

        const safeSerialNumber = getStrictSerialIdPart(latestSerialNumber);

        if (!safeSerialNumber) {
          throw new Error(
            'Serial number contains unsupported characters. Please update appliance setup.',
          );
        }

        const txCurrentDate = formatDateYYYYMMDDCompact(new Date());

        const latestLastCycle =
          applianceData.lastCycle && typeof applianceData.lastCycle === 'object'
            ? applianceData.lastCycle
            : {};

        const latestLastDate =
          typeof latestLastCycle.dateExecuted === 'string'
            ? latestLastCycle.dateExecuted
            : '';

        const latestRawCycleNumber =
          typeof latestLastCycle.cycleNumber === 'number' &&
          Number.isFinite(latestLastCycle.cycleNumber)
            ? latestLastCycle.cycleNumber
            : 0;

        const nextCycleNumber =
          latestLastDate === txCurrentDate ? latestRawCycleNumber + 1 : 1;

        const nextCycleId = `${txCurrentDate}-${safeSerialNumber}-${pad2(
          nextCycleNumber,
        )}`;

        const cycleRef = doc(
          collection(
            db,
            'clinics',
            clinicId,
            'rooms',
            roomId,
            'appliances',
            applianceId,
            'records_DailyOps',
          ),
          nextCycleId,
        );

        const cycleSnap = await tx.get(cycleRef);

        if (cycleSnap.exists()) {
          throw new Error('A cycle with this ID already exists. Please try again.');
        }

        tx.update(applianceRef, {
          '_status.isRunning': true,
          '_status.currentCycle': nextCycleId,
          updatedAt: serverTimestamp(),
        });

        tx.set(cycleRef, {
          _isFinished: false,
          createdAt: serverTimestamp(),
          settings: {
            temperature: temperatureValue,
            pressure: pressureValue,
          },
          cycleBeginTime: trimmedStartTime,
          cycleBeganBy: {
            userId: userUid,
            userName: userName ?? null,
          },
        });

        return nextCycleId;
      });

      setFormErrorField(null);

      Alert.alert(
        'Started',
        `Autoclave cycle ${committedCycleId} started successfully.`,
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
      console.error('start autoclave error', e);
      Alert.alert('Start failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
      setUiLocked(false);
    }
  }, [
    clinicId,
    roomId,
    applianceId,
    userUid,
    userName,
    loading,
    loadError,
    serialNumber,
    maxTemp,
    pressure,
    startTime,
    saving,
    setActivePicker,
    setFormErrorField,
    setSaving,
    setUiLocked,
    showValidationAlert,
    parseHHMM,
    validatePositiveIntUpTo3Digits,
    setupValueToString,
    formatDateYYYYMMDDCompact,
    pad2,
    routerBack,
  ]);

  const onFinishAndUnload = useCallback(async () => {
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
      Alert.alert('Not signed in', 'Please sign in before finishing the cycle.');
      return;
    }

    if (loading || cycleDocLoading) {
      Alert.alert('Please wait', 'Cycle information is still loading.');
      return;
    }

    if (loadError) {
      Alert.alert('Cannot finish', loadError);
      return;
    }

    if (cycleDocError) {
      Alert.alert('Cannot finish', cycleDocError);
      return;
    }

    if (!isRunning || !currentCycle) {
      Alert.alert('Cannot finish', 'No running cycle was found.');
      return;
    }

    if (!applianceKey.trim()) {
      Alert.alert('Cannot finish', 'Appliance key is missing.');
      return;
    }

    const trimmedUnloadTime = unloadTime.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedUnloadTime) {
      setFormErrorField('daily:unloadTime');

      showValidationAlert({
        title: 'Validation',
        message: 'Unload Time is required.',
        fieldKey: 'daily:unloadTime',
      });

      return;
    }

    if (!parseHHMM(trimmedUnloadTime)) {
      setFormErrorField('daily:unloadTime');

      showValidationAlert({
        title: 'Validation',
        message: 'Unload Time must be a valid time.',
        fieldKey: 'daily:unloadTime',
      });

      return;
    }

    if (internalIndicator === null) {
      setFormErrorField('daily:internalIndicator');

      showValidationAlert({
        title: 'Validation',
        message: 'Please select Internal Indicator result.',
        fieldKey: 'daily:internalIndicator',
      });

      return;
    }

    if (externalIndicator === null) {
      setFormErrorField('daily:externalIndicator');

      showValidationAlert({
        title: 'Validation',
        message: 'Please select External Indicator result.',
        fieldKey: 'daily:externalIndicator',
      });

      return;
    }

    if (!photoUri || photoUri.trim().length === 0) {
      setFormErrorField('daily:photoEvidence');

      showValidationAlert({
        title: 'Validation',
        message: 'Photo Evidence is required.',
        fieldKey: 'daily:photoEvidence',
      });

      return;
    }

    const cycleParts = currentCycle.split('-');

    if (cycleParts.length < 3) {
      Alert.alert('Cannot finish', 'Current cycle ID format is invalid.');
      return;
    }

    const cycleDatePart = cycleParts[0];
    const cycleNumberPart = Number(cycleParts[cycleParts.length - 1]);

    if (!/^\d{8}$/.test(cycleDatePart) || !Number.isFinite(cycleNumberPart)) {
      Alert.alert('Cannot finish', 'Current cycle ID format is invalid.');
      return;
    }

    if (saving) return;

    setSaving(true);
    setUiLocked(true, { scope: 'global' });

    let uploadedFileRef: ReturnType<typeof storageRef> | null = null;
    let finishCommitted = false;

    try {
      const storage = getStorage();
      const blob = await uriToBlob(photoUri);

      const safeClinicId = sanitizeIdPart(clinicId, '');
      const safeRoomId = sanitizeIdPart(roomId, '');
      const safeApplianceKey = sanitizeIdPart(applianceKey, '');
      const safeCurrentCycle = sanitizeIdPart(currentCycle, 'cycle');

      if (!safeClinicId || !safeRoomId || !safeApplianceKey) {
        throw new Error(
          'Storage path contains invalid clinic, room, or appliance information.',
        );
      }

      const photoPath = `clinics/${safeClinicId}/${safeRoomId}/${safeApplianceKey}/dailyOps/${safeCurrentCycle}.jpg`;

      uploadedFileRef = storageRef(storage, photoPath);

      await uploadBytes(uploadedFileRef, blob, {
        contentType: 'image/jpeg',
      });

      const photoUrl = await getDownloadURL(uploadedFileRef);

      const applianceRef = doc(
        db,
        'clinics',
        clinicId,
        'rooms',
        roomId,
        'appliances',
        applianceId,
      );

      const cycleRef = doc(
        db,
        'clinics',
        clinicId,
        'rooms',
        roomId,
        'appliances',
        applianceId,
        'records_DailyOps',
        currentCycle,
      );

      await runTransaction(db, async (tx) => {
        const applianceSnap = await tx.get(applianceRef);
        const cycleSnap = await tx.get(cycleRef);

        if (!applianceSnap.exists()) {
          throw new Error('Autoclave appliance not found.');
        }

        if (!cycleSnap.exists()) {
          throw new Error('Current cycle record not found.');
        }

        const applianceData = (applianceSnap.data() as ApplianceDocShape) ?? {};
        const latestStatus = applianceData._status ?? {};

        if (!latestStatus.isRunning) {
          throw new Error('This autoclave is no longer marked as running.');
        }

        const latestCurrentCycle =
          typeof latestStatus.currentCycle === 'string'
            ? latestStatus.currentCycle
            : '';

        if (latestCurrentCycle !== currentCycle) {
          throw new Error('The running cycle has changed. Please reload and try again.');
        }

        const latestApplianceKey =
          typeof applianceData.applianceKey === 'string'
            ? applianceData.applianceKey.trim()
            : '';

        if (!latestApplianceKey) {
          throw new Error('Appliance key is missing.');
        }

        if (latestApplianceKey !== applianceKey.trim()) {
          throw new Error('Appliance key changed. Please reload and try again.');
        }

        const cycleData = (cycleSnap.data() as DailyOpsCycleDoc) ?? {};

        if (cycleData._isFinished) {
          throw new Error('This cycle has already been finished.');
        }

        tx.update(cycleRef, {
          _isFinished: true,
          cycleEndTime: trimmedUnloadTime,
          cycleEndedBy: {
            userId: userUid,
            userName: userName ?? null,
          },
          results: {
            internalIndicator,
            externalIndicator,
            notes: trimmedNotes.length > 0 ? trimmedNotes : null,
            photoUrl,
            photoPath,
          },
          updatedAt: serverTimestamp(),
        });

        tx.update(applianceRef, {
          '_status.isRunning': false,
          '_status.currentCycle': '',
          lastCycle: {
            dateExecuted: cycleDatePart,
            cycleNumber: cycleNumberPart,
          },
          updatedAt: serverTimestamp(),
        });
      });

      finishCommitted = true;
      setFormErrorField(null);

      Alert.alert(
        'Finished',
        'Cycle finished and unloaded successfully.',
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
      console.error('finish autoclave cycle error', e);

      if (!finishCommitted && uploadedFileRef) {
        try {
          await deleteObject(uploadedFileRef);
        } catch (cleanupErr) {
          console.error('cleanup uploaded autoclave photo error', cleanupErr);
        }
      }

      Alert.alert('Finish failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
      setUiLocked(false);
    }
  }, [
    clinicId,
    roomId,
    applianceId,
    userUid,
    userName,
    loading,
    cycleDocLoading,
    loadError,
    cycleDocError,
    isRunning,
    currentCycle,
    applianceKey,
    unloadTime,
    internalIndicator,
    externalIndicator,
    photoUri,
    notes,
    saving,
    setActivePicker,
    setFormErrorField,
    setSaving,
    setUiLocked,
    showValidationAlert,
    parseHHMM,
    uriToBlob,
    routerBack,
  ]);

  return {
    onStartMachine,
    onFinishAndUnload,
  };
}
