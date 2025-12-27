import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { storage, UserProfile, UserSettings } from "@/lib/storage";
import { User, Syringe, Activity, Save } from "lucide-react";

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
  
  const [shortActingPensPerDay, setShortActingPensPerDay] = useState("");
  const [longActingPensPerDay, setLongActingPensPerDay] = useState("");
  const [injectionsPerDay, setInjectionsPerDay] = useState("");
  const [cgmDays, setCgmDays] = useState("");

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
      setShortActingPensPerDay(storedSettings.shortActingPensPerDay?.toString() || "");
      setLongActingPensPerDay(storedSettings.longActingPensPerDay?.toString() || "");
      setInjectionsPerDay(storedSettings.injectionsPerDay?.toString() || "");
      setCgmDays(storedSettings.cgmDays?.toString() || "");
    }
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
      shortActingPensPerDay: shortActingPensPerDay ? parseInt(shortActingPensPerDay) : undefined,
      longActingPensPerDay: longActingPensPerDay ? parseInt(longActingPensPerDay) : undefined,
      injectionsPerDay: injectionsPerDay ? parseInt(injectionsPerDay) : undefined,
      cgmDays: cgmDays ? parseInt(cgmDays) : undefined,
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    toast({ title: "Usage settings saved", description: "Your supply usage settings have been updated." });
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
                    <SelectItem value="exchanges">Exchanges (15g)</SelectItem>
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
              <Label className="text-sm font-medium">Carb Ratios (1 unit per X grams)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="breakfast-ratio" className="text-xs text-muted-foreground">Breakfast</Label>
                  <Input
                    id="breakfast-ratio"
                    placeholder="1:10"
                    value={breakfastRatio}
                    onChange={(e) => setBreakfastRatio(e.target.value)}
                    data-testid="input-breakfast-ratio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunch-ratio" className="text-xs text-muted-foreground">Lunch</Label>
                  <Input
                    id="lunch-ratio"
                    placeholder="1:12"
                    value={lunchRatio}
                    onChange={(e) => setLunchRatio(e.target.value)}
                    data-testid="input-lunch-ratio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinner-ratio" className="text-xs text-muted-foreground">Dinner</Label>
                  <Input
                    id="dinner-ratio"
                    placeholder="1:10"
                    value={dinnerRatio}
                    onChange={(e) => setDinnerRatio(e.target.value)}
                    data-testid="input-dinner-ratio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snack-ratio" className="text-xs text-muted-foreground">Snack</Label>
                  <Input
                    id="snack-ratio"
                    placeholder="1:15"
                    value={snackRatio}
                    onChange={(e) => setSnackRatio(e.target.value)}
                    data-testid="input-snack-ratio"
                  />
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Supply Usage Habits</CardTitle>
            </div>
            <CardDescription>Help estimate when you'll need to reorder supplies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="short-acting-pens">Short-Acting Pens/Day</Label>
                <Input
                  id="short-acting-pens"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 0.5"
                  value={shortActingPensPerDay}
                  onChange={(e) => setShortActingPensPerDay(e.target.value)}
                  data-testid="input-short-acting-pens"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="long-acting-pens">Long-Acting Pens/Day</Label>
                <Input
                  id="long-acting-pens"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 0.1"
                  value={longActingPensPerDay}
                  onChange={(e) => setLongActingPensPerDay(e.target.value)}
                  data-testid="input-long-acting-pens"
                />
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
      </div>
    </div>
  );
}
