import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Thermometer, ChevronRight, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage, ScenarioState } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

export function SickDayBanner() {
  const { toast } = useToast();
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ 
    travelModeActive: false, 
    sickDayActive: false 
  });

  useEffect(() => {
    const state = storage.getScenarioState();
    setScenarioState(state);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const state = storage.getScenarioState();
      setScenarioState(state);
    };

    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(() => {
      const state = storage.getScenarioState();
      if (state.sickDayActive !== scenarioState.sickDayActive) {
        setScenarioState(state);
      }
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [scenarioState.sickDayActive]);

  const handleDeactivate = () => {
    storage.deactivateSickDay();
    localStorage.removeItem("diabeater_sick_day_session");
    setScenarioState({ ...scenarioState, sickDayActive: false });
    toast({
      title: "Sick Day Mode Deactivated",
      description: "Glad you're feeling better!",
    });
  };

  if (!scenarioState.sickDayActive) {
    return null;
  }

  const getSeverityColor = () => {
    switch (scenarioState.sickDaySeverity) {
      case "severe":
        return "bg-red-500 dark:bg-red-600";
      case "moderate":
        return "bg-orange-500 dark:bg-orange-600";
      default:
        return "bg-amber-500 dark:bg-amber-600";
    }
  };

  return (
    <div 
      className={`${getSeverityColor()} text-white py-1.5 flex items-center justify-between gap-3 px-3 sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-40 [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]`}
      data-testid="banner-sick-day"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Thermometer className="h-4 w-4 flex-shrink-0" />
        <span className="text-[13px] font-medium truncate">
          Sick Day Mode Active
          <span className="hidden sm:inline"> — {scenarioState.sickDaySeverity || "moderate"} severity</span>
        </span>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/scenarios/sick-day#sickday-checklist">
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-7 text-[12px] bg-white/20 hover:bg-white/30 text-white border-0 px-2"
            data-testid="button-banner-view-guidance"
          >
            <span className="hidden sm:inline">View Guidance</span>
            <span className="sm:hidden">View</span>
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-[12px] bg-white/20 hover:bg-white/30 text-white border-0 px-2"
          onClick={handleDeactivate}
          data-testid="button-banner-deactivate"
        >
          <Power className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">I'm Better</span>
          <span className="sm:hidden">End</span>
        </Button>
      </div>
    </div>
  );
}
