import type { ChangeEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { storage } from "@/lib/storage";
import { Link } from "wouter";
import { Phone, ChevronRight, Upload, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { EmergencyProfileFields } from "@/components/emergency-profile-fields";

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

export function SettingsDataBackupSection({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();

  const handleExport = () => {
    const data = storage.exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diabeaters-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "Your backup file has been downloaded." });
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = storage.importAllData(content);
      if (result.success) {
        toast({ title: "Data imported", description: "Your data has been restored. The page will refresh." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({
          title: "Import failed",
          description: result.error || "Something went wrong.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className={cn("space-y-4", !embedded && "border-t border-border pt-6")}>
      <h3 className="text-h3 font-semibold text-foreground flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" aria-hidden />
        Backup &amp; restore
      </h3>
      <p className="text-body text-muted-foreground">
        Download a JSON file of your Diabeaters data or restore from a file. Covers local device data; if you use cloud sync, keep this as
        an extra copy when changing devices or for your records.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleExport} variant="outline" data-testid="button-export-data">
          <Download className="h-4 w-4 mr-2" />
          Download backup
        </Button>
        <div>
          <input type="file" accept=".json" onChange={handleImport} className="hidden" id="settings-import-file" data-testid="input-import-file" />
          <Button variant="outline" onClick={() => document.getElementById("settings-import-file")?.click()} data-testid="button-import-data">
            <Upload className="h-4 w-4 mr-2" />
            Import backup
          </Button>
        </div>
      </div>
    </div>
  );
}
