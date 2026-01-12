import { db } from '@/src/lib/firebase';
import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { safeTypeKeyFromLabel } from '../utils/slugify';

export type ModuleDoc = {
  typeKey: string;       // doc id mirror
  typeLabel: string;     // display name
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
};

type CreateModuleParams = {
  clinicId: string;
  typeLabel: string;
  createdBy?: string;
  iconKey?: string; // optional override
};

/**
 * Creates a module document under clinics/_common/modules/{typeKey}.
 * If typeKey is taken, appends -2, -3, ...
 */
export async function createModule(params: CreateModuleParams): Promise<ModuleDoc> {
  const { clinicId, typeLabel, createdBy, iconKey } = params;

  const base = safeTypeKeyFromLabel(typeLabel);

  return await runTransaction(db, async (tx) => {
    // Try base, then base-2, base-3...
    let candidate = base;

    for (let i = 0; i < 50; i++) {
      const moduleRef = doc(db, 'clinics', '_common', 'modules', candidate);
      const snap = await tx.get(moduleRef);

      if (!snap.exists()) {
        const moduleDoc: ModuleDoc = {
          typeKey: candidate,
          typeLabel: typeLabel.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(createdBy ? { createdBy } : {}),
        };

        tx.set(moduleRef, moduleDoc);
        return moduleDoc;
      }

      candidate = `${base}-${i + 2}`;
    }

    throw new Error('Unable to create module: too many similar names. Try a different name.');
  });
}
