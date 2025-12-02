import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBQX4kUaJ9cMNRX08xE39OFljbX5hR9Fa0",
  authDomain: "ys-brain-16ad9.firebaseapp.com",
  projectId: "ys-brain-16ad9",
  storageBucket: "ys-brain-16ad9.firebasestorage.app",
  messagingSenderId: "917202774723",
  appId: "1:917202774723:web:600ce4324bf58362579076",
  databaseURL: "https://ys-brain-16ad9-default-rtdb.asia-southeast1.firebasedatabase.app",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
