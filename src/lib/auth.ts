import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth } from 'firebase/auth';
import { app } from './firebase';

// runtime: grab the function even if TS doesn't list it
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
