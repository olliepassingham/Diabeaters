import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink, SettingsEmergencySection } from "./shared";
import { useLinkedPatient } from "@/hooks/use-linked-patient";

export default function SettingsEmergencyPage() {
  const [, setLocation] = useLocation();
  const { data: supporterSession, loading } = useLinkedPatient();

  useEffect(() => {
    if (loading) return;
    if (supporterSession) setLocation("/settings", { replace: true });
  }, [loading, supporterSession, setLocation]);

  if (loading || supporterSession) {
    return (
      <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
        <FaceLogoWatermark />
        <SettingsBackLink />
        <PageHeader title="Your emergency details" description="Loading…" />
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        title="Your emergency details"
        description="Used for Help now. Linked supporters only see this if the account holder allows it under Family & supporters."
      />
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-6">
          <SettingsEmergencySection variant="embedded" />
        </CardContent>
      </Card>
    </PageShell>
  );
}
