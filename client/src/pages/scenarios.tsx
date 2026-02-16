import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Thermometer, Plane, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Bedtime from "./bedtime";
import SickDay from "./sick-day";
import Travel from "./travel";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { storage, ScenarioHistoryEntry } from "@/lib/storage";

export default function Scenarios() {
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "travel") return "travel";
    if (tab === "sick-day") return "sick-day";
    return "bedtime";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [scenarioHistory, setScenarioHistory] = useState<ScenarioHistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "bedtime" || tab === "travel" || tab === "sick-day") {
      setActiveTab(tab);
    }
    setScenarioHistory(storage.getScenarioHistory().slice(0, 10));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold">Scenarios</h1>
          <p className="text-muted-foreground">Situation-specific guidance for managing your diabetes</p>
        </div>
        <PageInfoDialog
          title="About Scenarios"
          description="Special situation guidance for diabetes management"
        >
          <InfoSection title="Bedtime Check">
            <p>A calm evening check to help you feel confident going to sleep. Enter your current glucose, when you last ate and took insulin, and get personalised guidance for a steady night.</p>
          </InfoSection>
          <InfoSection title="Sick Day Mode">
            <p>When you're unwell, diabetes management changes. Activate sick day mode for adjusted monitoring guidance, ketone checking reminders, and when to seek medical help.</p>
          </InfoSection>
          <InfoSection title="Travel Mode">
            <p>Planning a trip? The travel planner helps you prepare with packing checklists, timezone adjustment advice, and emergency supplies guidance for your destination.</p>
          </InfoSection>
          <InfoSection title="Switching Modes">
            <p>Use the tabs to switch between different scenarios. Each provides tailored advice for that specific situation.</p>
          </InfoSection>
          <InfoSection title="Travel Emergency Card">
            <p>Generate a printable or screenshot-ready emergency card with your vital diabetes information in multiple languages for international travel.</p>
          </InfoSection>
        </PageInfoDialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="bedtime" className="gap-2" data-testid="tab-bedtime">
            <Moon className="h-4 w-4" />
            Bedtime
          </TabsTrigger>
          <TabsTrigger value="sick-day" className="gap-2" data-testid="tab-sick-day">
            <Thermometer className="h-4 w-4" />
            Sick Day
          </TabsTrigger>
          <TabsTrigger value="travel" className="gap-2" data-testid="tab-travel">
            <Plane className="h-4 w-4" />
            Travel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bedtime" className="mt-6 animate-fade-in-up">
          <BedtimeContent />
        </TabsContent>

        <TabsContent value="sick-day" className="mt-6 animate-fade-in-up">
          <SickDayContent />
        </TabsContent>

        <TabsContent value="travel" className="mt-6 animate-fade-in-up">
          <TravelContent />
        </TabsContent>
      </Tabs>

      <Card data-testid="card-past-scenarios">
        <CardHeader className="cursor-pointer" onClick={() => setHistoryExpanded(!historyExpanded)} data-testid="button-toggle-history">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Past Scenarios
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" tabIndex={-1}>
              {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {historyExpanded && (
          <CardContent data-testid="section-scenario-history">
            {scenarioHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-history">No past scenarios recorded yet</p>
            ) : (
              <div className="space-y-3">
                {scenarioHistory.map((entry) => {
                  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <div key={entry.id} className="flex items-start gap-3 text-sm" data-testid={`history-entry-${entry.id}`}>
                      <div className="mt-0.5">
                        {entry.type === "sick_day" ? (
                          <Thermometer className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Plane className="h-4 w-4 text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{entry.type === "sick_day" ? "Sick Day" : "Travel"}</span>
                          <span className="text-muted-foreground">
                            {formatDate(entry.startDate)}
                            {entry.endDate ? ` — ${formatDate(entry.endDate)}` : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                          {entry.destination && <span>{entry.destination}</span>}
                          {entry.severity && <span>Severity: {entry.severity}</span>}
                          {entry.journalEntryCount != null && entry.journalEntryCount > 0 && (
                            <span>{entry.journalEntryCount} journal {entry.journalEntryCount === 1 ? "entry" : "entries"}</span>
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
    </div>
  );
}

function BedtimeContent() {
  return <Bedtime />;
}

function SickDayContent() {
  return <SickDay />;
}

function TravelContent() {
  return <Travel />;
}
