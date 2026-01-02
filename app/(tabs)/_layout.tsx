import { useAuth } from '@/src/contexts/AuthContext';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabsLayout() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  
  if (initializing) return null; // splash/loading
  if (!user) return null; // prevent rendering tabs before redirect

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login");
    }
  }, [user, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ffd33d',
        tabBarStyle: {
          backgroundColor: '#002E5D',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Hello, ',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),          
        }}
      />
      <Tabs.Screen
        name="clinic"
        options={{
          headerShown: false,
          tabBarLabel: 'Clinic',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'storefront-sharp' : 'storefront-outline'} color={color} size={24}/>
          ),
          // popToTopOnBlur: true,
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
