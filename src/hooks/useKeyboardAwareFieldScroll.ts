import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

type MeasurableRef = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

type UseKeyboardAwareFieldScrollParams = {
  activeOverlayFieldKey?: string | null;
  overlayHeight?: number;
  baseBottomPadding?: number;
  safeGap?: number;
  focusAnchorRatio?: number;
  scrollDebounceMs?: number;
  scrollCooldownMs?: number;
  keyboardShowDelayMs?: number;
};

type UseKeyboardAwareFieldScrollResult = {
  scrollRef: React.RefObject<ScrollView | null>;
  registerFieldRef: (key: string) => (ref: MeasurableRef | null) => void;
  onFieldFocus: (key: string) => void;
  onFieldBlur: (key: string) => void;
  requestScroll: (key: string, reason: string, delayMs?: number) => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  contentBottomPadding: number;
  keyboardHeight: number;
};

export function useKeyboardAwareFieldScroll({
  activeOverlayFieldKey = null,
  overlayHeight = 0,
  baseBottomPadding = 24,
  safeGap = 12,
  focusAnchorRatio = 0.4,
  scrollDebounceMs = 16,
  scrollCooldownMs = 120,
  keyboardShowDelayMs = 50,
}: UseKeyboardAwareFieldScrollParams = {}): UseKeyboardAwareFieldScrollResult {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const inputRefs = useRef<Record<string, MeasurableRef | null>>({});
  const focusedKeyRef = useRef<string | null>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const pendingScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollKeyRef = useRef<string | null>(null);
  const lastScrollAtRef = useRef(0);
  const scrollReqIdRef = useRef(0);

  const requestScroll = useCallback(
    (key: string, reason: string, delayMs = scrollDebounceMs) => {
      pendingScrollKeyRef.current = key;

      if (pendingScrollTimerRef.current) {
        clearTimeout(pendingScrollTimerRef.current);
        pendingScrollTimerRef.current = null;
      }

      pendingScrollTimerRef.current = setTimeout(() => {
        const latestKey = pendingScrollKeyRef.current;
        if (!latestKey) return;

        const now = Date.now();
        const elapsed = now - lastScrollAtRef.current;
        const bypassCooldown = reason === 'validation';

        if (!bypassCooldown && elapsed < scrollCooldownMs) {
          const remaining = scrollCooldownMs - elapsed;
          requestScroll(latestKey, reason, remaining);
          return;
        }

        lastScrollAtRef.current = now;
        const reqId = ++scrollReqIdRef.current;

        requestAnimationFrame(() => {
          const input = inputRefs.current[latestKey];
          if (!input?.measureInWindow) return;

          input.measureInWindow((_x, y) => {
            if (reqId !== scrollReqIdRef.current) return;

            const windowH = Dimensions.get('window').height;
            const targetY = windowH * focusAnchorRatio;

            if (y <= targetY) return;

            const delta = y - targetY;
            const nextY = Math.max(0, scrollYRef.current + delta);

            scrollRef.current?.scrollTo({ y: nextY, animated: true });
          });
        });
      }, delayMs);
    },
    [focusAnchorRatio, scrollCooldownMs, scrollDebounceMs],
  );

  const registerFieldRef = useCallback(
    (key: string) => (ref: MeasurableRef | null) => {
      inputRefs.current[key] = ref;
    },
    [],
  );

  const onFieldFocus = useCallback(
    (key: string) => {
      focusedKeyRef.current = key;
      requestScroll(key, 'focus');
    },
    [requestScroll],
  );

  const onFieldBlur = useCallback((key: string) => {
    if (focusedKeyRef.current === key) {
      focusedKeyRef.current = null;
    }
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const nextKeyboardHeight = event.endCoordinates?.height ?? 0;
      setKeyboardHeight(nextKeyboardHeight);

      const key = focusedKeyRef.current;
      if (key) {
        requestScroll(key, 'keyboardShow', keyboardShowDelayMs);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();

      if (pendingScrollTimerRef.current) {
        clearTimeout(pendingScrollTimerRef.current);
      }
    };
  }, [keyboardShowDelayMs, requestScroll]);

  useEffect(() => {
    if (!activeOverlayFieldKey) return;

    requestAnimationFrame(() => {
      requestScroll(activeOverlayFieldKey, 'overlayOpen', 0);
    });
  }, [activeOverlayFieldKey, requestScroll]);

  const contentBottomPadding = useMemo(() => {
    const bottomObstruction = Math.max(keyboardHeight, overlayHeight);
    return baseBottomPadding + safeGap + bottomObstruction;
  }, [baseBottomPadding, keyboardHeight, overlayHeight, safeGap]);

  return {
    scrollRef,
    registerFieldRef,
    onFieldFocus,
    onFieldBlur,
    requestScroll,
    handleScroll,
    contentBottomPadding,
    keyboardHeight,
  };
}
