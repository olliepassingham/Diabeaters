import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [carbRatio, setCarbRatio] = useState("10");
  const [correctionFactor, setCorrectionFactor] = useState("50");
  const [insulinType, setInsulinType] = useState("rapid");
  const [notifications, setNotifications] = useState(true);

  const handleSave = () => {
    console.log("Settings saved:", { carbRatio, correctionFactor, insulinType, notifications });
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
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
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your basic profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="John Doe" data-testid="input-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john@example.com" data-testid="input-email" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insulin Settings</CardTitle>
            <CardDescription>Configure your insulin ratios and preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insulin-type">Primary Insulin Type</Label>
              <Select value={insulinType} onValueChange={setInsulinType}>
                <SelectTrigger id="insulin-type" data-testid="select-insulin-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rapid">Rapid-Acting (NovoRapid, Humalog)</SelectItem>
                  <SelectItem value="long">Long-Acting (Lantus, Tresiba)</SelectItem>
                  <SelectItem value="mixed">Mixed Insulin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carb-ratio">Insulin-to-Carb Ratio (1 unit per X grams)</Label>
              <Input
                id="carb-ratio"
                type="number"
                value={carbRatio}
                onChange={(e) => setCarbRatio(e.target.value)}
                data-testid="input-carb-ratio"
              />
              <p className="text-xs text-muted-foreground">
                1 unit of insulin covers {carbRatio}g of carbohydrates
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction-factor">Correction Factor (1 unit lowers by X mg/dL)</Label>
              <Input
                id="correction-factor"
                type="number"
                value={correctionFactor}
                onChange={(e) => setCorrectionFactor(e.target.value)}
                data-testid="input-correction-factor"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage how you receive alerts and reminders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="low-stock-alerts">Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when supplies are running low
                </p>
              </div>
              <Switch
                id="low-stock-alerts"
                checked={notifications}
                onCheckedChange={setNotifications}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-settings">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
