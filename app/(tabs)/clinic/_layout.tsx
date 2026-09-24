// app/(tabs)/clinic/_layout.tsx

import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';

export default function ClinicLayout() {
  return (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="index" options={{ title: 'Clinic 01' }} />
      <Stack.Screen name="room/[roomId]" />
      <Stack.Screen name="autoclave" options={{ title: 'Autoclave' }} />
      <Stack.Screen name="appliance" options={{ title: 'Appliance' }} />
      <Stack.Screen
        name="appliance-log"
        options={{ title: 'Appliance Log' }}
      />
      <Stack.Screen
        name="record-detail"
        options={{ title: 'Record Detail' }}
      />
    </Stack>
  );
}
