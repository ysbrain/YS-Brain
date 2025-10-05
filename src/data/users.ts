import { addDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function addSampleUserRecord(uid: string) {
  return addDoc(collection(db, 'users', uid, 'notes'), {
    title: 'Hello Firestore',
    createdAt: Date.now(),
  });
}

export function subscribeMyNotes(uid: string, cb: (items: any[]) => void) {
  const q = query(collection(db, 'users', uid, 'notes'));
  return onSnapshot(q, (snaps) => {
    cb(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
