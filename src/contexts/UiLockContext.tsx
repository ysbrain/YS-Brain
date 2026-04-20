import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type UiLockScope = 'global' | 'modal';

type SetUiLockedOptions = {
  scope?: UiLockScope;
};

type UiLockContextValue = {
  uiLocked: boolean;
  uiLockScope: UiLockScope | null;
  setUiLocked: (locked: boolean, options?: SetUiLockedOptions) => void;
};

const UiLockContext = createContext<UiLockContextValue | undefined>(undefined);

export function UiLockProvider({ children }: { children: React.ReactNode }) {
  const [uiLocked, setUiLockedState] = useState(false);
  const [uiLockScope, setUiLockScope] = useState<UiLockScope | null>(null);

  const setUiLocked = useCallback(
    (locked: boolean, options?: SetUiLockedOptions) => {
      if (locked) {
        setUiLockedState(true);
        setUiLockScope(options?.scope ?? 'global');
      } else {
        setUiLockedState(false);
        setUiLockScope(null);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      uiLocked,
      uiLockScope,
      setUiLocked,
    }),
    [uiLocked, uiLockScope, setUiLocked],
  );

  return (
    <UiLockContext.Provider value={value}>
      {children}
    </UiLockContext.Provider>
  );
}

export function useUiLock() {
  const ctx = useContext(UiLockContext);
  if (!ctx) {
    throw new Error('useUiLock must be used within a UiLockProvider');
  }
  return ctx;
}
