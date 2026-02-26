/**
 * Staged UI for App Store screenshots. No network, no auth.
 * Visit /_shots?state=<state> where state is one of:
 * onboarding | dashboard | add-supply | routines | settings-about
 */
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaceLogo } from "@/components/face-logo";
import { Disclaimer } from "@/components/disclaimer";
import { Heart, Shield, Clock, Package, Plus, Repeat, Info } from "lucide-react";

const PADDING = 24;
const BG = "rgb(245, 242, 236)"; // neutral beige

function ShotsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        padding: PADDING,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function OnboardingShot() {
  return (
    <ShotsLayout>
      <div className="text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <FaceLogo size={80} />
            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Diabeaters</h1>
          <p className="text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Stay one step ahead of your diabetes. Less guessing, more living.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 pb-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-base">What should we call you?</Label>
              <Input placeholder="Your first name" className="text-center text-lg" readOnly value="Alex" />
            </div>
            <div className="space-y-2">
              <Label className="text-base">What type of diabetes do you have?</Label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between p-3 rounded-md border border-primary bg-primary/5 ring-1 ring-primary">
                  <span className="font-medium text-sm">Type 1</span>
                  <span className="text-primary">✓</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span>Your data stays on your device</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Takes 2 minutes</span>
          </div>
        </div>
      </div>
    </ShotsLayout>
  );
}

const MOCK_SUPPLIES = [
  { name: "Insulin cartridges", quantity: 2 },
  { name: "CGM sensors", quantity: 3 },
  { name: "Needles", quantity: 24 },
];

function DashboardShot() {
  return (
    <ShotsLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaceLogo size={40} />
            <span className="font-semibold text-xl">Diabeaters</span>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cloud supplies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_SUPPLIES.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">Synced</p>
                </div>
                <span className="text-xs font-medium">{s.quantity}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add supply
          </Button>
        </div>
      </div>
    </ShotsLayout>
  );
}

function AddSupplyShot() {
  return (
    <ShotsLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FaceLogo size={40} />
          <span className="font-semibold text-xl">Diabeaters</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cloud supplies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="flex flex-col gap-2">
              <Input placeholder="Supply name" value="Test strips" readOnly />
              <Input type="number" value="50" className="w-24" readOnly />
              <Button size="sm">Add</Button>
            </form>
            <div className="border-t pt-3 space-y-2">
              {MOCK_SUPPLIES.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{s.name}</p>
                  <span className="text-xs">{s.quantity}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ShotsLayout>
  );
}

function RoutinesShot() {
  return (
    <ShotsLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FaceLogo size={40} />
          <span className="font-semibold text-xl">Diabeaters</span>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Routines</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Plan activities, meals and routines with guidance.
            </p>
            <div className="space-y-2">
              {["Morning coffee routine", "Post‑gym checklist", "Travel prep"].map((label, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <span className="text-xs text-muted-foreground">Saved</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full">
              Create a routine
            </Button>
          </CardContent>
        </Card>
      </div>
    </ShotsLayout>
  );
}

function SettingsAboutShot() {
  return (
    <ShotsLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FaceLogo size={40} />
          <span className="font-semibold text-xl">Diabeaters</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-5 w-5 text-primary" />
              Data &amp; Safety
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Disclaimer />
          </CardContent>
        </Card>
      </div>
    </ShotsLayout>
  );
}

export default function ShotsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const state = params.get("state") ?? "onboarding";

  switch (state) {
    case "onboarding":
      return <OnboardingShot />;
    case "dashboard":
      return <DashboardShot />;
    case "add-supply":
      return <AddSupplyShot />;
    case "routines":
      return <RoutinesShot />;
    case "settings-about":
      return <SettingsAboutShot />;
    default:
      return <OnboardingShot />;
  }
}
