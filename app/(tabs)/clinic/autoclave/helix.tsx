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
import { SafeAreaView } from 'react-native-safe-area-context';
// Reusable Date component (format: "21 Oct 2025")
import DateText from '@/src/components/DateText';
// Firestore
import { db } from '@/src/lib/firebase'; // your initialized Firestore
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp
} from 'firebase/firestore';
// Time picker
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type IndicatorOption = '134°C - 4min' | '121°C - 20min';
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

// 🔎 small helpers
const guessContentType = (uri: string) => {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
};

export default function HelixScreen() {
  const router = useRouter();
  const profile = useProfile();
  const { recordType, equipmentId, cycleString } = useLocalSearchParams<{ recordType: string; equipmentId: string; cycleString: string }>();
  const recordId = `${recordType}${equipmentId}`;
  const cycleNumber = parseInt(cycleString, 10) || 0;
  
  const [indicator, setIndicator] = useState<IndicatorOption>('134°C - 4min');
  const [resultInt, setResultInt] = useState<ResultOption>(null);
  const [resultExt, setResultExt] = useState<ResultOption>(null);
  
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
  
  const canProceed = Boolean(indicator && resultInt && resultExt && cycleNumber > 0);

  const goToPhotoScreen = () => {
    if (!canProceed) {
      const reasons: string[] = [];
      if (!resultInt) reasons.push('Select Internal Result (PASS or FAIL).');
      if (!resultExt) reasons.push('Select External Result (PASS or FAIL).');
      if (!cycleNumber || cycleNumber <= 0) reasons.push('Invalid cycle number.');
      Alert.alert('Continue disabled', reasons.join('\n'));
      return;
    }

    router.push({
      pathname: '/clinic/autoclave/helix-photos',
      params: {
        recordType,
        equipmentId,
        cycleString,
        indicator,
        resultInt,
        resultExt,
        startHHmm: toHHmm(startTime),
        endHHmm: toHHmm(endTime),
      },
    });
  };

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

  const openLogs = () => {
    router.push('/clinic/logs');
  };

  if (!profile) return <Text>No profile found.</Text>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
          
          {/* Mechanical Indicator selector */}          
          <View style={styles.mechanicalBlock}>
            <Text style={styles.mechanicalLabel}>Mechanical Indicator</Text>
            <View style={styles.segmentColumn}>
              {(['134°C - 4min', '121°C - 20min'] as const).map((opt, idx) => {
                const selected = indicator === opt;
                const withDivider = idx === 0; // divider between the two rows
                return (
                  <Pressable
                    key={`mech-${opt}`}
                    onPress={() => setIndicator(opt)}
                    style={[
                      styles.segmentBtnColumn,
                      withDivider && styles.segmentBtnDividerHorizontal,
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

          {/* Result selector with a vertical separator */}
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Internal Result:</Text>
            <View style={styles.segment}>
              {(['PASS', 'FAIL'] as const).map((opt, idx) => {
                const selected = resultInt === opt;
                const withDivider = idx === 0;
                return (
                  <Pressable
                    key={`internal-${opt}`}
                    onPress={() => setResultInt(opt)}
                    style={[
                      styles.segmentBtn,
                      withDivider && styles.segmentBtnDivider,
                      selected && styles.segmentBtnSelected
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

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>External Result:</Text>
            <View style={styles.segment}>
              {(['PASS', 'FAIL'] as const).map((opt, idx) => {
                const selected = resultExt === opt;
                const withDivider = idx === 0;
                return (
                  <Pressable
                    key={`external-${opt}`}
                    onPress={() => setResultExt(opt)}
                    style={[
                      styles.segmentBtn,
                      withDivider && styles.segmentBtnDivider,
                      selected && styles.segmentBtnSelected
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
          
          <View style={styles.photoSection}>
            <Pressable
              style={[styles.primaryBtn, !canProceed && { opacity: 0.6 }]}
              onPress={goToPhotoScreen}
              disabled={!canProceed}
            >
              <Text style={styles.primaryBtnText}>Take Photos</Text>
            </Pressable>

            {!canProceed && (
              <Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
                Fill in results first to continue.
              </Text>
            )}
          </View>
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
    </SafeAreaView>
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
