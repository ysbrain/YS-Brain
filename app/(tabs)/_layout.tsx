import { useAuth } from '@/src/contexts/AuthContext';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { fetchMyProfileOnce, UserProfile } from '../../src/features/profile/profile.read';

import Ionicons from '@expo/vector-icons/Ionicons';


export default function TabLayout() {
  const { user, initializing } = useAuth();  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  
  if (initializing) return null; // splash/loading

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login");
    }
  }, [user, router]);

  
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      // One-time fetch (fast initial data)
      const p = await fetchMyProfileOnce();
      setProfile(p);
      setLoading(false);
    })();

    return () => { if (unsub) unsub(); };
  }, []);

  if (loading) return <ActivityIndicator />;
  if (!profile) return <Text>No profile found.</Text>;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerStyle: {
          backgroundColor: '#002E5D',
          height: 120,
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 36,
        },
        tabBarStyle: {
          backgroundColor: '#002E5D',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hello, ' + profile.name + '!',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="clinic"
        options={{
          title: 'Clinic - ' + (profile.clinic || ''),
          tabBarLabel: 'Clinic',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'storefront-sharp' : 'storefront-outline'} color={color} size={24}/>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar-sharp' : 'calendar-outline'} color={color} size={24}/>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings-sharp' : 'settings-outline'} color={color} size={24}/>
          ),
        }}
      />
    </Tabs>
  );
}
