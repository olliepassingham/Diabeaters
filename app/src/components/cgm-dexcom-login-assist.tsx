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
 * Short Dexcom Share setup guide. Email or phone is the first path.
 * The portal account ID is the backup after a failed login.
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
          "No account ID found. Copy the full portal web address, then paste here.",
        );
        return;
      }
      onAccountIdPasted(extracted);
      onAssistError?.(null);
      setPasteFlash(true);
    } catch {
      onAssistError?.("Could not read clipboard. Paste the portal link into the field below.");
    }
  };

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border px-3 py-3",
        emphasize
          ? "border-amber-400/60 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-950/30"
          : "border-border/60 bg-muted/20",
        className,
      )}
      data-testid="dexcom-login-assist"
      data-emphasized={emphasize ? "true" : "false"}
    >
      <p className="text-sm font-semibold text-foreground">
        {emphasize ? "Try your account ID instead" : "Quick setup"}
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-sm leading-snug text-muted-foreground">
        <li>
          In Dexcom, turn on <span className="font-medium text-foreground">Share</span>
        </li>
        {emphasize ? (
          <>
            <li>Open the account portal and sign in</li>
            <li>Copy the web address, then paste below</li>
          </>
        ) : (
          <li>Enter the email or phone you use there, plus your password</li>
        )}
      </ol>

      {emphasize ? (
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
            Open portal
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
            {pasteFlash ? "Pasted" : "Paste ID"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
