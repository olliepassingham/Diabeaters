import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { toLegacyPrimaryContact } from "@/lib/emergency-sync";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { useSupporterSession } from "@/hooks/use-supporter-session";
import { emergencyDetailsEditHref } from "@/lib/emergency-details-edit-href";
import { HomeCardEmpty } from "@/components/home/home-ui";

export function HelpNowInfoWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const { inSupporterSession } = useSupporterSession();
  const emergencyEditHref = emergencyDetailsEditHref(inSupporterSession);
  const { data: emergency, syncGeneration } = useEmergencyProfile();
  const primaryContact = toLegacyPrimaryContact(emergency);

  return (
    <WidgetCard
      key={syncGeneration}
      className="overflow-visible border-l-4 border-l-red-600 bg-red-50/40 dark:bg-red-950/20 transition-shadow duration-500"
      data-testid="widget-help-now-info"
    >
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/help-now">
          <div className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
            <Phone className="h-5 w-5 text-red-600 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Emergency information</CardTitle>
          </div>
        </Link>
        <p className="text-small text-muted-foreground uppercase tracking-wide mt-1">
          {primaryContact ? "Urgent help" : null}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0 md:px-6 md:pb-6">
        {primaryContact ? (
          <div className="rounded-xl border border-red-200/60 dark:border-red-900/50 bg-card px-3 py-3 shadow-sm">
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 dark:bg-red-500/15">
                <User className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-base font-semibold text-foreground">{primaryContact.name || "Contact"}</p>
                {primaryContact.phone && (
                  <p className="text-base font-medium tabular-nums text-foreground">{primaryContact.phone}</p>
                )}
                {primaryContact.relationship && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {primaryContact.relationship}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <HomeCardEmpty
            compact
            icon={User}
            title="No emergency contacts yet"
            description="Add a contact so supporters know who to call."
          />
        )}

        <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2")}>
          <Link href="/help-now">
            <Button variant="destructive" size="sm" className="w-full min-h-10 font-medium shadow-sm" data-testid="button-help-now-widget">
              Help now
            </Button>
          </Link>
          <Link href={emergencyEditHref}>
            <Button
              variant="secondary"
              size="sm"
              className="w-full min-h-10 gap-1.5 font-medium shadow-sm border border-border/80"
              data-testid="button-edit-contacts"
            >
              {compact ? "Edit" : "Edit details"}
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Button>
          </Link>
        </div>
      </CardContent>
    </WidgetCard>
  );
}
