import DateText from '@/src/components/DateText';
import UploadingOverlay from '@/src/components/UploadingOverlay';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProfile } from '@/src/contexts/ProfileContext';
import { centerCropToAspect } from '@/src/lib/crop';
import { db } from '@/src/lib/firebase';
import { storage } from '@/src/lib/storage';

import { CameraView, useCameraPermissions } from 'expo-camera';
import { SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';

type ResultOption = 'PASS' | 'FAIL';
type IndicatorOption = '134°C - 4min' | '121°C - 20min';
type Target = 'internal' | 'external';

// ---- helpers (same as helix.tsx) ----
const guessContentType = (uri: string) => {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
};

const buildStoragePath = (opts: { clinicId: string; folder: string; cycle: number | null }) => {
  const { clinicId, folder, cycle } = opts;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `clinics/${clinicId}/${folder}/${ts}${cycle ? `_c${cycle}` : ''}.jpg`;
};

export default function HelixPhotosScreen() {
  const router = useRouter();
  const profile = useProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const { user } = useAuth();

  const {
    recordType,
    equipmentId,
    cycleString,
    indicator,
    resultInt,
    resultExt,
    startHHmm,
    endHHmm,
  } = useLocalSearchParams<{
    recordType: string;
    equipmentId: string;
    cycleString: string;
    indicator: IndicatorOption;
    resultInt: ResultOption;
    resultExt: ResultOption;
    startHHmm: string;
    endHHmm: string;
  }>();

  const recordId = `${recordType}${equipmentId}`;
  const cycleNumber = parseInt(cycleString, 10) || 0;

  // ---- 2-photo state ----
  const [internalUri, setInternalUri] = useState<string | null>(null);
  const [externalUri, setExternalUri] = useState<string | null>(null);

  // ---- camera modal state ----
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTarget, setActiveTarget] = useState<Target>('internal');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const isShutterBusy = isCapturing || isCropping;

  // ---- camera overlay crop frame sizing (same behavior as your current helix.tsx) ----
  const [camLayout, setCamLayout] = useState({ width: 0, height: 0 });
  const cropBox = useMemo(() => {
    const { width: cw, height: ch } = camLayout;
    if (cw <= 0 || ch <= 0) return { w: 0, h: 0, left: 0, top: 0 };
    const M = 24;
    let w = Math.max(0, cw - M * 2);
    let h = Math.round((w * 3) / 4); // 4:3
    if (h > ch - M * 2) {
      h = Math.max(0, ch - M * 2);
      w = Math.round((h * 4) / 3);
    }
    const left = Math.round((cw - w) / 2);
    const top = Math.round((ch - h) / 2);
    return { w, h, left, top };
  }, [camLayout]);

  // ---- responsive thumbnail sizing for 2-column layout ----
  const { width: screenW } = useWindowDimensions();
  const GRID_GAP = 12;
  const H_PADDING = 16 * 2;
  const thumbW = Math.floor((screenW - H_PADDING - GRID_GAP) / 2);
  const thumbH = Math.floor((thumbW * 3) / 4); // 4:3 thumbnail

  const openCameraFor = async (target: Target) => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission required', 'Please grant camera permission to take photos.');
        return;
      }
    }
    setActiveTarget(target);
    setIsCameraOpen(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || isShutterBusy) return;

    try {
      setIsCapturing(true);

      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
      });

      setIsCapturing(false);
      setIsCropping(true);

      const cropped = await centerCropToAspect(shot.uri, 4 / 3, {
        compress: 0.9,
        format: SaveFormat.JPEG,
      });

      const uri = (cropped as any).localUri ?? (cropped as any).uri;
      if (!uri) throw new Error('Cropped image returned no URI');

      if (activeTarget === 'internal') setInternalUri(uri);
      else setExternalUri(uri);

      setIsCameraOpen(false);
    } catch (e) {
      console.warn('Capture/crop error', e);
      Alert.alert('Capture failed', 'Please try again.');
    } finally {
      setIsCapturing(false);
      setIsCropping(false);
    }
  };

  // ---- merge via ViewShot (hidden stacked view) ----
  const viewShotRef = useRef<ViewShot>(null);
  const [intLoaded, setIntLoaded] = useState(false);
  const [extLoaded, setExtLoaded] = useState(false);

  const canUpload = Boolean(
    profile &&
      cycleNumber > 0 &&
      indicator &&
      resultInt &&
      resultExt &&
      internalUri &&
      externalUri
  );

  // ---- upload overlay state ----
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'working' | 'done' | 'error'>('working');
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadPct, setUploadPct] = useState(0);

  const mergeImagesVertically = async (): Promise<string> => {
    if (!internalUri || !externalUri) throw new Error('Missing photos');
    if (!viewShotRef.current) throw new Error('Merge view not ready');

    // Ensure <Image> nodes have loaded before capture (more reliable)
    if (!intLoaded || !extLoaded) {
      await new Promise<void>((resolve) => {
        const t = setInterval(() => {
          if (intLoaded && extLoaded) {
            clearInterval(t);
            resolve();
          }
        }, 50);
      });
    }

    // Output target: two 4:3 photos stacked.
    // Example: each 1600x1200; merged 1600x2400.
    const targetWidthPx = 1600;
    const targetHeightPx = 2400;
    const pr = PixelRatio.get();
    const width = targetWidthPx / pr;
    const height = targetHeightPx / pr;

    // allow one tick for layout stability
    await new Promise((r) => setTimeout(r, 50));

    const uri = await captureRef(viewShotRef, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
      width,
      height,
    });

    if (!uri) throw new Error('Failed to merge images');
    return uri;
  };

  const handleUpload = async () => {
    if (!canUpload) {
      Alert.alert('Upload disabled', 'Please capture both Internal and External photos.');
      return;
    }

    if (!user) return;

    setIsUploading(true);
    setUploadMode('working');
    setUploadMsg('Merging photos…');
    setUploadPct(0);

    try {
      // 1) Merge (internal top, external bottom)
      const mergedUri = await mergeImagesVertically();

      // 2) Upload merged image to Storage (same pattern as before)
      setUploadMsg('Uploading photo…');
      const storagePath = buildStoragePath({
        clinicId: profile!.clinic,
        folder: recordId,
        cycle: cycleNumber,
      });

      const response = await fetch(mergedUri);
      const blob = await response.blob();
      const metadata = { contentType: guessContentType(mergedUri) };

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

      // 3) Firestore write (same fields as helix.tsx)
      setUploadMsg('Saving record…');
      const entriesRef = collection(db, 'clinics', profile!.clinic, recordId);
      const newEntryRef = doc(entriesRef);

      const cycleDocRef = doc(db, 'clinics', profile!.clinic, `autoclave${equipmentId}`, 'cycle');

      const batch = writeBatch(db);
      batch.set(newEntryRef, {
        username: profile!.name ?? null,
        userID: user.uid,
        clinic: profile!.clinic ?? null,
        cycleNumber,
        timeStarted: startHHmm,
        timeEnded: endHHmm,
        mechanicalIndicator: indicator,
        resultInternal: resultInt === 'PASS',
        resultExternal: resultExt === 'PASS',
        photoUrl,
        createdAt: serverTimestamp(),
      });

      batch.set(
        cycleDocRef,
        { cycleCount: cycleNumber, updatedAt: serverTimestamp() },
        { merge: true }
      );

      await batch.commit();

      setUploadMode('done');
      setUploadMsg('Upload complete');
    } catch (e: any) {
      console.error(e);
      setUploadMode('error');
      setUploadMsg(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  if (!profile) return <Text>No profile found.</Text>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        {/* Content area (scrollable safety net), with extra bottom padding for sticky footer */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <DateText style={styles.label} />
            <Text style={styles.profileRight} numberOfLines={1}>
              {profile.clinic} - {profile.name}
            </Text>
          </View>

          <Text style={styles.value}>Capture Helix Photos</Text>

          {/* 2-column layout */}
          <View style={styles.photoGrid}>
            {/* Internal */}
            <View style={styles.photoCard}>
              <Text style={styles.cardTitle}>Internal</Text>

              {!internalUri ? (
                <Pressable style={styles.primaryBtnSmall} onPress={() => openCameraFor('internal')}>
                  <Text style={styles.primaryBtnText}>Take</Text>
                </Pressable>
              ) : (
                <>
                  <Image
                    source={{ uri: internalUri }}
                    style={[styles.thumb, { width: thumbW, height: thumbH }]}
                    resizeMode="cover"
                    onLoadEnd={() => setIntLoaded(true)}
                  />
                  <Pressable
                    style={styles.linkBtn}
                    onPress={() => {
                      setInternalUri(null);
                      setIntLoaded(false);
                    }}
                  >
                    <Text style={styles.linkText}>Retake</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* External */}
            <View style={styles.photoCard}>
              <Text style={styles.cardTitle}>External</Text>

              {!externalUri ? (
                <Pressable style={styles.primaryBtnSmall} onPress={() => openCameraFor('external')}>
                  <Text style={styles.primaryBtnText}>Take</Text>
                </Pressable>
              ) : (
                <>
                  <Image
                    source={{ uri: externalUri }}
                    style={[styles.thumb, { width: thumbW, height: thumbH }]}
                    resizeMode="cover"
                    onLoadEnd={() => setExtLoaded(true)}
                  />
                  <Pressable
                    style={styles.linkBtn}
                    onPress={() => {
                      setExternalUri(null);
                      setExtLoaded(false);
                    }}
                  >
                    <Text style={styles.linkText}>Retake</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {!canUpload && (
            <Text style={styles.helperInline}>
              Upload is enabled after both photos are taken.
            </Text>
          )}
        </ScrollView>

        {/* Sticky footer (always reachable) */}
        <View style={styles.footerSticky}>
          <Pressable
            onPress={handleUpload}
            disabled={!canUpload}
            style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
          >
            <Text style={styles.uploadBtnText}>Upload</Text>
          </Pressable>
        </View>
      </View>

      {/* Hidden merge renderer: internal (top) + external (bottom) */}
      {internalUri && externalUri && (
        <ViewShot
          ref={viewShotRef}
          style={styles.hiddenMerge}
          options={{ format: 'jpg', quality: 0.9, result: 'tmpfile' }}
        >
          {/* collapsable={false} helps view-shot find the native view reliably */}
          <View collapsable={false} style={styles.mergeCanvas}>
            <Image source={{ uri: internalUri }} style={styles.mergeImg} resizeMode="cover" />
            <Image source={{ uri: externalUri }} style={styles.mergeImg} resizeMode="cover" />
          </View>
        </ViewShot>
      )}

      {/* Camera modal */}
      <Modal
        visible={isCameraOpen}
        animationType="slide"
        onRequestClose={() => {
          if (isShutterBusy) return;
          setIsCameraOpen(false);
        }}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.cameraWrap}>
            <CameraView
              ref={cameraRef}
              facing="back"
              style={styles.camera}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setCamLayout({ width, height });
              }}
            />

            {/* 4:3 crop overlay */}
            {camLayout.width > 0 && camLayout.height > 0 && (
              <View pointerEvents="none" style={styles.overlayWrap}>
                {/* Top */}
                <View style={[styles.dim, { left: 0, top: 0, width: camLayout.width, height: cropBox.top }]} />
                {/* Bottom */}
                <View
                  style={[
                    styles.dim,
                    {
                      left: 0,
                      top: cropBox.top + cropBox.h,
                      width: camLayout.width,
                      height: camLayout.height - (cropBox.top + cropBox.h),
                    },
                  ]}
                />
                {/* Left */}
                <View style={[styles.dim, { left: 0, top: cropBox.top, width: cropBox.left, height: cropBox.h }]} />
                {/* Right */}
                <View
                  style={[
                    styles.dim,
                    {
                      left: cropBox.left + cropBox.w,
                      top: cropBox.top,
                      width: camLayout.width - (cropBox.left + cropBox.w),
                      height: cropBox.h,
                    },
                  ]}
                />
                {/* Frame */}
                <View
                  style={[
                    styles.cropBox,
                    { left: cropBox.left, top: cropBox.top, width: cropBox.w, height: cropBox.h },
                  ]}
                />
              </View>
            )}

            {isShutterBusy && (
              <View style={styles.busyTextWrap}>
                <Text style={styles.busyText}>{isCropping ? 'Processing…' : 'Capturing…'}</Text>
              </View>
            )}

            <View style={styles.shutterRow}>
              <Pressable
                style={[styles.cancelBtn, isShutterBusy && styles.btnDisabled]}
                onPress={() => !isShutterBusy && setIsCameraOpen(false)}
                disabled={isShutterBusy}
              >
                <Text style={[styles.cancelText, isShutterBusy && styles.btnDisabledText]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.shutterBtn, isShutterBusy && { opacity: 0.6 }]}
                onPress={capturePhoto}
                disabled={isShutterBusy}
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
          setIsUploading(false);
          if (uploadMode === 'done') {
            // photos -> helix -> previous screen before helix (matches existing behavior)
            router.back();
            setTimeout(() => router.back(), 50);
          }
        }}
      />
    </SafeAreaView>
  );
}

const FOOTER_RESERVED = 92;

const styles = StyleSheet.create({
  safe: { flex: 1 },

  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  scrollContent: {
    paddingTop: 16,
    paddingBottom: FOOTER_RESERVED,
    gap: 16,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { fontSize: 18, color: '#444' },
  profileRight: { fontSize: 16, color: '#444', fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  value: { fontSize: 18, fontWeight: 'bold' },

  // ---- 2-column grid ----
  photoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  photoCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },

  thumb: {
    borderRadius: 10,
    backgroundColor: '#eee',
  },

  primaryBtnSmall: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  linkBtn: { paddingVertical: 4 },
  linkText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },

  helperInline: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // ---- sticky footer ----
  footerSticky: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
  },
  uploadBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadBtnDisabled: { backgroundColor: '#bbb' },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ---- hidden merge renderer ----
  hiddenMerge: { position: 'absolute', left: -9999, top: -9999, opacity: 0 },
  // base layout is 400 wide; capture() output is controlled by width/height passed to capture()
  mergeCanvas: { width: 400, backgroundColor: '#000' },
  mergeImg: { width: 400, height: 300 }, // 4:3 each; stacked => 600 tall

  // ---- camera modal ----
  modalSafe: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },

  overlayWrap: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.35)' },
  cropBox: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 8 },

  busyTextWrap: {
    position: 'absolute',
    bottom: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  busyText: { color: '#fff', opacity: 0.9 },

  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  cancelText: { color: '#fff', fontSize: 16 },
  shutterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#007AFF',
  },
  shutterText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  btnDisabled: { opacity: 0.5 },
  btnDisabledText: { color: '#9aa0a6' },
});
