// src/hooks/useAlertModal.ts

import { useCallback, useState } from 'react';

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  onOk?: () => void;
};

export function useAlertModal() {
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      onOk?: () => void,
    ) => {
      setAlert({
        visible: true,
        title,
        message,
        onOk,
      });
    },
    [],
  );

  const closeAlert = useCallback(() => {
    const callback = alert.onOk;

    setAlert({
      visible: false,
      title: '',
      message: '',
    });

    callback?.();
  }, [alert]);

  return {
    alert,
    showAlert,
    closeAlert,
  };
}
