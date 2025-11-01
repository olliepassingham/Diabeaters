import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { UserSettings } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const [tdd, setTdd] = useState("");
  const [breakfastRatio, setBreakfastRatio] = useState("");
  const [lunchRatio, setLunchRatio] = useState("");
  const [dinnerRatio, setDinnerRatio] = useState("");
  const [snackRatio, setSnackRatio] = useState("");
  const [shortActingPensPerDay, setShortActingPensPerDay] = useState("");
  const [longActingPensPerDay, setLongActingPensPerDay] = useState("");
  const [injectionsPerDay, setInjectionsPerDay] = useState("");
  const [cgmDays, setCgmDays] = useState("");

  const { data: settings, isLoading } = useQuery<UserSettings | null>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setTdd(settings.tdd?.toString() || "");
      setBreakfastRatio(settings.breakfastRatio || "");
      setLunchRatio(settings.lunchRatio || "");
      setDinnerRatio(settings.dinnerRatio || "");
      setSnackRatio(settings.snackRatio || "");
      setShortActingPensPerDay(settings.shortActingPensPerDay?.toString() || "");
      setLongActingPensPerDay(settings.longActingPensPerDay?.toString() || "");
      setInjectionsPerDay(settings.injectionsPerDay?.toString() || "");
      setCgmDays(settings.cgmDays?.toString() || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      return await apiRequest("/api/settings", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      tdd: tdd ? parseFloat(tdd) : undefined,
      breakfastRatio,
      lunchRatio,
      dinnerRatio,
      snackRatio,
      shortActingPensPerDay: shortActingPensPerDay ? parseInt(shortActingPensPerDay) : undefined,
      longActingPensPerDay: longActingPensPerDay ? parseInt(longActingPensPerDay) : undefined,
      injectionsPerDay: injectionsPerDay ? parseInt(injectionsPerDay) : undefined,
      cgmDays: cgmDays ? parseInt(cgmDays) : undefined,
      hasCompletedSetup: true,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Basic Insulin Information</CardTitle>
            <CardDescription>Your total daily dose for sick day calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tdd">Total Daily Dose (TDD) - Units</Label>
              <Input
                id="tdd"
                type="number"
                placeholder="e.g., 40"
                value={tdd}
                onChange={(e) => setTdd(e.target.value)}
                data-testid="input-tdd"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Your typical total insulin dose per day (basal + bolus combined)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mealtime Carb Ratios</CardTitle>
            <CardDescription>Configure ratios for AI activity recommendations (format: 1:X).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breakfast-ratio">Breakfast Ratio</Label>
                <Input
                  id="breakfast-ratio"
                  placeholder="e.g., 1:10"
                  value={breakfastRatio}
                  onChange={(e) => setBreakfastRatio(e.target.value)}
                  data-testid="input-breakfast-ratio"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lunch-ratio">Lunch Ratio</Label>
                <Input
                  id="lunch-ratio"
                  placeholder="e.g., 1:12"
                  value={lunchRatio}
                  onChange={(e) => setLunchRatio(e.target.value)}
                  data-testid="input-lunch-ratio"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dinner-ratio">Dinner Ratio</Label>
                <Input
                  id="dinner-ratio"
                  placeholder="e.g., 1:10"
                  value={dinnerRatio}
                  onChange={(e) => setDinnerRatio(e.target.value)}
                  data-testid="input-dinner-ratio"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="snack-ratio">Snack Ratio</Label>
                <Input
                  id="snack-ratio"
                  placeholder="e.g., 1:15"
                  value={snackRatio}
                  onChange={(e) => setSnackRatio(e.target.value)}
                  data-testid="input-snack-ratio"
                  disabled={isLoading}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: 1:X means 1 unit of insulin covers X grams of carbohydrates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Habits (for Supply Tracker)</CardTitle>
            <CardDescription>Help estimate when you'll need to reorder supplies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="short-acting-pens">Short-Acting Pens/Day</Label>
                <Input
                  id="short-acting-pens"
                  type="number"
                  placeholder="e.g., 1"
                  value={shortActingPensPerDay}
                  onChange={(e) => setShortActingPensPerDay(e.target.value)}
                  data-testid="input-short-acting-pens"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="long-acting-pens">Long-Acting Pens/Day</Label>
                <Input
                  id="long-acting-pens"
                  type="number"
                  placeholder="e.g., 1"
                  value={longActingPensPerDay}
                  onChange={(e) => setLongActingPensPerDay(e.target.value)}
                  data-testid="input-long-acting-pens"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="injections-per-day">Total Injections/Day</Label>
                <Input
                  id="injections-per-day"
                  type="number"
                  placeholder="e.g., 4"
                  value={injectionsPerDay}
                  onChange={(e) => setInjectionsPerDay(e.target.value)}
                  data-testid="input-injections-per-day"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cgm-days">CGM Sensor Duration (days)</Label>
                <Input
                  id="cgm-days"
                  type="number"
                  placeholder="e.g., 10"
                  value={cgmDays}
                  onChange={(e) => setCgmDays(e.target.value)}
                  data-testid="input-cgm-days"
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={isLoading || saveMutation.isPending}
            data-testid="button-save-settings"
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
