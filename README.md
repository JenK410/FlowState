<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/de7340fc-e965-43f3-83a8-1b16f049dec9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Keep FlowState running outside VS Code

For a local production copy that keeps running even if VS Code idles or the VS Code terminal closes:

1. Start the detached production server:
   `npm run start:background`
2. Open:
   `http://127.0.0.1:3002`
3. Check whether it is still running:
   `npm run status:background`
4. Stop it:
   `npm run stop:background`

This still requires the computer to stay awake and online. For a link that works while the computer is asleep or turned off, deploy FlowState to cloud hosting.

## Non-local public hosting

Use the included `Dockerfile` and `render.yaml` to deploy FlowState as a real public web app. See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact steps and required secrets.

Firebase setup details are in [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Paid analytics subscriptions

FlowState uses Stripe Checkout for real subscription payment processing.

- Mainframe Analytics: `$2.99/month`
- Workspace Analytics: `$4.99/month` for 1-15 employees, `$5.99/month` for 16-30 employees, then +`$1/month` for every additional 15 employees

Required environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MAINFRAME_PRICE_ID`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- Firebase Admin credentials. For local testing, download a service account JSON from Firebase Console > Project settings > Service accounts > Generate new private key, save it in this app folder as `firebase-admin-service-account.json`, and restart the server. You can also use `FIREBASE_SERVICE_ACCOUNT_FILE`, `FIREBASE_SERVICE_ACCOUNT_KEY`, or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

Point the Stripe webhook endpoint to `/api/stripe/webhook` and listen for Checkout/subscription events so paid access is unlocked only after Stripe confirms payment. The app also confirms the returned Checkout session through `/api/confirm-checkout-session` after Stripe redirects the user back.
