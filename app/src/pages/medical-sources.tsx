import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

type SourceLink = { label: string; href: string };

function SourceList({ links }: { links: SourceLink[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {links.map((l) => (
        <li key={l.href}>
          <a
            href={l.href}
            className="text-primary underline underline-offset-2 hover:opacity-90"
            target="_blank"
            rel="noreferrer"
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function MedicalSourcesPage() {
  const reviewed = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <PageShell variant="standard" className="min-h-screen">
      <PageHeader
        leading={<PageBackButton />}
        title="Medical sources"
        description="References for diabetes-related educational content in Diabeaters (UK)."
      />

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 pt-6">
          <p className="text-xs text-muted-foreground">Last reviewed: {reviewed}</p>
          <p>
            Diabeaters provides educational information and calculators intended to support day-to-day organisation and
            learning. It is <strong>not</strong> a medical device and does not replace your clinician. Always follow your
            diabetes team’s plan and local emergency guidance.
          </p>

          <h2 id="hypoglycaemia" className="scroll-mt-24 text-base font-semibold">
            Hypoglycaemia (low blood sugar) & treatment
          </h2>
          <p>
            Used for general “treat the low” guidance and reminders shown in Help Now and the hypo tools.
          </p>
          <SourceList
            links={[
              { label: "NHS: Low blood sugar (hypoglycaemia)", href: "https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/" },
              { label: "Diabetes UK: Hypoglycaemia (hypos)", href: "https://www.diabetes.org.uk/guide-to-diabetes/complications/hypos" },
            ]}
          />

          <h2 id="emergency" className="scroll-mt-24 text-base font-semibold">
            Emergency guidance
          </h2>
          <p>
            Used for the “Help Now” page flow and safety framing. In the UK, call <strong>999</strong> for emergencies.
            For urgent medical help when it’s not life-threatening, consider <strong>NHS 111</strong>.
          </p>
          <SourceList
            links={[
              { label: "NHS: Call 999", href: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/" },
              { label: "NHS: NHS 111", href: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/nhs-111/" },
            ]}
          />

          <h2 id="sickday" className="scroll-mt-24 text-base font-semibold">
            Sick day rules, ketones, and DKA
          </h2>
          <p>Used for sick-day and pump-failure scenario information and warnings.</p>
          <SourceList
            links={[
              { label: "NHS: Diabetic ketoacidosis (DKA)", href: "https://www.nhs.uk/conditions/diabetic-ketoacidosis/" },
              { label: "Diabetes UK: Ketones and DKA", href: "https://www.diabetes.org.uk/guide-to-diabetes/complications/diabetic-ketoacidosis" },
            ]}
          />

          <h2 id="insulin" className="scroll-mt-24 text-base font-semibold">
            Insulin dosing concepts (bolus/corrections)
          </h2>
          <p>
            Used for educational framing around carb ratios, correction factors (ISF), and dose estimates shown in the
            Adviser and correction tools. Always use targets and dosing rules agreed with your clinician.
          </p>
          <SourceList
            links={[
              { label: "Diabetes UK: Insulin (overview)", href: "https://www.diabetes.org.uk/guide-to-diabetes/managing-your-diabetes/treating-your-diabetes/insulin" },
            ]}
          />

          <h2 id="exercise" className="scroll-mt-24 text-base font-semibold">
            Exercise & diabetes
          </h2>
          <p>
            Used for general exercise education and reminders shown in the exercise planner and in-progress banner.
          </p>
          <SourceList
            links={[
              { label: "NHS: Exercise", href: "https://www.nhs.uk/live-well/exercise/" },
              { label: "Diabetes UK: Exercise", href: "https://www.diabetes.org.uk/guide-to-diabetes/enjoy-food/exercise" },
            ]}
          />

          <h2 id="driving" className="scroll-mt-24 text-base font-semibold">
            Driving with diabetes (UK)
          </h2>
          <p>Used for the driving scenario flow and readiness guidance.</p>
          <SourceList
            links={[
              { label: "GOV.UK: Diabetes and driving", href: "https://www.gov.uk/diabetes-driving" },
              { label: "DVLA: Medical conditions, disabilities and driving", href: "https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency" },
            ]}
          />

          <h2 id="disclaimer" className="scroll-mt-24 text-base font-semibold">
            Notes on calculators
          </h2>
          <p>
            Calculators in Diabeaters provide estimates to support education and conversation with your care team. They
            do not know your full clinical context (e.g. insulin on board, illness, alcohol, exercise, pump settings, or
            individual sensitivity changes).
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}

