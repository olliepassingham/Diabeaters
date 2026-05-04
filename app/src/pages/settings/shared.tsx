import type { ChangeEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { peekDiabeatersBackup, storage, type ImportBackupMode } from "@/lib/storage";
import { Link } from "wouter";
import { Phone, ChevronRight, Upload, Download, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { EmergencyProfileFields } from "@/components/emergency-profile-fields";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";

export function SettingsNavRow({ href, label }: { href: string; label: string }) {
  const className =
    "flex items-center justify-between py-3 border-b border-border last:border-b-0 text-foreground hover:text-primary transition-colors group";
  const chevron = <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden />;
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        <span className="text-body font-medium">{label}</span>
        {chevron}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <span className="text-body font-medium">{label}</span>
      {chevron}
    </Link>
  );
}

export function SettingsHubGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border-border/80 p-4 space-y-2 shadow-sm">
      <h2 className="text-h3 font-semibold text-foreground mb-2">{title}</h2>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}

export function SettingsHubNavLink({
  href,
  label,
  description,
  icon: Icon,
  dataTestId,
}: {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  dataTestId?: string;
}) {
  const className =
    "group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50";
  const body = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:text-primary">{label}</p>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/80 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </>
  );
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} data-testid={dataTestId}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={className} data-testid={dataTestId}>
      {body}
    </Link>
  );
}

export function SettingsBackLink() {
  return (
    <div className="mb-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4 rotate-180 shrink-0" aria-hidden />
        All settings
      </Link>
    </div>
  );
}

export function SettingsEmergencySection({
  variant = "standalone",
  showSyncButton = true,
}: {
  variant?: "standalone" | "embedded";
  /** Hide manual cloud sync (e.g. on Account — auto-sync still runs). */
  showSyncButton?: boolean;
}) {
  const { toast } = useToast();
  const { syncGeneration, saveNow, isLoading } = useEmergencyProfile();
  const [saving, setSaving] = useState(false);

  const handleSyncNow = async () => {
    setSaving(true);
    try {
      await saveNow();
      toast({ title: "Synced", description: "Emergency details saved to your cloud profile." });
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : "Try again later.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const intro =
    variant === "embedded" ? (
      <p className="text-sm text-muted-foreground leading-relaxed">
        Used for <Link href="/help-now" className="text-primary underline-offset-2 hover:underline">Help now</Link>
        . Linked supporters only see this if you allow it under{" "}
        <Link href="/family-carers" className="text-primary underline-offset-2 hover:underline">
          Family &amp; Supporters
        </Link>
        .
      </p>
    ) : (
      <p className="text-body text-muted-foreground">
        One record for{" "}
        <Link href="/help-now" className="text-primary underline-offset-2 hover:underline">Help now</Link>
        . Manage it on{" "}
        <Link href="/account#account-emergency" className="text-primary underline-offset-2 hover:underline">
          Account
        </Link>
        . Supporters see it only if you enable it under Family &amp; Supporters.
      </p>
    );

  return (
    <div
      className={cn("space-y-4", variant === "standalone" && "scroll-mt-24 border-t border-border pt-6")}
      data-testid="card-emergency-contacts"
    >
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Emergency details</h3>
      </div>
      {intro}
      <EmergencyProfileFields syncGeneration={syncGeneration} />
      {showSyncButton ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || saving}
            onClick={() => void handleSyncNow()}
            data-testid="button-emergency-sync-now"
          >
            {saving ? "Syncing…" : "Sync to cloud now"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Local changes apply immediately; cloud sync usually follows within a second.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function formatBackupInstant(iso: string | null): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function SettingsDataBackupSection({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<ImportBackupMode>("merge");

  const resetRestoreFlow = () => {
    setPendingJson(null);
    setRestoreMode("merge");
    setRestoreOpen(false);
  };

  const handleExport = () => {
    const data = storage.exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `diabeaters-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Backup downloaded", description: "Keep the file somewhere only you can access (it may include health-related details)." });
  };

  const handleImportFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const peek = peekDiabeatersBackup(content);
      if (!peek.ok) {
        toast({
          title: "Not a valid backup",
          description: peek.error,
          variant: "destructive",
        });
        event.target.value = "";
        return;
      }
      setPendingJson(content);
      setRestoreMode("merge");
      setRestoreOpen(true);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const runRestore = () => {
    if (!pendingJson) return;
    const result = storage.importAllData(pendingJson, { mode: restoreMode });
    if (result.success) {
      resetRestoreFlow();
      toast({ title: "Data restored", description: "The page will refresh in a moment." });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast({
        title: "Import failed",
        description: result.error || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const peek = pendingJson ? peekDiabeatersBackup(pendingJson) : null;
  const peekOk = peek && peek.ok ? peek : null;

  const backupInfoContent = (
    <div className="space-y-2.5 text-sm leading-relaxed">
      <p>
        Export downloads a JSON snapshot of Diabeaters data stored in <strong className="font-medium text-foreground">this browser</strong>.
        Import applies a file you saved earlier from the same screen.
      </p>
      <p className="text-muted-foreground">
        Cloud sync is separate — use backups when changing devices or if you want your own copy on disk.
      </p>
      <p className="text-muted-foreground">
        Backup files may include health-related details. Keep them somewhere only you can access.
      </p>
    </div>
  );

  return (
    <div className={cn(!embedded && "border-t border-border pt-6")}>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-muted/5 shadow-sm ring-1 ring-border/30 dark:from-muted/15 dark:to-muted/5">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-inner dark:bg-primary/20"
                aria-hidden
              >
                <Database className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-base font-semibold tracking-tight text-foreground">Backup &amp; restore</h3>
                <p className="text-xs text-muted-foreground">Local data · JSON file</p>
              </div>
            </div>
            <InlineInfoHint
              ariaLabel="About backup and restore"
              content={backupInfoContent}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            />
          </div>

          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImportFileChosen}
            className="hidden"
            id="settings-import-file"
            data-testid="input-import-file"
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-auto min-h-11 flex-col gap-1 rounded-xl border border-border/50 bg-background/80 px-2 py-2.5 text-xs font-medium shadow-sm hover:bg-background sm:flex-row sm:gap-2 sm:py-2"
              onClick={handleExport}
              data-testid="button-export-data"
              aria-label="Download backup as JSON file"
            >
              <Download className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="leading-tight">Export</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-auto min-h-11 flex-col gap-1 rounded-xl border border-border/50 bg-background/80 px-2 py-2.5 text-xs font-medium shadow-sm hover:bg-background sm:flex-row sm:gap-2 sm:py-2"
              onClick={() => document.getElementById("settings-import-file")?.click()}
              data-testid="button-import-data"
              aria-label="Import backup from JSON file"
            >
              <Upload className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="leading-tight">Import</span>
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={restoreOpen}
        onOpenChange={(open) => {
          if (!open) resetRestoreFlow();
        }}
      >
        <AlertDialogContent className="max-w-md" data-testid="dialog-restore-backup">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left text-sm text-muted-foreground">
                {peekOk ? (
                  <>
                    <p>
                      This file looks like a Diabeaters export from{" "}
                      <span className="text-foreground">{formatBackupInstant(peekOk.exportedAt)}</span>
                      {peekOk.appVersion ? (
                        <>
                          {" "}
                          (app v{peekOk.appVersion}
                          {peekOk.backupFormatVersion ? `, backup format ${peekOk.backupFormatVersion}` : ""})
                        </>
                      ) : null}
                      . It contains <span className="text-foreground">{peekOk.keysRestored}</span> data sections we
                      recognise.
                    </p>
                    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="font-medium text-foreground">How should we apply it?</p>
                      <RadioGroup
                        value={restoreMode}
                        onValueChange={(v) => setRestoreMode(v as ImportBackupMode)}
                        className="space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="merge" id="restore-merge" className="mt-0.5" />
                          <Label htmlFor="restore-merge" className="cursor-pointer font-normal leading-snug">
                            <span className="text-foreground font-medium">Merge</span> — overwrite matching data from
                            the file and leave everything else on this device as it is. Safer if the backup is old or
                            incomplete.
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem value="replace" id="restore-replace" className="mt-0.5" />
                          <Label htmlFor="restore-replace" className="cursor-pointer font-normal leading-snug">
                            <span className="text-foreground font-medium">Replace then restore</span> — clear all
                            Diabeaters data stored in this browser for backed-up sections, then import the file. Use only
                            if you trust this file as a full snapshot (your sign-in is unchanged).
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                ) : (
                  <p>Could not read backup details.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel data-testid="button-restore-cancel">Cancel</AlertDialogCancel>
            <Button type="button" onClick={() => runRestore()} disabled={!peekOk} data-testid="button-restore-confirm">
              Restore
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
