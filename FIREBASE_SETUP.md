# FlowState Firebase Setup

FlowState uses Firebase project number `88050491406`.

Current registered web app config:

```text
projectId: gen-lang-client-0683642806
appId: 1:88050491406:web:06b09933cb2bf769b91c5f
messagingSenderId: 88050491406
```

## Enable Email/Password Authentication

1. Open Firebase Console.
2. Select project `gen-lang-client-0683642806`.
3. Go to **Authentication > Sign-in method**.
4. Enable **Email/Password**.
5. Save.

The app already uses:

```text
createUserWithEmailAndPassword
signInWithEmailAndPassword
```

## Add Deployed Domain

After Render deploys FlowState:

1. Go to **Authentication > Settings > Authorized domains**.
2. Add the Render domain without `https://`.

Example:

```text
flowstate.onrender.com
```

## Firestore

The app uses Firestore through `src/lib/firebase.ts`.

The current named database ID is:

```text
ai-studio-96491054-260f-4ee7-b4d2-c73b2a6faa0f
```

Set this in Render:

```text
VITE_FIRESTORE_DATABASE_ID=ai-studio-96491054-260f-4ee7-b4d2-c73b2a6faa0f
```

## Render Environment Variables

Add these to Render before deploying:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0683642806.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0683642806
VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0683642806.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=88050491406
VITE_FIREBASE_APP_ID=1:88050491406:web:06b09933cb2bf769b91c5f
VITE_FIRESTORE_DATABASE_ID=ai-studio-96491054-260f-4ee7-b4d2-c73b2a6faa0f
FIREBASE_SERVICE_ACCOUNT_KEY
FIREBASE_SERVICE_ACCOUNT_BASE64
```

Use either `FIREBASE_SERVICE_ACCOUNT_KEY` as the full service account JSON from Firebase Console, or `FIREBASE_SERVICE_ACCOUNT_BASE64` as the Base64-encoded JSON. Store either value only as a Render secret.
