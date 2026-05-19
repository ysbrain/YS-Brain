// src/hooks/autoclave/useDailyOpsStartController.ts

import type { ActionBlocker } from '@/src/components/autoclave/ActionBlockerList';
import {
  AUTOCLAVE_CYCLE_ID,
  AUTOCLAVE_SETUP_KEYS,
} from '@/src/constants/autoclave';
import {
  setupValueToString,
  validatePositiveIntUpTo3Digits,
} from '@/src/hooks/autoclave/setupUtils';
import type {
  DailyOpsActivePicker,
  DailyOpsFieldKey,
  SetupStoredItem,
} from '@/src/hooks/autoclave/types';
import { useStartAutoclaveCycleAction } from '@/src/hooks/autoclave/useStartAutoclaveCycleAction';
import {
  buildCycleId,
  getStrictSerialIdPart,
} from '@/src/hooks/autoclave/utils';
import {
  formatDateShortYYMMDD,
  pad2,
  parseHHMM,
} from '@/src/utils/dateTime';
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

export type UseDailyOpsStartControllerParams = {
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

  currentDateYYMMDD: string;

  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: SetUiLockedFn;

  setActivePicker: (value: DailyOpsActivePicker) => void;
  requestScroll: RequestScrollFn;
  routerBack: () => void;

  form: {
    setFormErrorField: (field: DailyOpsFieldKey | null) => void;

    maxTemp: string;
    pressure: string;
    startTime: string;
  };
};

export function useDailyOpsStartController({
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
  currentDateYYMMDD,
  saving,
  setSaving,
  setUiLocked,
  setActivePicker,
  requestScroll,
  routerBack,
  form,
}: UseDailyOpsStartControllerParams) {
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

  const { onStartMachine } = useStartAutoclaveCycleAction({
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

    serialNumber,

    maxTemp: form.maxTemp,
    pressure: form.pressure,
    startTime: form.startTime,

    setFormErrorField: form.setFormErrorField,
    setActivePicker,
    requestScroll,
    routerBack,

    parseHHMM,
    validatePositiveIntUpTo3Digits,
    setupValueToString,
    formatDateYYMMDD: formatDateShortYYMMDD,
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
        message: 'Serial number contains unsupported characters.',
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

  const canPressStartMachine = !saving && startBlockers.length === 0;

  return {
    serialNumber,
    cycleIdPreview,
    onStartMachine,
    startBlockers,
    canPressStartMachine,
  };
}

export type DailyOpsStartController =
  ReturnType<typeof useDailyOpsStartController>;
