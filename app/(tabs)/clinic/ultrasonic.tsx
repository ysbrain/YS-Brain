import UploadingOverlay from '@/src/components/UploadingOverlay';
import { useProfile } from '@/src/contexts/ProfileContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAuth } from '@/src/contexts/AuthContext';
import { db } from '@/src/lib/firebase'; // your initialized Firestore
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
// Crop helper (Context API version)
import { centerCropToAspect } from '@/src/lib/crop';
import { SaveFormat } from 'expo-image-manipulator';
// 🔥 Storage
import { storage } from '@/src/lib/storage'; // getStorage() exported here
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
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

// 🔎 small helpers
const guessContentType = (uri: string) => {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
};

const buildStoragePath = (opts: { clinicId: string; folder: string }) => {
  const { clinicId, folder } = opts;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `clinics/${clinicId}/${folder}/${ts}.jpg`;
};

export default function UltrasonicScreen() {
  const router = useRouter();
  const profile = useProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const { user } = useAuth();
  
  const [result, setResult] = useState<ResultOption>(null);

  const [replacementTime, setReplacementTime] = useState<Date>(() => new Date()); // default current time
  const [timePicker, setTimePicker] = useState<'replacement' | null>(null);

  const onTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android: closes automatically; iOS: keep open until Done
    if (event.type === 'dismissed') {
      setTimePicker(null);
      return;
    }
    if (selected) {
      if (timePicker === 'replacement') setReplacementTime(selected);
    }
    if (Platform.OS === 'android') setTimePicker(null);
  };

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [wasCropped, setWasCropped] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // derive a single busy flag for the shutter button
  const isShutterBusy = isCapturing || isCropping;

  // ⏱️ 12s timeout support
  const CAPTURE_TIMEOUT_MS = 12_000;
  const shutterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // If a timeout occurs, we set this to true so we can ignore late results
  const opCancelledRef = useRef(false);

  // ⏱️ Last uploaded time — now driven by the newest doc in the collection
  const [lastUploadedAt, setLastUploadedAt] = useState<Date | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Upload: require results + photo
  const canUpload = Boolean(result && photoUri);

  // Upload overlay
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'working' | 'done' | 'error'>('working');
  const [uploadMsg, setUploadMsg] = useState<string>('');
  const [uploadPct, setUploadPct] = useState<number>(0);

  // 🔁 Subscribe to the newest entry (by createdAt DESC, LIMIT 1)
  useEffect(() => {
    if (!profile?.clinic) return;

    const col = collection(db, 'clinics', profile.clinic, 'ultrasonic');
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
  }, [profile?.clinic]);

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

  // For the camera overlay frame, we need the live camera area size
  const [camLayout, setCamLayout] = useState({ width: 0, height: 0 });

  // Derived crop-box metrics (centered 4:3 that fits inside camera view)
  const cropBox = useMemo(() => {
    const { width: cw, height: ch } = camLayout;
    if (cw <= 0 || ch <= 0) return { w: 0, h: 0, left: 0, top: 0 };
    const M = 24; // margin around frame
    let w = Math.max(0, cw - M * 2);
    let h = Math.round((w * 3) / 4); // 4:3 aspect => h = w * 3/4
    // If too tall, fit by height instead
    if (h > ch - M * 2) {
      h = Math.max(0, ch - M * 2);
      w = Math.round((h * 4) / 3);
    }
    const left = Math.round((cw - w) / 2);
    const top = Math.round((ch - h) / 2);
    return { w, h, left, top };
  }, [camLayout]);

  const capturePhoto = async () => {
    if (!cameraRef.current || isShutterBusy) return; // prevent double taps
    let success = false;
    startShutterTimer(); // ⏱️ begin 12s timer

    try {
      // 1) Start capture
      setIsCapturing(true);
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true // we crop explicitly
      });

      // If timeout already fired, ignore the result and bail out quietly
      if (opCancelledRef.current) return;

      // 2) Crop
      setIsCapturing(false);
      setIsCropping(true);

      const cropped = await centerCropToAspect(shot.uri, 4 / 3, {
        compress: 0.9,
        format: SaveFormat.JPEG,
        targetWidth: 800, // optional downscale
      });

      if (opCancelledRef.current) return; // timed out during crop -> ignore

      const uri = (cropped as any).localUri ?? (cropped as any).uri;
      if (!uri) throw new Error('Cropped image returned no URI');

      setPhotoUri(uri);
      setWasCropped(true);
      success = true; // ✅ finished successfully
    } catch (e) {
      console.warn('Capture/crop error', e);
      Alert.alert('Capture failed', 'Please try again.');
    } finally {
      clearShutterTimer(); // ✅ stop the 12s timer
      setIsCapturing(false);
      setIsCropping(false);

      if (success && !opCancelledRef.current) {
        setIsCameraOpen(false); // close only after success
      }
    }
  };

  const retakePhoto = () => {
    setPhotoUri(null);
    openCamera();
  };

  const handleCancelCamera = () => {
    if (isShutterBusy) return; // ⬅️ ignore while busy
    setIsCameraOpen(false);
  };

  const clearShutterTimer = () => {
    if (shutterTimerRef.current) {
      clearTimeout(shutterTimerRef.current);
      shutterTimerRef.current = null;
    }
  };

  const startShutterTimer = () => {
    // New operation begins; clear any prior timer and reset cancelled flag
    clearShutterTimer();
    opCancelledRef.current = false;
    shutterTimerRef.current = setTimeout(() => {
      // ⏰ Timed out: mark operation cancelled and recover UI
      opCancelledRef.current = true;
      setIsCapturing(false);
      setIsCropping(false);

      // Let the user retry (modal stays open, shutter buttons re-enabled)
      Alert.alert(
        'Taking longer than expected',
        'Capturing this photo is taking unusually long. Please try again.',
        [{ text: 'OK' }]
      );
    }, CAPTURE_TIMEOUT_MS);
  };

  // Clean up the timer when the modal closes or screen unmounts
  useEffect(() => {
    return () => clearShutterTimer();
  }, []);

  const handleUpload = async () => {
    if (!canUpload) {
      const reasons: string[] = [];      
      if (!result) reasons.push('Select Result (PASS or FAIL).');
      if (!photoUri) reasons.push('Take a photo.');
      Alert.alert('Upload disabled', reasons.join('\n'));
      return;
    }

    if (!user) return;

    // ⛔ Block all interaction with the full-screen overlay
    setIsUploading(true);
    setUploadMode('working');
    setUploadMsg('Processing image…');
    setUploadPct(0);

    try {
      // 1) Ensure cropped image (you’re already cropping at capture; this is a safe fallback)
      let croppedUri = photoUri!;
      if (!wasCropped) {
        const out = await centerCropToAspect(photoUri!, 4 / 3, {
          compress: 0.9,
          format: SaveFormat.JPEG
        });
        croppedUri = (out as any).localUri ?? (out as any).uri;
      }

      // 2) Upload to Firebase Storage with progress
      setUploadMsg('Uploading photo…');

      const storagePath = buildStoragePath({
        clinicId: profile.clinic,
        folder: 'ultrasonic'
      });

      const response = await fetch(croppedUri);
      const blob = await response.blob();
      const metadata = { contentType: guessContentType(croppedUri) };
      const storageReference = storageRef(storage, storagePath);
      const task = uploadBytesResumable(storageReference, blob, metadata);

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (snap.totalBytes > 0) setUploadPct((snap.bytesTransferred / snap.totalBytes) * 100);
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const photoUrl = await getDownloadURL(task.snapshot.ref);

      // 3) Create Firestore document      
      setUploadMsg('Saving record…');

      const entriesRef = collection(db, 'clinics', profile.clinic, 'ultrasonic');
      await addDoc(entriesRef, {
        username: profile?.name ?? null,
        userID: user.uid,
        clinic: profile?.clinic ?? null,
        result: result === 'PASS',
        replacementTime: toHHmm(replacementTime),
        photoUrl,
        createdAt: serverTimestamp(),
      });

      // 4) Success: show completed state
      setUploadMode('done');
      setUploadMsg('Upload complete');
    } catch (e: any) {
      console.error(e);
      setUploadMode('error');
      setUploadMsg(e?.message ?? 'Something went wrong. Please try again.');
      // Leave overlay up in "error" mode; user can tap OK to dismiss and retry
    }
  };

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

          {/* Time row */}
          <View style={styles.timeRow}>
            <View style={styles.timeGroup}>
              <Text style={styles.timeLabel}>更換藥水(每天):</Text>
              <Pressable style={styles.timeBtn} onPress={() => setTimePicker('replacement')}>
                <Text style={styles.timeBtnText}>{toHHmm(replacementTime)}</Text>
              </Pressable>
            </View>
          </View>

          {/* Android picker (native modal) */}
          {Platform.OS === 'android' && timePicker !== null && (
            <DateTimePicker
              value={replacementTime}
              mode="time"
              is24Hour
              display="default"
              onChange={onTimeChange}
            />
          )}

          {/* iOS picker (custom modal with Done) */}
          {Platform.OS === 'ios' && (
            <Modal visible={timePicker !== null} transparent animationType="fade">
              <View style={styles.pickerBackdrop}>
                <View style={styles.pickerSheet}>
                  <View style={styles.accessoryBar}>
                    <Pressable style={styles.accessoryBtn} onPress={() => setTimePicker(null)}>
                      <Text style={styles.accessoryBtnText}>Done</Text>
                    </Pressable>
                  </View>
                  <View style={styles.pickerInner}>
                    <DateTimePicker
                      value={replacementTime}
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

      {/* Camera modal */}
      <Modal
        visible={isCameraOpen}
        animationType="slide"
        onRequestClose={() => {
          if (isShutterBusy) return; // ⬅️ ignore back while busy
          setIsCameraOpen(false);
        }}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {/* Measure this container to position the overlay accurately */}
          <View style={styles.cameraWrap}>
            <CameraView
              ref={cameraRef}
              facing="back"
              style={styles.camera}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout; // ← measure camera view itself
                setCamLayout({ width, height });
              }}
            />

            {/* 4:3 crop overlay (only when measured) */}
            {camLayout.width > 0 && camLayout.height > 0 && (
              <View pointerEvents="none" style={styles.overlayWrap}>
                {/* Dim outside the crop rectangle */}
                {/* Top */}
                <View
                  style={[
                    styles.dim,
                    { left: 0, top: 0, width: camLayout.width, height: cropBox.top }
                  ]}
                />
                {/* Bottom */}
                <View
                  style={[
                    styles.dim,
                    {
                      left: 0,
                      top: cropBox.top + cropBox.h,
                      width: camLayout.width,
                      height: camLayout.height - (cropBox.top + cropBox.h)
                    }
                  ]}
                />
                {/* Left */}
                <View
                  style={[
                    styles.dim,
                    { left: 0, top: cropBox.top, width: cropBox.left, height: cropBox.h }
                  ]}
                />
                {/* Right */}
                <View
                  style={[
                    styles.dim,
                    {
                      left: cropBox.left + cropBox.w,
                      top: cropBox.top,
                      width: camLayout.width - (cropBox.left + cropBox.w),
                      height: cropBox.h
                    }
                  ]}
                />

                {/* The visible crop frame */}
                <View
                  style={[
                    styles.cropBox,
                    {
                      left: cropBox.left,
                      top: cropBox.top,
                      width: cropBox.w,
                      height: cropBox.h
                    }
                  ]}
                />
              </View>
            )}

            {isShutterBusy && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 72,
                  left: 0,
                  right: 0,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', opacity: 0.9 }}>
                  {isCropping ? 'Processing…' : 'Capturing…'}
                </Text>
              </View>
            )}

            {/* Shutter row */}
            <View style={styles.shutterRow}>
              <Pressable
                style={[styles.cancelBtn, isShutterBusy && styles.btnDisabled]}
                onPress={handleCancelCamera}
                disabled={isShutterBusy}
                accessibilityState={{ disabled: isShutterBusy }}
              >
                <Text style={[styles.cancelText, isShutterBusy && styles.btnDisabledText]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[styles.shutterBtn, isShutterBusy && { opacity: 0.6 }]}
                onPress={capturePhoto}
                disabled={isShutterBusy}
                accessibilityState={{ disabled: isShutterBusy }}
              >
                {isShutterBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.shutterText}>Capture</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <UploadingOverlay
        visible={isUploading}
        mode={uploadMode}
        message={uploadMsg}
        percent={uploadMode === 'working' ? uploadPct : undefined}
        onRequestClose={() => {
          // Only called when mode !== 'working'
          setIsUploading(false);
          if (uploadMode === 'done') {
            router.back();
          }
        }}
      />
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

  // Time row
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  // Time picker
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: 'bold'
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
