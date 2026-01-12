import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ApplianceIconSpec = {
  name: MCIName;
  color?: string;
};

/**
 * Normalize a key so matching works even if you pass in something slightly off.
 * With your new design, you should mostly pass typeKey/iconKey already normalized.
 */
export function normalizeKey(key?: string) {
  return (key ?? '').trim().toLowerCase();
}

const FALLBACK_ICON: ApplianceIconSpec = {
  name: 'help-circle-outline',
  color: '#111',
};

/**
 * Map canonical typeKey/iconKey -> icon.
 * Add entries as you add modules.
 *
 * Tip: keep keys in kebab-case to match slugifyType output.
 */
const ICON_BY_KEY: Record<string, ApplianceIconSpec> = {
  'autoclave': { name: 'toaster-oven', color: '#111' },
  'water-line-test': { name: 'water-pump', color: '#111' },
  'ultrasonic-machine': { name: 'waves', color: '#111' },
};

/**
 * Get icon spec from a module key (typeKey or iconKey).
 */
export function getApplianceIcon(key?: string): ApplianceIconSpec {
  const k = normalizeKey(key);
  return ICON_BY_KEY[k] ?? FALLBACK_ICON;
}

/**
 * Optional helper: returns a ready-to-render icon component props.
 */
export function getApplianceIconProps(key?: string, size = 22) {
  const spec = getApplianceIcon(key);
  return {
    name: spec.name,
    size,
    color: spec.color ?? '#111',
  } as const;
}
