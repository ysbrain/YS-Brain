import { ProfileProvider } from '@/src/contexts/ProfileContext';
import { useUserProfile } from '@/src/data/hooks/useUserProfile';
import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function ClinicLayout() {
  const { profile, loading, error } = useUserProfile();

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!profile) return <Text>No profile found.</Text>;

  return (
    <SafeAreaProvider>
      <ProfileProvider profile={profile}>
        <Stack screenOptions={commonStackOptions}>
          <Stack.Screen name="index" options={{ title: 'Clinic 01' }} />                    
          <Stack.Screen
            name="autoclave/index"
            options={({ route }) => ({
              title: (route.params as any)?.equipment ?? 'Autoclave',
            })}
          />
          <Stack.Screen name="autoclave/helix" options={{ title: 'Helix Test' }} />
          <Stack.Screen name="autoclave/helix-photos" options={{ title: 'Helix Test' }} />
          <Stack.Screen name="autoclave/spore" options={{ title: 'Spore Test' }} />
          <Stack.Screen name="temperature" options={{ title: 'Temperature' }} />
          <Stack.Screen name="ultrasonic" options={{ title: 'Ultrasonic' }} />
          <Stack.Screen name="aed" options={{ title: 'AED' }} />
          <Stack.Screen name="logs" options={{ title: 'Logs' }} />
        </Stack>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
