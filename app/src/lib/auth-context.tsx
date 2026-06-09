import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentUser, onAuthStateChange } from "@/lib/auth";
import { setActiveUserIdForLocalStorage } from "@/lib/storage";
import { setSentryUserId } from "@/observability/sentry";
import { getSupabase } from "@/lib/supabase";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { ensureNativePushRegistered, syncRememberedPushTokenToSupabase } from "@/lib/push-tokens";
import { storage } from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Apply a Supabase session immediately (e.g. right after password sign-in). */
  syncAuthSession: (session: Session | null) => void;
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

  const syncAuthSession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    const uid = nextSession?.user?.id ?? null;
    setActiveUserIdForLocalStorage(uid);
    setSentryUserId(uid);
  }, []);

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

    const { data } = onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      syncAuthSession(nextSession ?? null);
      // Avoid hammering GoTrue's storage lock on TOKEN_REFRESHED; only sync when session identity is established.
      if (
        nextSession?.user?.id &&
        (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED")
      ) {
        void syncRememberedPushTokenToSupabase();
      }
    });

    return () => {
      isMounted = false;
      data?.unsubscribe();
    };
  }, [initialE2EUser, syncAuthSession]);

  useEffect(() => {
    if (loading || !user?.id) return;
    let cancelled = false;
    let suppliesIdleId = 0;
    let suppliesTimeoutId = 0;

    const runPushAndPrefs = () => {
      if (cancelled) return;
      /** Sequential so push registration and prefs upsert do not fight GoTrue's auth storage lock. */
      void (async () => {
        await ensureNativePushRegistered();
        if (cancelled) return;
        await syncNotificationPreferences(storage.getNotificationSettings());
      })();
    };

    const runSuppliesReconcile = () => {
      if (cancelled) return;
      void import("@/lib/supplies").then((m) => m.reconcileSupplies());
    };

    const scheduleSupplies = () => {
      if (typeof window.requestIdleCallback === "function") {
        suppliesIdleId = window.requestIdleCallback(runSuppliesReconcile, { timeout: 6000 });
      } else {
        suppliesTimeoutId = window.setTimeout(runSuppliesReconcile, 4000);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const pushIdleId = window.requestIdleCallback(
        () => {
          runPushAndPrefs();
          scheduleSupplies();
        },
        { timeout: 3000 },
      );
      return () => {
        cancelled = true;
        window.cancelIdleCallback(pushIdleId);
        if (suppliesIdleId) window.cancelIdleCallback(suppliesIdleId);
        if (suppliesTimeoutId) window.clearTimeout(suppliesTimeoutId);
      };
    }

    const pushTimer = window.setTimeout(() => {
      runPushAndPrefs();
      scheduleSupplies();
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(pushTimer);
      if (suppliesIdleId) window.cancelIdleCallback(suppliesIdleId);
      if (suppliesTimeoutId) window.clearTimeout(suppliesTimeoutId);
    };
  }, [loading, user?.id]);

  const value: AuthContextValue = { user, session, loading, syncAuthSession };
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
