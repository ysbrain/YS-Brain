import { Redirect } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";

export default function Index() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  console.log("User on Index page:");

  if (user) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}
