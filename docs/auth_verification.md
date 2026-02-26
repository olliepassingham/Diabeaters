# Auth Implementation Verification

Lightweight sanity checks for OAuth, password reset, and verification. No external credentials required.

## 1. Auth callback route

- [ ] `/auth/callback` route exists in `App.tsx` (MainRouter)
- [ ] `AuthCallback` page calls `handleAuthCallback()` on mount
- [ ] Success → redirects to `/` (dashboard)
- [ ] Error → redirects to `/login` with `?error=` and shows toast

**Files:** `client/src/App.tsx`, `client/src/pages/auth-callback.tsx`

## 2. Provider buttons (Login and Signup)

- [ ] Three buttons: "Continue with Apple", "Continue with Google", "Continue with Microsoft"
- [ ] Each has `aria-label`: "Continue with Apple", "Continue with Google", "Continue with Microsoft"
- [ ] Provider mappings: Apple → `'apple'`, Google → `'google'`, Microsoft → `'azure'`
- [ ] Buttons use consistent Tailwind styling (e.g. `variant="outline"`, `className="w-full"`)

**Files:** `client/src/pages/login.tsx`, `client/src/pages/signup.tsx`

## 3. auth.ts exports and redirectTo

- [ ] `signInWithProvider(provider: 'apple'|'google'|'azure')` exported
- [ ] `handleAuthCallback()` exported
- [ ] `sendPasswordResetEmail(email)` exported
- [ ] `updatePassword(newPassword)` exported
- [ ] OAuth `redirectTo` uses `window.location.origin + '/auth/callback'`
- [ ] Password reset `redirectTo` uses `window.location.origin + '/reset-password'`

**File:** `client/src/lib/auth.ts`

## 4. Password reset flow

- [ ] "Forgot your password?" link on Login → `/reset-request`
- [ ] `/reset-request`: email form, success message: "If an account exists for that email, we've sent a reset link."
- [ ] `/reset-password`: guarded form (new + confirm password)
- [ ] Without temporary session: shows friendly error and link back to `/reset-request`
- [ ] On success: redirect to `/login` with success toast

**Files:** `client/src/pages/login.tsx`, `client/src/pages/reset-request.tsx`, `client/src/pages/reset-password.tsx`

## 5. README completeness

- [ ] OAuth section: Site URL, Redirect URLs (`/auth/callback` for localhost and production)
- [ ] Provider sections: Apple, Google, Microsoft with single redirect URL
- [ ] Password reset section: Redirect URLs for `/reset-password` (localhost and production)
- [ ] iOS notes for both OAuth and password reset

**File:** `README.md`

## 6. Email verification flow

- [ ] **Signup**: After signup success, redirect to `/check-email` (do not assume user is verified)
- [ ] **requireVerified**: If no user → redirect to `/login`; if user not verified → redirect to `/check-email` with friendly message
- [ ] **Simulate unverified user**: `requireVerified(unverifiedUser, setLocation)` should redirect to `/check-email`
- [ ] **Simulate verified user**: `requireVerified(verifiedUser, setLocation)` allows access to dashboard
- [ ] **resendVerification**: Calls `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: origin + '/auth/callback' } })`
- [ ] **Auth callback**: After session finalised, if verified → `/`; else → `/check-email`
- [ ] **Login**: If login succeeds but user not verified → redirect to `/check-email` with banner
- [ ] **ProtectedLayout**: Uses `requireVerified` so only verified users access dashboard

**Files:** `client/src/lib/auth.ts`, `client/src/pages/check-email.tsx`, `client/src/App.tsx`, `client/src/pages/login.tsx`, `client/src/pages/signup.tsx`, `client/src/pages/auth-callback.tsx`
