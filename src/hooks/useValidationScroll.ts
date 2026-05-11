// src/hooks/useValidationScroll.ts

import { useCallback } from 'react';
import { Alert } from 'react-native';

type RequestScrollFn = (
  key: string,
  reason: string,
  delayMs?: number,
) => void;

type ScrollToFieldOptions = {
  delayMs?: number;
  reason?: string;
};

type ShowValidationAlertOptions = {
  title?: string;
  message: string;
  fieldKey?: string | null;
  delayMs?: number;
  reason?: string;
};

export function useValidationScroll(requestScroll: RequestScrollFn) {
  const scrollToField = useCallback(
    (
      fieldKey: string | null | undefined,
      options: ScrollToFieldOptions = {},
    ) => {
      if (!fieldKey) return;

      const {
        delayMs = 50,
        reason = 'validation',
      } = options;

      requestAnimationFrame(() => {
        requestScroll(fieldKey, reason, delayMs);
      });
    },
    [requestScroll],
  );

  const showValidationAlert = useCallback(
    ({
      title = 'Validation',
      message,
      fieldKey,
      delayMs = 50,
      reason = 'validation',
    }: ShowValidationAlertOptions) => {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'OK',
            onPress: () => {
              scrollToField(fieldKey, {
                delayMs,
                reason,
              });
            },
          },
        ],
        { cancelable: true },
      );
    },
    [scrollToField],
  );

  return {
    scrollToField,
    showValidationAlert,
  };
}
