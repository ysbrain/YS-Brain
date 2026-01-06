import { ProfileProvider } from '@/src/contexts/ProfileContext';
import { useUserProfile } from '@/src/data/hooks/useUserProfile';
import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';

const LogsHeaderButton = ({ recordId }: { recordId: string }) => {
  const router = useRouter();

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/clinic/logs",
          params: { recordId },
        })
      }
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}
      hitSlop={10}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>Logs</Text>
    </Pressable>
  );
};

export default function ClinicLayout() {
  const { profile, loading, error } = useUserProfile();

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!profile) return <Text>No profile found.</Text>;

  return (
    <ProfileProvider profile={profile}>
      <Stack screenOptions={commonStackOptions}>
        <Stack.Screen name="index" options={{ title: 'Clinic 01' }} /> 
      </Stack>
    </ProfileProvider>
  );
}
