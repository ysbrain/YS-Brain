import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type UiLockOverlayCardProps = {
  title?: string;
  message?: string;
};

export default function UiLockOverlayCard({
  title = 'Saving record…',
  message = 'Please wait, this may take a moment.',
}: UiLockOverlayCardProps) {
  return (
    <View style={styles.card}>
      <ActivityIndicator size="large" color="#111" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 220,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },
  message: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
});
