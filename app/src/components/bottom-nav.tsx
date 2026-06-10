import { Home, MessageCircle, Shapes, Users, Wrench, User } from "lucide-react";
import { isAiCoachEnabled, isCommunityEnabled } from "@/lib/flags";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { useLocation } from "wouter";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { navigateWithViewTransition } from "@/lib/nav-view-transition";
import { prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";
import { prefetchCarerViewRoute, prefetchCommunityFeedChunk, prefetchDemoCriticalRoutes } from "@/lib/demo-route-prefetch";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { useAuth } from "@/lib/auth-context";
import { prefetchLinkedPatientsQuery } from "@/lib/carer-link-query";
import { getActiveAppMode, isCarerSessionMode, isCommunitySessionMode } from "@/lib/carer-session";
import { useProfile } from "@/lib/profile";
import { isCommunityAccountProfile, storage } from "@/lib/storage";

const iconClass = "h-[23px] w-[23px]";

let prefetchedCommunity = false;
let prefetchedCommunityMessages = false;
let prefetchedCommunityThread = false;
let prefetchedNotificationsPage = false;
let prefetchedAccount = false;
let prefetchedTools = false;
let prefetchedScenarios = false;

function prefetchCommunity(): void {
  if (prefetchedCommunity) return;
  prefetchedCommunity = true;
  void import("@/pages/community/index");
}

/** DM inbox; separate chunk from feed — warm when community is enabled. */
export function prefetchCommunityMessages(): void {
  if (prefetchedCommunityMessages) return;
  prefetchedCommunityMessages = true;
  void import("@/pages/community/messages");
}

export function prefetchCommunityThread(): void {
  if (prefetchedCommunityThread) return;
  prefetchedCommunityThread = true;
  void import("@/pages/community/thread");
}

export function prefetchNotificationsPage(): void {
  if (prefetchedNotificationsPage) return;
  prefetchedNotificationsPage = true;
  void import("@/pages/notifications");
}

/** Feed + DM inbox + thread + `/notifications` — warm together for social navigation. */
export function prefetchCommunityNavigationBundle(): void {
  prefetchCommunity();
  prefetchCommunityFeedChunk();
  prefetchCommunityMessages();
  prefetchCommunityThread();
  prefetchNotificationsPage();
}

export function prefetchAccount(): void {
  if (prefetchedAccount) return;
  prefetchedAccount = true;
  void import("@/pages/account");
}

function prefetchTools(): void {
  if (prefetchedTools) return;
  prefetchedTools = true;
  void import("@/pages/tools/index");
  prefetchToolsHubLinkedChunks();
}

function prefetchScenarios(): void {
  if (prefetchedScenarios) return;
  prefetchedScenarios = true;
  void import("@/pages/scenarios");
}

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
      title: "Guides",
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

function communityMemberTabs(showCommunityTab: boolean): TabDef[] {
  const tabs: TabDef[] = [
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
  if (isAiCoachEnabled) {
    tabs.push({
      title: AI_ASSISTANT_NAME,
      href: "/coach",
      icon: MessageCircle,
      testId: "bottomnav-coach",
      isActive: (pathname) => pathname === "/coach",
    });
  }
  tabs.push({
    title: "Account",
    href: "/account",
    icon: User,
    testId: "bottomnav-account",
    isActive: (pathname) => pathname === "/account",
  });
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
      href: "/account",
      icon: User,
      testId: "bottomnav-account",
      isActive: (pathname) => pathname === "/account",
    },
  );
  return tabs;
}

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const pathname = location.split("?")[0] ?? location;
  const [hash, setHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash.slice(1) : "",
  );
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const { profile, loading: profileLoading } = useProfile();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = isCarerSessionMode(hasCarerLink, activeMode);
  const isCommunityMode = isCommunitySessionMode(hasCarerLink, activeMode, {
    localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
    cloudCommunityProfile: profile?.account_type === "community",
  });
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
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (!hasCarerLink) return;
    prefetchCarerViewRoute();
    prefetchLinkedPatientsQuery(queryClient, user?.id);
  }, [hasCarerLink, queryClient, user?.id]);

  /**
   * Warm lazy chunks for bottom-nav targets so first taps feel instant.
   * Community DM + bell targets are warmed soon after paint when the user can reach them from the header
   * (patient dashboard used to defer everything to idle, so the messages chunk often missed the first tap).
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const warmCommonTabs = () => {
      prefetchDemoCriticalRoutes();
      prefetchTools();
      prefetchAccount();
      if (!isCarerMode && !isCommunityMode) prefetchScenarios();
    };

    let idleId = 0;
    let timeoutId = 0;
    let rafOuter = 0;
    let rafInner = 0;

    // While `useProfile()` is still loading, `showCommunityTab` is false — warm chunks anyway so the
    // first Feed / Messages tap after login is not blocked on JS download + parse.
    const communityWarm =
      (isCommunityEnabled &&
        (showCommunityTab || isCommunityMode || (!isCarerMode && !isCommunityMode && profileLoading))) ||
      (isCarerMode && isCommunityEnabled);

    if (isCarerMode || isCommunityMode) {
      warmCommonTabs();
      if (communityWarm) prefetchCommunityNavigationBundle();
      return;
    }

    if (communityWarm) {
      rafOuter = window.requestAnimationFrame(() => {
        rafInner = window.requestAnimationFrame(() => {
          prefetchCommunityNavigationBundle();
        });
      });
    }

    const scheduleCommon = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(warmCommonTabs, { timeout: 4500 });
      } else {
        timeoutId = window.setTimeout(warmCommonTabs, 1200);
      }
    };
    scheduleCommon();

    return () => {
      window.cancelAnimationFrame(rafOuter);
      window.cancelAnimationFrame(rafInner);
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isCarerMode, isCommunityMode, showCommunityTab, profileLoading]);

  const tabs = isCarerMode
    ? carerTabs(showCommunityTab)
    : isCommunityMode
      ? communityMemberTabs(showCommunityTab)
      : patientTabs(showCommunityTab);

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
      className="bottom-nav-vt surface-chrome fixed bottom-[var(--keyboard-inset-bottom,0px)] inset-x-0 z-[100] grid place-items-center border-t border-border/35 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_-12px_hsl(260_28%_38%_/_0.14)] dark:shadow-[0_-10px_36px_-12px_hsl(0_0%_0%_/_0.42)]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      data-testid="nav-bottom"
    >
      {tabs.map((tab) => {
        const active = tab.isActive(pathname, hash);
        const warmPrefetch = () => {
          if (tab.href === "/community") {
            prefetchCommunityNavigationBundle();
          }
          if (tab.href === "/account") prefetchAccount();
          if (tab.href === "/tools") prefetchTools();
          if (tab.href === "/scenarios") prefetchScenarios();
        };
        return (
          <motion.a
            key={tab.testId}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            className={`flex min-h-11 w-full min-w-0 max-w-[6.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 no-underline transition-colors duration-150 ease-out ${
              active
                ? "bg-primary/[0.14] text-primary shadow-sm dark:bg-primary/20"
                : "text-muted-foreground hover:bg-muted/55"
            }`}
            data-testid={tab.testId}
            onPointerEnter={warmPrefetch}
            onTouchStart={warmPrefetch}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              if (tab.href === pathname) {
                e.preventDefault();
                return;
              }
              e.preventDefault();
              navigateWithViewTransition(setLocation, tab.href);
            }}
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
          </motion.a>
        );
      })}
    </nav>
  );
}
