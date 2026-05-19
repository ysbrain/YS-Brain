// src/hooks/autoclave/useDailyOpsRunningController.ts

import type { ActionBlocker } from '@/src/components/autoclave/ActionBlockerList';
import { AUTOCLAVE_CYCLE_ID } from '@/src/constants/autoclave';
import type {
  DailyOpsActivePicker,
  DailyOpsCycleDoc,
  DailyOpsFieldKey,
} from '@/src/hooks/autoclave/types';
import { useFinishAutoclaveCycleAction } from '@/src/hooks/autoclave/useFinishAutoclaveCycleAction';
import { parseHHMM } from '@/src/utils/dateTime';
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

export type UseDailyOpsRunningControllerParams = {
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;
  userUid?: string | null;
  userName?: string | null;

  loading: boolean;
  loadError: string | null;

  isRunning: boolean;
  currentCycle: string;
  applianceKey: string;

  cycleDocLoading: boolean;
  cycleDocError: string | null;
  cycleDoc: DailyOpsCycleDoc | null;

  saving: boolean;
  setSaving: (value: boolean) => void;
  setUiLocked: SetUiLockedFn;

  setActivePicker: (value: DailyOpsActivePicker) => void;
  requestScroll: RequestScrollFn;
  routerBack: () => void;

  form: {
    setFormErrorField: (field: DailyOpsFieldKey | null) => void;

    unloadTime: string;

    internalIndicator: boolean | null;
    externalIndicator: boolean | null;

    photoUri: string | null;

    notes: string;
  };
};

export function useDailyOpsRunningController({
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
  form,
}: UseDailyOpsRunningControllerParams) {
  const { onFinishAndUnload } = useFinishAutoclaveCycleAction({
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

    applianceKey,

    unloadTime: form.unloadTime,
    internalIndicator: form.internalIndicator,
    externalIndicator: form.externalIndicator,
    photoUri: form.photoUri,
    notes: form.notes,

    setFormErrorField: form.setFormErrorField,
    setActivePicker,
    requestScroll,
    routerBack,

    parseHHMM,
    uriToBlob,
  });

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

  const canPressFinishUnload = !saving && finishBlockers.length === 0;

  return {
    cycleDocLoading,
    cycleDocError,
    cycleDoc,
    onFinishAndUnload,
    finishBlockers,
    canPressFinishUnload,
  };
}

export type DailyOpsRunningController =
  ReturnType<typeof useDailyOpsRunningController>;
