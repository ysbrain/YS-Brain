// src/hooks/autoclave/useDailyOpsController.ts

import { AUTOCLAVE_SETUP_KEYS } from '@/src/constants/autoclave';
import {
  setupValueToNumberString,
} from '@/src/hooks/autoclave/setupUtils';
import type {
  DailyOpsActivePicker,
  DailyOpsCycleDoc,
  SetupStoredItem,
} from '@/src/hooks/autoclave/types';
import { useDailyOpsForm } from '@/src/hooks/autoclave/useDailyOpsForm';
import { useDailyOpsRunningController } from '@/src/hooks/autoclave/useDailyOpsRunningController';
import { useDailyOpsStartController } from '@/src/hooks/autoclave/useDailyOpsStartController';
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
  
  lastStartedCycle: {
    cycleNumber?: number;
    dateExecuted?: string;
    cycleId?: string;
  };

  lastFinishedCycle: {
    cycleNumber?: number;
    dateExecuted?: string;
    cycleId?: string;
  };

  isRunning: boolean;
  currentCycle: string;
  applianceKey: string;

  cycleDocLoading: boolean;
  cycleDocError: string | null;
  cycleDoc: DailyOpsCycleDoc | null;

  currentDateYYMMDD: string;

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
  lastStartedCycle,
  lastFinishedCycle,
  isRunning,
  currentCycle,
  applianceKey,
  cycleDocLoading,
  cycleDocError,
  cycleDoc,
  currentDateYYMMDD,
  saving,
  setSaving,
  setUiLocked,
  setActivePicker,
  requestScroll,
  routerBack,
}: UseDailyOpsControllerParams) {
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

  const form = useDailyOpsForm({
    applianceId,
    currentCycle,
    defaultMaxTemp,
    defaultPressure,
  });

  const start = useDailyOpsStartController({
    clinicId,
    roomId,
    applianceId,
    userUid,
    userName,
    loading,
    loadError,
    setup,
    lastStartedCycle,
    isRunning,
    applianceKey,
    currentDateYYMMDD,
    saving,
    setSaving,
    setUiLocked,
    setActivePicker,
    requestScroll,
    routerBack,
    form: {
      setFormErrorField: form.setFormErrorField,
      maxTemp: form.maxTemp,
      pressure: form.pressure,
      startTime: form.startTime,
    },
  });

  const running = useDailyOpsRunningController({
    clinicId,
    roomId,
    applianceId,
    userUid,
    userName,
    loading,
    loadError,
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
    form: {
      setFormErrorField: form.setFormErrorField,
      unloadTime: form.unloadTime,
      internalIndicator: form.internalIndicator,
      externalIndicator: form.externalIndicator,
      photoUri: form.photoUri,
      notes: form.notes,
    },
  });

  /**
   * Compatibility return shape.
   *
   * This means your existing DailyOpsStartCard, DailyOpsRunningCard,
   * and DailyOpsView do not need to change yet.
   */
  return {
    isRunning,

    cycleIdPreview: start.cycleIdPreview,

    currentCycle,

    cycleDocLoading: running.cycleDocLoading,
    cycleDocError: running.cycleDocError,
    cycleDoc: running.cycleDoc,

    formErrorField: form.formErrorField,
    setFormErrorField: form.setFormErrorField,

    maxTemp: form.maxTemp,
    setMaxTemp: form.setMaxTemp,

    pressure: form.pressure,
    setPressure: form.setPressure,

    startTime: form.startTime,
    setStartTime: form.setStartTime,

    unloadTime: form.unloadTime,
    setUnloadTime: form.setUnloadTime,

    internalIndicator: form.internalIndicator,
    setInternalIndicator: form.setInternalIndicator,

    externalIndicator: form.externalIndicator,
    setExternalIndicator: form.setExternalIndicator,

    photoUri: form.photoUri,
    setPhotoUri: form.setPhotoUri,

    notes: form.notes,
    setNotes: form.setNotes,

    onStartMachine: start.onStartMachine,
    onFinishAndUnload: running.onFinishAndUnload,

    canPressStartMachine: start.canPressStartMachine,
    canPressFinishUnload: running.canPressFinishUnload,

    startBlockers: start.startBlockers,
    finishBlockers: running.finishBlockers,
  };
}

export type DailyOpsController = ReturnType<typeof useDailyOpsController>;
