import { useAuth } from '@/src/contexts/AuthContext';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';


export default function TabLayout() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  
  if (initializing) return null; // splash/loading

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login");
    }
  }, [user, router]);

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
          title: 'Hello, ' + '!',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="clinic"
        options={{
          title: 'Clinic - 001',
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
