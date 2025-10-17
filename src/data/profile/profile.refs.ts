import { db } from '@/src/lib/firebase';
import { doc } from 'firebase/firestore';
import { userProfileConverter } from './profile.converter';

export const userProfileRef = (uid: string) =>
  doc(db, 'users', uid).withConverter(userProfileConverter);

export const myProfileRef = (uid: string) => userProfileRef(uid);
