import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from "../contexts/AuthContext";

SplashScreen.preventAutoHideAsync(); // Keep the splash screen visible while we fetch resources

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
