import { Home, Shapes, Users, Wrench, User } from "lucide-react";
import { isCommunityEnabled } from "@/lib/flags";
import { Link, useLocation } from "wouter";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode } from "@/lib/carer-session";
import { useProfile } from "@/lib/profile";

const iconClass = "h-[23px] w-[23px]";

type TabDef = {
  title: string;
  href: string;
  icon: typeof Home;
  testId: string;
  isActive: (pathname: string, hash: string) => boolean;
};

function patientTabs(showCommunityTab: boolean): TabDef[] {
  const tabs: TabDef[] = [
    {
      title: "Home",
      href: "/",
      icon: Home,
      testId: "bottomnav-home",
      isActive: (pathname) => pathname === "/",
    },
    {
      title: "Scenarios",
      href: "/scenarios",
      icon: Shapes,
      testId: "bottomnav-scenarios",
      isActive: (pathname) => pathname === "/scenarios" || pathname.startsWith("/scenarios/"),
    },
  ];
  if (isCommunityEnabled && showCommunityTab) {
    tabs.push({
      title: "Feed",
      href: "/community",
      icon: Users,
      testId: "bottomnav-community",
      isActive: (pathname) => pathname === "/community" || pathname.startsWith("/community/"),
    });
  }
  tabs.push(
    {
      title: "Tools",
      href: "/tools",
      icon: Wrench,
      testId: "bottomnav-tools",
      isActive: (pathname) =>
        pathname === "/tools" ||
        pathname.startsWith("/tools/") ||
        pathname === "/education" ||
        pathname.startsWith("/education/"),
    },
    {
      title: "Account",
      href: "/account",
      icon: User,
      testId: "bottomnav-account",
      isActive: (pathname) => pathname === "/account",
    },
  );
  return tabs;
}

function carerTabs(showCommunityTab: boolean): TabDef[] {
  const tabs: TabDef[] = [
    {
      title: "Supporter",
      href: "/carer-view",
      icon: Home,
      testId: "bottomnav-home",
      isActive: (pathname) => pathname === "/carer-view" || pathname.startsWith("/carer-view/"),
    },
  ];
  if (isCommunityEnabled && showCommunityTab) {
    tabs.push({
      title: "Feed",
      href: "/community",
      icon: Users,
      testId: "bottomnav-community",
      isActive: (pathname) => pathname === "/community" || pathname.startsWith("/community/"),
    });
  }
  tabs.push(
    {
      title: "Tools",
      href: "/tools",
      icon: Wrench,
      testId: "bottomnav-tools",
      isActive: (pathname) =>
        pathname === "/tools" ||
        pathname.startsWith("/tools/") ||
        pathname === "/education" ||
        pathname.startsWith("/education/"),
    },
    {
      title: "Account",
      href: "/supporter-profile",
      icon: User,
      testId: "bottomnav-account",
      isActive: (pathname) => pathname === "/supporter-profile" || pathname === "/account",
    },
  );
  return tabs;
}

export function BottomNav() {
  const [location] = useLocation();
  const pathname = location.split("?")[0] ?? location;
  const [hash, setHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash.slice(1) : "",
  );
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const { profile, loading: profileLoading } = useProfile();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");
  const showCommunityTab =
    isCommunityEnabled && !profileLoading && profile?.is_public === true;

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [location]);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const tabs = isCarerMode ? carerTabs(showCommunityTab) : patientTabs(showCommunityTab);

  const cols = tabs.length;
  const navRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const set = () => {
      const h = el.getBoundingClientRect().height;
      const px = `${Math.ceil(h)}px`;
      document.documentElement.style.setProperty("--bottom-nav-height", px);
      document.body?.style?.setProperty("--bottom-nav-height", px);
      document.getElementById("root")?.style?.setProperty("--bottom-nav-height", px);
    };

    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("orientationchange", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", set);
    };
  }, [cols]);

  return (
    <nav
      ref={navRef}
      className="surface-chrome fixed bottom-0 inset-x-0 z-50 grid place-items-center border-t border-border/40 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_28px_-10px_hsl(260_30%_40%_/_0.12)] dark:shadow-[0_-6px_28px_-10px_hsl(0_0%_0%_/_0.35)]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      data-testid="nav-bottom"
    >
      {tabs.map((tab) => {
        const active = tab.isActive(pathname, hash);
        return (
          <Link key={tab.testId} href={tab.href} className="flex w-full justify-center min-w-0">
            <button
              type="button"
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 max-w-[6.5rem] px-2 py-2 rounded-2xl transition-all duration-200 ease-out ${
                active
                  ? "text-primary bg-primary/[0.14] shadow-sm dark:bg-primary/20"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
              data-testid={tab.testId}
            >
              <tab.icon
                className={`${iconClass} shrink-0 ${active ? "stroke-[2]" : "stroke-[1.5] opacity-90"}`}
              />
              <span
                className={`text-[11px] font-medium leading-none text-center whitespace-nowrap ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.title}
              </span>
            </button>
          </Link>
        );
      })}
    </nav>
  );
}
