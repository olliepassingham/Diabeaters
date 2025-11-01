import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SickDay() {
  const { toast } = useToast();
  const [tdd, setTdd] = useState("");
  const [bgLevel, setBgLevel] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [results, setResults] = useState<{
    correctionDose: number;
    breakfastRatio: string;
    lunchRatio: string;
    dinnerRatio: string;
    snackRatio: string;
  } | null>(null);

  const handleCalculate = () => {
    if (!tdd || !bgLevel || !severity) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields to calculate recommendations.",
        variant: "destructive",
      });
      return;
    }

    const tddNum = parseFloat(tdd);
    const bgNum = parseFloat(bgLevel);
    
    let severityMultiplier = 1;
    if (severity === "moderate") severityMultiplier = 1.2;
    if (severity === "severe") severityMultiplier = 1.5;

    const correctionFactor = 1800 / tddNum;
    const bgAboveTarget = Math.max(0, bgNum - 100);
    const correctionDose = Math.round((bgAboveTarget / correctionFactor) * severityMultiplier * 10) / 10;

    const baseRatio = Math.round(450 / tddNum);
    const adjustedRatio = Math.max(1, Math.round(baseRatio / severityMultiplier));

    setResults({
      correctionDose,
      breakfastRatio: `1:${adjustedRatio}`,
      lunchRatio: `1:${adjustedRatio}`,
      dinnerRatio: `1:${adjustedRatio}`,
      snackRatio: `1:${Math.max(1, adjustedRatio + 2)}`,
    });

    console.log("Sick day calculation completed", { tdd: tddNum, bgLevel: bgNum, severity });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Sick Day Adviser</h1>
        <p className="text-muted-foreground mt-1">
          Calculate insulin adjustments when you're feeling unwell.
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Medical Disclaimer</p>
                <p className="text-yellow-800 dark:text-yellow-200 mt-1">
                  This tool provides estimates only. Always consult your healthcare provider when sick, 
                  especially if blood glucose is consistently high or you have ketones.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input Information</CardTitle>
            <CardDescription>
              Enter your details to calculate sick day adjustments
            </CardDescription>
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
              />
              <p className="text-xs text-muted-foreground">
                Your typical total insulin dose per day (basal + bolus combined)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Illness Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="severity" data-testid="select-severity">
                  <SelectValue placeholder="Select severity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor (slight cold, feeling off)</SelectItem>
                  <SelectItem value="moderate">Moderate (fever, flu symptoms)</SelectItem>
                  <SelectItem value="severe">Severe (high fever, vomiting, unable to eat)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bg-level">Current Blood Glucose (mg/dL)</Label>
              <Input
                id="bg-level"
                type="number"
                placeholder="e.g., 180"
                value={bgLevel}
                onChange={(e) => setBgLevel(e.target.value)}
                data-testid="input-bg-level"
              />
            </div>

            <Button onClick={handleCalculate} className="w-full" data-testid="button-calculate">
              <Activity className="h-4 w-4 mr-2" />
              Calculate Recommendations
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Sick Day Recommendations</CardTitle>
              <CardDescription>Based on your current condition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">Correction Dose:</span>
                  <span className="text-2xl font-semibold" data-testid="text-correction-dose">
                    {results.correctionDose} units
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Immediate correction for current blood glucose
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Adjusted Mealtime Ratios</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Breakfast</p>
                    <p className="font-semibold mt-1">{results.breakfastRatio}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Lunch</p>
                    <p className="font-semibold mt-1">{results.lunchRatio}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Dinner</p>
                    <p className="font-semibold mt-1">{results.dinnerRatio}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Snacks</p>
                    <p className="font-semibold mt-1">{results.snackRatio}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ratios show: 1 unit of insulin per X grams of carbohydrates
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">Important Reminders:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Check blood glucose every 2-4 hours</li>
                  <li>Stay hydrated with sugar-free fluids</li>
                  <li>Check for ketones if BG remains high</li>
                  <li>Contact your healthcare team if symptoms worsen</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
