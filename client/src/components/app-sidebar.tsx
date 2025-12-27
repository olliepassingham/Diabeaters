import { Home, Package, Bot, Settings, Thermometer, Phone } from "lucide-react";
import { Link, useLocation } from "wouter";
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
    title: "Sick Day Adviser",
    url: "/sick-day",
    icon: Thermometer,
  },
  {
    title: "AI Advisor",
    url: "/advisor",
    icon: Bot,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-primary">D</span>
            </div>
            <span className="text-xl font-semibold">Diabeater</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
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
