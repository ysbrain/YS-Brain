// app/_layout.tsx

import GlobalUiLockOverlay from '@/src/components/GlobalUiLockOverlay';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { UiLockProvider } from '@/src/contexts/UiLockContext';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UiLockProvider>
          <>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#f0fff4ff' },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>

            <GlobalUiLockOverlay />
          </>
        </UiLockProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
