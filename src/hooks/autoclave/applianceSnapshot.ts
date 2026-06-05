// src/hooks/autoclave/applianceSnapshot.ts

import { AUTOCLAVE_SETUP_KEYS } from '@/src/constants/autoclave';
import { setupValueToString } from '@/src/hooks/autoclave/setupUtils';
import type {
  ApplianceDocShape,
  AutoclaveApplianceSnapshot,
  SetupStoredItem,
} from '@/src/hooks/autoclave/types';

export function buildApplianceSnapshot(params: {
  clinicId: string;
  roomId: string;
  applianceId: string;
  applianceData: ApplianceDocShape;
}): AutoclaveApplianceSnapshot {
  const { clinicId, roomId, applianceId, applianceData } = params;

  const setup =
    applianceData.setup && typeof applianceData.setup === 'object'
      ? applianceData.setup
      : ({} as Record<string, SetupStoredItem | undefined>);

  const applianceKey =
    typeof applianceData.applianceKey === 'string'
      ? applianceData.applianceKey.trim()
      : '';

  const applianceName =
    typeof applianceData.applianceName === 'string' &&
    applianceData.applianceName.trim().length > 0
      ? applianceData.applianceName.trim()
      : null;

  const serialNumber = setupValueToString(
    setup,
    AUTOCLAVE_SETUP_KEYS.serialNumber,
    '',
  ).trim();

  return {
    clinicId,
    roomId,
    applianceId,
    applianceKey,
    applianceName,
    serialNumber,
  };
}
