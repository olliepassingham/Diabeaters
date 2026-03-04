import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, ArrowLeft, Package, Syringe, Activity, Calendar, Heart, AlertTriangle, CheckCircle2, Clock, Thermometer, Plane, Info, Plug, Cylinder, Shield } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply, UserProfile, UserSettings, HypoTreatment, CarerPrivacySettings } from "@/lib/storage";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";

function HealthIndicator({ supplies, settings }: { supplies: Supply[]; settings: UserSettings }) {
  if (supplies.length === 0) return null;

  const lowSupplies = supplies.filter(s => {
    if (s.dailyUsage <= 0) return false;
    const daysLeft = s.currentQuantity / s.dailyUsage;
    return daysLeft <= 7;
  });

  const criticalSupplies = supplies.filter(s => {
    if (s.dailyUsage <= 0) return false;
    const daysLeft = s.currentQuantity / s.dailyUsage;
    return daysLeft <= 3;
  });

  if (criticalSupplies.length > 0) {
    return (
      <Card className="border-red-500/30 bg-red-50 dark:bg-red-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Attention Needed</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {criticalSupplies.length} supply item{criticalSupplies.length > 1 ? "s" : ""} running critically low (3 days or less)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lowSupplies.length > 0) {
    return (
      <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Supplies Getting Low</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {lowSupplies.length} item{lowSupplies.length > 1 ? "s" : ""} will run out within a week
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">All Looking Good</p>
            <p className="text-sm text-green-700 dark:text-green-300">Supplies are well stocked and no immediate concerns</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const typeIcons: Record<string, typeof Package> = {
  needle: Syringe,
  insulin: Package,
  cgm: Activity,
  infusion_set: Plug,
  reservoir: Cylinder,
  other: Package,
};

export default function CarerView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [hypoTreatments, setHypoTreatments] = useState<HypoTreatment[]>([]);
  const [privacy, setPrivacy] = useState<CarerPrivacySettings>(storage.getCarerPrivacy());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [scenarioState, setScenarioState] = useState<any>(null);

  useEffect(() => {
    setProfile(storage.getProfile());
    setSettings(storage.getSettings());
    setSupplies(storage.getSupplies());
    setHypoTreatments(storage.getHypoTreatments());
    setPrivacy(storage.getCarerPrivacy());
    setAppointments(storage.getAppointments());
    setScenarioState(storage.getScenarioState());
  }, []);

  const userName = profile?.name || "User";
  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/family-carers">
          <Button variant="ghost" size="icon" data-testid="button-back-from-carer-view">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-carer-view">
            <Eye className="h-6 w-6 text-primary" />
            Carer View
          </h1>
          <p className="text-muted-foreground">What a linked carer would see for {firstName}</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Shield className="h-3 w-3" /> Read Only
        </Badge>
      </div>

      <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Prototype Preview:</strong> This shows what a linked carer would see on their device. In a full release, this would be a separate login with real-time data syncing.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Heart className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" data-testid="text-carer-view-name">{userName}</h2>
              <p className="text-muted-foreground text-sm">Type 1 Diabetes {profile?.insulinDeliveryMethod === "pump" ? "(Insulin Pump)" : "(Injections)"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Last updated: just now</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <HealthIndicator supplies={supplies} settings={settings} />

      {scenarioState?.sickDayActive && privacy.shareScenarios && (
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Thermometer className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Sick Day Mode Active</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">{firstName} has activated sick day monitoring</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scenarioState?.travelActive && privacy.shareScenarios && (
        <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Plane className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Travel Mode Active</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {scenarioState.travelDestination ? `Travelling to ${scenarioState.travelDestination}` : `${firstName} is currently travelling`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {privacy.shareHypoAlerts && (
        <Card data-testid="card-hypo-log">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Hypo Treatments
            </CardTitle>
            <CardDescription>Recent hypo treatment notifications</CardDescription>
          </CardHeader>
          <CardContent>
            {hypoTreatments.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No recent hypo treatments recorded</p>
                <p className="text-xs text-muted-foreground mt-1">This is good news</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hypoTreatments.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-start gap-3 py-2 border-b last:border-0" data-testid={`hypo-entry-${t.id}`}>
                    <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">Hypo Treated</span>
                        {t.carerNotified && <Badge variant="secondary" className="text-xs">Notified</Badge>}
                      </div>
                      {t.glucoseLevel && <p className="text-sm text-muted-foreground">Glucose: {t.glucoseLevel} mmol/L</p>}
                      {t.treatment && <p className="text-sm text-muted-foreground">Treatment: {t.treatment}</p>}
                      {t.followUpGlucose && <p className="text-sm text-green-600 dark:text-green-400">Follow-up: {t.followUpGlucose} mmol/L</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatDistanceToNow(new Date(t.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {privacy.shareSupplies && (
        <Card data-testid="card-supply-overview">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Supply Levels
            </CardTitle>
            <CardDescription>{firstName}'s current supply stock</CardDescription>
          </CardHeader>
          <CardContent>
            {supplies.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">No supplies tracked yet</p>
            ) : (
              <div className="space-y-3">
                {supplies.map((supply) => {
                  const daysLeft = supply.dailyUsage > 0 ? Math.floor(supply.currentQuantity / supply.dailyUsage) : Infinity;
                  const Icon = typeIcons[supply.type] || Package;
                  const isLow = daysLeft <= 7;
                  const isCritical = daysLeft <= 3;

                  return (
                    <div key={supply.id} className="flex items-center gap-3 py-2 border-b last:border-0" data-testid={`carer-supply-${supply.id}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isCritical ? "bg-red-100 dark:bg-red-900/30" : isLow ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${isCritical ? "text-red-500" : isLow ? "text-amber-500" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{supply.name}</p>
                        <p className="text-xs text-muted-foreground">{supply.currentQuantity} remaining</p>
                      </div>
                      <div className="text-right shrink-0">
                        {daysLeft === Infinity ? (
                          <Badge variant="secondary" className="text-xs">No usage set</Badge>
                        ) : isCritical ? (
                          <Badge variant="destructive" className="text-xs">{daysLeft}d left</Badge>
                        ) : isLow ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">{daysLeft}d left</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{daysLeft}d left</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {privacy.shareAppointments && (
        <Card data-testid="card-appointments-overview">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Appointments
            </CardTitle>
            <CardDescription>{firstName}'s scheduled healthcare visits</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const upcoming = appointments
                .filter((a: any) => !a.completed && new Date(a.date) >= new Date())
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

              if (upcoming.length === 0) {
                return <p className="text-muted-foreground text-center py-6 text-sm">No upcoming appointments</p>;
              }

              return (
                <div className="space-y-3">
                  {upcoming.slice(0, 5).map((apt: any) => {
                    const daysUntil = differenceInDays(new Date(apt.date), new Date());
                    return (
                      <div key={apt.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(apt.date), "EEE d MMM yyyy")}{apt.location ? ` \u00b7 ${apt.location}` : ""}</p>
                        </div>
                        <div className="shrink-0">
                          {daysUntil === 0 ? (
                            <Badge variant="destructive" className="text-xs">Today</Badge>
                          ) : daysUntil <= 7 ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">{daysUntil}d</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{daysUntil}d</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="text-center text-xs text-muted-foreground py-4">
        <p>This is a read-only carer view. Changes can only be made by {firstName}.</p>
      </div>
    </div>
  );
}
