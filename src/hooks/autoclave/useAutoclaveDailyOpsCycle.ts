// src/hooks/autoclave/useAutoclaveDailyOpsCycle.ts

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/src/lib/firebase';
import type { DailyOpsCycleDoc } from './types';

type UseAutoclaveDailyOpsCycleParams = {
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;
  isRunning: boolean;
  currentCycle: string;
};

type UseAutoclaveDailyOpsCycleResult = {
  cycleDocLoading: boolean;
  cycleDocError: string | null;
  cycleDoc: DailyOpsCycleDoc | null;
};

export function useAutoclaveDailyOpsCycle({
  clinicId,
  roomId,
  applianceId,
  isRunning,
  currentCycle,
}: UseAutoclaveDailyOpsCycleParams): UseAutoclaveDailyOpsCycleResult {
  const [cycleDocLoading, setCycleDocLoading] = useState(false);
  const [cycleDocError, setCycleDocError] = useState<string | null>(null);
  const [cycleDoc, setCycleDoc] = useState<DailyOpsCycleDoc | null>(null);

  useEffect(() => {
    if (!clinicId || !roomId || !applianceId || !isRunning || !currentCycle) {
      setCycleDoc(null);
      setCycleDocError(null);
      setCycleDocLoading(false);
      return;
    }

    setCycleDocLoading(true);
    setCycleDocError(null);

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

    const unsub = onSnapshot(
      cycleRef,
      (snap) => {
        if (!snap.exists()) {
          setCycleDoc(null);
          setCycleDocError('Current cycle record not found.');
          setCycleDocLoading(false);
          return;
        }

        setCycleDoc((snap.data() as DailyOpsCycleDoc) ?? {});
        setCycleDocError(null);
        setCycleDocLoading(false);
      },
      (err) => {
        console.error('autoclave cycle snapshot error', err);
        setCycleDoc(null);
        setCycleDocError('Failed to load current cycle.');
        setCycleDocLoading(false);
      },
    );

    return () => unsub();
  }, [clinicId, roomId, applianceId, isRunning, currentCycle]);

  return {
    cycleDocLoading,
    cycleDocError,
    cycleDoc,
  };
}
