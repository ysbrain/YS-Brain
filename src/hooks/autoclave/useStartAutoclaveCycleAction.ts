// src/hooks/autoclave/useStartAutoclaveCycleAction.ts

import {
  AUTOCLAVE_RECORD_COLLECTIONS,
  AUTOCLAVE_SETUP_KEYS,
} from '@/src/constants/autoclave';
import { useAlert } from '@/src/contexts/AlertContext';
import { buildApplianceSnapshot } from '@/src/hooks/autoclave/applianceSnapshot';
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
import {
  buildRoomActivityPayload,
  getRoomActivityRef
} from '@/src/lib/roomActivityIndex';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { useCallback } from 'react';

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
  applianceKey: string;
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
  applianceKey,
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
  const { alert } = useAlert();

  const { showValidationAlert } = useValidationScroll(requestScroll);

  const onStartMachine = useCallback(async () => {
    blurActiveInputAndDismissKeyboard();
    setActivePicker(null);

    if (!clinicId || !roomId || !applianceId) {
      await alert({
        title: 'Missing context',
        message: 'Clinic, room, or appliance information is missing.',
      });
      return;
    }

    if (!userUid) {
      await alert({
        title: 'Not signed in',
        message: 'Please sign in before starting the machine.',
      });
      return;
    }

    if (loading) {
      await alert({
        title: 'Please wait',
        message: 'Autoclave information is still loading.',
      });
      return;
    }

    if (loadError) {
      await alert({
        title: 'Cannot start',
        message: loadError,
      });
      return;
    }

    if (!serialNumber.trim()) {
      await alert({
        title: 'Cannot start',
        message: 'Missing serial number in appliance setup.',
      });
      return;
    }

    if (!applianceKey.trim()) {
      await alert({
        title: 'Cannot start',
        message: 'Appliance key is missing.',
      });
      return;
    }

    const strictInputSerialIdPart = getStrictSerialIdPart(serialNumber);

    if (!strictInputSerialIdPart) {
      await alert({
        title: 'Cannot start',
        message: 'Serial number contains unsupported characters. Please update appliance setup.',
      });
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

          const applianceSnapshot = buildApplianceSnapshot({
            clinicId,
            roomId,
            applianceId,
            applianceData,
          });

          const safeSerialNumber =
            getStrictSerialIdPart(latestSerialNumber);

          if (!safeSerialNumber) {
            throw new Error(
              'Serial number contains unsupported characters. Please update appliance setup.',
            );
          }

          const txCurrentDate = formatDateYYMMDD(new Date());

          const latestLastStartedCycle =
            applianceData.lastStartedCycle &&
            typeof applianceData.lastStartedCycle === 'object'
              ? applianceData.lastStartedCycle
              : {};

          const latestLastStartedDate =
            typeof latestLastStartedCycle.dateExecuted === 'string'
              ? latestLastStartedCycle.dateExecuted
              : '';

          const latestRawStartedCycleNumber =
            typeof latestLastStartedCycle.cycleNumber === 'number' &&
            Number.isFinite(latestLastStartedCycle.cycleNumber)
              ? latestLastStartedCycle.cycleNumber
              : 0;

          const nextCycleNumber =
            latestLastStartedDate === txCurrentDate
              ? latestRawStartedCycleNumber + 1
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

          const activityRef = getRoomActivityRef({
            clinicId,
            roomId,
            applianceId,
            collectionName: AUTOCLAVE_RECORD_COLLECTIONS.dailyOps,
            recordId: nextCycleId,
          });

          const cycleSnap = await tx.get(cycleRef);

          if (cycleSnap.exists()) {
            throw new Error(
              'A cycle with this ID already exists. Please try again.',
            );
          }

          tx.update(applianceRef, {
            '_status.isRunning': true,
            '_status.currentCycle': nextCycleId,

            lastStartedCycle: {
              dateExecuted: txCurrentDate,
              cycleNumber: nextCycleNumber,
              cycleId: nextCycleId,
            },

            updatedAt: serverTimestamp(),
          });

          tx.set(cycleRef, {
            _isFinished: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            dateExecuted: txCurrentDate,
            cycleId: nextCycleId,

            applianceSnapshot,

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

          tx.set(
            activityRef,
            buildRoomActivityPayload({
              clinicId,
              roomId,
              applianceId,
              collectionName: AUTOCLAVE_RECORD_COLLECTIONS.dailyOps,
              recordId: nextCycleId,
              recordTypeLabel: 'Daily Ops',

              applianceName:
                typeof applianceData.applianceName === 'string'
                  ? applianceData.applianceName
                  : null,
              applianceTypeKey:
                typeof applianceData.typeKey === 'string'
                  ? applianceData.typeKey
                  : 'autoclave',
              applianceTypeName:
                typeof applianceData.typeName === 'string'
                  ? applianceData.typeName
                  : 'Autoclave',

              outcome: null,
              uploadStatus: 'running',

              isAutoclaveRecord: true,
              isRunningDailyOps: true,
            }),
          );

          return nextCycleId;
        },
      );

      setFormErrorField(null);

      await alert({
        title: 'Started',
        message: `Autoclave cycle ${committedCycleId} started successfully.`,
      });
      routerBack();
    } catch (e) {
      console.error('start autoclave error', e);

      const message =
        e instanceof Error ? e.message : 'Unknown error';

      await alert({
        title: 'Start failed',
        message,
      });
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
    applianceKey,
    maxTemp,
    pressure,
    startTime,
    saving,
    alert,
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
