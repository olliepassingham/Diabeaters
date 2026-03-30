import { Link } from "wouter";
import { Car, AlertTriangle, Gauge, IdCard, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

const SECTIONS = [
  {
    title: "Before you drive",
    body: "Use the checks your care team recommends — often a fingerstick blood test, especially if you use insulin or have had a recent low. If you are low, treat with fast-acting carbohydrate and only drive again when you are safely back in range and feeling well enough to concentrate, as your team describes.",
  },
  {
    title: "Longer journeys",
    body: "Keep glucose tablets or juice within reach (not only in the boot). Plan breaks for food, insulin, and checks if your team advises. Heat, delays, and missed meals can all affect glucose while you are on the road.",
  },
  {
    title: "If you feel hypo while driving",
    body: "Pull over and stop as soon as it is safe — do not try to reach home first. Turn the engine off, treat the hypo, and wait until you have recovered fully before driving again. If you are not safe to continue, arrange another way home.",
  },
  {
    title: "CGM and driving",
    body: "Some people use CGM for awareness, but many regions still expect a confirmatory blood test before driving after certain readings or alerts. Follow local rules and what your team has written for you.",
  },
];

export default function DrivingScenarioPage() {
  return (
    <PageShell variant="standard" className="space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Driving"
        description="Principles for safer decisions about glucose and driving. Not legal advice — rules differ by country and your medical team."
      />

      <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">Important</AlertTitle>
        <AlertDescription className="text-small text-amber-900/90 dark:text-amber-100/90">
          This app does not state legal blood-glucose limits for driving. Check your local licensing and medical guidance, and follow your clinic&apos;s written advice.
        </AlertDescription>
      </Alert>

      <Card className="rounded-xl border-border/80">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Car className="h-6 w-6 text-primary" />
            On the road
          </CardTitle>
          <CardDescription>Simple habits that support safer driving with type 1</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="rounded-xl border border-border/60 bg-card p-4">
              <h2 className="text-h3 font-semibold text-foreground">{s.title}</h2>
              <p className="text-small text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/80">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Gauge className="h-6 w-6 text-primary" />
            Plan ahead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-small text-muted-foreground space-y-2">
            <li>Know where your hypo treatment is before you set off</li>
            <li>Avoid driving if you are severely sleep-deprived or unwell unless your team has cleared you</li>
            <li>After a serious hypo, your team may advise a period before driving again — follow that plan</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/tools/hypo-help">
            Hypo help
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/emergency-card">
            <IdCard className="h-4 w-4 mr-2" />
            Emergency card
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/help-now">
            Help now
          </Link>
        </Button>
      </div>

      <p className="text-tiny text-muted-foreground flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 shrink-0" />
        If in doubt, do not drive — contact your team or someone who can take over.
      </p>
    </PageShell>
  );
}
