import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Thermometer, Plane } from "lucide-react";
import SickDay from "./sick-day";
import Travel from "./travel";

export default function Scenarios() {
  const [activeTab, setActiveTab] = useState("sick-day");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scenarios</h1>
        <p className="text-muted-foreground">Situation-specific guidance for managing your diabetes</p>
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
