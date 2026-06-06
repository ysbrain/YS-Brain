// src/hooks/autoclave/useFinishAutoclaveCycleAction.ts

import {
  AUTOCLAVE_RECORD_COLLECTIONS,
  AUTOCLAVE_STORAGE,
} from '@/src/constants/autoclave';
import { buildApplianceSnapshot } from '@/src/hooks/autoclave/applianceSnapshot';
import type {
  ParseHHMMFn,
  RequestScrollFn,
  SetActivePickerFn,
  SetFormErrorFieldFn,
  SetUiLockedFn,
  UriToBlobFn,
} from '@/src/hooks/autoclave/dailyOpsActionTypes';
import { validateDailyOpsFinishForm } from '@/src/hooks/autoclave/dailyOpsValidation';
import type {
  ApplianceDocShape,
  DailyOpsCycleDoc,
} from '@/src/hooks/autoclave/types';
import {
  parseCycleId,
  sanitizeIdPart,
} from '@/src/hooks/autoclave/utils';
import { useValidationScroll } from '@/src/hooks/useValidationScroll';
import { db } from '@/src/lib/firebase';
import { blurActiveInputAndDismissKeyboard } from '@/src/utils/keyboard';
import {
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

type UseFinishAutoclaveCycleActionParams = {
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

  applianceKey: string;

  unloadTime: string;
  internalIndicator: boolean | null;
  externalIndicator: boolean | null;
  photoUri: string | null;
  notes: string;

  setFormErrorField: SetFormErrorFieldFn;
  setActivePicker: SetActivePickerFn;
  requestScroll: RequestScrollFn;
  routerBack: () => void;

  parseHHMM: ParseHHMMFn;
  uriToBlob: UriToBlobFn;
};

export function useFinishAutoclaveCycleAction({
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
  applianceKey,
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
  uriToBlob,
}: UseFinishAutoclaveCycleActionParams) {
  const { showValidationAlert } = useValidationScroll(requestScroll);

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
      Alert.alert(
        'Not signed in',
        'Please sign in before finishing the cycle.',
      );
      return;
    }

    if (loading || cycleDocLoading) {
      Alert.alert(
        'Please wait',
        'Cycle information is still loading.',
      );
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
      Alert.alert(
        'Cannot finish',
        'No running cycle was found.',
      );
      return;
    }

    if (!applianceKey.trim()) {
      Alert.alert(
        'Cannot finish',
        'Appliance key is missing.',
      );
      return;
    }

    const validation = validateDailyOpsFinishForm({
      unloadTime,
      internalIndicator,
      externalIndicator,
      photoUri,
      notes,
      parseHHMM,
    });

    if (!validation.ok) {
      setFormErrorField(validation.fieldKey);
      showValidationAlert(validation.alert);
      return;
    }

    const {
      trimmedUnloadTime,
      trimmedNotes,
      trimmedPhotoUri,
    } = validation.values;

    const parsed = parseCycleId(currentCycle);

    if (!parsed) {
      Alert.alert(
        'Cannot finish',
        'Current cycle ID format is invalid.',
      );
      return;
    }

    const {
      dateYYMMDD: cycleDatePart,
      cycleNumber: cycleNumberPart,
    } = parsed;

    if (!Number.isFinite(cycleNumberPart)) {
      Alert.alert(
        'Cannot finish',
        'Current cycle ID format is invalid.',
      );
      return;
    }

    if (saving) return;

    setSaving(true);
    setUiLocked(true, { scope: 'global' });

    let uploadedFileRef: ReturnType<typeof storageRef> | null =
      null;

    let databaseCommitted = false;

    try {
      const storage = getStorage();
      const blob = await uriToBlob(trimmedPhotoUri);

      const safeClinicId = sanitizeIdPart(clinicId, '');
      const safeRoomId = sanitizeIdPart(roomId, '');
      const safeApplianceKey = sanitizeIdPart(applianceKey, '');
      const safeCurrentCycle = sanitizeIdPart(
        currentCycle,
        'cycle',
      );

      if (!safeClinicId || !safeRoomId || !safeApplianceKey) {
        throw new Error(
          'Storage path contains invalid clinic, room, or appliance information.',
        );
      }

      const photoPath =
        `clinics/${safeClinicId}/${safeRoomId}/${safeApplianceKey}` +
        `/${AUTOCLAVE_STORAGE.dailyOpsFolder}` +
        `/${safeCurrentCycle}.${AUTOCLAVE_STORAGE.photoExtension}`;

      uploadedFileRef = storageRef(storage, photoPath);

      await uploadBytes(uploadedFileRef, blob, {
        contentType: AUTOCLAVE_STORAGE.photoContentType,
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
        AUTOCLAVE_RECORD_COLLECTIONS.dailyOps,
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

        const applianceData =
          (applianceSnap.data() as ApplianceDocShape) ?? {};

        const latestStatus = applianceData._status ?? {};

        if (!latestStatus.isRunning) {
          throw new Error(
            'This autoclave is no longer marked as running.',
          );
        }

        const latestCurrentCycle =
          typeof latestStatus.currentCycle === 'string'
            ? latestStatus.currentCycle
            : '';

        if (latestCurrentCycle !== currentCycle) {
          throw new Error(
            'The running cycle has changed. Please reload and try again.',
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

        const cycleData =
          (cycleSnap.data() as DailyOpsCycleDoc) ?? {};

        if (cycleData._isFinished) {
          throw new Error(
            'This cycle has already been finished.',
          );
        }

        const existingApplianceSnapshot = (cycleData as any).applianceSnapshot;

        const applianceSnapshot =
          existingApplianceSnapshot &&
          typeof existingApplianceSnapshot === 'object'
            ? existingApplianceSnapshot
            : buildApplianceSnapshot({
                clinicId,
                roomId,
                applianceId,
                applianceData,
              });
        
        const failedChecks: string[] = [];

        if (internalIndicator === false) {
          failedChecks.push('internalIndicator');
        }

        if (externalIndicator === false) {
          failedChecks.push('externalIndicator');
        }

        const outcome: 'pass' | 'fail' =
          failedChecks.length > 0 ? 'fail' : 'pass';

        tx.update(cycleRef, {
          _isFinished: true,
          _outcome: outcome,

          applianceSnapshot,

          failedChecks,

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

          lastFinishedCycle: {
            dateExecuted: cycleDatePart,
            cycleNumber: cycleNumberPart,
            cycleId: currentCycle,
          },

          updatedAt: serverTimestamp(),
        });
      });

      databaseCommitted = true;
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
    } catch (e) {
      console.error('finish autoclave cycle error', e);

      if (!databaseCommitted && uploadedFileRef) {
        try {
          await deleteObject(uploadedFileRef);
        } catch (cleanupErr) {
          console.error(
            'cleanup uploaded autoclave photo error',
            cleanupErr,
          );
        }
      }

      const message =
        e instanceof Error ? e.message : 'Unknown error';

      Alert.alert('Finish failed', message);
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
    onFinishAndUnload,
  };
}
