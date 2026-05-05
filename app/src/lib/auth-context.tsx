import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, onAuthStateChange } from "@/lib/auth";
import { setActiveUserIdForLocalStorage } from "@/lib/storage";
import { setSentryUserId } from "@/observability/sentry";
import { getSupabase } from "@/lib/supabase";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { ensureIosPushRegistered } from "@/lib/push-tokens";
import { storage } from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getE2EUser(): User | null {
  try {
    const raw = localStorage.getItem("diabeater_e2e_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
    const email = typeof parsed.email === "string" ? parsed.email : "test@example.com";
    const email_confirmed_at =
      typeof parsed.email_confirmed_at === "string" ? parsed.email_confirmed_at : new Date().toISOString();
    return {
      ...(parsed as User),
      id: parsed.id,
      email,
      email_confirmed_at,
    } as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialE2EUser = getE2EUser();
  const [user, setUser] = useState<User | null>(initialE2EUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!initialE2EUser);

  useEffect(() => {
    let isMounted = true;
    setActiveUserIdForLocalStorage(null);

    (async () => {
      if (initialE2EUser) {
        if (!isMounted) return;
        setUser(initialE2EUser);
        setSession(null);
        setActiveUserIdForLocalStorage(initialE2EUser.id);
        setSentryUserId(initialE2EUser.id);
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        if (!isMounted) return;
        setUser(null);
        setSession(null);
        setActiveUserIdForLocalStorage(null);
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
        const uid = data?.user?.id ?? null;
        setUser(data?.user ?? null);
        setSession(sessionRes.data.session ?? null);
        setActiveUserIdForLocalStorage(uid);
        setSentryUserId(uid);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setUser(null);
        setSession(null);
        setActiveUserIdForLocalStorage(null);
        setSentryUserId(null);
        setLoading(false);
      }
    })();

    if (initialE2EUser) return;

    const { data } = onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setActiveUserIdForLocalStorage(session?.user?.id ?? null);
      setSentryUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      data?.unsubscribe();
    };
  }, [initialE2EUser]);

  useEffect(() => {
    if (loading || !user?.id) return;
    void ensureIosPushRegistered();
    /** Keeps `notification_preferences` aligned with this device so edge functions see `push: true`. */
    void syncNotificationPreferences(storage.getNotificationSettings());
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
