import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, User } from "lucide-react";
import { Link } from "wouter";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { toLegacyPrimaryContact } from "@/lib/emergency-sync";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";

export function HelpNowInfoWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const { data: emergency, syncGeneration } = useEmergencyProfile();
  const primaryContact = toLegacyPrimaryContact(emergency);

  return (
    <WidgetCard
      key={syncGeneration}
      className="border-l-4 border-l-red-600 bg-red-50/40 dark:bg-red-950/20 transition-shadow duration-500"
      data-testid="widget-help-now-info"
    >
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/help-now">
          <div className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
            <Phone className="h-5 w-5 text-red-600 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Emergency information</CardTitle>
          </div>
        </Link>
        <p className="text-sm text-gray-600 dark:text-red-200/80 uppercase tracking-wide mt-1">Urgent help</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 md:px-6 md:pb-6">
        {primaryContact ? (
          <div className="rounded-xl border border-red-100 dark:border-red-900/50 bg-white dark:bg-card px-3 py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-gray-600 shrink-0" />
              <span className="text-base font-semibold text-gray-900 dark:text-foreground">{primaryContact.name || "Contact"}</span>
            </div>
            {primaryContact.phone && (
              <p className="text-base text-gray-900 dark:text-foreground font-medium tabular-nums">{primaryContact.phone}</p>
            )}
            {primaryContact.relationship && (
              <p className="text-sm text-gray-500 uppercase tracking-wide mt-1">{primaryContact.relationship}</p>
            )}
          </div>
        ) : (
          <p className="text-base text-gray-900 dark:text-foreground text-center py-1">No emergency contacts set up yet.</p>
        )}

        <div className={compact ? "space-y-2" : "grid grid-cols-2 gap-2"}>
          <Link href="/help-now">
            <Button variant="destructive" size="sm" className="w-full" data-testid="button-help-now-widget">
              Help now
            </Button>
          </Link>
          <Link href="/account#account-emergency">
            <Button variant="outline" size="sm" className="w-full border-gray-900/20 dark:border-border" data-testid="button-edit-contacts">
              {compact ? "Edit" : "Edit details"}
              <ArrowRight className="h-4 w-4 ml-1 hidden sm:inline" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </WidgetCard>
  );
}
