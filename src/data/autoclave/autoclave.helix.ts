import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';

export const db = getFirestore();

// Utility: create a local date key anchored to your business timezone
export function makeDateKey(timeZone = 'Asia/Shanghai') {
  const parts = new Intl.DateTimeFormat('en-CA', { // yields YYYY-MM-DD
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`; // e.g., "2025-10-23"
}

export async function logHelixTest(params: {
  result: boolean;
  username: string;
  cycleNumber: number;
  photoUrl?: string;
}) {
  const { result, username, cycleNumber, photoUrl } = params;

  const docData = {
    result,
    username,
    cycleNumber,
    photoUrl: photoUrl ?? null,
    createdAt: serverTimestamp(), // server-side time
    dateKey: makeDateKey('Asia/Shanghai'),
  };

  const ref = await addDoc(collection(db, 'clinics/clinic001/helix1'), docData);
  return ref.id;
}
