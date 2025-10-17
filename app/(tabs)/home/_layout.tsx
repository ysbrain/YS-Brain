import { useUserProfile } from '@/src/data/hooks/useUserProfile';
import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

export default function HomeLayout() {
  const { profile, loading, error } = useUserProfile();

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!profile) return <Text>No profile found.</Text>;
  
  return (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="index" options={{ title: 'Hello - ' + profile.name + '!' }} />
    </Stack>
  );
}
