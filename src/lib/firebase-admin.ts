import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let _db: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (_db) return _db;

  const app =
    getApps().length === 0
      ? initializeApp({
          credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
              /\\n/g,
              "\n"
            ),
          }),
        })
      : getApps()[0];

  _db = getFirestore(app);
  return _db;
}
