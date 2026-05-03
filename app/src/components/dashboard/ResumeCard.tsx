import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildCoachHref } from "@/lib/ai-coach/links";
import type { LastInteractionKind, LastInteractionRecord } from "@/lib/last-interaction";

function resumeHref(kind: LastInteractionKind): string {
  switch (kind) {
    case "coach":
      return buildCoachHref({ from: "resume-card" });
    case "scenario:sick-day":
      return "/sick-day";
    case "scenario:pump-failure":
      return "/scenarios/pump-failure";
    case "scenario:alcohol":
      return "/scenarios/alcohol";
    case "scenario:exercise":
      return "/scenarios/exercise";
    case "scenario:travel":
      return "/travel";
    case "ratios":
      return "/ratios";
    case "community-draft":
      return "/community/messages";
    default:
      return "/";
  }
}

function resumeLabel(kind: LastInteractionKind): string {
  switch (kind) {
    case "coach":
      return "Continue your last coach conversation";
    case "scenario:sick-day":
      return "Sick day";
    case "scenario:pump-failure":
      return "Pump or infusion backup";
    case "scenario:alcohol":
      return "Alcohol mode";
    case "scenario:exercise":
      return "Exercise";
    case "scenario:travel":
      return "Travel";
    case "ratios":
      return "Ratios";
    case "community-draft":
      return "Messages";
    default:
      return "Open app";
  }
}

export function ResumeCard({
  last,
  hidden,
}: {
  last: LastInteractionRecord;
  hidden: boolean;
}) {
  if (hidden) return null;

  const title = "Pick up where you left off";
  const subtitle = resumeLabel(last.kind);

  return (
    <Card className="border-border/70 shadow-sm" data-testid="resume-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button className="min-h-11 shrink-0" asChild>
          <Link href={resumeHref(last.kind)} data-testid="link-resume-primary">
            Resume
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
