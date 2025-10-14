import type { DocumentData, FirestoreDataConverter } from 'firebase/firestore';

export type Clinic = {
  equipment: string[]; // Required as an array of strings
};

export const clinicConverter: FirestoreDataConverter<Clinic> = {
  toFirestore(modelObject: Clinic): DocumentData {
    return {
      equipment: Array.isArray(modelObject.equipment) ? modelObject.equipment : [],
    };
  },
  fromFirestore(snapshot, options): Clinic {
    const data = snapshot.data(options);
    return {
      equipment: Array.isArray(data?.equipment) ? (data.equipment as string[]) : [],
    };
  },
};
