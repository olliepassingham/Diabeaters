import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";
import { isUserVerified } from "@/lib/auth";
import { consumePostLoginToast } from "@/lib/community-path-patient-reconcile";
import { useToast } from "@/hooks/use-toast";

/** Shows one-shot toasts stashed during post-login routing (e.g. patient on community welcome path). */
export function PostLoginToast() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (loading || !user?.id || !isUserVerified(user)) return;
    const message = consumePostLoginToast();
    if (!message) return;
    toast(message);
  }, [loading, user, toast]);

  return null;
}
