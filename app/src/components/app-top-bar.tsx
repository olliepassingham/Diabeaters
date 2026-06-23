import { useState, useEffect } from "react";
import { useLocation } from "wouter";

import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";

import type { User as SupabaseUser } from "@supabase/supabase-js";

import { Settings, User as UserIcon, LogOut } from "lucide-react";
import { Link } from "wouter";

import { FaceLogo } from "@/components/face-logo";
import { MessagesInboxNavButton } from "@/components/messages-inbox-nav-button";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { isCommunityEnabled } from "@/lib/flags";
import { prefetchAccount } from "@/components/bottom-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile";

type AppTopBarProps = {
  isCarer: boolean;
  isCommunityMode?: boolean;
  pathOnly: string;
  onBrandClick: () => void;
  onLogout: () => void | Promise<void>;
};

function initialsForUser(user: SupabaseUser | null, fullName: string | null): string {
  const raw =
    (fullName?.trim() ||
      (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
      user?.email ||
      "")?.trim() || "";
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

function HeaderProfileDropdown({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { profile, refresh } = useProfile();
  const { displayUrl: avatarSrc, resolveError: avatarResolveError } = useResolvedProfileImageUrl(
    profile?.avatar_url,
  );
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [profile?.avatar_url, avatarSrc]);

  useEffect(() => {
    if (import.meta.env.DEV && avatarResolveError) {
      console.warn("[header avatar]", avatarResolveError);
    }
  }, [avatarResolveError]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const fullName = profile?.full_name ?? null;
  const initials = initialsForUser(user, fullName);
  const showImg = Boolean(avatarSrc && !imgFailed);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-card p-0 shadow-sm outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="button-profile-menu"
          aria-label="Account menu"
          onPointerEnter={prefetchAccount}
          onTouchStart={prefetchAccount}
        >
          {showImg ? (
            <img
              src={avatarSrc!}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-foreground">
              <UserIcon className="h-4 w-4 opacity-80" aria-hidden />
              <span className="sr-only">{initials}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-48">
        <DropdownMenuItem
          className="cursor-pointer"
          data-testid="menu-item-account"
          onPointerEnter={prefetchAccount}
          onSelect={(e) => {
            e.preventDefault();
            prefetchAccount();
            setLocation("/account");
          }}
        >
          <UserIcon className="mr-2 h-4 w-4" />
          Account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          data-testid="menu-item-log-out"
          onSelect={(e) => {
            e.preventDefault();
            void onLogout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppTopBar({ isCarer, isCommunityMode = false, pathOnly, onBrandClick, onLogout }: AppTopBarProps) {
  const homeActive = isCarer
    ? pathOnly === "/carer-view"
    : isCommunityMode
      ? pathOnly === "/community"
      : pathOnly === "/";

  const modeLabel = isCarer ? "Supporter" : isCommunityMode ? "Community" : "User";

  return (
    <header
      className={cn(
        "surface-chrome sticky top-0 z-50 flex min-h-14 items-center border-b border-border/40 px-4 pb-2 pt-[env(safe-area-inset-top)] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]",
      )}
    >
      <div className="relative flex w-full min-w-0 items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <HeaderProfileDropdown onLogout={onLogout} />
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/settings" aria-label="Settings" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex max-w-[min(12rem,calc(100vw-8rem))] -translate-x-1/2 -translate-y-1/2 items-center justify-center text-h2 font-semibold text-foreground">
          <button
            type="button"
            onClick={onBrandClick}
            className={`pointer-events-auto flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-0.5 py-1 transition-all sm:gap-2 sm:px-1 ${
              homeActive
                ? "cursor-default"
                : "cursor-pointer hover:opacity-80 active:opacity-60 active:scale-[0.98]"
            }`}
            data-testid="button-home-brand"
          >
            <FaceLogo size={32} />
            <span className="truncate">Diabeaters</span>
          </button>
        </div>

        <span
          className="pointer-events-none absolute left-1/2 top-[calc(50%+1.375rem)] -translate-x-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
          data-testid="header-mode-chip"
        >
          {modeLabel}
        </span>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          {isCommunityEnabled && <MessagesInboxNavButton />}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
