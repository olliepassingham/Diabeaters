import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChange } from "@/lib/auth";
import { clearCarerClientSessionKeys, onboardingAccountPathFromUserMetadata } from "@/lib/carer-session";
import { restoreAccountSessionFromCloud } from "@/lib/account-session-restore";
import {
  readPersistedAuthSession,
  recoverAuthSessionAfterNull,
} from "@/lib/persisted-auth-session";
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
  const userIdRef = useRef<string | null>(initialE2EUser?.id ?? null);

  const syncAuthSession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    const uid = nextSession?.user?.id ?? null;
    userIdRef.current = uid;
    setActiveUserIdForLocalStorage(uid);
    setSentryUserId(uid);
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (initialE2EUser) {
        if (!isMounted) return;
        setUser(initialE2EUser);
        setSession(null);
        userIdRef.current = initialE2EUser.id;
        setActiveUserIdForLocalStorage(initialE2EUser.id);
        setSentryUserId(initialE2EUser.id);
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        if (!isMounted) return;
        syncAuthSession(null);
        setLoading(false);
        return;
      }

      try {
        // Prefer the cached session. Never call getUser() here — it hits the network and can
        // wipe local auth when Android reports online but the refresh fails.
        const sessionRes = await supabase.auth.getSession();
        let next = sessionRes.data.session ?? null;
        if (!next) {
          // Paint from disk immediately so a slow/failed refresh cannot flash the login screen.
          const persisted = readPersistedAuthSession();
          if (persisted && isMounted) {
            syncAuthSession(persisted);
            setLoading(false);
          }
          next = await recoverAuthSessionAfterNull(supabase);
        }
        if (!isMounted) return;
        if (next) {
          syncAuthSession(next);
          setLoading(false);
        }
        // If still null, keep loading until INITIAL_SESSION (or the safety timer).
      } catch {
        if (!isMounted) return;
        try {
          const persisted = readPersistedAuthSession();
          if (persisted) {
            syncAuthSession(persisted);
            setLoading(false);
          }
          const recovered = await recoverAuthSessionAfterNull(supabase);
          if (!isMounted) return;
          if (recovered) {
            syncAuthSession(recovered);
            setLoading(false);
          }
        } catch {
          // Leave loading to INITIAL_SESSION / safety timer.
        }
      }
    })();

    if (initialE2EUser) return;

    const safetyTimer = window.setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2500);

    const { data } = onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        clearCarerClientSessionKeys();
        syncAuthSession(null);
        setLoading(false);
        return;
      }

      void (async () => {
        let sessionToApply = nextSession ?? null;

        // Failed token refresh / INITIAL_SESSION with null must not look like a logout when
        // the refresh token is still on disk — that is the weak-WiFi "please log in again" bug.
        if (!sessionToApply && (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
          const persisted = readPersistedAuthSession();
          if (persisted) {
            syncAuthSession(persisted);
            sessionToApply = persisted;
          }
          const supabase = getSupabase();
          if (supabase) {
            const recovered = await recoverAuthSessionAfterNull(supabase);
            if (recovered) sessionToApply = recovered;
          }
          // If recovery also fails but we already painted a user from bootstrap, keep them.
          if (!sessionToApply && userIdRef.current) {
            setLoading(false);
            return;
          }
        }

        if (!isMounted) return;

        if (sessionToApply) {
          syncAuthSession(sessionToApply);
        } else if (event === "INITIAL_SESSION") {
          // Truly no session on disk / invalid refresh — guest shell.
          syncAuthSession(null);
        }

        if (event === "INITIAL_SESSION") {
          setLoading(false);
        }

        const uid = sessionToApply?.user?.id;
        if (
          uid &&
          sessionToApply?.user &&
          (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED")
        ) {
          void restoreAccountSessionFromCloud(
            uid,
            onboardingAccountPathFromUserMetadata(sessionToApply.user),
          );
          // Avoid hammering GoTrue's storage lock on TOKEN_REFRESHED; only sync when
          // session identity is established.
          void syncRememberedPushTokenToSupabase();
        }
      })();
    });

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimer);
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
      void import("@/lib/offline-reconcile").then((m) => m.reconcileAfterBackOnline());
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
