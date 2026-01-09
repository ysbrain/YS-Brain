import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ApplianceIconSpec = {
  lib: 'mci';
  name: MCIName;
  color?: string;
};

const FALLBACK_ICON: ApplianceIconSpec = {
  lib: 'mci',
  name: 'help-circle-outline',
  color: '#111',
};

/**
 * Normalize appliance type values to reduce mapping issues:
 * - trim
 * - lowercase
 * - collapse spaces/underscores to a standard form if you want
 */
export function normalizeApplianceType(type?: string) {
  return (type ?? '').trim().toLowerCase();
}

/**
 * Map applianceType -> icon.
 * Add more cases as your app grows.
 */
const ICON_BY_TYPE: Record<string, ApplianceIconSpec> = {
  // examples — replace with your actual appliance types
  autoclave: { lib: 'mci', name: 'toaster-oven', color: '#111' },
  waterlinetest: { lib: 'mci', name: 'water-pump', color: '#111' },
  ultrasonicmachine: { lib: 'mci', name: 'waves', color: '#111' },
};

export function getApplianceIcon(type?: string): ApplianceIconSpec {
  const key = normalizeApplianceType(type);
  return ICON_BY_TYPE[key] ?? FALLBACK_ICON;
}
