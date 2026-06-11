import { useEffect } from "react";
import { useLocation } from "wouter";

import { useAuth } from "@/lib/auth-context";
import { isUserVerified } from "@/lib/auth";
import { consumePostLoginToast, POST_LOGIN_TOAST_STASHED_EVENT } from "@/lib/post-login-toast-stash";
import { useToast } from "@/hooks/use-toast";

function showStashedPostLoginToast(toast: ReturnType<typeof useToast>["toast"]): void {
  const message = consumePostLoginToast();
  if (!message) return;
  toast(message);
}

/** Shows one-shot toasts stashed during post-login routing (e.g. patient on community welcome path). */
export function PostLoginToast() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    if (loading || !user?.id || !isUserVerified(user)) return;
    showStashedPostLoginToast(toast);
  }, [loading, user, toast, location]);

  useEffect(() => {
    const onStashed = () => {
      if (loading || !user?.id || !isUserVerified(user)) return;
      showStashedPostLoginToast(toast);
    };
    window.addEventListener(POST_LOGIN_TOAST_STASHED_EVENT, onStashed);
    return () => window.removeEventListener(POST_LOGIN_TOAST_STASHED_EVENT, onStashed);
  }, [loading, user, toast]);

  return null;
}
