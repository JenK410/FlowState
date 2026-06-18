import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import fallbackFirebaseConfig from '../../firebase-applet-config.json';

const envFirebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasCompleteEnvFirebaseConfig = [
  envFirebaseConfig.apiKey,
  envFirebaseConfig.authDomain,
  envFirebaseConfig.projectId,
  envFirebaseConfig.storageBucket,
  envFirebaseConfig.messagingSenderId,
  envFirebaseConfig.appId,
].every(Boolean);

const firebaseConfig: FirebaseOptions = hasCompleteEnvFirebaseConfig
  ? envFirebaseConfig
  : fallbackFirebaseConfig;

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'ai-studio-96491054-260f-4ee7-b4d2-c73b2a6faa0f';

// Initialize Firestore with long-polling to improve reliability in the preview environment
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
googleProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export async function createEmailAccount(email: string, password: string, name: string) {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const displayName = name.trim() || email.trim().split('@')[0] || 'FlowState Member';
  await updateProfile(result.user, { displayName });
  return result;
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

// Validate Connection to Firestore as per skill guidelines
export async function testConnection() {
  try {
    // Attempting a fetch from server to ensure connectivity as recommended by the skill
    await getDocFromServer(doc(db, '_healthcheck', 'connection'));
    console.log("[Firebase] Firestore connection verified");
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) {
      // Quietly return false, caller can handle retry or warning
      return false;
    }
    console.warn("[Firebase] Connection check encountered an unexpected error:", error);
    return false;
  }
}
// Do not call testConnection() here at the top level to avoid race conditions with sandbox boot

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errString);
  if (operationType !== OperationType.LIST && operationType !== OperationType.GET) {
    throw new Error(errString);
  }
}
