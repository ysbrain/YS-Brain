import { ProfileProvider } from '@/src/contexts/ProfileContext';
import { useUserProfile } from '@/src/data/hooks/useUserProfile';
import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
    <SafeAreaProvider>
      <ProfileProvider profile={profile}>
        <Stack screenOptions={commonStackOptions}>
          <Stack.Screen name="index" options={{ title: 'Clinic 01' }} />                    
          <Stack.Screen
            name="autoclave/index"
            options={({ route }) => ({
              title: (route.params as any)?.title ?? 'Autoclave',
            })}
          />
          <Stack.Screen
            name="autoclave/helix"
            options={({ route }) => {
              const p = route.params as any;
              const recordId = `${p?.recordType ?? ""}${p?.equipmentId ?? ""}`;
              return {
                title: "Helix Test",
                headerRight: () =>
                  recordId ? <LogsHeaderButton recordId={recordId} /> : null,
              };
            }}
          />
          <Stack.Screen name="autoclave/helix-photos" options={{ title: 'Helix Test' }} />
          <Stack.Screen
            name="autoclave/spore"
            options={({ route }) => {
              const p = route.params as any;
              const recordId = `${p?.recordType ?? ""}${p?.equipmentId ?? ""}`;
              return {
                title: "Spore Test",
                headerRight: () =>
                  recordId ? <LogsHeaderButton recordId={recordId} /> : null,
              };
            }}
          />          
          <Stack.Screen
            name="temperature"
            options={({ route }) => {
              const params = route.params as { equipmentId?: string } | undefined;
              const equipmentId = params?.equipmentId;
              const recordId = equipmentId ? `temperature${equipmentId}` : null;
              return {
                title: "Temperature",
                headerRight: () =>
                  recordId ? <LogsHeaderButton recordId={recordId} /> : null,
              };
            }}
          />
          <Stack.Screen
            name="ultrasonic"
            options={{
              title: "Ultrasonic",
              headerRight: () => <LogsHeaderButton recordId="ultrasonic" />,
            }}
          />          
          <Stack.Screen
            name="aed"
            options={{
              title: "AED",
              headerRight: () => <LogsHeaderButton recordId="aed" />,
            }}
          />
          <Stack.Screen name="logs/index" options={{ title: 'Logs' }} />
          <Stack.Screen name="logs/[docId]" options={{ title: "Log Details" }} />
        </Stack>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
