import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plane, X, ChevronRight, Power, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage, ScenarioState } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

export function TravelBanner() {
  const { toast } = useToast();
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ 
    travelModeActive: false, 
    sickDayActive: false 
  });
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const state = storage.getScenarioState();
    setScenarioState(state);
    updateDaysRemaining(state);
  }, []);

  const updateDaysRemaining = (state: ScenarioState) => {
    if (state.travelEndDate) {
      const end = new Date(state.travelEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      setDaysRemaining(diff);
      
      if (diff < 0) {
        storage.deactivateTravelMode();
        localStorage.removeItem("diabeater_travel_session");
        setScenarioState({ ...state, travelModeActive: false });
        toast({
          title: "Travel Mode Ended",
          description: "Welcome back! Your trip has concluded.",
        });
      }
    }
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const state = storage.getScenarioState();
      setScenarioState(state);
      updateDaysRemaining(state);
      if (state.travelModeActive) {
        setDismissed(false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(() => {
      const state = storage.getScenarioState();
      if (state.travelModeActive !== scenarioState.travelModeActive) {
        setScenarioState(state);
        updateDaysRemaining(state);
        if (state.travelModeActive) {
          setDismissed(false);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [scenarioState.travelModeActive]);

  const handleDeactivate = () => {
    storage.deactivateTravelMode();
    localStorage.removeItem("diabeater_travel_session");
    setScenarioState({ ...scenarioState, travelModeActive: false });
    toast({
      title: "Travel Mode Ended",
      description: "Welcome back home!",
    });
  };

  if (!scenarioState.travelModeActive || dismissed) {
    return null;
  }

  const getTimezoneText = () => {
    if (!scenarioState.travelTimezoneShift || scenarioState.travelTimezoneDirection === "none") {
      return null;
    }
    const hours = Math.abs(scenarioState.travelTimezoneShift);
    const direction = scenarioState.travelTimezoneDirection === "east" ? "ahead" : "behind";
    return `${hours}h ${direction}`;
  };

  const timezoneText = getTimezoneText();

  return (
    <div 
      className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 flex items-center justify-between gap-4"
      data-testid="banner-travel"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Plane className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          Travel Mode: {scenarioState.travelDestination}
          {daysRemaining !== null && daysRemaining >= 0 && (
            <span className="hidden sm:inline"> — {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left</span>
          )}
          {timezoneText && (
            <span className="hidden md:inline text-blue-100"> ({timezoneText})</span>
          )}
        </span>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/scenarios?tab=travel">
          <Button 
            variant="secondary" 
            size="sm" 
            data-testid="button-banner-view-travel"
          >
            <span className="hidden sm:inline">View Plan</span>
            <span className="sm:hidden">View</span>
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDeactivate}
          data-testid="button-banner-end-travel"
        >
          <Power className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">End Trip</span>
          <span className="sm:hidden">End</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          data-testid="button-banner-dismiss-travel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
