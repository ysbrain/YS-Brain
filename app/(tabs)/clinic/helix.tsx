import { useUserProfile } from '@/src/data/hooks/useUserProfile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Reusable Date component (format: "21 Oct 2025")
import DateText from '../../../components/DateText';

// Firestore
import { db } from '@/src/lib/firebase'; // your initialized Firestore
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

type ResultOption = 'PASS' | 'FAIL' | null;

// For "Last uploaded time" display
function formatDateTime(d: Date, timeZone = 'Asia/Shanghai') {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone,
    })
      .format(d)
      .replace(/,/g, '');
  } catch {
    return `${d.toDateString()} ${d.toTimeString().slice(0, 8)}`;
  }
}

export default function HelixScreen() {
  // Hooks at top-level (no conditionals)
  const { profile, loading, error } = useUserProfile();
  const [permission, requestPermission] = useCameraPermissions();

  const [result, setResult] = useState<ResultOption>(null);

  // Cycle (digits-only string; validate: integer >=1 and <= 6 digits)
  const [cycleStr, setCycleStr] = useState<string>('');
  const cycleAccessoryId = 'cycle-input-accessory-id';
  const hasOnlyDigitsMax6 = /^\d{1,6}$/.test(cycleStr);
  const isValidCycle = hasOnlyDigitsMax6 && Number(cycleStr) >= 1;
  const cycleNumber = isValidCycle ? Number.parseInt(cycleStr, 10) : null;

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Last uploaded time (from Firestore: /clinics/clinic001/helix1/status)
  const [lastUploadedAt, setLastUploadedAt] = useState<Date | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Footer enablement: require result + photo + valid cycle
  const canUpload = Boolean(result && photoUri && isValidCycle);

  // Load status once
  useEffect(() => {
    let isMounted = true;
    const loadStatus = async () => {
      try {
        const statusRef = doc(db, 'clinics', 'clinic001', 'helix1', 'status');
        const snap = await getDoc(statusRef);
        if (snap.exists()) {
          const ts = snap.data()?.lastUploadedAt as Timestamp | undefined;
          if (ts && isMounted) setLastUploadedAt(ts.toDate());
        }
      } catch (e) {
        console.warn('Failed to load status doc', e);
      } finally {
        if (isMounted) setLoadingStatus(false);
      }
    };
    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission required', 'Please grant camera permission to take a photo.');
        return;
      }
    }
    setIsCameraOpen(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      setPhotoUri(photo?.uri ?? null);
      setIsCameraOpen(false);
    } catch (e) {
      console.warn('Failed to capture photo', e);
      Alert.alert('Capture failed', 'Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const retakePhoto = () => {
    setPhotoUri(null);
    openCamera();
  };

  const handleUpload = async () => {
    if (!canUpload) {
      const reasons: string[] = [];
      if (!result) reasons.push('Select PASS or FAIL.');
      if (!photoUri) reasons.push('Take a photo.');
      if (!isValidCycle) reasons.push('Enter a valid integer cycle (1–999999).');
      Alert.alert('Upload disabled', reasons.join('\n'));
      return;
    }

    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in before uploading.');
      return;
    }

    try {
      // 1) Create an entry document in the collection
      const entriesRef = collection(db, 'clinics', 'clinic001', 'helix1');
      await addDoc(entriesRef, {
        result: result === 'PASS',
        username: profile?.name ?? user.uid,
        cycleNumber, // integer
        clinic: profile?.clinic ?? null,
        createdAt: serverTimestamp(),
      });

      // 2) Update status doc with lastUploadedAt
      const statusRef = doc(db, 'clinics', 'clinic001', 'helix1', 'status');
      await setDoc(
        statusRef,
        {
          lastUploadedAt: serverTimestamp(),
          lastBy: profile?.name ?? user.uid,
          lastCycleNumber: cycleNumber,
          lastResult: result === 'PASS',
        },
        { merge: true }
      );

      setLastUploadedAt(new Date()); // local optimistic update
      Alert.alert('Upload complete', 'Your entry was uploaded successfully.');
    } catch (e) {
      console.error(e);
      Alert.alert('Upload failed', 'Please try again.');
    }
  };

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!profile) return <Text>No profile found.</Text>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Content area: sticks to top below header */}
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Current date */}
          <DateText style={styles.date} />

          {/* Profile */}
          {profile ? (
            <>
              <Text style={styles.label}>
                User: <Text style={styles.value}>{profile.name}</Text>
              </Text>
              <Text style={styles.label}>
                Clinic: <Text style={styles.value}>{profile.clinic}</Text>
              </Text>
            </>
          ) : (
            <Text style={styles.label}>Loading profile…</Text>
          )}

          {/* Cycle input */}
          <View style={styles.cycleRow}>
            <Text style={styles.cycleLabel}>Cycle:</Text>
            <TextInput
              value={cycleStr}
              onChangeText={(text) => {
                const digits = text.replace(/[^\d]/g, '').slice(0, 6);
                setCycleStr(digits);
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="e.g., 123"
              maxLength={6}
              blurOnSubmit
              returnKeyType={Platform.OS === 'android' ? 'done' : 'default'}
              inputAccessoryViewID={Platform.OS === 'ios' ? cycleAccessoryId : undefined}
              style={[
                styles.cycleInput,
                cycleStr.length > 0 && !isValidCycle && styles.cycleInputInvalid,
              ]}
            />
          </View>
          {cycleStr.length > 0 && !isValidCycle && (
            <Text style={styles.cycleHint}>Enter an integer ≥ 1 with up to 6 digits.</Text>
          )}

          {/* (iOS) "Done" bar above number pad */}
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={cycleAccessoryId}>
              <View style={styles.accessoryBar}>
                <Pressable style={styles.accessoryBtn} onPress={Keyboard.dismiss}>
                  <Text style={styles.accessoryBtnText}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
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

          {/* Photo capture */}
          <View style={styles.photoSection}>
            {!photoUri ? (
              <Pressable style={styles.primaryBtn} onPress={openCamera}>
                <Text style={styles.primaryBtnText}>Take Photo</Text>
              </Pressable>
            ) : (
              <>
                <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                <Pressable style={styles.secondaryBtn} onPress={retakePhoto}>
                  <Text style={styles.secondaryBtnText}>Retake Photo</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Footer stays at bottom: Upload button + Last uploaded */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleUpload}
            disabled={!canUpload}
            style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
          >
            <Text style={styles.uploadBtnText}>
              {canUpload ? 'Upload' : 'Upload (disabled)'}
            </Text>
          </Pressable>

          <View style={styles.lastRow}>
            <Text style={styles.lastLabel}>Last uploaded:</Text>
            {loadingStatus ? (
              <Text style={styles.lastValue}>Loading…</Text>
            ) : lastUploadedAt ? (
              <Text style={styles.lastValue}>{formatDateTime(lastUploadedAt, 'Asia/Shanghai')}</Text>
            ) : (
              <Text style={styles.lastValue}>No uploads yet</Text>
            )}
          </View>
        </View>
      </View>

      {/* Camera modal */}
      <Modal
        visible={isCameraOpen}
        animationType="slide"
        onRequestClose={() => setIsCameraOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.cameraWrap}>
            <CameraView ref={cameraRef} facing="back" style={styles.camera} />
            <View style={styles.shutterRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setIsCameraOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.shutterBtn} onPress={capturePhoto}>
                {isCapturing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.shutterText}>Capture</Text>
                )}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Page layout: content at top, footer at bottom
  container: { flex: 1, paddingHorizontal: 16 },
  content: { paddingTop: 16, gap: 16 }, // starts right below header
  footer: { marginTop: 'auto', paddingTop: 12, paddingBottom: 12, gap: 8 },

  date: { fontSize: 18, fontWeight: '600' },

  label: { fontSize: 16, color: '#444' },
  value: { fontWeight: '600', color: '#000' },

  // Cycle
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cycleLabel: { fontSize: 16, fontWeight: '600' },
  cycleInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff'
  },
  cycleInputInvalid: { borderColor: '#C0392B' },
  cycleHint: { fontSize: 12, color: '#C0392B' },

  // Accessory bar (iOS)
  accessoryBar: {
    backgroundColor: '#F2F2F2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  accessoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  accessoryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Result selector with separator
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultLabel: { fontSize: 16, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
  segmentBtnSelected: { backgroundColor: '#007AFF22' },
  segmentBtnDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#ddd' },
  segmentText: { fontSize: 16, color: '#333' },
  segmentTextSelected: { fontWeight: '700', color: '#007AFF' },

  // Photo
  photoSection: { gap: 12 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#eee' },

  // Buttons
  primaryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  secondaryBtn: {
    borderColor: '#007AFF',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },

  // Footer controls
  uploadBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
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
  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#222' },
  cancelText: { color: '#fff', fontSize: 16 },
  shutterBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#007AFF' },
  shutterText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
