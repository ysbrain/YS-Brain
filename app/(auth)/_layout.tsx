import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#002E5D'},
        headerTintColor: '#fff',
        headerTitle: "YS Brain",
        headerTitleStyle: {
                    fontSize: 24,
                    fontWeight: 'bold',
                  },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign In" }} />
      <Stack.Screen name="signup" options={{ title: "Create Account" }} />
    </Stack>
  );
}
