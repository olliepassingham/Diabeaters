import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, onAuthStateChange } from "@/lib/auth";
import { setSentryUserId } from "@/observability/sentry";
import { getSupabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        if (!isMounted) return;
        setUser(null);
        setSession(null);
        setSentryUserId(null);
        setLoading(false);
        return;
      }

      try {
        const [{ data }, sessionRes] = await Promise.all([
          getCurrentUser(),
          supabase.auth.getSession(),
        ]);

        if (!isMounted) return;
        setUser(data?.user ?? null);
        setSession(sessionRes.data.session ?? null);
        setSentryUserId(data?.user?.id ?? null);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setUser(null);
        setSession(null);
        setSentryUserId(null);
        setLoading(false);
      }
    })();

    const { data } = onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setSentryUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      data?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading || !user?.id) return;
    const timer = window.setTimeout(() => {
      void import("@/lib/supplies").then((m) => m.reconcileSupplies());
    }, 800);
    return () => clearTimeout(timer);
  }, [loading, user?.id]);

  const value: AuthContextValue = { user, session, loading };
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
