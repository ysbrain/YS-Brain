export type UserProfile = {
  ysid: string;
  email: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  photoURL?: string | null;
  clinic: string;
  createdAt?: Date;    // <- Domain uses Date
  updatedAt?: Date;
};
