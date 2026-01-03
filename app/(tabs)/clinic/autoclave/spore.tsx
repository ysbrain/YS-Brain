import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
// Reusable Date component (format: "21 Oct 2025")
import DateText from '@/src/components/DateText';
// Firestore
import { db } from '@/src/lib/firebase'; // your initialized Firestore
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
// Time picker
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

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

// Format time strictly as HH:mm (24-hour, locale-independent)
function toHHmm(d: Date) {
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function SporeScreen() {
  const router = useRouter();
  const profile = useProfile();
  const { user } = useAuth();
  const { recordType, equipmentId, cycleString } = useLocalSearchParams<{ recordType: string; equipmentId: string; cycleString: string }>();
  const recordId = `${recordType}${equipmentId}`;
  const cycleNumber = parseInt(cycleString, 10) || 0;
  
  const [result, setResult] = useState<ResultOption>(null);
  
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState<Date>(() => new Date()); // default current time
  const [activeTimePicker, setActiveTimePicker] = useState<null | 'start' | 'end'>(null);

  const onTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android: closes automatically; iOS: keep open until Done
    if (event.type === 'dismissed') {
      setActiveTimePicker(null);
      return;
    }
    if (selected) {
      if (activeTimePicker === 'start') setStartTime(selected);
      if (activeTimePicker === 'end') setEndTime(selected);
    }
    if (Platform.OS === 'android') setActiveTimePicker(null);
  };  

  // ⏱️ Last uploaded time — now driven by the newest doc in the collection
  const [lastUploadedAt, setLastUploadedAt] = useState<Date | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  
  // Upload: require results
  const [uploading, setUploading] = useState(false);
  const canUpload = Boolean(result) && cycleNumber > 0;

  // 🔁 Subscribe to the newest entry (by createdAt DESC, LIMIT 1)
  useEffect(() => {
    if (!profile?.clinic || !recordId) return;

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
  }, [profile?.clinic, recordId]);

  const handleUpload = async () => {    
    if (!result) {
      Alert.alert('Upload disabled', 'Select Result (PASS or FAIL).');
      return;
    }
  
    if (!user) return;
      
    try {
      setUploading(true);

      const entriesRef = collection(db, 'clinics', profile.clinic, recordId);
      const newEntryRef = doc(entriesRef);
      
      const cycleDocRef = doc(db, 'clinics', profile!.clinic, `autoclave${equipmentId}`, 'cycle');
      
      const batch = writeBatch(db);      
      batch.set(newEntryRef, {
        username: profile?.name ?? null,
        userID: user.uid,
        clinic: profile?.clinic ?? null,
        cycleNumber,
        timeStarted: toHHmm(startTime),
        timeEnded: toHHmm(endTime),
        result: result === 'PASS',
        createdAt: serverTimestamp(),
      });

      batch.set(
        cycleDocRef,
        { cycleCount: cycleNumber, updatedAt: serverTimestamp() },
        { merge: true }
      );

      await batch.commit();

      // Completed message, then go back when dismissed
      Alert.alert(
        'Completed',
        'Spore test result uploaded successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
        {
          cancelable: false, // prevents dismiss by tapping outside / back button
        }
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openLogs = () => {
    router.push('/clinic/logs');
  };

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

        {/* Cycle */}
        <Text style={styles.value}>Cycle Number: {cycleNumber}</Text>

        {/* Start/End Time rows */}
        <View style={styles.timeRowTwo}>
          <View style={styles.timeGroup}>
            <Text style={styles.timeLabel}>Start Time:</Text>
            <Pressable style={styles.timeBtn} onPress={() => setActiveTimePicker('start')}>
              <Text style={styles.timeBtnText}>{toHHmm(startTime)}</Text>
            </Pressable>
          </View>

          <View style={styles.timeGroup}>
            <Text style={styles.timeLabel}>End Time:</Text>
            <Pressable style={styles.timeBtn} onPress={() => setActiveTimePicker('end')}>
              <Text style={styles.timeBtnText}>{toHHmm(endTime)}</Text>
            </Pressable>
          </View>
        </View>

        {/* Android picker (native modal) */}
        {Platform.OS === 'android' && activeTimePicker !== null && (
          <DateTimePicker
            value={activeTimePicker === 'start' ? startTime : endTime}
            mode="time"
            is24Hour
            display="default"
            onChange={onTimeChange}
          />
        )}

        {/* iOS picker (custom modal with Done) */}
        {Platform.OS === 'ios' && (
          <Modal visible={activeTimePicker !== null} transparent animationType="fade">
            <View style={styles.pickerBackdrop}>
              <View style={styles.pickerSheet}>
                <View style={styles.accessoryBar}>
                  <Pressable style={styles.accessoryBtn} onPress={() => setActiveTimePicker(null)}>
                    <Text style={styles.accessoryBtnText}>Done</Text>
                  </Pressable>
                </View>
                <View style={styles.pickerInner}>
                  <DateTimePicker
                    value={activeTimePicker === 'start' ? startTime : endTime}
                    mode="time"
                    is24Hour
                    display="spinner"
                    onChange={onTimeChange}
                    style={styles.iosTimePicker}
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}
          
        {/* Result selector with a vertical separator */}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Result:</Text>
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

        {/* Upload button */}
        <Pressable
          onPress={handleUpload}
          disabled={!canUpload}
          style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
        >          
          <Text style={styles.uploadBtnText}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Text>
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
