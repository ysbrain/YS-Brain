import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useContext, useEffect, useState } from "react";
import { deleteToken, getToken, saveToken } from "./storage";

type AuthContextType = {
  isSignedIn: boolean;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await getToken("userToken");
        if (token) setUserToken(token);
      } finally {
        setLoading(false);
        SplashScreen.hideAsync(); // Hide the splash screen once loading is done
      }
    };
    loadToken();
  }, []);

  const signIn = async (token: string) => {
    await saveToken("userToken", token);
    setUserToken(token);
  };

  const signOut = async () => {
    await deleteToken("userToken");
    setUserToken(null);
  };

  console.log("AuthProvider render, isSignedIn:", !!userToken);

  return (
    <AuthContext.Provider value={{ isSignedIn: !!userToken, loading, signIn, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
