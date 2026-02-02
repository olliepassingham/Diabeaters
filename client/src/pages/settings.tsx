import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { storage, UserProfile, UserSettings, NotificationSettings, EmergencyContact } from "@/lib/storage";
import { User, Syringe, Activity, Save, Bell, Phone, Plus, Trash2, Star } from "lucide-react";
import { FaceLogoWatermark } from "@/components/face-logo";
import { requestNotificationPermission } from "@/hooks/use-offline";
import { useLocation } from "wouter";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";

export default function Settings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bgUnits, setBgUnits] = useState("mg/dL");
  const [carbUnits, setCarbUnits] = useState("grams");
  const [deliveryMethod, setDeliveryMethod] = useState<"pen" | "pump">("pen");
  
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
  const [siteChangeDays, setSiteChangeDays] = useState("");
  const [reservoirChangeDays, setReservoirChangeDays] = useState("");
  const [reservoirCapacity, setReservoirCapacity] = useState("");
  
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    enabled: true,
    supplyAlerts: true,
    criticalThresholdDays: 3,
    lowThresholdDays: 7,
    browserNotifications: false,
  });
  
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRelationship, setNewContactRelationship] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);

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
      setDeliveryMethod((storedProfile.insulinDeliveryMethod as "pen" | "pump") || "pen");
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
      setSiteChangeDays(storedSettings.siteChangeDays?.toString() || "3");
      setReservoirChangeDays(storedSettings.reservoirChangeDays?.toString() || "3");
      setReservoirCapacity(storedSettings.reservoirCapacity?.toString() || "300");
    } else {
      setSiteChangeDays("3");
      setReservoirChangeDays("3");
      setReservoirCapacity("300");
    }
    
    setNotifSettings(storage.getNotificationSettings());
    setContacts(storage.getEmergencyContacts());
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace("#", "");
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, []);

  const handleSaveProfile = () => {
    if (profile) {
      const updatedProfile = {
        ...profile,
        name,
        email,
        bgUnits,
        carbUnits,
        insulinDeliveryMethod: deliveryMethod,
      };
      storage.saveProfile(updatedProfile);
      setProfile(updatedProfile);
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
      siteChangeDays: siteChangeDays ? parseInt(siteChangeDays) : undefined,
      reservoirChangeDays: reservoirChangeDays ? parseInt(reservoirChangeDays) : undefined,
      reservoirCapacity: reservoirCapacity ? parseInt(reservoirCapacity) : undefined,
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    toast({ title: "Usage settings saved", description: "Your supply usage settings have been updated." });
  };

  const isPumpUser = deliveryMethod === "pump";

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

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast({ title: "Missing information", description: "Please enter a name and phone number.", variant: "destructive" });
      return;
    }
    const newContact = storage.addEmergencyContact({
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRelationship.trim() || undefined,
      isPrimary: contacts.length === 0,
    });
    setContacts([...contacts, newContact]);
    setNewContactName("");
    setNewContactPhone("");
    setNewContactRelationship("");
    setShowContactForm(false);
    toast({ title: "Contact added", description: `${newContact.name} has been added to your emergency contacts.` });
  };

  const handleDeleteContact = (id: string) => {
    storage.deleteEmergencyContact(id);
    setContacts(contacts.filter(c => c.id !== id));
    toast({ title: "Contact removed" });
  };

  const handleSetPrimary = (id: string) => {
    const updated = contacts.map(c => ({ ...c, isPrimary: c.id === id }));
    updated.forEach(c => {
      storage.deleteEmergencyContact(c.id);
      storage.addEmergencyContact(c);
    });
    setContacts(storage.getEmergencyContacts());
    toast({ title: "Primary contact updated" });
  };

  return (
    <div className="space-y-6 relative">
      <FaceLogoWatermark />
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
        </div>
        <PageInfoDialog
          title="About Settings"
          description="Configure your personal diabetes management preferences"
        >
          <InfoSection title="Profile Section">
            <p>Set your name, email, and choose your preferred units for blood glucose (mmol/L or mg/dL) and carbohydrates.</p>
          </InfoSection>
          <InfoSection title="Insulin Delivery">
            <p>Select whether you use pens (MDI) or an insulin pump. This affects what supply types and features are shown throughout the app.</p>
          </InfoSection>
          <InfoSection title="Insulin Ratios">
            <p>Enter your insulin-to-carb ratios for different meals. These are used by the AI Advisor to calculate bolus suggestions.</p>
          </InfoSection>
          <InfoSection title="Usage Habits">
            <p>Set your typical daily insulin usage, injections per day, and CGM wear time. This helps calculate accurate depletion forecasts in Supply Tracker.</p>
          </InfoSection>
          <InfoSection title="Emergency Contacts">
            <p>Add contacts who should be notified in an emergency. These appear in Help Now and can be called quickly when needed.</p>
          </InfoSection>
          <InfoSection title="Notifications">
            <p>Enable or disable supply alerts and choose when to be warned about low stock levels.</p>
          </InfoSection>
        </PageInfoDialog>
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
            <div className="space-y-2">
              <Label htmlFor="delivery-method">Insulin Delivery Method</Label>
              <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as "pen" | "pump")}>
                <SelectTrigger id="delivery-method" data-testid="select-delivery-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pen">MDI (Multiple Daily Injections)</SelectItem>
                  <SelectItem value="pump">Insulin Pump</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {deliveryMethod === "pump" 
                  ? "Using an insulin pump for continuous delivery" 
                  : "Using pens or syringes for injections"}
              </p>
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
                <Label htmlFor="tdd" className="flex items-center">
                  Total Daily Dose (TDD)
                  <InfoTooltip {...DIABETES_TERMS.tdd} />
                </Label>
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
                <Label htmlFor="correction-factor" className="flex items-center">
                  Correction Factor
                  <InfoTooltip {...DIABETES_TERMS.correctionFactor} />
                </Label>
                <Input
                  id="correction-factor"
                  type="number"
                  step="0.1"
                  placeholder={bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"}
                  value={correctionFactor}
                  onChange={(e) => setCorrectionFactor(e.target.value)}
                  data-testid="input-correction-factor"
                />
                <p className="text-xs text-muted-foreground">How much 1 unit lowers your blood sugar</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center">
                  Target Range ({bgUnits})
                  <InfoTooltip {...DIABETES_TERMS.targetRange} />
                </Label>
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
              <Label className="text-sm font-medium flex items-center">
                Carb Ratios (units per 10g carbs)
                <InfoTooltip {...DIABETES_TERMS.carbRatio} />
              </Label>
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
            <CardDescription>
              Help estimate when you'll need to reorder supplies.
              {isPumpUser && <span className="ml-1 text-primary">(Pump user settings)</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPumpUser ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Daily Dose</Label>
                  <div className="h-9 px-3 rounded-md border bg-muted/50 flex items-center">
                    <span className={tdd ? "" : "text-muted-foreground"}>
                      {tdd ? `${tdd} units/day` : "Set in Insulin Settings above"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Uses your TDD from Insulin Settings</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reservoir-capacity">Reservoir Capacity</Label>
                  <Input
                    id="reservoir-capacity"
                    type="number"
                    placeholder="e.g., 300"
                    value={reservoirCapacity}
                    onChange={(e) => setReservoirCapacity(e.target.value)}
                    data-testid="input-reservoir-capacity"
                  />
                  <p className="text-xs text-muted-foreground">Units per cartridge</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-change-days">Site Change Interval</Label>
                  <Select value={siteChangeDays} onValueChange={setSiteChangeDays}>
                    <SelectTrigger id="site-change-days" data-testid="select-site-change-days">
                      <SelectValue placeholder="Days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Every 2 days</SelectItem>
                      <SelectItem value="3">Every 3 days</SelectItem>
                      <SelectItem value="4">Every 4 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">How often you change infusion sets</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reservoir-change-days">Reservoir Change Interval</Label>
                  <Select value={reservoirChangeDays} onValueChange={setReservoirChangeDays}>
                    <SelectTrigger id="reservoir-change-days" data-testid="select-reservoir-change-days">
                      <SelectValue placeholder="Days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Every 2 days</SelectItem>
                      <SelectItem value="3">Every 3 days</SelectItem>
                      <SelectItem value="4">Every 4 days</SelectItem>
                      <SelectItem value="5">Every 5 days</SelectItem>
                      <SelectItem value="7">Every 7 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">How often you change reservoirs</p>
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
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
            ) : (
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
            )}
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

        <Card id="emergency-contacts" data-testid="card-emergency-contacts">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <CardTitle>Emergency Contacts</CardTitle>
              </div>
              {!showContactForm && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowContactForm(true)}
                  data-testid="button-add-contact"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Contact
                </Button>
              )}
            </div>
            <CardDescription>People to contact in case of an emergency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showContactForm && (
              <div className="p-4 border rounded-md space-y-4 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Name</Label>
                    <Input
                      id="contact-name"
                      placeholder="e.g., Mum"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Phone Number</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="e.g., 07700 900123"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      data-testid="input-contact-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-relationship">Relationship (optional)</Label>
                  <Input
                    id="contact-relationship"
                    placeholder="e.g., Mother, Partner, Friend"
                    value={newContactRelationship}
                    onChange={(e) => setNewContactRelationship(e.target.value)}
                    data-testid="input-contact-relationship"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setShowContactForm(false);
                      setNewContactName("");
                      setNewContactPhone("");
                      setNewContactRelationship("");
                    }}
                    data-testid="button-cancel-contact"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddContact} data-testid="button-save-contact">
                    <Save className="h-4 w-4 mr-2" />
                    Save Contact
                  </Button>
                </div>
              </div>
            )}

            {contacts.length === 0 && !showContactForm ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No emergency contacts added yet. Add someone who can help in an emergency.
              </p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div 
                    key={contact.id} 
                    className="flex items-center justify-between p-3 border rounded-md gap-2"
                    data-testid={`contact-item-${contact.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{contact.name}</span>
                          {contact.isPrimary && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{contact.phone}</p>
                        {contact.relationship && (
                          <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!contact.isPrimary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetPrimary(contact.id)}
                          title="Set as primary contact"
                          data-testid={`button-set-primary-${contact.id}`}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteContact(contact.id)}
                        title="Delete contact"
                        data-testid={`button-delete-contact-${contact.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
