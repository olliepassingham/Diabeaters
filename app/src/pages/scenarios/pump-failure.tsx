import { Link } from "wouter";
import { Syringe, AlertTriangle, Phone, Package, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { MedicalSourcesLink } from "@/components/medical-sources-link";

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
        description="Emergency-style steps when delivery stops unexpectedly. This is educational — always follow your clinic's written backup plan."
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

          <Collapsible className="group rounded-xl border border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary shrink-0" aria-hidden />
                What to keep accessible
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
              <ul className="list-disc list-inside text-small text-muted-foreground space-y-2">
                <li>Spare rapid-acting and long-acting insulin pens (in date)</li>
                <li>Pen needles and a written backup dose plan</li>
                <li>Glucose tabs or juice for hypos</li>
                <li>Ketone strips if you use them</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
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

      <MedicalSourcesLink anchor="sickday" />
    </PageShell>
  );
}
