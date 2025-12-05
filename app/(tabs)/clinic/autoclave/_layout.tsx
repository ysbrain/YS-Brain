import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';
import React from 'react';

export default function AutoclaveLayout() {
  return (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="index"
        options={({ route }) => ({
          title: (route.params as any)?.equipment ?? 'Autoclave',
        })}
      />
      <Stack.Screen name="helix" options={{ title: 'Helix Test' }} />
      <Stack.Screen name="spore" options={{ title: 'Spore Test' }} />
    </Stack>
  );
}
