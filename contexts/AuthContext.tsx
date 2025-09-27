import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useContext, useEffect, useState } from "react";
import { deleteToken, getToken, saveToken } from "./storage";

type AuthContextType = {
  isSignedIn: boolean;
  userToken: string | null;
  signIn: (token: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const token = await getToken("userToken");
        const storedUsername = await getToken("username");
        if (token) setUserToken(token);
        console.log("Auth data loaded:", { userToken });
      } finally {
        setLoading(false);
        SplashScreen.hideAsync(); // Hide the splash screen once loading is done
      }
    };
    loadAuthData();
  }, []);
  
  const signIn = async (token: string) => {
    await saveToken("userToken", token);
    setUserToken(token);
  };

  const signOut = async () => {
    await deleteToken("userToken");
    setUserToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: !!userToken,
        userToken,
        signIn,
        signOut,
      }}
    >
    {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
