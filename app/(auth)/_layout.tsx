import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AuthLayout() {
  const { user, initializing } = useAuth();
  const router = useRouter();

  if (initializing) return null; // splash/loading
  
  useEffect(() => {
    if (user) {
      router.replace("/(tabs)");
    }
  }, [user, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#002E5D'},
        headerTintColor: '#fff',
        title: "YS Brain",
        headerTitleStyle: {
                    fontSize: 24,
                    fontWeight: 'bold',
                  },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
    </Stack>
  );
}
