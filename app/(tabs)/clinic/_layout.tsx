import { Stack } from 'expo-router';

export default function clinicLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'B' }} />
      <Stack.Screen name="sterilizer" options={{ title: 'B2' }} />
    </Stack>
  );
}
