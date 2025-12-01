import { db } from '@/src/lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

export async function fetchServerNowViaFirestore(): Promise<Date> {
  const tdoc = doc(db, '_time', 'now'); // /_time/now
  await setDoc(tdoc, { serverNow: serverTimestamp() }, { merge: true });
  const snap = await getDoc(tdoc);
  const ts = snap.data()?.serverNow as Timestamp | undefined;
  if (!ts) {
    // Retry once if unresolved (rare race condition)
    const retrySnap = await getDoc(tdoc);
    const retryTs = retrySnap.data()?.serverNow as Timestamp | undefined;
    if (retryTs) {
      return retryTs.toDate();
    } else {
      console.warn('fetchServerNowViaFirestore: serverNow timestamp missing after retry');
      return new Date(); // final fallback
    }
  }
  return ts.toDate();
}
