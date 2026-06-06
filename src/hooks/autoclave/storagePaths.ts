// src/hooks/autoclave/storagePaths.ts

import { AUTOCLAVE_STORAGE } from '@/src/constants/autoclave';
import { sanitizeIdPart } from '@/src/hooks/autoclave/utils';

export type AutoclaveStorageFolder =
  | typeof AUTOCLAVE_STORAGE.dailyOpsFolder
  | typeof AUTOCLAVE_STORAGE.helixFolder
  | typeof AUTOCLAVE_STORAGE.sporeFolder;

export function buildAutoclavePhotoPath(params: {
  clinicId: string;
  roomId: string;
  applianceId: string;
  folder: AutoclaveStorageFolder;
  fileBaseName: string;
}) {
  const {
    clinicId,
    roomId,
    applianceId,
    folder,
    fileBaseName,
  } = params;

  const safeClinicId = sanitizeIdPart(clinicId, '');
  const safeRoomId = sanitizeIdPart(roomId, '');
  const safeApplianceId = sanitizeIdPart(applianceId, '');
  const safeFileBaseName = sanitizeIdPart(fileBaseName, '');

  if (
    !safeClinicId ||
    !safeRoomId ||
    !safeApplianceId ||
    !safeFileBaseName
  ) {
    throw new Error(
      'Storage path contains invalid clinic, room, appliance, or file information.',
    );
  }

  return (
    `clinics/${safeClinicId}/${safeRoomId}/${safeApplianceId}` +
    `/${folder}` +
    `/${safeFileBaseName}.${AUTOCLAVE_STORAGE.photoExtension}`
  );
}
