import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

import { auth } from "@/src/lib/auth";
import { db } from "@/src/lib/firebase";

import { userProfileConverter } from "../profile/profile.converter";
import type { UserProfile } from "../profile/profile.types";

type UseUserProfileResult = {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
};

export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = undefined;
        }

        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        setLoading(true);

        const profileRef = doc(
          db,
          "users",
          user.uid
        ).withConverter(userProfileConverter);

        unsubscribeProfile = onSnapshot(
          profileRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setProfile(snapshot.data());
            } else {
              setProfile(null);
            }

            setError(null);
            setLoading(false);
          },
          (err) => {
            console.error("Profile listener error:", err);

            setError(err);
            setLoading(false);
          }
        );
      },
      (err) => {
        console.error("Auth state error:", err);

        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeAuth();

      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  return {
    profile,
    loading,
    error,
  };
}
