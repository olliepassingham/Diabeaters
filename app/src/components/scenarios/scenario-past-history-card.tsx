import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ChevronDown, ChevronUp, Thermometer, Plane } from "lucide-react";
import { storage, type ScenarioHistoryEntry } from "@/lib/storage";

type ScenarioHistoryKind = "sick_day" | "travel";

const COPY: Record<ScenarioHistoryKind, { title: string; description: string }> = {
  sick_day: {
    title: "Past sick days",
    description: "Sessions you have recorded while unwell.",
  },
  travel: {
    title: "Past trips",
    description: "Travel plans and trips you have recorded.",
  },
};

export function ScenarioPastHistoryCard({ kind }: { kind: ScenarioHistoryKind }) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<ScenarioHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(storage.getScenarioHistory().filter((e) => e.type === kind).slice(0, 10));
  }, [kind]);

  const { title, description } = COPY[kind];
  const Icon = kind === "sick_day" ? Thermometer : Plane;

  return (
    <section
      className="scroll-mt-28 w-full"
      id={kind === "sick_day" ? "sick-day-past-sessions" : "travel-past-trips"}
      aria-label={title}
    >
      <Card className="pressable card-interactive shadow-md w-full" data-testid={`card-past-scenarios-${kind}`}>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-toggle-history-${kind}`}
        >
          <CardTitle className="flex items-center justify-between gap-2 text-h2 text-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{title}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" tabIndex={-1} type="button">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {expanded && (
          <CardContent data-testid={`section-scenario-history-${kind}`}>
            {entries.length === 0 ? (
              <p className="text-small text-muted-foreground" data-testid={`text-no-history-${kind}`}>
                No past {kind === "sick_day" ? "sick days" : "trips"} recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => {
                  const formatDate = (d: string) =>
                    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 text-small"
                      data-testid={`history-entry-${entry.id}`}
                    >
                      <div className="mt-0.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${kind === "sick_day" ? "text-orange-500" : "text-purple-500"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{kind === "sick_day" ? "Sick day" : "Travel"}</span>
                          <span className="text-muted-foreground">
                            {formatDate(entry.startDate)}
                            {entry.endDate ? ` — ${formatDate(entry.endDate)}` : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                          {entry.destination && <span>{entry.destination}</span>}
                          {entry.severity && <span>Severity: {entry.severity}</span>}
                          {entry.journalEntryCount != null && entry.journalEntryCount > 0 && (
                            <span>
                              {entry.journalEntryCount} journal {entry.journalEntryCount === 1 ? "entry" : "entries"}
                            </span>
                          )}
                        </div>
                        {entry.notes && <p className="text-muted-foreground truncate">{entry.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </section>
  );
}
