import UiLockOverlayCard from '@/src/components/ui-lock/UiLockOverlayCard';
import { uiLockOverlayStyles } from '@/src/components/ui-lock/uiLockOverlayStyles';
import { useUiLock } from '@/src/contexts/UiLockContext';
import { useEffect } from 'react';
import { BackHandler, Platform, View } from 'react-native';

export default function GlobalUiLockOverlay() {
  const { uiLocked } = useUiLock();

  useEffect(() => {
    if (Platform.OS !== 'android' || !uiLocked) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [uiLocked]);

  if (!uiLocked) return null;

  return (
    <View style={uiLockOverlayStyles.overlayContainer} pointerEvents="auto">
      <UiLockOverlayCard />
    </View>
  );
}
