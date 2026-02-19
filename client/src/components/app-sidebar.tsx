import { Home, Package, Bot, Settings, Phone, Users, Calendar, AlertTriangle, ShoppingBag, Heart } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { FaceLogo } from "@/components/face-logo";
import { useReleaseMode } from "@/lib/release-mode";
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

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Supply Tracker",
    url: "/supplies",
    icon: Package,
  },
  {
    title: "Activity Adviser",
    url: "/adviser",
    icon: Bot,
  },
  {
    title: "Scenarios",
    url: "/scenarios",
    icon: AlertTriangle,
  },
  {
    title: "Appointments",
    url: "/appointments",
    icon: Calendar,
  },
  {
    title: "Community",
    url: "/community",
    icon: Users,
    beta: true,
  },
  {
    title: "Family & Carers",
    url: "/family-carers",
    icon: Heart,
    beta: true,
  },
  {
    title: "Shop",
    url: "/shop",
    icon: ShoppingBag,
    beta: true,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
] as const;

export function AppSidebar() {
  const [location] = useLocation();
  const { isBetaVisible } = useReleaseMode();

  const visibleItems = items.filter(item => !("beta" in item && item.beta) || isBetaVisible);

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <Link href="/">
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
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon />
                      <span className="flex-1">{item.title}</span>
                      {"beta" in item && item.beta && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal no-default-hover-elevate no-default-active-elevate" data-testid={`badge-beta-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          Beta
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
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
    </Sidebar>
  );
}
