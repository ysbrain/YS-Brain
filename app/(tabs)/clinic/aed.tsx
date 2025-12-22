import { useProfile } from '@/src/contexts/ProfileContext';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
// Reusable Date component (format: "21 Oct 2025")
import DateText from '@/src/components/DateText';
// Firestore
import { db } from '@/src/lib/firebase'; // your initialized Firestore
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

type ResultOption = 'PASS' | 'FAIL' | null;

// For "Last uploaded time" display
function formatDateTime(d: Date, timeZone = 'Asia/Hong_Kong') {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone
    })
      .format(d)
      .replace(/,/g, '');
  } catch {
    return `${d.toDateString()} ${d.toTimeString().slice(0, 8)}`;
  }
}

export default function AedScreen() {
  const router = useRouter();
  const profile = useProfile();
  
  const [result, setResult] = useState<ResultOption>(null);

  // ⏱️ Last uploaded time — now driven by the newest doc in the collection
  const [lastUploadedAt, setLastUploadedAt] = useState<Date | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Upload: require results + photo
  const canUpload = Boolean(result);

  // 🔁 Subscribe to the newest entry (by createdAt DESC, LIMIT 1)
  useEffect(() => {
    const col = collection(db, 'clinics', profile.clinic, 'aed');
    const q = query(col, orderBy('createdAt', 'desc'), limit(1));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setLastUploadedAt(null);
        } else {
          const data = snap.docs[0].data();
          const ts = data?.createdAt as Timestamp | undefined;
          setLastUploadedAt(ts ? ts.toDate() : null);
        }
        setLoadingStatus(false);
      },
      (err) => {
        console.warn('Failed to load latest upload time', err);
        setLoadingStatus(false);
      }
    );
    return unsubscribe;
  }, []);

  const handleUpload = async () => {
    if (!canUpload) {
      const reasons: string[] = [];      
      if (!result) reasons.push('Select Result (PASS or FAIL).');
      Alert.alert('Upload disabled', reasons.join('\n'));
      return;
    }

    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in before uploading.');
      return;
    }

    try {
      const entriesRef = collection(db, 'clinics', profile.clinic, 'aed');
      await addDoc(entriesRef, {
        username: profile?.name ?? null,
        userID: user.uid,
        clinic: profile?.clinic ?? null,
        result: result === 'PASS',
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error(e);
    }

    router.back();
  };

  const openLogs = () => {
    router.push('/clinic/logs');
  };

  if (!profile) return <Text>No profile found.</Text>;

  return (
    /* Content area: sticks to top below header */
    <View style={styles.container}>
      <View style={styles.content}>

        {/* ✅ Header row: Date (left) + Profile (right) */}
        <View style={styles.headerRow}>
          <DateText style={styles.label} />
          {profile ? (
            <Text style={styles.profileRight} numberOfLines={1}>
              {profile.clinic} - {profile.name}
            </Text>
          ) : (
            <Text style={styles.profileRight}>Loading profile…</Text>
          )}
        </View>

        {/* Result selector with a vertical separator */}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>AED:</Text>
          <View style={styles.segment}>
            {(['PASS', 'FAIL'] as const).map((opt, idx) => {
              const selected = result === opt;
              const withDivider = idx === 0; // add separator after first (between PASS and FAIL)
              return (
                <Pressable
                  key={opt}
                  onPress={() => setResult(opt)}
                  style={[
                    styles.segmentBtn,
                    withDivider && styles.segmentBtnDivider,
                    selected && styles.segmentBtnSelected,
                  ]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={handleUpload}
          disabled={!canUpload}
          style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
        >
          < Text style={styles.uploadBtnText}>Upload</Text>
        </Pressable>
      </View>

      {/* Footer stays at bottom: Upload button + Last uploaded */}
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={openLogs}>
          <Text style={styles.primaryBtnText}>Logs</Text>
        </Pressable>

        <View style={styles.lastRow}>
          <Text style={styles.lastLabel}>Last uploaded:</Text>
          {loadingStatus ? (
            <Text style={styles.lastValue}>Loading…</Text>
          ) : lastUploadedAt ? (
            <Text style={styles.lastValue}>{formatDateTime(lastUploadedAt)}</Text>
          ) : (
            <Text style={styles.lastValue}>No uploads yet</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Page layout: content at top, footer at bottom
  container: { flex: 1, paddingHorizontal: 16 },
  content: { paddingTop: 16, gap: 16 }, // starts right below header
  footer: { marginTop: 'auto', paddingTop: 12, paddingBottom: 12, gap: 8 },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },

  label: { fontSize: 18, color: '#444' },
  profileRight: {
    fontSize: 16,
    color: '#444',
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1
  },

  // Result selector with separator
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultLabel: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
  segmentBtnSelected: { backgroundColor: '#007AFF22' },
  segmentBtnDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#ddd' },
  segmentText: { fontSize: 16, color: '#333' },
  segmentTextSelected: { fontWeight: 'bold', color: '#007AFF' },

  // Buttons
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Footer controls
  uploadBtn: {
    marginTop: 12,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  uploadBtnDisabled: { backgroundColor: '#bbb' },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastLabel: { fontSize: 12, color: '#666' },
  lastValue: { fontSize: 12, color: '#333' }
});
