import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

const NOT_CONFIGURED = new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");

type AuthResult<T> = {
  data: T | null;
  error: AuthError | Error | null;
};

export type OAuthProvider = "apple" | "google" | "azure";

export async function signup(
  email: string,
  password: string,
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "consent" },
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

export async function handleAuthCallback(): Promise<{ user: User }> {
  const supabase = getSupabase();
  if (!supabase) throw NOT_CONFIGURED;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (session?.user) return { user: session.user };

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
): Promise<AuthResult<{ user: User }>> {
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
): Promise<AuthResult<{ user: User }>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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

  const {
    data: { subscription },
    error,
  } = supabase.auth.onAuthStateChange(cb);

  return {
    data: subscription
      ? {
          unsubscribe: () => {
            subscription.unsubscribe();
          },
        }
      : null,
    error,
  };
}
