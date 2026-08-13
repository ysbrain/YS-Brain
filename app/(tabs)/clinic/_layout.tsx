import { ProfileProvider } from '@/src/contexts/ProfileContext';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

export default function ClinicLayout() {
  const { profile, loading, error } = useUserProfile();

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!profile) return <Text>No profile found.</Text>;

  return (
    <ProfileProvider profile={profile}>
      <Stack screenOptions={commonStackOptions}>
        <Stack.Screen name="index" options={{ title: 'Clinic 01' }} />
        <Stack.Screen name="room/[roomId]" />
        <Stack.Screen name="autoclave" options={{ title: 'Autoclave' }} />
        <Stack.Screen name="appliance" options={{ title: 'Appliance' }} />
        <Stack.Screen name="appliance-log" options={{ title: 'Appliance Log' }} />
        <Stack.Screen name="record-detail" options={{ title: 'Record Detail' }} />
      </Stack>
    </ProfileProvider>
  );
}
