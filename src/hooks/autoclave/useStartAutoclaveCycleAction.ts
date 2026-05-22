// src/hooks/autoclave/useStartAutoclaveCycleAction.ts

import {
  AUTOCLAVE_RECORD_COLLECTIONS,
  AUTOCLAVE_SETUP_KEYS,
} from '@/src/constants/autoclave';
import type {
  FormatDateYYMMDDFn,
  Pad2Fn,
  ParseHHMMFn,
  RequestScrollFn,
  SetActivePickerFn,
  SetFormErrorFieldFn,
  SetUiLockedFn,
  SetupValueToStringFn,
  ValidatePositiveIntUpTo3DigitsFn,
} from '@/src/hooks/autoclave/dailyOpsActionTypes';
import { validateDailyOpsStartForm } from '@/src/hooks/autoclave/dailyOpsValidation';
import type { ApplianceDocShape } from '@/src/hooks/autoclave/types';
import {
  buildCycleId,
  getStrictSerialIdPart,
} from '@/src/hooks/autoclave/utils';
import { useValidationScroll } from '@/src/hooks/useValidationScroll';
import { db } from '@/src/lib/firebase';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { useCallback } from 'react';
import { Alert } from 'react-native';

type UseStartAutoclaveCycleActionParams = {
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

  serialNumber: string;
  maxTemp: string;
  pressure: string;
  startTime: string;

  setFormErrorField: SetFormErrorFieldFn;
  setActivePicker: SetActivePickerFn;
  requestScroll: RequestScrollFn;
  routerBack: () => void;

  parseHHMM: ParseHHMMFn;
  validatePositiveIntUpTo3Digits: ValidatePositiveIntUpTo3DigitsFn;
  setupValueToString: SetupValueToStringFn;
  formatDateYYMMDD: FormatDateYYMMDDFn;
  pad2: Pad2Fn;
};

export function useStartAutoclaveCycleAction({
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
  serialNumber,
  maxTemp,
  pressure,
  startTime,
  setFormErrorField,
  setActivePicker,
  requestScroll,
  routerBack,
  parseHHMM,
  validatePositiveIntUpTo3Digits,
  setupValueToString,
  formatDateYYMMDD,
  pad2,
}: UseStartAutoclaveCycleActionParams) {
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
      Alert.alert(
        'Not signed in',
        'Please sign in before starting the machine.',
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
      Alert.alert('Cannot start', loadError);
      return;
    }

    if (!serialNumber.trim()) {
      Alert.alert(
        'Cannot start',
        'Missing serial number in appliance setup.',
      );
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

    const validation = validateDailyOpsStartForm({
      maxTemp,
      pressure,
      startTime,
      parseHHMM,
      validatePositiveIntUpTo3Digits,
    });

    if (!validation.ok) {
      setFormErrorField(validation.fieldKey);
      showValidationAlert(validation.alert);
      return;
    }

    const {
      temperatureValue,
      pressureValue,
      trimmedStartTime,
    } = validation.values;

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

      const committedCycleId = await runTransaction(
        db,
        async (tx) => {
          const applianceSnap = await tx.get(applianceRef);

          if (!applianceSnap.exists()) {
            throw new Error('Autoclave appliance not found.');
          }

          const applianceData =
            (applianceSnap.data() as ApplianceDocShape) ?? {};

          const latestStatus = applianceData._status ?? {};

          if (latestStatus.isRunning) {
            throw new Error(
              'This autoclave is already running a cycle.',
            );
          }

          const latestSetup =
            applianceData.setup &&
            typeof applianceData.setup === 'object'
              ? applianceData.setup
              : {};

          const latestSerialNumber = setupValueToString(
            latestSetup,
            AUTOCLAVE_SETUP_KEYS.serialNumber,
            '',
          ).trim();

          if (!latestSerialNumber) {
            throw new Error(
              'Missing serial number in appliance setup.',
            );
          }

          const safeSerialNumber =
            getStrictSerialIdPart(latestSerialNumber);

          if (!safeSerialNumber) {
            throw new Error(
              'Serial number contains unsupported characters. Please update appliance setup.',
            );
          }

          const txCurrentDate = formatDateYYMMDD(new Date());

          const latestLastCycle =
            applianceData.lastCycle &&
            typeof applianceData.lastCycle === 'object'
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
            latestLastDate === txCurrentDate
              ? latestRawCycleNumber + 1
              : 1;

          const nextCycleId = buildCycleId({
            serial: safeSerialNumber,
            dateYYMMDD: txCurrentDate,
            cycleNumber: nextCycleNumber,
            pad2,
          });

          const cycleRef = doc(
            collection(
              db,
              'clinics',
              clinicId,
              'rooms',
              roomId,
              'appliances',
              applianceId,
              AUTOCLAVE_RECORD_COLLECTIONS.dailyOps,
            ),
            nextCycleId,
          );

          const cycleSnap = await tx.get(cycleRef);

          if (cycleSnap.exists()) {
            throw new Error(
              'A cycle with this ID already exists. Please try again.',
            );
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
        },
      );

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
    } catch (e) {
      console.error('start autoclave error', e);

      const message =
        e instanceof Error ? e.message : 'Unknown error';

      Alert.alert('Start failed', message);
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
    formatDateYYMMDD,
    pad2,
    routerBack,
  ]);

  return {
    onStartMachine,
  };
}
