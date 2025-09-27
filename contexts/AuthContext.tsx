import * as SecureStore from "expo-secure-store";
import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  isSignedIn: boolean;
  userToken: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load token on app start
    const loadToken = async () => {
      try {
        const token = await SecureStore.getItemAsync("userToken");
        if (token) setUserToken(token);
      } finally {
        setLoading(false);
        SplashScreen.hideAsync();
      }
    };
    loadToken();
  }, []);

  const signIn = async (token: string) => {
    await SecureStore.setItemAsync("userToken", token);
    setUserToken(token);
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync("userToken");
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
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
