import { fetchMyProfileOnce, UserProfile } from '@/src/features/profile/profile.read';
import { commonStackOptions } from '@/src/lib/stackOptions';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

export default function HomeLayout() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // One-time fetch (fast initial data)
      try {
        const p = await fetchMyProfileOnce();
        setProfile(p);
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }    
    })();
  }, []);
  if (loading) return <ActivityIndicator />;
  if (!profile) return <Text>No profile found.</Text>;
  
  return (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="index" options={{ title: 'Hello - ' + profile.name + '!' }} />
    </Stack>
  );
}
