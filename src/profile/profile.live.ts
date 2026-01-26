import { auth } from '@/src/lib/auth';
import { onSnapshot, Unsubscribe } from 'firebase/firestore';
import { myProfileRef } from './profile.refs';
import type { UserProfile } from './profile.types';

/** Subscribe to the current user's profile for live updates */
export function subscribeMyProfile(
  next: (profile: UserProfile | null) => void,
  error?: (err: Error) => void
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const ref = myProfileRef(user.uid);
  return onSnapshot(
    ref,
    (snap) => next(snap.exists() ? snap.data() : null),
    (err) => error?.(err as Error)
  );
}
