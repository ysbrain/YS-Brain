import { useProfile } from '@/src/contexts/ProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function TemperatureScreen() {
  const router = useRouter();
  const profile = useProfile();
  const equipmentId = useLocalSearchParams<{ equipmentId: string }>().equipmentId;
  const recordId = `temperature${equipmentId}`;
  const [cycleNumber, setCycleNumber] = useState<number>(0);

  // ⏱️ Last uploaded time — now driven by the newest doc in the collection
  const [lastUploadedAt, setLastUploadedAt] = useState<Date | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Upload: require results
  const canUpload = Boolean(cycleNumber > 0);

  // 🔁 Subscribe to the newest entry (by createdAt DESC, LIMIT 1)
  useEffect(() => {
    const col = collection(db, 'clinics', profile.clinic, recordId);
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
      Alert.alert('Upload disabled');
      return;
    }

    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in before uploading.');
      return;
    }

    try {      
      // Create Firestore document      
      const entriesRef = collection(db, 'clinics', profile.clinic, 'ultrasonic');
      await addDoc(entriesRef, {
        username: profile?.name ?? null,
        userID: user.uid,
        clinic: profile?.clinic ?? null,
        temperature: cycleNumber,
        createdAt: serverTimestamp(),
      });       
    } catch (e: any) {
      console.error(e);
    }
  };

  const openLogs = () => {
    router.push('/clinic/logs');
  };

  if (!profile) return <Text>No profile found.</Text>;

  return (
    <View>
      {/* Content area: sticks to top below header */}
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
  
          <Pressable
            onPress={handleUpload}
            disabled={!canUpload}
            style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
          >
            <Text style={styles.uploadBtnText}>Upload</Text>
          </Pressable>
  
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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

  value: { fontSize: 18, fontWeight: 'bold' },

  // Time rows
  timeRowTwo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  // Each (label + button) group
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  timeBtn: {
    minWidth: 88,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  timeBtnText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '700',
  },

  // Accessory bar (iOS)
  accessoryBar: {
    backgroundColor: '#F2F2F2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end'
  },
  accessoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6
  },
  accessoryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // iOS time picker modal visuals  
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',          // centers the sheet horizontally
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 420,                 // important on iPad: prevents huge sheet
    alignSelf: 'center',           // ensure it centers in the backdrop
    backgroundColor: '#fff',
    paddingTop: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  pickerInner: {
    alignItems: 'center',          // centers the picker control itself
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iosTimePicker: {    
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  
  // Mechanical Indicator vertical block
  mechanicalBlock: {
    gap: 8,
  },
  mechanicalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  // Vertical segmented container
  segmentColumn: {
    flexDirection: 'column',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  // Each row button (full width)
  segmentBtnColumn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Horizontal divider between rows
  segmentBtnDividerHorizontal: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },

  // Result selector with separator
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 130,   // helps align both rows
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

  // Photo
  photoSection: { gap: 12 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#eee' },

  // Buttons
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderColor: '#007AFF',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  secondaryBtnText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },

  // Footer controls
  uploadBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  uploadBtnDisabled: { backgroundColor: '#bbb' },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastLabel: { fontSize: 12, color: '#666' },
  lastValue: { fontSize: 12, color: '#333' },

  // Camera modal
  modalSafe: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },

  // Overlay
  overlayWrap: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.35)' },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 8
  },

  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#222' },
  cancelText: { color: '#fff', fontSize: 16 },
  shutterBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#007AFF' },
  shutterText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  btnDisabledText: { color: '#9aa0a6' }
});
