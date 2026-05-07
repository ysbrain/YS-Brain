// src/hooks/autoclave/useDailyOpsForm.ts

import { useEffect, useState } from 'react';

import type { DailyOpsFieldKey } from '@/src/hooks/autoclave/types';
import { formatTimeHHMM } from '@/src/utils/dateTime';

type UseDailyOpsFormParams = {
  applianceId?: string | null;
  currentCycle: string;
  defaultMaxTemp: string;
  defaultPressure: string;
};

export function useDailyOpsForm({
  applianceId,
  currentCycle,
  defaultMaxTemp,
  defaultPressure,
}: UseDailyOpsFormParams) {
  const [formErrorField, setFormErrorField] = useState<DailyOpsFieldKey | null>(null);

  const [maxTemp, setMaxTemp] = useState('');
  const [pressure, setPressure] = useState('');

  const [startTime, setStartTime] = useState(formatTimeHHMM(new Date()));
  const [unloadTime, setUnloadTime] = useState(formatTimeHHMM(new Date()));

  const [internalIndicator, setInternalIndicator] = useState<boolean | null>(null);
  const [externalIndicator, setExternalIndicator] = useState<boolean | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Reset start-page editable fields when the appliance changes.
  useEffect(() => {
    setFormErrorField(null);
    setMaxTemp('');
    setPressure('');
    setStartTime(formatTimeHHMM(new Date()));
  }, [applianceId]);

  // Backfill setup defaults only if user has not already typed something.
  //
  // Including applianceId here ensures that if the user switches appliance
  // and the new appliance happens to have the same default values,
  // the fields can still be repopulated after the reset above.
  useEffect(() => {
    setMaxTemp((prev) =>
      prev.trim().length > 0 ? prev : defaultMaxTemp,
    );

    setPressure((prev) =>
      prev.trim().length > 0 ? prev : defaultPressure,
    );
  }, [applianceId, defaultMaxTemp, defaultPressure]);

  // Reset running-page form state when the running cycle changes.
  useEffect(() => {
    setFormErrorField(null);
    setUnloadTime(formatTimeHHMM(new Date()));
    setInternalIndicator(null);
    setExternalIndicator(null);
    setPhotoUri(null);
    setNotes('');
  }, [currentCycle]);

  return {
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
  };
}
