import { Link } from "wouter";
import { Syringe, AlertTriangle, Phone, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

const STEPS = [
  {
    title: "Stay calm and check ketones",
    body: "If you have blood or urine ketone strips, check now. Rising ketones with high glucose need urgent medical advice.",
  },
  {
    title: "Switch to injected insulin",
    body: "Use your backup rapid-acting pen for meals and corrections, and your long-acting pen for basal — use doses your care team gave you for pump failure. If you don’t have a written plan, contact your team or urgent care.",
  },
  {
    title: "Hydrate and monitor often",
    body: "Check glucose every 1–2 hours until stable. Drink water unless you’ve been told to restrict fluids.",
  },
  {
    title: "Replace or fix the pump",
    body: "Call your pump company’s helpline. Keep pens and needles with you until the pump is working again.",
  },
];

export default function PumpFailurePage() {
  return (
    <PageShell variant="standard">
      <PageHeader
        leading={<PageBackButton />}
        title="Pump or infusion failure"
        description="Emergency-style steps when delivery stops unexpectedly. This is educational — always follow your clinic&apos;s written backup plan."
      />

      <Alert variant="destructive" className="border-destructive/50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Emergency</AlertTitle>
        <AlertDescription className="text-small">
          If you are vomiting, have moderate/large ketones, or cannot keep fluids down, seek urgent medical help or call your local emergency number.
        </AlertDescription>
      </Alert>

      <Card className="rounded-xl border-border/80">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Syringe className="h-6 w-6 text-primary" />
            Step-by-step
          </CardTitle>
          <CardDescription>Work through these in order</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-small font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <h2 className="text-h3 font-semibold text-foreground">{s.title}</h2>
                <p className="text-small text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/80">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Package className="h-6 w-6 text-primary" />
            Keep accessible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-small text-muted-foreground space-y-2">
            <li>Spare rapid-acting and long-acting insulin pens (in date)</li>
            <li>Pen needles and a written backup dose plan</li>
            <li>Glucose tabs or juice for hypos</li>
            <li>Ketone strips if you use them</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/scenarios/travel">
            <Package className="h-4 w-4 mr-2" />
            Travel packing &amp; backup
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/supplies">
            Supply tracker
          </Link>
        </Button>
      </div>

      <p className="text-tiny text-muted-foreground flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 shrink-0" />
        Save your diabetes team and pump manufacturer numbers in your phone.
      </p>
    </PageShell>
  );
}
