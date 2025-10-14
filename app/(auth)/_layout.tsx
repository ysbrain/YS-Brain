import { useAuth } from '@/src/contexts/AuthContext';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function AuthLayout() {
  const { user, initializing } = useAuth();
  const router = useRouter();

  if (initializing) return null; // splash/loading
  
  useEffect(() => {
    if (user) {
      router.replace("../(tabs)/home");
    }
  }, [user, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#002E5D'},
        headerTintColor: '#fff',
        headerTitleStyle: {
                    fontSize: 36,
                    fontWeight: 'bold',
                  },
      }}
    >
      <Stack.Screen name="login" options={{ title: "YS Brain" }} />
    </Stack>
  );
}
