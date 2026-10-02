// app/(tabs)/_layout.tsx

import { useAuth } from '@/src/contexts/AuthContext';
import { ProfileProvider } from '@/src/contexts/ProfileContext';
import { useUserProfile } from '@/src/hooks/useUserProfile';

import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function TabsLayout() {
  const { user, initializing } = useAuth();
  const { profile, loading: profileLoading, error } = useUserProfile();
  const router = useRouter();

  // Hooks must run before any conditional return.
  useEffect(() => {
    if (!initializing && !user) {
      router.replace('/(auth)/login');
    }
  }, [initializing, user, router]);

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // Prevent the tabs from briefly rendering before redirect.
  if (!user) {
    return null;
  }

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.message}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Error loading profile: {error.message}
        </Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No profile found.</Text>
      </View>
    );
  }

  return (
    <ProfileProvider profile={profile}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#ffd33d',
          tabBarInactiveTintColor: '#ffffff',
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
    </ProfileProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 8,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    color: '#B00020',
    fontWeight: '600',
    textAlign: 'center',
  },
});
