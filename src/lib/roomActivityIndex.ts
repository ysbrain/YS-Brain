// src/lib/roomActivityIndex.ts

import { db } from '@/src/lib/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';

type RoomActivityIndexParams = {
  clinicId: string;
  roomId: string;
  applianceId: string;
  collectionName: string;
  recordId: string;

  recordTypeLabel: string;

  applianceName?: string | null;
  applianceTypeKey?: string | null;
  applianceTypeName?: string | null;

  outcome?: string | null;
  uploadStatus?: string | null;

  isAutoclaveRecord?: boolean;
  isRunningDailyOps?: boolean;

  sourcePath?: string;
};

export function buildRoomActivityId(params: {
  applianceId: string;
  collectionName: string;
  recordId: string;
}) {
  return `${params.applianceId}_${params.collectionName}_${params.recordId}`;
}

export function getRoomActivityRef(params: {
  clinicId: string;
  roomId: string;
  applianceId: string;
  collectionName: string;
  recordId: string;
}) {
  return doc(
    db,
    'clinics',
    params.clinicId,
    'rooms',
    params.roomId,
    'activityRecords',
    buildRoomActivityId({
      applianceId: params.applianceId,
      collectionName: params.collectionName,
      recordId: params.recordId,
    }),
  );
}

export function buildRoomActivityPayload({
  clinicId,
  roomId,
  applianceId,
  collectionName,
  recordId,
  recordTypeLabel,
  applianceName,
  applianceTypeKey,
  applianceTypeName,
  outcome = null,
  uploadStatus = null,
  isAutoclaveRecord = false,
  isRunningDailyOps = false,
  sourcePath,
}: RoomActivityIndexParams) {
  return {
    clinicId,
    roomId,
    applianceId,

    recordId,
    collectionName,
    recordTypeLabel,

    applianceName: applianceName ?? null,
    applianceTypeKey: applianceTypeKey ?? null,
    applianceTypeName: applianceTypeName ?? null,

    outcome,
    uploadStatus,

    isAutoclaveRecord,
    isRunningDailyOps,

    sourcePath:
      sourcePath ??
      `clinics/${clinicId}/rooms/${roomId}/appliances/${applianceId}/${collectionName}/${recordId}`,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function buildRoomActivityUpdatePayload(
  params: Partial<
    Pick<
      RoomActivityIndexParams,
      | 'recordTypeLabel'
      | 'applianceName'
      | 'applianceTypeKey'
      | 'applianceTypeName'
      | 'outcome'
      | 'uploadStatus'
      | 'isAutoclaveRecord'
      | 'isRunningDailyOps'
    >
  >,
) {
  return {
    ...params,
    updatedAt: serverTimestamp(),
  };
}
