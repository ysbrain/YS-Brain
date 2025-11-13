import React, { createContext, useContext, useMemo } from 'react';
import type { UserProfile } from '../data/profile/profile.types';

type ProfileContextValue = {
  profile: UserProfile;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ profile }), [profile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider (under _layout)');
  }
  return ctx.profile;
}
