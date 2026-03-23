import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type ApplianceIconSpec = {
  name: MCIName;
  color?: string;
};

const FALLBACK_ICON: ApplianceIconSpec = {
  name: 'clipboard-text-outline',
  color: '#111',
};

/**
 * Map keys -> icon.
 * Add keys as your module list grows.
 */
const ICON_BY_KEY: Record<string, ApplianceIconSpec> = {
  'autoclave': { name: 'toaster-oven', color: '#111' },
  'water_line_test': { name: 'water-pump', color: '#111' },
};

export function getApplianceIcon(key: string): ApplianceIconSpec {
  return ICON_BY_KEY[key] ?? FALLBACK_ICON;
}
