import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { storage, UserProfile, UserSettings, NotificationSettings, EmergencyContact } from "@/lib/storage";
import { User, Syringe, Activity, Save, Bell, Phone, Plus, Trash2, Star, Download, Upload } from "lucide-react";
import { FaceLogoWatermark } from "@/components/face-logo";
import { requestNotificationPermission } from "@/hooks/use-offline";
import { useLocation } from "wouter";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";

function ProfileTab({ 
  name, setName, email, setEmail, bgUnits, setBgUnits, 
  carbUnits, setCarbUnits, deliveryMethod, setDeliveryMethod, 
  onSave 
}: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  bgUnits: string; setBgUnits: (v: string) => void;
  carbUnits: string; setCarbUnits: (v: string) => void;
  deliveryMethod: "pen" | "pump"; setDeliveryMethod: (v: "pen" | "pump") => void;
  onSave: () => void;
}) {
  return (
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
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bg-units">Blood Glucose Units</Label>
            <Select value={bgUnits} onValueChange={setBgUnits}>
              <SelectTrigger id="bg-units" data-testid="select-bg-units"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mmol/L">mmol/L</SelectItem>
                <SelectItem value="mg/dL">mg/dL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="carb-units">Carbohydrate Units</Label>
            <Select value={carbUnits} onValueChange={setCarbUnits}>
              <SelectTrigger id="carb-units" data-testid="select-carb-units"><SelectValue /></SelectTrigger>
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
            <SelectTrigger id="delivery-method" data-testid="select-delivery-method"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pen">MDI (Multiple Daily Injections)</SelectItem>
              <SelectItem value="pump">Insulin Pump</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {deliveryMethod === "pump" ? "Using an insulin pump for continuous delivery" : "Using pens or syringes for injections"}
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} data-testid="button-save-profile">
            <Save className="h-4 w-4 mr-2" />
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InsulinTab({
  bgUnits, tdd, setTdd, correctionFactor, setCorrectionFactor,
  targetBgLow, setTargetBgLow, targetBgHigh, setTargetBgHigh,
  breakfastRatio, setBreakfastRatio, lunchRatio, setLunchRatio,
  dinnerRatio, setDinnerRatio, snackRatio, setSnackRatio,
  onSave
}: {
  bgUnits: string;
  tdd: string; setTdd: (v: string) => void;
  correctionFactor: string; setCorrectionFactor: (v: string) => void;
  targetBgLow: string; setTargetBgLow: (v: string) => void;
  targetBgHigh: string; setTargetBgHigh: (v: string) => void;
  breakfastRatio: string; setBreakfastRatio: (v: string) => void;
  lunchRatio: string; setLunchRatio: (v: string) => void;
  dinnerRatio: string; setDinnerRatio: (v: string) => void;
  snackRatio: string; setSnackRatio: (v: string) => void;
  onSave: () => void;
}) {
  return (
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
            <Input id="tdd" type="number" placeholder="e.g., 40" value={tdd} onChange={(e) => setTdd(e.target.value)} data-testid="input-tdd" />
            <p className="text-xs text-muted-foreground">Units per day</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="correction-factor" className="flex items-center">
              Correction Factor
              <InfoTooltip {...DIABETES_TERMS.correctionFactor} />
            </Label>
            <Input id="correction-factor" type="number" step="0.1" placeholder={bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"} value={correctionFactor} onChange={(e) => setCorrectionFactor(e.target.value)} data-testid="input-correction-factor" />
            <p className="text-xs text-muted-foreground">How much 1 unit lowers your blood sugar</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center">
              Target Range ({bgUnits})
              <InfoTooltip {...DIABETES_TERMS.targetRange} />
            </Label>
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Low" value={targetBgLow} onChange={(e) => setTargetBgLow(e.target.value)} data-testid="input-target-bg-low" />
              <span className="text-muted-foreground">-</span>
              <Input type="number" placeholder="High" value={targetBgHigh} onChange={(e) => setTargetBgHigh(e.target.value)} data-testid="input-target-bg-high" />
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
              <Input id="breakfast-ratio" type="number" step="0.1" placeholder="e.g., 1.0" value={breakfastRatio} onChange={(e) => setBreakfastRatio(e.target.value)} data-testid="input-breakfast-ratio" />
              <p className="text-xs text-muted-foreground">units/10g</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunch-ratio" className="text-xs text-muted-foreground">Lunch</Label>
              <Input id="lunch-ratio" type="number" step="0.1" placeholder="e.g., 0.8" value={lunchRatio} onChange={(e) => setLunchRatio(e.target.value)} data-testid="input-lunch-ratio" />
              <p className="text-xs text-muted-foreground">units/10g</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dinner-ratio" className="text-xs text-muted-foreground">Dinner</Label>
              <Input id="dinner-ratio" type="number" step="0.1" placeholder="e.g., 1.0" value={dinnerRatio} onChange={(e) => setDinnerRatio(e.target.value)} data-testid="input-dinner-ratio" />
              <p className="text-xs text-muted-foreground">units/10g</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="snack-ratio" className="text-xs text-muted-foreground">Snack</Label>
              <Input id="snack-ratio" type="number" step="0.1" placeholder="e.g., 0.7" value={snackRatio} onChange={(e) => setSnackRatio(e.target.value)} data-testid="input-snack-ratio" />
              <p className="text-xs text-muted-foreground">units/10g</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} data-testid="button-save-insulin">
            <Save className="h-4 w-4 mr-2" />
            Save Insulin Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageTab({
  isPumpUser, tdd,
  shortActingUnitsPerDay, setShortActingUnitsPerDay,
  longActingUnitsPerDay, setLongActingUnitsPerDay,
  injectionsPerDay, setInjectionsPerDay,
  cgmDays, setCgmDays,
  siteChangeDays, setSiteChangeDays,
  reservoirChangeDays, setReservoirChangeDays,
  reservoirCapacity, setReservoirCapacity,
  onSave
}: {
  isPumpUser: boolean; tdd: string;
  shortActingUnitsPerDay: string; setShortActingUnitsPerDay: (v: string) => void;
  longActingUnitsPerDay: string; setLongActingUnitsPerDay: (v: string) => void;
  injectionsPerDay: string; setInjectionsPerDay: (v: string) => void;
  cgmDays: string; setCgmDays: (v: string) => void;
  siteChangeDays: string; setSiteChangeDays: (v: string) => void;
  reservoirChangeDays: string; setReservoirChangeDays: (v: string) => void;
  reservoirCapacity: string; setReservoirCapacity: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Card>
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
                  {tdd ? `${tdd} units/day` : "Set in Insulin & Ratios tab"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Uses your TDD from Insulin Settings</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservoir-capacity">Reservoir Capacity</Label>
              <Input id="reservoir-capacity" type="number" placeholder="e.g., 300" value={reservoirCapacity} onChange={(e) => setReservoirCapacity(e.target.value)} data-testid="input-reservoir-capacity" />
              <p className="text-xs text-muted-foreground">Units per cartridge</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-change-days">Site Change Interval</Label>
              <Select value={siteChangeDays} onValueChange={setSiteChangeDays}>
                <SelectTrigger id="site-change-days" data-testid="select-site-change-days"><SelectValue placeholder="Days" /></SelectTrigger>
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
                <SelectTrigger id="reservoir-change-days" data-testid="select-reservoir-change-days"><SelectValue placeholder="Days" /></SelectTrigger>
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
              <Input id="cgm-days" type="number" placeholder="e.g., 10" value={cgmDays} onChange={(e) => setCgmDays(e.target.value)} data-testid="input-cgm-days" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="short-acting-units">Short-Acting Units/Day</Label>
              <Input id="short-acting-units" type="number" placeholder="e.g., 25" value={shortActingUnitsPerDay} onChange={(e) => setShortActingUnitsPerDay(e.target.value)} data-testid="input-short-acting-units" />
              <p className="text-xs text-muted-foreground">100 units = 1 pen</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="long-acting-units">Long-Acting Units/Day</Label>
              <Input id="long-acting-units" type="number" placeholder="e.g., 20" value={longActingUnitsPerDay} onChange={(e) => setLongActingUnitsPerDay(e.target.value)} data-testid="input-long-acting-units" />
              <p className="text-xs text-muted-foreground">100 units = 1 pen</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="injections-per-day">Injections/Day</Label>
              <Input id="injections-per-day" type="number" placeholder="e.g., 4" value={injectionsPerDay} onChange={(e) => setInjectionsPerDay(e.target.value)} data-testid="input-injections-per-day" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cgm-days">CGM Sensor Duration (days)</Label>
              <Input id="cgm-days" type="number" placeholder="e.g., 10" value={cgmDays} onChange={(e) => setCgmDays(e.target.value)} data-testid="input-cgm-days" />
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onSave} data-testid="button-save-usage">
            <Save className="h-4 w-4 mr-2" />
            Save Usage Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsTab({
  notifSettings, onToggle, onThreshold, onEnableBrowser
}: {
  notifSettings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
  onThreshold: (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => void;
  onEnableBrowser: () => void;
}) {
  return (
    <Card data-testid="card-notification-settings">
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
          <Switch checked={notifSettings.enabled} onCheckedChange={(checked) => onToggle("enabled", checked)} data-testid="switch-notifications-enabled" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Supply Alerts</Label>
            <p className="text-sm text-muted-foreground">Alert when supplies are running low</p>
          </div>
          <Switch checked={notifSettings.supplyAlerts} onCheckedChange={(checked) => onToggle("supplyAlerts", checked)} disabled={!notifSettings.enabled} data-testid="switch-supply-alerts" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="critical-days">Critical Alert (days)</Label>
            <Select value={notifSettings.criticalThresholdDays.toString()} onValueChange={(v) => onThreshold("criticalThresholdDays", v)} disabled={!notifSettings.enabled || !notifSettings.supplyAlerts}>
              <SelectTrigger id="critical-days" data-testid="select-critical-days"><SelectValue /></SelectTrigger>
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
            <Select value={notifSettings.lowThresholdDays.toString()} onValueChange={(v) => onThreshold("lowThresholdDays", v)} disabled={!notifSettings.enabled || !notifSettings.supplyAlerts}>
              <SelectTrigger id="low-days" data-testid="select-low-days"><SelectValue /></SelectTrigger>
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
              <Switch checked={true} onCheckedChange={(checked) => onToggle("browserNotifications", checked)} disabled={!notifSettings.enabled} data-testid="switch-browser-notifications" />
            ) : (
              <Button variant="outline" size="sm" onClick={onEnableBrowser} disabled={!notifSettings.enabled} data-testid="button-enable-browser-notifications">
                Enable
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmergencyContactsTab({
  contacts, showContactForm, setShowContactForm,
  newContactName, setNewContactName, newContactPhone, setNewContactPhone,
  newContactRelationship, setNewContactRelationship,
  onAdd, onDelete, onSetPrimary
}: {
  contacts: EmergencyContact[];
  showContactForm: boolean; setShowContactForm: (v: boolean) => void;
  newContactName: string; setNewContactName: (v: string) => void;
  newContactPhone: string; setNewContactPhone: (v: string) => void;
  newContactRelationship: string; setNewContactRelationship: (v: string) => void;
  onAdd: () => void; onDelete: (id: string) => void; onSetPrimary: (id: string) => void;
}) {
  return (
    <Card data-testid="card-emergency-contacts">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle>Emergency Contacts</CardTitle>
          </div>
          {!showContactForm && (
            <Button variant="outline" size="sm" onClick={() => setShowContactForm(true)} data-testid="button-add-contact">
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
                <Input id="contact-name" placeholder="e.g., Mum" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} data-testid="input-contact-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone Number</Label>
                <Input id="contact-phone" type="tel" placeholder="e.g., 07700 900123" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} data-testid="input-contact-phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-relationship">Relationship (optional)</Label>
              <Input id="contact-relationship" placeholder="e.g., Mother, Partner, Friend" value={newContactRelationship} onChange={(e) => setNewContactRelationship(e.target.value)} data-testid="input-contact-relationship" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowContactForm(false); setNewContactName(""); setNewContactPhone(""); setNewContactRelationship(""); }} data-testid="button-cancel-contact">
                Cancel
              </Button>
              <Button onClick={onAdd} data-testid="button-save-contact">
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
              <div key={contact.id} className="flex items-center justify-between p-3 border rounded-md gap-2" data-testid={`contact-item-${contact.id}`}>
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
                    {contact.relationship && <p className="text-xs text-muted-foreground">{contact.relationship}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!contact.isPrimary && (
                    <Button variant="ghost" size="icon" onClick={() => onSetPrimary(contact.id)} title="Set as primary contact" data-testid={`button-set-primary-${contact.id}`}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onDelete(contact.id)} title="Delete contact" data-testid={`button-delete-contact-${contact.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataTab() {
  const { toast } = useToast();

  const handleExport = () => {
    const data = storage.exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diabeaters-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "Your backup file has been downloaded." });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = storage.importAllData(content);
      if (result.success) {
        toast({ title: "Data imported", description: "Your data has been restored. The page will refresh." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "Import failed", description: result.error || "Something went wrong.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <CardTitle>Data & Backup</CardTitle>
        </div>
        <CardDescription>Export or import your Diabeaters data. Your data is stored on this device only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="font-medium">Export your data</Label>
            <p className="text-sm text-muted-foreground">Download all your settings, supplies, contacts, and history as a backup file.</p>
          </div>
          <Button onClick={handleExport} variant="outline" data-testid="button-export-data">
            <Download className="h-4 w-4 mr-2" />
            Download Backup
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="space-y-1">
            <Label className="font-medium">Import data</Label>
            <p className="text-sm text-muted-foreground">Restore from a previously exported backup file. This will replace your current data.</p>
          </div>
          <div>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" id="import-file" data-testid="input-import-file" />
            <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()} data-testid="button-import-data">
              <Upload className="h-4 w-4 mr-2" />
              Import Backup
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Tip: Export your data regularly to keep a backup. If you use a different device or browser, you can import your backup to continue where you left off.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});
  const [activeTab, setActiveTab] = useState("profile");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bgUnits, setBgUnits] = useState("mmol/L");
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
      bgUnits: "mmol/L",
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
      setBgUnits(storedProfile.bgUnits || "mmol/L");
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
      const hash = window.location.hash.replace("#", "");
      const tabMap: Record<string, string> = {
        "notifications": "notifications",
        "emergency-contacts": "contacts",
        "usual-habits": "usage",
        "data": "data",
      };
      if (tabMap[hash]) {
        setActiveTab(tabMap[hash]);
      }
    }
  }, []);

  const handleSaveProfile = () => {
    if (profile) {
      const updatedProfile = { ...profile, name, email, bgUnits, carbUnits, insulinDeliveryMethod: deliveryMethod };
      storage.saveProfile(updatedProfile);
      setProfile(updatedProfile);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    }
  };

  const handleSaveInsulin = () => {
    const newSettings: UserSettings = {
      ...settings,
      tdd: tdd ? parseFloat(tdd) : undefined,
      breakfastRatio, lunchRatio, dinnerRatio, snackRatio,
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
      toast({ title: "Permission denied", description: "Please enable notifications in your browser settings.", variant: "destructive" });
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
          <InfoSection title="Profile">
            <p>Set your name, email, and choose your preferred units for blood glucose (mmol/L or mg/dL) and carbohydrates.</p>
          </InfoSection>
          <InfoSection title="Insulin & Ratios">
            <p>Enter your insulin-to-carb ratios, correction factor, and target range. These are used by the AI Advisor for bolus suggestions.</p>
          </InfoSection>
          <InfoSection title="Supply Usage">
            <p>Set your typical daily insulin usage and CGM wear time. This helps calculate accurate depletion forecasts in Supply Tracker.</p>
          </InfoSection>
          <InfoSection title="Notifications">
            <p>Enable or disable supply alerts and choose when to be warned about low stock levels.</p>
          </InfoSection>
          <InfoSection title="Emergency Contacts">
            <p>Add contacts who should be notified in an emergency. These appear in Help Now and can be called quickly when needed.</p>
          </InfoSection>
        </PageInfoDialog>
      </div>

      <div className="max-w-3xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="settings-tabs">
          <TabsList className="w-full grid grid-cols-6" data-testid="settings-tab-list">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="h-4 w-4 mr-1 hidden sm:inline" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="insulin" data-testid="tab-insulin">
              <Syringe className="h-4 w-4 mr-1 hidden sm:inline" />
              <span>Ratios</span>
            </TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">
              <Activity className="h-4 w-4 mr-1 hidden sm:inline" />
              <span>Usage</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="h-4 w-4 mr-1 hidden sm:inline" />
              <span>Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">
              <Phone className="h-4 w-4 mr-1 hidden sm:inline" />
              <span>Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="data" data-testid="tab-data">
              <Download className="h-4 w-4 mr-1 hidden sm:inline" />
              <span>Data</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="profile">
              <ProfileTab
                name={name} setName={setName} email={email} setEmail={setEmail}
                bgUnits={bgUnits} setBgUnits={setBgUnits} carbUnits={carbUnits} setCarbUnits={setCarbUnits}
                deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod}
                onSave={handleSaveProfile}
              />
            </TabsContent>

            <TabsContent value="insulin">
              <InsulinTab
                bgUnits={bgUnits} tdd={tdd} setTdd={setTdd}
                correctionFactor={correctionFactor} setCorrectionFactor={setCorrectionFactor}
                targetBgLow={targetBgLow} setTargetBgLow={setTargetBgLow}
                targetBgHigh={targetBgHigh} setTargetBgHigh={setTargetBgHigh}
                breakfastRatio={breakfastRatio} setBreakfastRatio={setBreakfastRatio}
                lunchRatio={lunchRatio} setLunchRatio={setLunchRatio}
                dinnerRatio={dinnerRatio} setDinnerRatio={setDinnerRatio}
                snackRatio={snackRatio} setSnackRatio={setSnackRatio}
                onSave={handleSaveInsulin}
              />
            </TabsContent>

            <TabsContent value="usage">
              <UsageTab
                isPumpUser={isPumpUser} tdd={tdd}
                shortActingUnitsPerDay={shortActingUnitsPerDay} setShortActingUnitsPerDay={setShortActingUnitsPerDay}
                longActingUnitsPerDay={longActingUnitsPerDay} setLongActingUnitsPerDay={setLongActingUnitsPerDay}
                injectionsPerDay={injectionsPerDay} setInjectionsPerDay={setInjectionsPerDay}
                cgmDays={cgmDays} setCgmDays={setCgmDays}
                siteChangeDays={siteChangeDays} setSiteChangeDays={setSiteChangeDays}
                reservoirChangeDays={reservoirChangeDays} setReservoirChangeDays={setReservoirChangeDays}
                reservoirCapacity={reservoirCapacity} setReservoirCapacity={setReservoirCapacity}
                onSave={handleSaveUsage}
              />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationsTab
                notifSettings={notifSettings}
                onToggle={handleNotifToggle}
                onThreshold={handleNotifThreshold}
                onEnableBrowser={handleEnableBrowserNotifications}
              />
            </TabsContent>

            <TabsContent value="contacts">
              <EmergencyContactsTab
                contacts={contacts} showContactForm={showContactForm} setShowContactForm={setShowContactForm}
                newContactName={newContactName} setNewContactName={setNewContactName}
                newContactPhone={newContactPhone} setNewContactPhone={setNewContactPhone}
                newContactRelationship={newContactRelationship} setNewContactRelationship={setNewContactRelationship}
                onAdd={handleAddContact} onDelete={handleDeleteContact} onSetPrimary={handleSetPrimary}
              />
            </TabsContent>

            <TabsContent value="data">
              <DataTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
