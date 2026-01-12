import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ApplianceIconSpec = {
  name: MCIName;
  color?: string;
};

/**
 * Convert key/label into a stable kebab-case lookup key.
 * Supports:
 * - camelCase: waterLineTest -> water-line-test
 * - kebab-case: water-line-test -> water-line-test
 * - spaces: "Water Line Test" -> water-line-test
 * - snake_case: water_line_test -> water-line-test
 */
export function normalizeIconKey(input?: string) {
  if (!input) return '';

  const withDashes = input
    .trim()
    // insert dashes for camelCase BEFORE lowercasing
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // remove accents
    .replace(/[^a-z0-9]+/g, '-')          // non-alphanum -> dash
    .replace(/(^-|-$)+/g, '');            // trim dashes

  return withDashes;
}

const FALLBACK_ICON: ApplianceIconSpec = {
  name: 'clipboard-text-outline',
  color: '#111',
};

/**
 * Map canonical kebab-case keys -> icon.
 * Add keys as your module list grows.
 */
const ICON_BY_KEY: Record<string, ApplianceIconSpec> = {
  'autoclave': { name: 'toaster-oven', color: '#111' },
  'water-line-test': { name: 'water-pump', color: '#111' },
};

export function getApplianceIcon(keyOrLabel?: string): ApplianceIconSpec {
  const k = normalizeIconKey(keyOrLabel);
  return ICON_BY_KEY[k] ?? FALLBACK_ICON;
}
