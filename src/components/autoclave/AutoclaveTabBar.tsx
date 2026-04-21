// src/components/autoclave/AutoclaveTabBar.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AutoclaveTabKey = 'dailyOps' | 'helix' | 'spore';

type TabItem = {
  key: AutoclaveTabKey;
  label: string;
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

type AutoclaveTabButtonProps = {
  label: string;
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  active: boolean;
  isLast?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function AutoclaveTabButton({
  label,
  iconName,
  active,
  isLast = false,
  disabled = false,
  onPress,
}: AutoclaveTabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        isLast && styles.tabButtonLast,
        disabled && styles.tabButtonDisabled,
        pressed && !disabled && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons
        name={iconName}
        size={20}
        color={active ? '#2c7a7b' : '#64748b'}
      />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

type AutoclaveTabBarProps = {
  activeTab: AutoclaveTabKey;
  onChangeTab: (tab: AutoclaveTabKey) => void;
  disabled?: boolean;
};

const TAB_ITEMS: TabItem[] = [
  { key: 'dailyOps', label: 'Daily Ops', iconName: 'play-outline' },
  { key: 'helix', label: 'Helix', iconName: 'timer-sand' },
  { key: 'spore', label: 'Spore', iconName: 'test-tube' },
];

export function AutoclaveTabBar({
  activeTab,
  onChangeTab,
  disabled = false,
}: AutoclaveTabBarProps) {
  return (
    <View style={styles.tabBar}>
      {TAB_ITEMS.map((tab, index) => (
        <View key={tab.key} style={styles.tabSlot}>
          <AutoclaveTabButton
            label={tab.label}
            iconName={tab.iconName}
            active={activeTab === tab.key}
            isLast={index === TAB_ITEMS.length - 1}
            disabled={disabled}
            onPress={() => onChangeTab(tab.key)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    backgroundColor: '#fff',
  },

  tabSlot: {
    flex: 1,
  },

  tabButton: {
    minHeight: 54,
    borderRightWidth: 1,
    borderRightColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
  },

  tabButtonLast: {
    borderRightWidth: 0,
  },

  tabButtonActive: {
    backgroundColor: '#f8fafc',
  },

  tabButtonDisabled: {
    opacity: 0.65,
  },

  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },

  tabTextActive: {
    color: '#2c7a7b',
  },
});
