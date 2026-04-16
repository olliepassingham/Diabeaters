import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from "@supabase/supabase-js";
import { getAuthCallbackUrl, getResetPasswordUrl } from "./auth-app-url";
import { getSupabase } from "./supabase";

const NOT_CONFIGURED = new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");

type AuthResult<T> = {
  data: T | null;
  error: AuthError | Error | null;
};

export type OAuthProvider = "apple" | "google" | "azure";

/** Maps Supabase auth errors to friendly copy; use for login and signup. */
export function describeAuthErrorForDisplay(error: AuthError | Error): {
  message: string;
  suggestCheckEmail?: boolean;
} {
  const raw = error.message ?? "";
  const msg = raw.toLowerCase();
  const code =
    "code" in error && typeof (error as AuthError).code === "string"
      ? ((error as AuthError).code ?? "")
      : "";

  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("confirm your email") ||
    (msg.includes("email") && msg.includes("not confirmed"))
  ) {
    return {
      message:
        "Check your email to verify your account, then try again. You can resend the link from the check-email page.",
      suggestCheckEmail: true,
    };
  }
  if (
    msg.includes("invalid login") ||
    msg.includes("invalid credentials") ||
    code === "invalid_credentials" ||
    msg.includes("wrong password")
  ) {
    return { message: "Wrong email or password." };
  }
  return { message: raw || "Something went wrong." };
}

/** Browser-specific messages when fetch to Supabase never completes. */
export function describeAuthNetworkError(message: string): string {
  const m = message.toLowerCase();
  if (
    m === "failed to fetch" ||
    m === "load failed" ||
    m.includes("networkerror") ||
    m.includes("network request failed")
  ) {
    return "Could not connect to Supabase. Check your network and VPN, confirm VITE_SUPABASE_URL in .env/.env.local, restart the dev server after env changes, and ensure your Supabase project is active.";
  }
  return message;
}

export async function signup(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    return { data, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export function isUserVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  const ids = user.identities ?? [];
  return ids.some((id) => {
    if (!id) return false;
    const data = (id as { identity_data?: { email?: string } }).identity_data;
    const confirmedAt = (id as { confirmed_at?: string }).confirmed_at;
    return data?.email != null && confirmedAt != null;
  });
}

export function requireVerified(
  user: User | null,
  setLocation: (path: string) => void,
): boolean {
  if (!user) {
    setLocation("/login");
    return false;
  }
  if (!isUserVerified(user)) {
    setLocation("/check-email?message=Please verify your email to continue.");
    return false;
  }
  return true;
}

export async function resendVerification(
  email: string,
): Promise<AuthResult<{}>> {
  const supabase = getSupabase();
  if (!supabase) return { data: {}, error: NOT_CONFIGURED };

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });
    return { data: {}, error };
  } catch (e) {
    return {
      data: {},
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function signInWithProvider(
  provider: OAuthProvider,
): Promise<AuthResult<{ url: string }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthCallbackUrl(),
        queryParams: { prompt: "consent" },
      },
    });
    if (data?.url) return { data: { url: data.url }, error };
    return { data: null, error: error ?? new Error("Could not start OAuth sign-in") };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function handleAuthCallback(): Promise<{ user: User }> {
  const supabase = getSupabase();
  if (!supabase) throw NOT_CONFIGURED;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (session?.user) return { user: session.user };

  // Fallback: if a user is already available, return it without waiting.
  // This helps in cases where getSession() is empty but the auth user is resolvable.
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) return { user: data.user };
  } catch {
    // Continue to onAuthStateChange
  }

  return new Promise<{ user: User }>((resolve, reject) => {
    const { data } = onAuthStateChange((_event, sess) => {
      if (sess?.user) {
        clearTimeout(timeoutId);
        data?.unsubscribe();
        resolve({ user: sess.user });
      }
    });

    const timeoutId = setTimeout(() => {
      data?.unsubscribe();
      reject(new Error("Could not complete sign in. Please try again."));
    }, 8000);
  });
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<AuthResult<{}>> {
  const supabase = getSupabase();
  if (!supabase) return { data: {}, error: NOT_CONFIGURED };

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { data: {}, error };
  } catch (e) {
    return {
      data: {},
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function updatePassword(
  newPassword: string,
): Promise<AuthResult<{ user: User | null }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function updateEmail(
  newEmail: string,
): Promise<AuthResult<{ user: User | null }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: getAuthCallbackUrl() },
    );
    return { data, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function logout(): Promise<AuthResult<{}>> {
  const supabase = getSupabase();
  if (!supabase) return { data: {}, error: NOT_CONFIGURED };

  try {
    const { error } = await supabase.auth.signOut();
    return { data: {}, error };
  } catch (e) {
    return {
      data: {},
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function getCurrentUser(): Promise<
  AuthResult<{ user: User | null }>
> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export function onAuthStateChange(
  cb: (event: AuthChangeEvent, session: Session | null) => void,
): AuthResult<{ unsubscribe: () => void }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: null, error: NOT_CONFIGURED };
  }

  const res = supabase.auth.onAuthStateChange(cb);
  const subscription = res.data?.subscription;

  return {
    data: subscription
      ? {
          unsubscribe: () => {
            subscription.unsubscribe();
          },
        }
      : null,
    // Older/newer supabase-js typings differ on whether an `error` is present here.
    error: (res as unknown as { error?: AuthError | null }).error ?? null,
  };
}
