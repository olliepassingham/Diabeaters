import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { storage, UserProfile, UserSettings, NotificationSettings } from "@/lib/storage";
import { User, Syringe, Activity, Save, Bell } from "lucide-react";
import { FaceLogoWatermark } from "@/components/face-logo";
import { requestNotificationPermission } from "@/hooks/use-offline";

export default function Settings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bgUnits, setBgUnits] = useState("mg/dL");
  const [carbUnits, setCarbUnits] = useState("grams");
  
  const [tdd, setTdd] = useState("");
  const [breakfastRatio, setBreakfastRatio] = useState("");
  const [lunchRatio, setLunchRatio] = useState("");
  const [dinnerRatio, setDinnerRatio] = useState("");
  const [snackRatio, setSnackRatio] = useState("");
  const [correctionFactor, setCorrectionFactor] = useState("");
  const [targetBgLow, setTargetBgLow] = useState("");
  const [targetBgHigh, setTargetBgHigh] = useState("");
  
  const [shortActingUnitsPerDay, setShortActingUnitsPerDay] = useState("");
  const [longActingUnitsPerDay, setLongActingUnitsPerDay] = useState("");
  const [injectionsPerDay, setInjectionsPerDay] = useState("");
  const [cgmDays, setCgmDays] = useState("");
  
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    enabled: true,
    supplyAlerts: true,
    criticalThresholdDays: 3,
    lowThresholdDays: 7,
    browserNotifications: false,
  });

  useEffect(() => {
    const storedProfile = storage.getProfile();
    const storedSettings = storage.getSettings();
    
    const defaultProfile: UserProfile = {
      name: "",
      email: "",
      dateOfBirth: "",
      bgUnits: "mg/dL",
      carbUnits: "grams",
      diabetesType: "type1",
      insulinDeliveryMethod: "pen",
      usingInsulin: true,
      hasAcceptedDisclaimer: true,
    };
    
    if (storedProfile) {
      setProfile(storedProfile);
      setName(storedProfile.name || "");
      setEmail(storedProfile.email || "");
      setBgUnits(storedProfile.bgUnits || "mg/dL");
      setCarbUnits(storedProfile.carbUnits || "grams");
    } else {
      setProfile(defaultProfile);
    }
    
    if (storedSettings) {
      setSettings(storedSettings);
      setTdd(storedSettings.tdd?.toString() || "");
      setBreakfastRatio(storedSettings.breakfastRatio || "");
      setLunchRatio(storedSettings.lunchRatio || "");
      setDinnerRatio(storedSettings.dinnerRatio || "");
      setSnackRatio(storedSettings.snackRatio || "");
      setCorrectionFactor(storedSettings.correctionFactor?.toString() || "");
      setTargetBgLow(storedSettings.targetBgLow?.toString() || "");
      setTargetBgHigh(storedSettings.targetBgHigh?.toString() || "");
      setShortActingUnitsPerDay(storedSettings.shortActingUnitsPerDay?.toString() || "");
      setLongActingUnitsPerDay(storedSettings.longActingUnitsPerDay?.toString() || "");
      setInjectionsPerDay(storedSettings.injectionsPerDay?.toString() || "");
      setCgmDays(storedSettings.cgmDays?.toString() || "");
    }
    
    setNotifSettings(storage.getNotificationSettings());
  }, []);

  const handleSaveProfile = () => {
    if (profile) {
      storage.saveProfile({
        ...profile,
        name,
        email,
        bgUnits,
        carbUnits,
      });
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    }
  };

  const handleSaveInsulin = () => {
    const newSettings: UserSettings = {
      ...settings,
      tdd: tdd ? parseFloat(tdd) : undefined,
      breakfastRatio,
      lunchRatio,
      dinnerRatio,
      snackRatio,
      correctionFactor: correctionFactor ? parseFloat(correctionFactor) : undefined,
      targetBgLow: targetBgLow ? parseFloat(targetBgLow) : undefined,
      targetBgHigh: targetBgHigh ? parseFloat(targetBgHigh) : undefined,
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    toast({ title: "Insulin settings saved", description: "Your insulin settings have been updated." });
  };

  const handleSaveUsage = () => {
    const newSettings: UserSettings = {
      ...settings,
      shortActingUnitsPerDay: shortActingUnitsPerDay ? parseInt(shortActingUnitsPerDay) : undefined,
      longActingUnitsPerDay: longActingUnitsPerDay ? parseInt(longActingUnitsPerDay) : undefined,
      injectionsPerDay: injectionsPerDay ? parseInt(injectionsPerDay) : undefined,
      cgmDays: cgmDays ? parseInt(cgmDays) : undefined,
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    toast({ title: "Usage settings saved", description: "Your supply usage settings have been updated." });
  };

  const handleNotifToggle = (key: keyof NotificationSettings, value: boolean) => {
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    storage.saveNotificationSettings(updated);
  };

  const handleNotifThreshold = (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => {
    const numValue = parseInt(value) || 0;
    const updated = { ...notifSettings, [key]: numValue };
    setNotifSettings(updated);
    storage.saveNotificationSettings(updated);
  };

  const handleEnableBrowserNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      handleNotifToggle("browserNotifications", true);
      toast({ title: "Notifications enabled", description: "You'll receive browser notifications for important alerts." });
    } else {
      toast({ 
        title: "Permission denied", 
        description: "Please enable notifications in your browser settings.",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-6 relative">
      <FaceLogoWatermark />
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Your personal details and preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bg-units">Blood Glucose Units</Label>
                <Select value={bgUnits} onValueChange={setBgUnits}>
                  <SelectTrigger id="bg-units" data-testid="select-bg-units">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg/dL">mg/dL</SelectItem>
                    <SelectItem value="mmol/L">mmol/L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="carb-units">Carbohydrate Units</Label>
                <Select value={carbUnits} onValueChange={setCarbUnits}>
                  <SelectTrigger id="carb-units" data-testid="select-carb-units">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="portions-10g">Carb Portion (10g)</SelectItem>
                    <SelectItem value="portions-15g">Carb Portion (15g)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} data-testid="button-save-profile">
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-primary" />
              <CardTitle>Insulin Settings</CardTitle>
            </div>
            <CardDescription>Configure your insulin ratios and targets for calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tdd">Total Daily Dose (TDD)</Label>
                <Input
                  id="tdd"
                  type="number"
                  placeholder="e.g., 40"
                  value={tdd}
                  onChange={(e) => setTdd(e.target.value)}
                  data-testid="input-tdd"
                />
                <p className="text-xs text-muted-foreground">Units per day</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="correction-factor">Correction Factor</Label>
                <Input
                  id="correction-factor"
                  type="number"
                  placeholder="e.g., 50"
                  value={correctionFactor}
                  onChange={(e) => setCorrectionFactor(e.target.value)}
                  data-testid="input-correction-factor"
                />
                <p className="text-xs text-muted-foreground">1 unit drops BG by X</p>
              </div>
              <div className="space-y-2">
                <Label>Target Range ({bgUnits})</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Low"
                    value={targetBgLow}
                    onChange={(e) => setTargetBgLow(e.target.value)}
                    data-testid="input-target-bg-low"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="High"
                    value={targetBgHigh}
                    onChange={(e) => setTargetBgHigh(e.target.value)}
                    data-testid="input-target-bg-high"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Carb Ratios (units per 10g carbs)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="breakfast-ratio" className="text-xs text-muted-foreground">Breakfast</Label>
                  <Input
                    id="breakfast-ratio"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 1.0"
                    value={breakfastRatio}
                    onChange={(e) => setBreakfastRatio(e.target.value)}
                    data-testid="input-breakfast-ratio"
                  />
                  <p className="text-xs text-muted-foreground">units/10g</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunch-ratio" className="text-xs text-muted-foreground">Lunch</Label>
                  <Input
                    id="lunch-ratio"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 0.8"
                    value={lunchRatio}
                    onChange={(e) => setLunchRatio(e.target.value)}
                    data-testid="input-lunch-ratio"
                  />
                  <p className="text-xs text-muted-foreground">units/10g</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinner-ratio" className="text-xs text-muted-foreground">Dinner</Label>
                  <Input
                    id="dinner-ratio"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 1.0"
                    value={dinnerRatio}
                    onChange={(e) => setDinnerRatio(e.target.value)}
                    data-testid="input-dinner-ratio"
                  />
                  <p className="text-xs text-muted-foreground">units/10g</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snack-ratio" className="text-xs text-muted-foreground">Snack</Label>
                  <Input
                    id="snack-ratio"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 0.7"
                    value={snackRatio}
                    onChange={(e) => setSnackRatio(e.target.value)}
                    data-testid="input-snack-ratio"
                  />
                  <p className="text-xs text-muted-foreground">units/10g</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveInsulin} data-testid="button-save-insulin">
                <Save className="h-4 w-4 mr-2" />
                Save Insulin Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="usual-habits">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Usual Habits</CardTitle>
            </div>
            <CardDescription>Help estimate when you'll need to reorder supplies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="short-acting-units">Short-Acting Units/Day</Label>
                <Input
                  id="short-acting-units"
                  type="number"
                  placeholder="e.g., 25"
                  value={shortActingUnitsPerDay}
                  onChange={(e) => setShortActingUnitsPerDay(e.target.value)}
                  data-testid="input-short-acting-units"
                />
                <p className="text-xs text-muted-foreground">100 units = 1 pen</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="long-acting-units">Long-Acting Units/Day</Label>
                <Input
                  id="long-acting-units"
                  type="number"
                  placeholder="e.g., 20"
                  value={longActingUnitsPerDay}
                  onChange={(e) => setLongActingUnitsPerDay(e.target.value)}
                  data-testid="input-long-acting-units"
                />
                <p className="text-xs text-muted-foreground">100 units = 1 pen</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="injections-per-day">Injections/Day</Label>
                <Input
                  id="injections-per-day"
                  type="number"
                  placeholder="e.g., 4"
                  value={injectionsPerDay}
                  onChange={(e) => setInjectionsPerDay(e.target.value)}
                  data-testid="input-injections-per-day"
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
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveUsage} data-testid="button-save-usage">
                <Save className="h-4 w-4 mr-2" />
                Save Usage Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="notifications" data-testid="card-notification-settings">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Control when and how you receive alerts about your supplies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive in-app alerts</p>
              </div>
              <Switch
                checked={notifSettings.enabled}
                onCheckedChange={(checked) => handleNotifToggle("enabled", checked)}
                data-testid="switch-notifications-enabled"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Supply Alerts</Label>
                <p className="text-sm text-muted-foreground">Alert when supplies are running low</p>
              </div>
              <Switch
                checked={notifSettings.supplyAlerts}
                onCheckedChange={(checked) => handleNotifToggle("supplyAlerts", checked)}
                disabled={!notifSettings.enabled}
                data-testid="switch-supply-alerts"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="critical-days">Critical Alert (days)</Label>
                <Select
                  value={notifSettings.criticalThresholdDays.toString()}
                  onValueChange={(v) => handleNotifThreshold("criticalThresholdDays", v)}
                  disabled={!notifSettings.enabled || !notifSettings.supplyAlerts}
                >
                  <SelectTrigger id="critical-days" data-testid="select-critical-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Urgent alerts when this low</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low-days">Low Alert (days)</Label>
                <Select
                  value={notifSettings.lowThresholdDays.toString()}
                  onValueChange={(v) => handleNotifThreshold("lowThresholdDays", v)}
                  disabled={!notifSettings.enabled || !notifSettings.supplyAlerts}
                >
                  <SelectTrigger id="low-days" data-testid="select-low-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="10">10 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Reminder to reorder</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">Get alerts even when the app is in the background</p>
                </div>
                {notifSettings.browserNotifications ? (
                  <Switch
                    checked={true}
                    onCheckedChange={(checked) => handleNotifToggle("browserNotifications", checked)}
                    disabled={!notifSettings.enabled}
                    data-testid="switch-browser-notifications"
                  />
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleEnableBrowserNotifications}
                    disabled={!notifSettings.enabled}
                    data-testid="button-enable-browser-notifications"
                  >
                    Enable
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
