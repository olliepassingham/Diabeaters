import { Home, Package, Bot, Settings, Phone, Calendar, AlertTriangle, Heart, Eye, User, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { FaceLogo } from "@/components/face-logo";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode } from "@/lib/carer-session";
import { isCommunityEnabled } from "@/lib/flags";
import { useProfile } from "@/lib/profile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const patientItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Supply Tracker", url: "/supplies", icon: Package },
  { title: "Meal planner", url: "/adviser", icon: Bot },
  { title: "Scenarios", url: "/scenarios", icon: AlertTriangle },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "Carers", url: "/family-carers", icon: Heart },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

const carerItems = [
  { title: "Supporter", url: "/carer-view", icon: Eye },
  { title: "Account", url: "/account", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

function sidebarLinkActive(location: string, url: string): boolean {
  if (url === "/community") return location === "/community" || location.startsWith("/community/");
  if (url === "/carer-view") return location === "/carer-view" || location.startsWith("/carer-view/");
  return location === url;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { isCarer } = useLinkedCarer();
  const { profile, loading: profileLoading } = useProfile();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(isCarer && activeMode === "carer");
  const showCommunity =
    isCommunityEnabled && !profileLoading && profile?.is_public === true;

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const navItems = useMemo(() => {
    if (!isCarer) {
      if (!showCommunity) return patientItems;
      return [
        ...patientItems.slice(0, 4),
        { title: "Feed", url: "/community", icon: Users },
        ...patientItems.slice(4),
      ] as const;
    }
    if (!isCarerMode || !showCommunity) return carerItems;
    return [
      { title: "Supporter", url: "/carer-view", icon: Eye },
      { title: "Feed", url: "/community", icon: Users },
      { title: "Account", url: "/account", icon: User },
      { title: "Settings", url: "/settings", icon: Settings },
    ] as const;
  }, [isCarer, isCarerMode, showCommunity]);

  const homeHref = isCarer ? "/carer-view" : "/";

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <Link href={homeHref}>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="h-10 w-10 flex items-center justify-center">
              <FaceLogo size={32} />
            </div>
            <span className="text-xl font-semibold">Diabeaters</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={sidebarLinkActive(location, item.url)}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!isCarer && (
        <SidebarFooter className="p-4">
          <Link href="/help-now">
            <SidebarMenuButton
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
              isActive={location === "/help-now"}
              data-testid="link-help-now"
            >
              <Phone className="h-4 w-4" />
              <span>Help Now</span>
            </SidebarMenuButton>
          </Link>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
