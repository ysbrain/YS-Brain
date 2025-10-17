import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
  WithFieldValue,
} from 'firebase/firestore';
import type { UserProfile } from './profile.types';

// Firestore storage shape (timestamps are Firestore Timestamp)
type UserProfileDoc = Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(model: WithFieldValue<UserProfile>): DocumentData {
    const { createdAt, updatedAt, ...rest } = model as any;

    // Pass through serverTimestamp() if provided, else convert Date
    const toTs = (v: unknown) => {
      // serverTimestamp() is a FieldValue; we pass it through
      if (v && typeof v === 'object' && !('getTime' in (v as any))) {
        return v; // likely FieldValue (e.g., serverTimestamp())
      }
      return v instanceof Date ? Timestamp.fromDate(v) : v;
    };

    return {
      ...rest,
      ...(createdAt !== undefined && { createdAt: toTs(createdAt) }),
      ...(updatedAt !== undefined && { updatedAt: toTs(updatedAt) }),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): UserProfile {
    const data = snapshot.data(options) as UserProfileDoc;
    return {
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    };
  },
};
