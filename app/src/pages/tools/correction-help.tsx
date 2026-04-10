import { useEffect, useState } from "react";
import { Link } from "wouter";
import { TrendingUp, Calculator, Moon, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { storage, type UserProfile } from "@/lib/storage";

/**
 * Dedicated hub for correction / ISF — tools previously linked only via redirect to Ratios.
 */
export default function CorrectionHelpPage() {
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);

  useEffect(() => {
    setProfile(storage.getProfile());
  }, []);

  const isPump = profile?.insulinDeliveryMethod === "pump";

  return (
    <PageShell variant="standard" className="space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Correction helper"
        description="How this app handles correction doses — links to the screens that use your correction factor (ISF)."
      />

      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25">
        <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
          Educational only. Correction math uses the correction factor you save in Settings / Ratios. Always follow your
          care team&apos;s rules and your prescription.
        </AlertDescription>
      </Alert>

      {isPump && (
        <Alert data-testid="alert-correction-pump-iob">
          <AlertDescription className="text-sm">
            <strong>Pump users:</strong> Before stacking a manual correction, check <strong>active insulin (IOB)</strong> on
            your pump — the pump may already credit recent boluses. Temp basals and extended boluses also affect how much
            extra insulin is safe.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-h3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Ratios &amp; ISF
            </CardTitle>
            <CardDescription>Edit correction factor and carb ratios in one place.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your <strong>correction factor</strong> (ISF / CF) is used anywhere the app suggests insulin for high glucose.
            </p>
            <Button asChild className="w-full">
              <Link href="/ratios">Open Ratios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-h3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Meal bolus
            </CardTitle>
            <CardDescription>Carb coverage from your meal ratios (not the same as a pure BG correction).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="secondary" className="w-full">
              <Link href="/adviser?tab=meal">Open Meal &amp; ratios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-h3 flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" />
              Bedtime check
            </CardTitle>
            <CardDescription>Night-time correction suggestion with conservative safeguards.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/bedtime">Open Bedtime</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-h3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Sick day
            </CardTitle>
            <CardDescription>Illness can change how much correction is appropriate.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/scenarios/sick-day">Open Sick Day</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
