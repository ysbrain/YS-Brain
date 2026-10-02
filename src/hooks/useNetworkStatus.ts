import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [online, setOnline] = useState(
    navigator.onLine
  );

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);

    window.addEventListener(
      'online',
      onlineHandler
    );

    window.addEventListener(
      'offline',
      offlineHandler
    );

    return () => {
      window.removeEventListener(
        'online',
        onlineHandler
      );

      window.removeEventListener(
        'offline',
        offlineHandler
      );
    };
  }, []);

  return online;
}
