import {
  Home,
  Package,
  Bot,
  Settings,
  Phone,
  Calendar,
  AlertTriangle,
  Heart,
  Eye,
  User,
  Users,
  Wrench,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { FaceLogo } from "@/components/face-logo";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, isCarerSessionMode, isCommunitySessionMode } from "@/lib/carer-session";
import { isAiCoachEnabled, isCommunityEnabled } from "@/lib/flags";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
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
  { title: "Meal & ratios", url: "/adviser", icon: Bot },
  { title: "Guides", url: "/scenarios", icon: AlertTriangle },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "Supporters", url: "/family-carers", icon: Heart },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

const carerItems = [
  { title: "Supporter", url: "/carer-view", icon: Eye },
  { title: "Account", url: "/account", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

const communityItemsBase = [
  { title: "Tools", url: "/tools", icon: Wrench },
  { title: "Education", url: "/education", icon: BookOpen },
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
  const isCarerMode = isCarerSessionMode(isCarer, activeMode);
  const isCommunityMode = isCommunitySessionMode(isCarer, activeMode, {
    localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
    cloudCommunityProfile: profile?.account_type === "community",
  });
  const showCommunity =
    isCommunityEnabled && !profileLoading && profile?.is_public === true;

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const navItems = useMemo(() => {
    if (!isCarer && isCommunityMode) {
      const items: Array<{ title: string; url: string; icon: typeof Wrench }> = [...communityItemsBase];
      if (showCommunity) {
        items.push({ title: "Feed", url: "/community", icon: Users });
      }
      if (isAiCoachEnabled) {
        items.push({ title: AI_ASSISTANT_NAME, url: "/coach", icon: MessageCircle });
      }
      items.push(
        { title: "Account", url: "/account", icon: User },
        { title: "Settings", url: "/settings", icon: Settings },
      );
      return items;
    }
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
  }, [isCarer, isCarerMode, isCommunityMode, showCommunity]);

  const homeHref = isCarer ? "/carer-view" : isCommunityMode ? getCommunityMemberLandingPath() : "/";

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
      {!isCarer && !isCommunityMode && (
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
