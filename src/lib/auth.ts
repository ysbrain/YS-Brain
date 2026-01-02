import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { app } from "./firebase";

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
