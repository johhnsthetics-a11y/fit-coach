# Student and Patient Auth Credentials Design

## Goal

Give every student or patient a real CoachFit login created by their responsible professional. The professional receives a one-time temporary password, shares the credentials through copy or WhatsApp, and the client must create a private password at first login before entering the existing payment funnel.

## Scope

- Trainer and nutritionist can generate access only for their own student or patient.
- The login email is the email already stored on the client record.
- Supabase Auth remains the only password authority.
- The temporary password is returned once and is never stored in plaintext.
- The existing invitation portal and Cartpanda financial rules are reused.
- Existing clients are migrated on demand with a `Generate access` action.
- Automated email delivery is out of scope. The professional uses copy or WhatsApp.

## User Flow

1. The professional creates or opens a student/patient with a valid unique email.
2. `Generate access` calls an authenticated Edge Function.
3. The function verifies the caller owns the client, creates the Auth user, links it to the client, and returns a temporary password once.
4. The UI shows email, temporary password, `Copy access`, and `Send via WhatsApp`.
5. The client signs in through the normal CoachFit login.
6. CoachFit detects that the Auth user belongs to a student/patient and requires a password change.
7. After the password is changed, CoachFit opens the existing client portal.
8. If CoachFit activation is pending, the R$ 25/month activation screen is shown.
9. Cartpanda approval unlocks the tools. Renewal failure blocks them again. Professional-fee debt remains an independent higher-priority block.

## Data Model

Add to `public.students`:

- `auth_user_id uuid null unique references auth.users(id) on delete set null`
- `must_change_password boolean not null default false`
- `credentials_generated_at timestamptz null`

Student and patient continue to share the existing `students` entity. Their responsible professional type is derived from the existing professional relationship.

No password or password hash is stored in `public.students`.

## Backend API

### Generate credentials Edge Function

Create an authenticated `student-credentials` Edge Function.

Input:

- `studentId`

Authorization and validation:

- Validate the caller JWT with Supabase Auth.
- Fetch the student by `studentId` and caller `coach_id`; never trust a frontend `coachId`.
- Require a valid normalized student email.
- Refuse generation when the email is already linked to an unrelated Auth account.
- If `auth_user_id` is already linked and `must_change_password = true`, replace the unused temporary password and return a new one. This makes a lost response safely recoverable.
- If `must_change_password = false`, refuse regeneration. Password recovery handles later access problems without exposing a new password to the professional.

Operation:

- Generate a cryptographically secure temporary password.
- Create a confirmed Supabase Auth user with non-authoritative display metadata only.
- Store authorization role in Auth app metadata, not user metadata.
- Link the returned Auth user ID to the owned student and set `must_change_password = true`.
- Return email and temporary password only in the successful response.
- If linking fails after Auth creation, delete the newly created Auth user as compensation.

The service role is used only inside the Edge Function and is never exposed to the browser.

### Current-client bootstrap RPC

Add an authenticated function that resolves the caller through `students.auth_user_id = auth.uid()` and returns only:

- owned active invitation code needed by the current portal compatibility layer;
- `must_change_password`;
- student ID and professional type needed for routing.

The function must return only the row linked to the current Auth user. It is not available to `anon`.

### Complete first password change action

Add a second authenticated action to the credentials Edge Function. It validates the temporary-login JWT, resolves the student through `auth_user_id = auth.uid()`, validates the new password, updates that same Auth user's password, and then clears `must_change_password` on the linked student. If the database update fails after the Auth password update, the still-authenticated user can retry the same action with the new password; portal access remains blocked until both operations succeed.

## Frontend

### Professional area

- Add `Generate access` to the existing student/patient action area.
- Disable the action when the client has no valid email.
- Show credentials in a focused modal after successful generation.
- Provide copy and WhatsApp actions with role-aware wording (`student` or `patient`).
- Warn that the temporary password appears only once.
- While first access is still pending, offer `Generate new temporary password`; after the client creates a personal password, show `Access already active` and direct later access problems to password recovery.

### Login routing

- Keep the current professional login unchanged.
- After `signInWithPassword`, call the current-client bootstrap before loading professional data.
- If a student link exists, route to the student/patient experience.
- Otherwise continue with the professional bootstrap.
- Never infer authorization from editable Auth user metadata.

### First login

- Show a dedicated password-change screen with email read-only, new password, confirmation, validation, and loading/error states.
- Submit the new password to the authenticated Edge Function action so it can update the current Auth user and clear the first-login flag in one controlled operation.
- Clear `must_change_password` only after Auth confirms the update.
- Do not render portal or payment content until this step succeeds.

### Portal compatibility

The first release reuses the existing secure invitation-backed portal functions after the authenticated bootstrap returns the client's own active invitation. The invitation is kept out of the browser URL and is not displayed. This avoids rewriting workout, nutrition, questionnaire, chat, check-in, XP, and Cartpanda flows in the same release.

A later migration may replace invitation arguments with `auth.uid()`-scoped RPCs and then disable anonymous portal access after all clients have Auth accounts. That hardening is deliberately outside this release to preserve compatibility.

## Security

- Only the owner professional can generate credentials.
- Only the linked Auth user can bootstrap a client portal and clear first-login state.
- The temporary password is generated with Web Crypto and returned once.
- Plaintext passwords are never logged, persisted, included in analytics, or stored in local storage.
- Edge Function logs redact credentials and tokens.
- Duplicate email conflicts do not reveal whether an unrelated account exists beyond a generic support message.
- Existing financial enforcement remains server-side and cannot be unlocked by URL or frontend state.
- RLS remains enabled; no public table access is added.

## Failure Handling

- Missing/invalid email: professional corrects the client record first.
- Duplicate email: no new account is created; show a generic account-conflict message.
- Edge Function timeout: generation is idempotent through the persisted `auth_user_id`; while first access remains pending, retry replaces the temporary password instead of creating a second account.
- Auth user created but database link fails: remove the newly created Auth user before returning failure.
- Password update succeeds but flag clearing fails: keep portal access blocked and let the authenticated user retry the first-password action with the newly chosen password.
- Cartpanda delay/failure continues to use the existing activation and renewal states.

## Testing

- Professional cannot generate access for another professional's client.
- Trainer generates student credentials; nutritionist generates patient credentials.
- Missing or duplicate email is rejected without creating partial records.
- Temporary password is returned once and not persisted.
- Student/patient login is routed away from the professional area.
- First login requires a valid new password and confirmation.
- Refresh before and after password change preserves the correct state.
- Existing professional login remains unchanged.
- Existing invitation portal remains functional during rollout.
- Pending activation, active access, failed renewal, cancellation, and professional debt preserve current behavior.
- Build, lint, typecheck, focused Auth tests, and existing critical funnel tests pass.

## Rollout

1. Apply the additive migration.
2. Deploy the credentials Edge Function.
3. Deploy the frontend and RPC integration.
4. Generate access for one controlled student and one controlled patient.
5. Validate first login, password change, Cartpanda activation, refresh, logout, and login with the new password.
6. Enable professionals to generate access for existing clients on demand.

Rollback is additive: hide the generation action and keep the existing invitation portal available. Existing professional accounts and financial states are unaffected.
