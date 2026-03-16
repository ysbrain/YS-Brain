// app/(tabs)/_layout.tsx

import { useAuth } from '@/src/contexts/AuthContext';
import { UiLockProvider, useUiLock } from '@/src/contexts/UiLockContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';

function TabsWithOverlay() {
  const { uiLocked } = useUiLock();
  
  useEffect(() => {
    if (Platform.OS !== 'android' || !uiLocked) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [uiLocked]);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#ffd33d',
          // tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: '#102E5C',
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home-sharp' : 'home-outline'}
                color={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="clinic"
          options={{
            headerShown: false,
            tabBarLabel: 'Clinic',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'storefront-sharp' : 'storefront-outline'}
                color={color}
                size={24}
              />
            ),
            // popToTopOnBlur: true,
          }}
        />

        <Tabs.Screen
          name="calendar"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'calendar-sharp' : 'calendar-outline'}
                color={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'settings-sharp' : 'settings-outline'}
                color={color}
                size={24}
              />
            ),
          }}
        />
      </Tabs>

      {uiLocked && (
        <View style={styles.globalBlockingOverlay} pointerEvents="auto">
          <View style={styles.globalBlockingCard}>
            <ActivityIndicator size="large" color="#111" />
            <Text style={styles.globalBlockingTitle}>Saving record…</Text>
            <Text style={styles.globalBlockingText}>
              Please wait. Uploading may take a few seconds.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { user, initializing } = useAuth();
  const router = useRouter();

  if (initializing) return null; // splash/loading
  if (!user) return null; // prevent rendering tabs before redirect

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user, router]);

  return (
    <UiLockProvider>
      <TabsWithOverlay />
    </UiLockProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  globalBlockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalBlockingCard: {
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
  globalBlockingTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },
  globalBlockingText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
});
