import { Home, Shapes, Wrench, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useLinkedCarer } from "@/hooks/use-linked-carer";

const iconClass = "h-[23px] w-[23px]";

type TabDef = {
  title: string;
  href: string;
  icon: typeof Home;
  testId: string;
  isActive: (pathname: string, hash: string) => boolean;
};

function patientTabs(): TabDef[] {
  return [
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
  ];
}

function carerTabs(): TabDef[] {
  return [
    {
      title: "Home",
      href: "/carer-view",
      icon: Home,
      testId: "bottomnav-home",
      isActive: (pathname, hash) => pathname === "/carer-view" && hash !== "carer-scenarios",
    },
    {
      title: "Scenarios",
      href: "/carer-view#carer-scenarios",
      icon: Shapes,
      testId: "bottomnav-scenarios",
      isActive: (pathname, hash) => pathname === "/carer-view" && hash === "carer-scenarios",
    },
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
  ];
}

export function BottomNav() {
  const [location] = useLocation();
  const pathname = location.split("?")[0] ?? location;
  const [hash, setHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash.slice(1) : "",
  );
  const { isCarer } = useLinkedCarer();

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [location]);

  const tabs = isCarer ? carerTabs() : patientTabs();

  const cols = tabs.length;
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-sm grid place-items-center px-1 pb-[env(safe-area-inset-bottom)]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      data-testid="nav-bottom"
    >
      {tabs.map((tab) => {
        const active = tab.isActive(pathname, hash);
        return (
          <Link key={tab.testId} href={tab.href} className="flex w-full justify-center min-w-0">
            <button
              type="button"
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 max-w-[4.5rem] px-2 py-2 rounded-t-xl transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid={tab.testId}
            >
              <tab.icon
                className={`${iconClass} shrink-0 ${active ? "stroke-[2]" : "stroke-[1.5] opacity-90"}`}
              />
              <span
                className={`text-tiny font-medium leading-tight text-center line-clamp-2 ${
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
