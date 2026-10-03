// src/contexts/AlertContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AlertModal } from '@/src/components/AlertModal';

type AlertOptions = {
  title: string;
  message: string;
};

type AlertContextValue = {
  alert: (
    options: AlertOptions
  ) => Promise<void>;
};

const AlertContext =
  createContext<AlertContextValue | null>(
    null
  );

export function AlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolverRef =
    useRef<(() => void) | null>(null);

  const [visible, setVisible] =
    useState(false);

  const [title, setTitle] =
    useState('');

  const [message, setMessage] =
    useState('');

  const alert = useCallback(
    ({
      title,
      message,
    }: AlertOptions) => {
      return new Promise<void>(
        (resolve) => {
          setTitle(title);
          setMessage(message);

          resolverRef.current =
            resolve;

          setVisible(true);
        }
      );
    },
    []
  );

  const handleOk =
    useCallback(() => {
      setVisible(false);

      resolverRef.current?.();

      resolverRef.current = null;
    }, []);

  const value = useMemo(
    () => ({
      alert,
    }),
    [alert]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}

      <AlertModal
        visible={visible}
        title={title}
        message={message}
        onOk={handleOk}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context =
    useContext(AlertContext);

  if (!context) {
    throw new Error(
      'useAlert must be used inside AlertProvider'
    );
  }

  return context;
}
