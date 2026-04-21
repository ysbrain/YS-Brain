// src/hooks/autoclave/useDailyOpsForm.ts

import { useEffect, useState } from 'react';

export type DailyFieldKey =
  | 'daily:maxTemp'
  | 'daily:pressure'
  | 'daily:startTime'
  | 'daily:unloadTime'
  | 'daily:internalIndicator'
  | 'daily:externalIndicator'
  | 'daily:photoEvidence'
  | 'daily:notes';

type UseDailyOpsFormParams = {
  applianceId?: string | null;
  currentCycle: string;
  defaultMaxTemp: string;
  defaultPressure: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function useDailyOpsForm({
  applianceId,
  currentCycle,
  defaultMaxTemp,
  defaultPressure,
}: UseDailyOpsFormParams) {
  const [formErrorField, setFormErrorField] = useState<DailyFieldKey | null>(null);

  const [maxTemp, setMaxTemp] = useState('');
  const [pressure, setPressure] = useState('');
  const [startTime, setStartTime] = useState(formatTimeHHMM(new Date()));

  const [unloadTime, setUnloadTime] = useState(formatTimeHHMM(new Date()));
  const [internalIndicator, setInternalIndicator] = useState<boolean | null>(null);
  const [externalIndicator, setExternalIndicator] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Mirrors current autoclave.tsx behavior:
  // backfill setup defaults only if user has not already typed something.
  useEffect(() => {
    setMaxTemp((prev) =>
      prev.trim().length > 0 ? prev : defaultMaxTemp,
    );
    setPressure((prev) =>
      prev.trim().length > 0 ? prev : defaultPressure,
    );
  }, [defaultMaxTemp, defaultPressure]);

  // Mirrors current autoclave.tsx behavior:
  // reset start-page editable defaults when appliance changes.
  useEffect(() => {
    setMaxTemp('');
    setPressure('');
    setStartTime(formatTimeHHMM(new Date()));
  }, [applianceId]);

  // Mirrors current autoclave.tsx behavior:
  // reset running-page form state when cycle changes.
  useEffect(() => {
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
