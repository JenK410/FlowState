# Global Workspace Joining Architecture & Rules for FlowState

For all future prompts, code modifications, or debugging tasks associated with workspace invitations and team boarding features in 'FlowState', the codebase must strictly adhere to the following architectural guidelines.

## 1. Deep Link Detection & Pre-Auth Gate
- **Parameter Capture**: When a deep link or URL containing a workspace invitation token (`invite`) or join code (`join`) is visited, the URL parameters MUST be immediately read.
- **Pre-Auth Storage**: Before initiating any sign-in/Google Authentication redirects or flows, the invite token or join code must be saved to client-side storage (`localStorage` as key `pending_invite_token` and `pending_join_code` respectively) to guarantee persistence across subsequent page reloads or authentication redirects.

## 2. Post-Auth Hydration
- **Auth Trigger Check**: Upon a successful user authentication state transition (`onAuthStateChanged` hook or equivalent auth listener), the app must promptly query the stored pending tokens from state/local cache.
- **Relationship Resolution**: If a pending invitation or registration code exists, fetch the corresponding workspace metadata from FireStore/the backend and prompt the user using an elegant invitation modal or dialog block.
- **Loading Phase & State Hydration**: Highlight a clear user-facing loading state (e.g., indicator/spinner showing "Joining workspace...") during the backend transaction execution to prevent premature view transition.

## 3. Atomic Completion & State Synchronization
- **Membership Creation**: Create the membership document linking the user and organization under the secure database collection:
  - Add standard worker/member roles.
  - Mark matching invite entries as `accepted` or `declined`.
- **State Purge**: Atomically remove and clear `pending` workspace references in client memory storage (`localStorage`) upon a successful database transaction to prevent duplicate application submissions.
- **Sidebar Integration**: Force reactive state updates or view transitions causing immediate sidebar item re-population.
