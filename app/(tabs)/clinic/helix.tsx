import { logHelixTest } from '@/src/data/autoclave/autoclave.helix';
import { useUserProfile } from '@/src/data/hooks/useUserProfile';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ✅ Reusable Date component you created earlier (format: "21 Oct 2025")
import DateText from '@/components/DateText'; // <-- adjust path if needed

type ResultOption = 'PASS' | 'FAIL' | null;

export default function HelixScreen() {
  const { profile, loading, error } = useUserProfile();
  const [permission, requestPermission] = useCameraPermissions();

  const [result, setResult] = useState<ResultOption>(null);

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  const canUpload = Boolean(result && photoUri);

  const openCamera = async () => {
    // Ask for permission if needed
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
      setIsCameraOpen(false); // close modal after capture
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
    if (!canUpload) return;    
    
    try {
      // Convert 'PASS'/'FAIL' to boolean
      const resultBool = result === 'PASS';

      // If you later store the photo in Firebase Storage, 
      // supply the photo's download URL as photoUrl.
      const id = await logHelixTest({
        result: resultBool,
        username: profile?.name ?? 'Unknown',
        cycleNumber: 1, // <-- supply your actual cycle number
        // photoUrl: await uploadAndGetDownloadUrl(photoUri)
      });

      Alert.alert('Upload complete', `Entry ID: ${id}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Upload failed', 'Please try again.');
    }
  };

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!profile) return <Text>No profile found.</Text>;

  return (
    // ✅ SafeAreaView from react-native-safe-area-context
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

        {/* 1) Current date (21 Oct 2025) via DateText */}
        <DateText style={styles.date} />

        {/* 2) User name & 3) Clinic name */}
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

        {/* 4) Result selector */}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Result:</Text>
          <View style={styles.segment}>
            {(['PASS', 'FAIL'] as const).map(opt => {
              const selected = result === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setResult(opt)}
                  style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 5) Photo capture section (camera only; no album) */}
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

        {/* 6) Upload button (enabled only when result + photo) */}
        <Pressable
          onPress={handleUpload}
          disabled={!canUpload}
          style={[styles.uploadBtn, !canUpload && styles.uploadBtnDisabled]}
        >
          <Text style={styles.uploadBtnText}>{canUpload ? 'Upload' : 'Upload (disabled)'}</Text>
        </Pressable>

        {/* Camera modal */}
        <Modal
          visible={isCameraOpen}
          animationType="slide"
          onRequestClose={() => setIsCameraOpen(false)}
        >
          {/* Safe area inside modal too (top/bottom edges) */}
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                facing="back"
                style={styles.camera}
              />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 16, gap: 16 },

  date: { fontSize: 18, fontWeight: '600' },

  label: { fontSize: 16, color: '#444' },
  value: { fontWeight: '600', color: '#000' },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultLabel: { fontSize: 16, fontWeight: '600' },
  segment: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
  segmentBtnSelected: { backgroundColor: '#007AFF22' },
  segmentText: { fontSize: 16, color: '#333' },
  segmentTextSelected: { fontWeight: '700', color: '#007AFF' },

  photoSection: { gap: 12 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#eee' },

  primaryBtn: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  secondaryBtn: { borderColor: '#007AFF', borderWidth: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  secondaryBtnText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },

  uploadBtn: { marginTop: 'auto', backgroundColor: '#34C759', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  uploadBtnDisabled: { backgroundColor: '#bbb' },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalSafe: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  shutterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#222' },
  cancelText: { color: '#fff', fontSize: 16 },
  shutterBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#007AFF' },
  shutterText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
