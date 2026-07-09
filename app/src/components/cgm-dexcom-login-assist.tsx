import { useState } from "react";
import { ChevronDown, ClipboardPaste, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

export function DexcomLoginAssist({
  server,
  onAccountIdPasted,
  onAssistError,
  className,
}: DexcomLoginAssistProps) {
  const [open, setOpen] = useState(false);
  const portalUrl = dexcomAccountPortalUrl(server);

  const pasteAccountId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const extracted = extractDexcomAccountIdFromInput(text);
      if (!extracted) {
        onAssistError?.(
          "No Dexcom account ID found. Copy the full web address from the Dexcom account portal after you sign in.",
        );
        return;
      }
      onAccountIdPasted(extracted);
      onAssistError?.(null);
      setOpen(false);
    } catch {
      onAssistError?.("Could not read the clipboard. Paste the account ID into the field manually.");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-xs font-medium text-foreground hover:bg-muted/35">
        <span>Email login didn&apos;t work? Find your account ID</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
          <li>Enable Share in the Dexcom G7 app (add at least one follower if asked).</li>
          <li>Open the Dexcom account portal and sign in with the same password.</li>
          <li>Copy the web address — your account ID is the long code in the URL.</li>
          <li>Paste below; we&apos;ll pull out the ID automatically.</li>
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
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => void pasteAccountId()}
            data-testid="button-dexcom-paste-account-id"
          >
            <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
            Paste from clipboard
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
