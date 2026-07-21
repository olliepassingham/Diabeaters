import { useEffect, useState } from "react";
import { ClipboardPaste, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dexcomAccountPortalUrl,
  extractDexcomAccountIdFromInput,
  isDexcomAccountId,
  type DexcomShareServer,
} from "@/lib/cgm/dexcom-share-client";
import { openExternalUrl } from "@/lib/open-external-url";
import { cn } from "@/lib/utils";

type DexcomLoginAssistProps = {
  server: DexcomShareServer;
  onAccountIdPasted: (accountId: string) => void;
  onAssistError?: (message: string | null) => void;
  /** Highlight the guide after a failed email/password attempt. */
  emphasize?: boolean;
  className?: string;
};

export function formatDexcomStoredLoginLabel(username: string): string {
  if (!isDexcomAccountId(username)) return username;
  return `Account linked (${username.slice(0, 8)}…)`;
}

/** Normalize email, phone, raw UUID, or pasted portal URL for the Dexcom login field. */
export function normalizeDexcomUsernameInput(raw: string): string {
  return extractDexcomAccountIdFromInput(raw) ?? raw;
}

/** True when a Connect failure should push the user toward the account-ID path. */
export function shouldEmphasizeDexcomAccountIdAssist(error: string | null | undefined): boolean {
  if (!error) return false;
  return /password|login failed|account|email|share|rejected|invalid|authenticate|500/i.test(error);
}

/**
 * Primary Dexcom Share setup guide. Account ID from the Dexcom portal is the
 * reliable path for many G7/Clarity accounts — email/phone often fails against
 * the unofficial Share API even when the password is correct.
 */
export function DexcomLoginAssist({
  server,
  onAccountIdPasted,
  onAssistError,
  emphasize = false,
  className,
}: DexcomLoginAssistProps) {
  const [pasteFlash, setPasteFlash] = useState(false);
  const portalUrl = dexcomAccountPortalUrl(server);

  useEffect(() => {
    if (!pasteFlash) return;
    const id = window.setTimeout(() => setPasteFlash(false), 1600);
    return () => window.clearTimeout(id);
  }, [pasteFlash]);

  const pasteAccountId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const extracted = extractDexcomAccountIdFromInput(text);
      if (!extracted) {
        onAssistError?.(
          "No Dexcom account ID found. After signing in at the portal, copy the full web address from the address bar, then paste here.",
        );
        return;
      }
      onAccountIdPasted(extracted);
      onAssistError?.(null);
      setPasteFlash(true);
    } catch {
      onAssistError?.("Could not read the clipboard. Paste the portal link or account ID into the field below.");
    }
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border px-3 py-3",
        emphasize
          ? "border-amber-400/60 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-950/30"
          : "border-border/60 bg-muted/20",
        className,
      )}
      data-testid="dexcom-login-assist"
      data-emphasized={emphasize ? "true" : "false"}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">
          {emphasize ? "Email login often fails — use your account ID" : "Recommended: connect with your account ID"}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Dexcom Share frequently rejects email or phone for G7/Clarity accounts. Your account ID from the Dexcom portal
          is the reliable way in.
        </p>
      </div>

      <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
        <li>
          In the <span className="font-medium text-foreground">Dexcom G7</span> app, turn on{" "}
          <span className="font-medium text-foreground">Share</span> and add at least one follower if asked.
        </li>
        <li>Open the Dexcom account portal and sign in with the same password you use in the Dexcom app.</li>
        <li>
          Copy the web address — it contains a long code like{" "}
          <span className="font-mono text-[10px] text-foreground/80">a1b2c3d4-…</span>
        </li>
        <li>Paste below. We extract the ID automatically.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={() => openExternalUrl(portalUrl)}
          data-testid="button-dexcom-open-portal"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open account portal
        </Button>
        <Button
          type="button"
          variant={pasteFlash ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={() => void pasteAccountId()}
          data-testid="button-dexcom-paste-account-id"
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          {pasteFlash ? "Account ID pasted" : "Paste from clipboard"}
        </Button>
      </div>
    </div>
  );
}
