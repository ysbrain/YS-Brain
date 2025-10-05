import { doc, getDoc } from 'firebase/firestore';
import { auth } from '../../lib/auth';
import { db } from '../../lib/firebase';

export type UserProfile = {
  ysid: string;
  email: string | null;
  name?: string | null;
  gender?: 'male' | 'female' | 'nonbinary' | 'prefer_not_to_say' | null;
  photoURL?: string | null;
  clinic?: string | null;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any;
};

/** Fetch the current user's profile document once */
export async function fetchMyProfileOnce(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref); // one-time read
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
