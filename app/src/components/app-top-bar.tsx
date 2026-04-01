import { useState, useEffect } from "react";
import { useLocation } from "wouter";

import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";

import type { User as SupabaseUser } from "@supabase/supabase-js";

import { User as UserIcon, LogOut } from "lucide-react";

import { FaceLogo } from "@/components/face-logo";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile";

type AppTopBarProps = {
  isCarer: boolean;
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
          onSelect={(e) => {
            e.preventDefault();
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

export function AppTopBar({ isCarer, pathOnly, onBrandClick, onLogout }: AppTopBarProps) {
  const homeActive = isCarer ? pathOnly === "/carer-view" : pathOnly === "/";

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center bg-card/90 px-4 backdrop-blur border-b border-border/70">
      <div className="relative flex w-full items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <HeaderProfileDropdown onLogout={onLogout} />
        </div>

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-h2 font-semibold text-foreground">
          <button
            type="button"
            onClick={onBrandClick}
            className={`flex items-center gap-2 rounded-lg px-1 py-1 transition-all ${
              homeActive
                ? "cursor-default"
                : "cursor-pointer hover:opacity-80 active:opacity-60 active:scale-[0.98]"
            }`}
            data-testid="button-home-brand"
          >
            <FaceLogo size={32} />
            <span>Diabeaters</span>
          </button>
        </div>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
