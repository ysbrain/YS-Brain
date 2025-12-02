import { rtdb } from '@/src/lib/firebase';
import { onValue, ref } from 'firebase/database';

/** Get the current server time using RTDB's .info/serverTimeOffset via onValue() */
export async function getServerTime(): Promise<Date> {
  const serverOffsetRef = ref(rtdb, '.info/serverTimeOffset');

  return new Promise<Date>((resolve) => {
    // Optional: safety timeout in case the listener never fires (offline, etc.)
    const timeoutMs = 5000;
    const timeoutId = setTimeout(() => {
      console.warn('Timed out getting server time; falling back to device time');
      resolve(new Date());
    }, timeoutMs);

    onValue(
      serverOffsetRef,
      (snap) => {
        clearTimeout(timeoutId);
        const offset = (snap.val() as number) ?? 0;
        resolve(new Date(Date.now() + offset)); // device now + server-provided offset
      },
      (error) => {
        clearTimeout(timeoutId);
        console.warn('Failed to get server time; falling back to device time', error);
        resolve(new Date()); // fallback only if RTDB unavailable
      },
      { onlyOnce: true } // ensures this is a one-time read (no persistent listener)
    );
  });
}
