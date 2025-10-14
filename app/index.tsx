import { useAuth } from "@/src/contexts/AuthContext";
import { Redirect } from "expo-router";

export default function Index() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  if (user) {
    return <Redirect href="/(tabs)/home" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}
