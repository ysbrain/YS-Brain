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
      <Stack screenOptions={commonStackOptions}>
        <Stack.Screen name="index" options={{ title: profile.clinic }} />
        <Stack.Screen
          name="autoclave"        
          options={({ route }) => {
            return { title: (route.params as any)?.selected ?? 'Autoclave' };
          }}
        />
        <Stack.Screen name="helix" options={{ title: 'Helix Test' }} />
        <Stack.Screen name="sterilizer" options={{ title: 'Sterilizer' }} />
      </Stack>
    </SafeAreaProvider>    
  );
}
