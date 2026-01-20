import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Thermometer, Plane } from "lucide-react";
import SickDay from "./sick-day";
import Travel from "./travel";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

export default function Scenarios() {
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return tab === "travel" ? "travel" : "sick-day";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "travel" || tab === "sick-day") {
      setActiveTab(tab);
    }
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
          <InfoSection title="Sick Day Mode">
            <p>When you're unwell, diabetes management changes. Activate sick day mode for adjusted monitoring guidance, ketone checking reminders, and when to seek medical help.</p>
          </InfoSection>
          <InfoSection title="Travel Mode">
            <p>Planning a trip? The travel planner helps you prepare with packing checklists, timezone adjustment advice, and emergency supplies guidance for your destination.</p>
          </InfoSection>
          <InfoSection title="Switching Modes">
            <p>Use the tabs to switch between Sick Day and Travel modes. Each provides tailored advice for that specific situation.</p>
          </InfoSection>
          <InfoSection title="Travel Emergency Card">
            <p>Generate a printable or screenshot-ready emergency card with your vital diabetes information in multiple languages for international travel.</p>
          </InfoSection>
        </PageInfoDialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="sick-day" className="gap-2" data-testid="tab-sick-day">
            <Thermometer className="h-4 w-4" />
            Sick Day
          </TabsTrigger>
          <TabsTrigger value="travel" className="gap-2" data-testid="tab-travel">
            <Plane className="h-4 w-4" />
            Travel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sick-day" className="mt-6">
          <SickDayContent />
        </TabsContent>

        <TabsContent value="travel" className="mt-6">
          <TravelContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SickDayContent() {
  return <SickDay />;
}

function TravelContent() {
  return <Travel />;
}
