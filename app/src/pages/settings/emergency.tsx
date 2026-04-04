import { Card, CardContent } from "@/components/ui/card";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink, SettingsEmergencySection } from "./shared";

export default function SettingsEmergencyPage() {
  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        title="Your emergency details"
        description="Used for Help now. Linked carers only see this if the account holder allows it under Family & carers."
      />
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-6">
          <SettingsEmergencySection variant="embedded" />
        </CardContent>
      </Card>
    </PageShell>
  );
}
