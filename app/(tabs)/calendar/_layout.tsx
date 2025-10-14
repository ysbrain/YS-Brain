import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';

export default function CalendarLayout() {
  return (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="index" options={{ title: 'Calendar' }} />
    </Stack>
  );
}
