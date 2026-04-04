import { Redirect } from "wouter";
import { isCommunityEnabled } from "@/lib/flags";

/** When community is disabled, send users home (feature flag). */
export function CommunityFeatureGate({ children }: { children: React.ReactNode }) {
  if (!isCommunityEnabled) return <Redirect to="/" replace />;
  return <>{children}</>;
}
