// src/hooks/autoclave/useAutoclaveAppliance.ts

import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/src/lib/firebase';
import type { ApplianceDocShape, SetupStoredItem } from './types';

type UseAutoclaveApplianceParams = {
  clinicId?: string | null;
  roomId?: string | null;
  applianceId?: string | null;
};

type UseAutoclaveApplianceResult = {
  loading: boolean;
  loadError: string | null;
  applianceName: string;
  applianceKey: string;
  setup: Record<string, SetupStoredItem | undefined>;
  lastCycle: {
    cycleNumber?: number;
    dateExecuted?: string;
  };
  isRunning: boolean;
  currentCycle: string;
};

export function useAutoclaveAppliance({
  clinicId,
  roomId,
  applianceId,
}: UseAutoclaveApplianceParams): UseAutoclaveApplianceResult {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [applianceName, setApplianceName] = useState('Autoclave');
  const [applianceKey, setApplianceKey] = useState('');
  const [setup, setSetup] = useState<Record<string, SetupStoredItem | undefined>>({});
  const [lastCycle, setLastCycle] = useState<{
    cycleNumber?: number;
    dateExecuted?: string;
  }>({});
  const [isRunning, setIsRunning] = useState(false);
  const [currentCycle, setCurrentCycle] = useState('');

  useEffect(() => {
    if (!clinicId || !roomId || !applianceId) {
      setLoadError('Missing clinic, room, or appliance information.');
      setLoading(false);

      setApplianceName('Autoclave');
      setApplianceKey('');
      setSetup({});
      setLastCycle({});
      setIsRunning(false);
      setCurrentCycle('');
      return;
    }

    setLoading(true);
    setLoadError(null);

    const applianceRef = doc(
      db,
      'clinics',
      clinicId,
      'rooms',
      roomId,
      'appliances',
      applianceId,
    );

    const unsub = onSnapshot(
      applianceRef,
      (snap) => {
        if (!snap.exists()) {
          setLoadError('Autoclave appliance not found.');
          setLoading(false);

          setApplianceName('Autoclave');
          setApplianceKey('');
          setSetup({});
          setLastCycle({});
          setIsRunning(false);
          setCurrentCycle('');
          return;
        }

        const data = (snap.data() as ApplianceDocShape) ?? {};

        setApplianceName(
          typeof data.applianceName === 'string' && data.applianceName.trim().length > 0
            ? data.applianceName
            : 'Autoclave',
        );

        setApplianceKey(
          typeof data.applianceKey === 'string' && data.applianceKey.trim().length > 0
            ? data.applianceKey
            : '',
        );

        const nextSetup =
          data.setup && typeof data.setup === 'object'
            ? data.setup
            : ({} as Record<string, SetupStoredItem | undefined>);
        setSetup(nextSetup);

        const nextLastCycle =
          data.lastCycle && typeof data.lastCycle === 'object'
            ? data.lastCycle
            : { cycleNumber: undefined, dateExecuted: undefined };
        setLastCycle(nextLastCycle);

        const nextStatus = data._status ?? {};
        setIsRunning(Boolean(nextStatus.isRunning));
        setCurrentCycle(
          typeof nextStatus.currentCycle === 'string' ? nextStatus.currentCycle : '',
        );

        setLoading(false);
      },
      (err) => {
        console.error('autoclave appliance snapshot error', err);
        setLoadError('Failed to load autoclave appliance.');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [clinicId, roomId, applianceId]);

  return {
    loading,
    loadError,
    applianceName,
    applianceKey,
    setup,
    lastCycle,
    isRunning,
    currentCycle,
  };
}
