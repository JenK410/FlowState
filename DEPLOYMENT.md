# FlowState Non-Local Deployment

For a link that works when this computer is asleep or VS Code is closed, deploy FlowState to a cloud Node host.

## Recommended Path: Render

1. Push this app folder to a private GitHub repository.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render will read `render.yaml` and use the included `Dockerfile`.
4. Add the environment variables below in Render.
5. Deploy. The app will be available at Render's public HTTPS URL.

## Required Environment Variables

Use Render/Railway/Fly secret environment variables. Do not put these in code.

```text
GEMINI_API_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIRESTORE_DATABASE_ID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_MAINFRAME_PRICE_ID
VITE_STRIPE_PUBLISHABLE_KEY
FIREBASE_SERVICE_ACCOUNT_KEY
FIREBASE_SERVICE_ACCOUNT_BASE64
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Optional invite email support:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Use one Firebase Admin credential method in Render:

- `FIREBASE_SERVICE_ACCOUNT_KEY`: full Firebase service account JSON pasted as one secret value.
- `FIREBASE_SERVICE_ACCOUNT_BASE64`: Base64-encoded service account JSON.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`: split service account values.

Keep the local JSON file out of git.

## Firebase Authentication

Use Firebase project number `88050491406`. This codebase already contains a web app config for that project:

```text
projectId: gen-lang-client-0683642806
appId: 1:88050491406:web:06b09933cb2bf769b91c5f
messagingSenderId: 88050491406
```

In Firebase Console:

1. Go to **Authentication > Sign-in method**.
2. Enable **Email/Password**.
3. Go to **Authentication > Settings > Authorized domains**.
4. Add the deployed Render domain without `https://`.

Example:

```text
flowstate.onrender.com
```

## Stripe Webhook

After deployment, set the Stripe webhook endpoint to:

```text
https://YOUR-PUBLIC-APP-URL/api/stripe/webhook
```

Listen for Checkout/subscription events. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Local vs Non-Local

`npm run start:background` keeps a local production copy running on this computer at `http://127.0.0.1:3002`.

Cloud deployment is what makes FlowState available to other people even when this computer is off, asleep, or not connected.
