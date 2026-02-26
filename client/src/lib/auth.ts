import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthResult<T> = {
  data: T | null;
  error: AuthError | null;
};

export async function signup(
  email: string,
  password: string,
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  return { data, error };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function logout(): Promise<AuthResult<{}>> {
  const { error } = await supabase.auth.signOut();
  return { data: {}, error };
}

export async function getCurrentUser(): Promise<
  AuthResult<{ user: User | null }>
> {
  const { data, error } = await supabase.auth.getUser();
  return { data, error };
}

export function onAuthStateChange(
  cb: (event: AuthChangeEvent, session: Session | null) => void,
): AuthResult<{ unsubscribe: () => void }> {
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

