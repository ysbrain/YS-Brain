import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Mode = 'working' | 'done' | 'error';

type UploadingOverlayProps = {
  visible: boolean;
  mode: Mode;                    // 'working' | 'done' | 'error'
  message?: string;              // main status line
  percent?: number;              // 0..100
  onRequestClose?: () => void;   // called when user dismisses in 'done'/'error'
};

export default function UploadingOverlay({
  visible,
  mode,
  message,
  percent,
  onRequestClose,
}: UploadingOverlayProps) {
  const isWorking = mode === 'working';

  const handleRequestClose = () => {
    // On Android, hardware back triggers this.
    // While working, ignore it to truly block interaction.
    if (isWorking) return;
    onRequestClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Status */}
        <Text style={styles.title}>
          {mode === 'working' ? 'Uploading' : mode === 'done' ? 'Upload complete' : 'Upload failed'}
        </Text>

        {!!message && <Text style={styles.message}>{message}</Text>}

        {/* Spinner while working, otherwise a check/cross could be shown (simple text here) */}
        {isWorking ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 16 }} />
        ) : (
          <Text style={styles.bigIcon}>{mode === 'done' ? '✅' : '⚠️'}</Text>
        )}

        {/* Determinate progress bar */}
        {typeof percent === 'number' && isFinite(percent) && (
          <View style={styles.progressWrap}>
            <View style={[styles.progressBar, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
          </View>
        )}

        {/* Done/Error actions */}
        {!isWorking && (
          <Pressable style={styles.okBtn} onPress={onRequestClose}>
            <Text style={styles.okBtnText}>OK</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#002E5D',
    paddingHorizontal: 24,
    paddingTop: Platform.select({ ios: 64, android: 32, default: 32 }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  message: { color: '#ddd', fontSize: 14, marginTop: 8, textAlign: 'center' },
  bigIcon: { fontSize: 48, marginTop: 16 },
  progressWrap: {
    marginTop: 24,
    width: '90%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#333',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  okBtn: {
    marginTop: 28,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  okBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
