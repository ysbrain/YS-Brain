// src/hooks/useValidationScroll.ts

import { useAlert } from '@/src/contexts/AlertContext';
import { useCallback } from 'react';

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
  const { alert } = useAlert();

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
    async ({
      title = 'Validation',
      message,
      fieldKey,
      delayMs = 50,
      reason = 'validation',
    }: ShowValidationAlertOptions) => {
      await alert({
        title,
        message,
      });

      scrollToField(fieldKey, {
        delayMs,
        reason,
      });
    },
    [scrollToField, alert],
  );

  return {
    scrollToField,
    showValidationAlert,
  };
}
