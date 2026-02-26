import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type CaptureResult = { uri: string; width: number; height: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  onCaptured: (photo: CaptureResult) => Promise<void> | void;
};

export function CameraCaptureModal({ visible, onClose, onCaptured }: Props) {
  const camRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [taking, setTaking] = useState(false);

  const canUseCamera = !!permission?.granted;

  const takePhoto = async () => {
    if (!camRef.current || taking) return;

    try {
      setTaking(true);

      // takePictureAsync is provided by CameraView (Expo camera docs).
      const photo = await camRef.current.takePictureAsync({ quality: 1 });

      if (photo?.uri) {
        await onCaptured({ uri: photo.uri, width: photo.width, height: photo.height });
      }

      onClose();
    } finally {
      setTaking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : !canUseCamera ? (
          <View style={styles.center}>
            <Text style={styles.text}>We need camera permission.</Text>
            <Pressable style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Grant permission</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={[styles.btnText, styles.btnGhostText]}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.previewWrap}>
            <CameraView
              ref={camRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
              // Android supports ratio prop; it's documented as Android-only.
              ratio="16:9"
            />

            {/* 16:9 bracket overlay */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={styles.maskTop} />
              <View style={styles.maskRow}>
                <View style={styles.maskSide} />
                <View style={styles.bracket} />
                <View style={styles.maskSide} />
              </View>
              <View style={styles.maskBottom} />
            </View>

            {/* top controls */}
            <View style={styles.topBar}>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <MaterialCommunityIcons name="close" size={26} color="#fff" />
              </Pressable>
            </View>

            {/* bottom controls */}
            <View style={styles.bottomBar}>
              <Pressable
                onPress={takePhoto}
                disabled={!cameraReady || taking}
                style={[styles.shutter, (!cameraReady || taking) && { opacity: 0.6 }]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
              <Text style={styles.hint}>Align subject inside the 16:9 frame</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const BRACKET_WIDTH = 0.88; // 88% of screen width

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  previewWrap: { flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#fff', marginBottom: 12, fontWeight: '700' },
  btn: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  btnText: { color: '#fff', fontWeight: '800' },
  btnGhost: { borderColor: 'rgba(255,255,255,0.35)' },
  btnGhostText: { color: 'rgba(255,255,255,0.8)' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  iconBtn: { padding: 10 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 40,
    paddingTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  hint: { color: 'rgba(255,255,255,0.85)', fontWeight: '700' },

  shutter: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: '#fff' },

  // masks (darken outside the bracket)
  maskTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  maskRow: { flexDirection: 'row', alignItems: 'center' },
  maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  bracket: {
    width: `${BRACKET_WIDTH * 100}%`,
    aspectRatio: 16 / 9,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  maskBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
});
