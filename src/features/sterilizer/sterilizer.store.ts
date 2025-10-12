import {
  addDoc,
  collection,
  doc,
  getDoc, onSnapshot, query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth } from '../../lib/auth';
import { db } from '../../lib/firebase';

// Collection reference
const sterilizerColl = collection(db, 'sterilizer');

/**
 * Create a new sterilizer document.
 * Fields: label (string), active (boolean), timestamps set by server.
 * Returns the new document ID.
 */
export async function createSterilizer(indicator: number) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  // If using per-user rules, include ownerUid.
  const docRef = await addDoc(sterilizerColl, {
    indicator,
    startStaff: user.uid,
    startTime: serverTimestamp(),
  });
  return docRef.id;
}
// addDoc/setDoc/updateDoc and serverTimestamp are standard Firestore operations. [5](https://firebase.google.com/docs/firestore/manage-data/add-data)[1](https://cloud.google.com/firestore/native/docs/manage-data/add-data)[2](https://stackoverflow.com/questions/51846914/add-timestamp-in-firestore-documents)

/**
 * Update some fields of an existing sterilizer document.
 */
export async function updateSterilizer(docId: string, partial: Partial<{ label: string; pass: boolean; indicator: number }>) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  // Optional: if you want to enforce ownership at the app layer,
  // fetch and check ownerUid before updating:
  // const snap = await getDoc(doc(sterilizerColl, docId));
  // if (!snap.exists() || snap.data().ownerUid !== user.uid) throw new Error('Not owner');

  await updateDoc(doc(sterilizerColl, docId), {
    ...partial,
    endStaff: user.uid,
    endTime: serverTimestamp(),
  });
}
// updateDoc performs partial updates; serverTimestamp marks server-side time. [1](https://cloud.google.com/firestore/native/docs/manage-data/add-data)[2](https://stackoverflow.com/questions/51846914/add-timestamp-in-firestore-documents)

/** Get a single doc once */
export async function getSterilizer(docId: string) {
  const snap = await getDoc(doc(sterilizerColl, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
// getDoc retrieves one document a single time. [6](https://firebase.google.com/docs/firestore/query-data/get-data)

/** Subscribe to my sterilizer docs (per-user) */
export function subscribeSterilizers(onData: (rows: any[]) => void) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const q = query(sterilizerColl, where('ownerUid', '==', user.uid));
  return onSnapshot(q, (qs) => {
    onData(qs.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
// onSnapshot provides realtime updates; initial snapshot + updates thereafter. [7](https://firebase.google.com/docs/firestore/query-data/listen)