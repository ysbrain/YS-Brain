import { auth } from '@/src/lib/auth';
import { db } from '@/src/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import * as React from 'react';
import { userProfileConverter } from '../profile/profile.converter';
import type { UserProfile } from '../profile/profile.types';

type UseUserProfileResult = {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
};

export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setError(new Error('No authenticated user'));
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', user.uid).withConverter(userProfileConverter);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? snap.data()! : null); // createdAt/updatedAt are Date
        setLoading(false);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { profile, loading, error };
}
