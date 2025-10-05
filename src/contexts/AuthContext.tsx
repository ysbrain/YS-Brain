import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../lib/auth';

type AuthCtx = { user: User | null; initializing: boolean };
const Ctx = createContext<AuthCtx>({ user: null, initializing: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  return <Ctx.Provider value={{ user, initializing }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
