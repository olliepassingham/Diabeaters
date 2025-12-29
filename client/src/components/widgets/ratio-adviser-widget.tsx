import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Syringe, ArrowRight, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings } from "@/lib/storage";

export function RatioAdviserWidget() {
  const [settings, setSettings] = useState<UserSettings>({});

  useEffect(() => {
    setSettings(storage.getSettings());
  }, []);

  const hasRatios = settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio;

  return (
    <Card data-testid="widget-ratio-adviser">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Syringe className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Your Ratios</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasRatios ? (
          <div className="grid grid-cols-2 gap-2">
            {settings.breakfastRatio && (
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Breakfast</p>
                <p className="text-sm font-medium">{settings.breakfastRatio}</p>
              </div>
            )}
            {settings.lunchRatio && (
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Lunch</p>
                <p className="text-sm font-medium">{settings.lunchRatio}</p>
              </div>
            )}
            {settings.dinnerRatio && (
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Dinner</p>
                <p className="text-sm font-medium">{settings.dinnerRatio}</p>
              </div>
            )}
            {settings.snackRatio && (
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Snack</p>
                <p className="text-sm font-medium">{settings.snackRatio}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              No ratios set yet
            </p>
          </div>
        )}
        
        <Link href="/settings">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-edit-ratios">
            {hasRatios ? "Edit Ratios" : "Set Up Ratios"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
        
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Not medical advice
        </p>
      </CardContent>
    </Card>
  );
}
