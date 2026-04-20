import UiLockOverlayCard from '@/src/components/ui-lock/UiLockOverlayCard';
import { uiLockOverlayStyles } from '@/src/components/ui-lock/uiLockOverlayStyles';
import { useUiLock } from '@/src/contexts/UiLockContext';
import { useEffect } from 'react';
import { BackHandler, Platform, View } from 'react-native';

export default function GlobalUiLockOverlay() {
  const { uiLocked, uiLockScope } = useUiLock();

  const globalLocked = uiLocked && uiLockScope === 'global';

  useEffect(() => {
    if (Platform.OS !== 'android' || !globalLocked) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [globalLocked]);

  if (!globalLocked) return null;

  return (
    <View style={uiLockOverlayStyles.overlayContainer} pointerEvents="auto">
      <UiLockOverlayCard />
    </View>
  );
}
