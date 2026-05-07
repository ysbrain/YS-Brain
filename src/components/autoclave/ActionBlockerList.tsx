// src/components/autoclave/ActionBlockerList.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type ActionBlocker = {
  key: string;
  message: string;
};

type ActionBlockerListProps = {
  blockers: ActionBlocker[];
};

export function ActionBlockerList({ blockers }: ActionBlockerListProps) {
  if (blockers.length === 0) return null;

  return (
    <View style={styles.blockerBox}>
      <MaterialCommunityIcons
        name="information-outline"
        size={18}
        color="#b45309"
      />

      <View style={{ flex: 1 }}>
        <Text style={styles.blockerTitle}>Action unavailable</Text>

        {blockers.map((blocker) => (
          <Text key={blocker.key} style={styles.blockerText}>
            • {blocker.message}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockerBox: {
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#facc15',
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  blockerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#92400e',
    marginBottom: 4,
  },
  blockerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
    lineHeight: 18,
  },
});
