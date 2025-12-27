import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle, Clock, Plus, Activity, AlertTriangle, Thermometer, Dumbbell, Phone, Plane } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply } from "@/lib/storage";

function StatCard({ title, value, icon: Icon, description, variant }: { 
  title: string; 
  value: string | number; 
  icon: any; 
  description?: string;
  variant?: "default" | "warning" | "critical";
}) {
  const bgColors = {
    default: "bg-primary/10",
    warning: "bg-yellow-500/10",
    critical: "bg-red-500/10",
  };
  const iconColors = {
    default: "text-primary",
    warning: "text-yellow-600 dark:text-yellow-500",
    critical: "text-red-600 dark:text-red-500",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold" data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className={`p-2 rounded-lg ${bgColors[variant || "default"]}`}>
            <Icon className={`h-5 w-5 ${iconColors[variant || "default"]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplyAlertCard({ supply }: { supply: Supply }) {
  const daysRemaining = storage.getDaysRemaining(supply);
  const status = storage.getSupplyStatus(supply);

  return (
    <Card className={status === "critical" ? "border-red-500/50" : "border-yellow-500/50"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="font-medium text-sm">{supply.name}</p>
            <p className="text-xs text-muted-foreground">
              {supply.currentQuantity} remaining
            </p>
          </div>
          <Badge variant={status === "critical" ? "destructive" : "secondary"} data-testid={`badge-supply-${supply.id}`}>
            {daysRemaining} days
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ title, description, icon: Icon, href, testId }: {
  title: string;
  description: string;
  icon: any;
  href: string;
  testId: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover-elevate active-elevate-2 cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setProfile(storage.getProfile());
  }, []);

  const lowStockSupplies = supplies.filter(s => storage.getSupplyStatus(s) !== "ok");
  const criticalSupplies = supplies.filter(s => storage.getSupplyStatus(s) === "critical");

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-greeting">
            {greeting()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">Here's your diabetes management overview.</p>
        </div>
        <Link href="/supplies">
          <Button data-testid="button-add-supply">
            <Plus className="h-4 w-4 mr-2" />
            Add Supply
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Supplies"
          value={supplies.length}
          icon={Package}
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockSupplies.length}
          icon={AlertCircle}
          description="< 7 days remaining"
          variant={lowStockSupplies.length > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Critical Alerts"
          value={criticalSupplies.length}
          icon={AlertTriangle}
          description="< 3 days remaining"
          variant={criticalSupplies.length > 0 ? "critical" : "default"}
        />
      </div>

      {criticalSupplies.length > 0 && (
        <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
              <CardTitle className="text-lg text-red-900 dark:text-red-100">Critical Supply Alerts</CardTitle>
            </div>
            <CardDescription className="text-red-800/80 dark:text-red-200/80">
              These items need immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {criticalSupplies.map((supply) => (
                <SupplyAlertCard key={supply.id} supply={supply} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lowStockSupplies.length > 0 && lowStockSupplies.length !== criticalSupplies.length && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <CardTitle className="text-lg text-yellow-900 dark:text-yellow-100">Low Stock Warnings</CardTitle>
            </div>
            <CardDescription className="text-yellow-800/80 dark:text-yellow-200/80">
              Plan to restock these items soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStockSupplies
                .filter(s => storage.getSupplyStatus(s) === "low")
                .map((supply) => (
                  <SupplyAlertCard key={supply.id} supply={supply} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="Track Supplies"
            description="Update your inventory"
            icon={Package}
            href="/supplies"
            testId="link-supplies"
          />
          <QuickActionCard
            title="Exercise Planning"
            description="Get activity recommendations"
            icon={Dumbbell}
            href="/advisor"
            testId="link-advisor"
          />
          <QuickActionCard
            title="Sick Day Help"
            description="Get adjusted ratios when unwell"
            icon={Thermometer}
            href="/sick-day"
            testId="link-sick-day"
          />
          <QuickActionCard
            title="Travel Mode"
            description="Plan supplies for trips"
            icon={Plane}
            href="/travel"
            testId="link-travel"
          />
          <QuickActionCard
            title="Help Now"
            description="Emergency assistance"
            icon={Phone}
            href="/help-now"
            testId="link-help-now"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All Supplies Overview</CardTitle>
            <Link href="/supplies">
              <Button variant="outline" size="sm" data-testid="button-view-all-supplies">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {supplies.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              No supplies tracked yet. Add your first supply to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {supplies.slice(0, 6).map((supply) => {
                const daysRemaining = storage.getDaysRemaining(supply);
                const status = storage.getSupplyStatus(supply);
                return (
                  <div key={supply.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{supply.name}</p>
                      <p className="text-xs text-muted-foreground">{supply.currentQuantity} remaining</p>
                    </div>
                    <Badge 
                      variant={status === "critical" ? "destructive" : status === "low" ? "secondary" : "outline"}
                    >
                      {daysRemaining === 999 ? "N/A" : `${daysRemaining}d`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
