import { Home, Package, Bot, AlertTriangle, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calendar, Users, Heart, ShoppingBag, Settings, Phone, MessageCircle } from "lucide-react";

const primaryTabs = [
  { title: "Home", url: "/", icon: Home },
  { title: "Supplies", url: "/supplies", icon: Package },
  { title: "Advisor", url: "/advisor", icon: Bot },
  { title: "Scenarios", url: "/scenarios", icon: AlertTriangle },
];

const moreItems = [
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "AI Coach", url: "/ai-coach", icon: MessageCircle },
  { title: "Community", url: "/community", icon: Users, beta: true },
  { title: "Family & Carers", url: "/family-carers", icon: Heart, beta: true },
  { title: "Shop", url: "/shop", icon: ShoppingBag, beta: true },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function BottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = moreItems.some(item => location === item.url);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t safe-area-bottom" data-testid="nav-bottom">
      <div className="flex items-stretch justify-around px-1">
        {primaryTabs.map((tab) => {
          const isActive = location === tab.url;
          return (
            <Link key={tab.url} href={tab.url}>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                data-testid={`bottomnav-${tab.title.toLowerCase()}`}
              >
                <tab.icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className="text-[11px] font-medium">{tab.title}</span>
              </button>
            </Link>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors ${
                isMoreActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
              data-testid="bottomnav-more"
            >
              <MoreHorizontal className={`h-6 w-6 ${isMoreActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[11px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-left">More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {moreItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <Link key={item.url} href={item.url}>
                    <button
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl w-full transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover-elevate"
                      }`}
                      onClick={() => setMoreOpen(false)}
                      data-testid={`bottomnav-more-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="h-6 w-6" />
                      <span className="text-xs font-medium text-center leading-tight">{item.title}</span>
                      {"beta" in item && item.beta && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal no-default-hover-elevate no-default-active-elevate">
                          Beta
                        </Badge>
                      )}
                    </button>
                  </Link>
                );
              })}
            </div>

            <Link href="/help-now">
              <button
                className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-medium"
                onClick={() => setMoreOpen(false)}
                data-testid="bottomnav-help-now"
              >
                <Phone className="h-5 w-5" />
                Help Now
              </button>
            </Link>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
