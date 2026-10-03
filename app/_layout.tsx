// app/_layout.tsx

import GlobalUiLockOverlay from '@/src/components/ui-lock/GlobalUiLockOverlay';
import { AlertProvider } from '@/src/contexts/AlertContext';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { UiLockProvider } from '@/src/contexts/UiLockContext';
import { registerServiceWorker } from '@/src/registerServiceWorker';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <>
      <Head>
        <title>YS Brain</title>

        <meta
          name="theme-color"
          content="#22c55e"
        />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <meta
          name="mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-title"
          content="YS Brain"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />

        <link
          rel="manifest"
          href="/manifest.json"
        />

        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
        />

        <link
          rel="icon"
          href="/icon-192.png"
        />
      </Head>

      <SafeAreaProvider>
        <AuthProvider>
          <UiLockProvider>
            <AlertProvider>
              <>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: {
                      backgroundColor: '#f0fff4ff',
                    },
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                </Stack>

                <GlobalUiLockOverlay />
              </>
            </AlertProvider>
          </UiLockProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </>
  );
}
