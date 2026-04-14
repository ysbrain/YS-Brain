import { useUiLock } from '@/src/contexts/UiLockContext';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';

export default function GlobalUiLockOverlay() {
  const { uiLocked } = useUiLock();

  useEffect(() => {
    if (Platform.OS !== 'android' || !uiLocked) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [uiLocked]);

  if (!uiLocked) return null;

  return (
    <View style={styles.globalBlockingOverlay} pointerEvents="auto">
      <View style={styles.globalBlockingCard}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.globalBlockingTitle}>Saving record…</Text>
        <Text style={styles.globalBlockingText}>
          Please wait. Uploading may take some time.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalBlockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalBlockingCard: {
    minWidth: 220,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  globalBlockingTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },
  globalBlockingText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
});
