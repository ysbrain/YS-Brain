// src/constants/autoclave.ts

export const AUTOCLAVE_SETUP_KEYS = {
  serialNumber: 'serial_number',
  defaultTempC: 'default_temp_c',
  defaultPressure: 'default_pressure',
} as const;

export const AUTOCLAVE_RECORD_COLLECTIONS = {
  dailyOps: 'records_DailyOps',
  helix: 'records_Helix',
  spore: 'records_Spore',
} as const;

export const AUTOCLAVE_CYCLE_ID = {
  invalidSerialPlaceholder: 'INVALID_SERIAL',
  /**
   * Format:
   * YYYYMMDD-SERIAL-01
   *
   * Serial may contain hyphens, so do not parse cycle IDs with split('-')
   * unless you only read first and last parts carefully.
   */
  regex: /^(\d{8})-(.+)-(\d{2,})$/,
} as const;

export const AUTOCLAVE_STORAGE = {
  dailyOpsFolder: 'dailyOps',
  helixFolder: 'helix',
  sporeFolder: 'spore',
  photoContentType: 'image/jpeg',
  photoExtension: 'jpg',
} as const;

export const AUTOCLAVE_VALIDATION = {
  maxThreeDigitLength: 3,
} as const;

export const DAILY_OPS_FIELD_KEYS = {
  maxTemp: 'daily:maxTemp',
  pressure: 'daily:pressure',
  startTime: 'daily:startTime',
  unloadTime: 'daily:unloadTime',
  internalIndicator: 'daily:internalIndicator',
  externalIndicator: 'daily:externalIndicator',
  photoEvidence: 'daily:photoEvidence',
  notes: 'daily:notes',
} as const;
