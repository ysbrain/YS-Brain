// src/hooks/autoclave/useDailyOpsController.ts

import type { ActionBlocker } from '@/src/components/autoclave/ActionBlockerList';
import {
  AUTOCLAVE_CYCLE_ID,
  AUTOCLAVE_SETUP_KEYS,
} from '@/src/constants/autoclave';
import {
  setupValueToNumberString,
  setupValueToString,
  validatePositiveIntUpTo3Digits,
} from '@/src/hooks/autoclave/setupUtils';
import type {
  DailyOpsActivePicker,
  DailyOpsCycleDoc,
  SetupStoredItem,
} from '@/src/hooks/autoclave/types';
import { useAutoclaveDailyOpsActions } from '@/src/hooks/autoclave/useAutoclaveDailyOpsActions';
import { useDailyOpsForm } from '@/src/hooks/autoclave/useDailyOpsForm';
import {
  buildCycleId,
  getStrictSerialIdPart,
} from '@/src/hooks/autoclave/utils';
import {
  formatDateShortYYMMDD,
  pad2,
  parseHHMM,
} from '@/src/utils/dateTime';
import { uriToBlob } from '@/src/utils/photo';
import { useMemo } from 'react';

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

type UseDailyOpsControllerParams = {
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
  isRunning: boolean;
  currentCycle: string;
  applianceKey: string;
  cycleDocLoading: boolean;
  cycleDocError: string | null;
  cycleDoc: DailyOpsCycleDoc | null;
  currentDate: string; // still passed but no longer used for ID logic
  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: SetUiLockedFn;
  setActivePicker: (value: DailyOpsActivePicker) => void;
  requestScroll: RequestScrollFn;
  routerBack: () => void;
};

export function useDailyOpsController({
  clinicId,
  roomId,
  applianceId,
  userUid,
  userName,
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
  saving,
  setSaving,
  setUiLocked,
  setActivePicker,
  requestScroll,
  routerBack,
}: UseDailyOpsControllerParams) {
  const currentDateYYMMDD = useMemo(() => {
    return formatDateShortYYMMDD(new Date());
  }, []);

  const defaultMaxTemp = useMemo(() => {
    return setupValueToNumberString(
      setup,
      AUTOCLAVE_SETUP_KEYS.defaultTempC,
      '',
    );
  }, [setup]);

  const defaultPressure = useMemo(() => {
    return setupValueToNumberString(
      setup,
      AUTOCLAVE_SETUP_KEYS.defaultPressure,
      '',
    );
  }, [setup]);

  const {
    formErrorField,
    setFormErrorField,
    maxTemp,
    setMaxTemp,
    pressure,
    setPressure,
    startTime,
    setStartTime,
    unloadTime,
    setUnloadTime,
    internalIndicator,
    setInternalIndicator,
    externalIndicator,
    setExternalIndicator,
    photoUri,
    setPhotoUri,
    notes,
    setNotes,
  } = useDailyOpsForm({
    applianceId,
    currentCycle,
    defaultMaxTemp,
    defaultPressure,
  });

  const serialNumber = useMemo(() => {
    return setupValueToString(
      setup,
      AUTOCLAVE_SETUP_KEYS.serialNumber,
      '',
    ).trim();
  }, [setup]);

  const strictSerialIdPart = useMemo(() => {
    return getStrictSerialIdPart(serialNumber);
  }, [serialNumber]);

  const hasValidSerialNumber = !!strictSerialIdPart;

  // compare using YYMMDD
  const nextCycle = useMemo(() => {
    const lastDate =
      typeof lastCycle?.dateExecuted === 'string'
        ? lastCycle.dateExecuted
        : '';

    const rawCycleNumber =
      typeof lastCycle?.cycleNumber === 'number' &&
      Number.isFinite(lastCycle.cycleNumber)
        ? lastCycle.cycleNumber
        : 0;

    const nextNumber =
      lastDate === currentDateYYMMDD ? rawCycleNumber + 1 : 1;

    return pad2(nextNumber);
  }, [lastCycle, currentDateYYMMDD]);

  // SERIAL-YYMMDD-XX
  const cycleIdPreview = useMemo(() => {
    const serialPart =
      strictSerialIdPart ??
      AUTOCLAVE_CYCLE_ID.invalidSerialPlaceholder;

    return buildCycleId({
      serial: serialPart,
      dateYYMMDD: currentDateYYMMDD,
      cycleNumber: Number(nextCycle),
      pad2,
    });
  }, [currentDateYYMMDD, strictSerialIdPart, nextCycle]);

  const { onStartMachine, onFinishAndUnload } =
    useAutoclaveDailyOpsActions({
      clinicId,
      roomId,
      applianceId,
      userUid: userUid ?? null,
      userName: userName ?? null,
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
      formatDateYYMMDDCompact: formatDateShortYYMMDD,
      pad2,
    });

  const startBlockers = useMemo<ActionBlocker[]>(() => {
    const blockers: ActionBlocker[] = [];

    if (loading) {
      blockers.push({
        key: 'loading',
        message: 'Autoclave information is still loading.',
      });
    }

    if (loadError) {
      blockers.push({
        key: 'loadError',
        message: loadError,
      });
    }

    if (!clinicId || !roomId || !applianceId) {
      blockers.push({
        key: 'missingContext',
        message: 'Clinic, room, or appliance information is missing.',
      });
    }

    if (!userUid) {
      blockers.push({
        key: 'notSignedIn',
        message: 'Please sign in before starting the machine.',
      });
    }

    if (!serialNumber.trim()) {
      blockers.push({
        key: 'missingSerial',
        message: 'Missing serial number in appliance setup.',
      });
    } else if (!hasValidSerialNumber) {
      blockers.push({
        key: 'invalidSerial',
        message:
          'Serial number contains unsupported characters. Please update appliance setup.',
      });
    }

    if (isRunning) {
      blockers.push({
        key: 'alreadyRunning',
        message: 'This autoclave is already running a cycle.',
      });
    }

    return blockers;
  }, [
    loading,
    loadError,
    clinicId,
    roomId,
    applianceId,
    userUid,
    serialNumber,
    hasValidSerialNumber,
    isRunning,
  ]);

  const canPressStartMachine =
    !saving && startBlockers.length === 0;

  const hasValidCurrentCycleId =
    !!currentCycle && AUTOCLAVE_CYCLE_ID.regex.test(currentCycle);

  const finishBlockers = useMemo<ActionBlocker[]>(() => {
    const blockers: ActionBlocker[] = [];

    if (loading || cycleDocLoading) {
      blockers.push({
        key: 'loading',
        message: 'Cycle information is still loading.',
      });
    }

    if (loadError) {
      blockers.push({
        key: 'loadError',
        message: loadError,
      });
    }

    if (cycleDocError) {
      blockers.push({
        key: 'cycleDocError',
        message: cycleDocError,
      });
    }

    if (cycleDoc?._isFinished) {
      blockers.push({
        key: 'alreadyFinished',
        message: 'This cycle has already been finished.',
      });
    }

    if (!clinicId || !roomId || !applianceId) {
      blockers.push({
        key: 'missingContext',
        message: 'Clinic, room, or appliance information is missing.',
      });
    }

    if (!userUid) {
      blockers.push({
        key: 'notSignedIn',
        message: 'Please sign in before finishing the cycle.',
      });
    }

    if (!isRunning || !currentCycle) {
      blockers.push({
        key: 'noRunningCycle',
        message: 'No running cycle was found.',
      });
    }

    if (isRunning && currentCycle && !hasValidCurrentCycleId) {
      blockers.push({
        key: 'invalidCycleId',
        message: 'Current cycle ID format is invalid.',
      });
    }

    if (applianceKey.trim().length === 0) {
      blockers.push({
        key: 'missingApplianceKey',
        message: 'Appliance key is missing.',
      });
    }

    return blockers;
  }, [
    loading,
    cycleDocLoading,
    loadError,
    cycleDocError,
    cycleDoc?._isFinished,
    clinicId,
    roomId,
    applianceId,
    userUid,
    isRunning,
    currentCycle,
    hasValidCurrentCycleId,
    applianceKey,
  ]);

  const canPressFinishUnload =
    !saving && finishBlockers.length === 0;

  return {
    isRunning,
    cycleIdPreview,
    currentCycle,
    cycleDocLoading,
    cycleDocError,
    cycleDoc,
    formErrorField,
    setFormErrorField,
    maxTemp,
    setMaxTemp,
    pressure,
    setPressure,
    startTime,
    setStartTime,
    unloadTime,
    setUnloadTime,
    internalIndicator,
    setInternalIndicator,
    externalIndicator,
    setExternalIndicator,
    photoUri,
    setPhotoUri,
    notes,
    setNotes,
    onStartMachine,
    onFinishAndUnload,
    canPressStartMachine,
    canPressFinishUnload,
    startBlockers,
    finishBlockers,
  };
}

export type DailyOpsController = ReturnType<typeof useDailyOpsController>;
