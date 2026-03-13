import React, { createContext, useContext, useMemo, useState } from 'react';

type UiLockContextValue = {
  uiLocked: boolean;
  setUiLocked: (locked: boolean) => void;
};

const UiLockContext = createContext<UiLockContextValue | undefined>(undefined);

export function UiLockProvider({ children }: { children: React.ReactNode }) {
  const [uiLocked, setUiLocked] = useState(false);

  const value = useMemo(
    () => ({
      uiLocked,
      setUiLocked,
    }),
    [uiLocked]
  );

  return <UiLockContext.Provider value={value}>{children}</UiLockContext.Provider>;
}

export function useUiLock() {
  const ctx = useContext(UiLockContext);
  if (!ctx) {
    throw new Error('useUiLock must be used within UiLockProvider');
  }
  return ctx;
}
