import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Save } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PageBackLink, PageHeader, PageShell } from "@/components/layout";
import { hapticLight } from "@/lib/haptics";
import { scrollAppMainToTop } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

/** Uppercase section label above a settings group (iOS-style). */
export function SettingsGroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Rounded list container for hub links or toggle rows. */
export function SettingsGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm", className)}>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

/** Single content panel for a settings sub-page. */
export function SettingsPanel({
  children,
  className,
  id,
  testId,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  testId?: string;
}) {
  return (
    <div
      id={id}
      data-testid={testId}
      className={cn("overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm", className)}
    >
      {children}
    </div>
  );
}

export function SettingsPanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

export function SettingsHubNavLink({
  href,
  label,
  description,
  icon: Icon,
  dataTestId,
}: {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  dataTestId?: string;
}) {
  const className =
    "group flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/40 sm:px-4";
  const body = (
    <>
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground group-hover:text-primary">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} data-testid={dataTestId}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={className} data-testid={dataTestId}>
      {body}
    </Link>
  );
}

export function SettingsNavRow({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description?: string;
}) {
  const className =
    "group flex w-full items-center justify-between gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-muted/30 sm:px-4";
  const chevron = (
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
  );
  const inner = (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      {chevron}
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export function SettingsBackLink({ href = "/settings" }: { href?: string }) {
  return <PageBackLink fallbackHref={href} label="Settings" />;
}

export function SettingsToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  testId,
  className,
}: {
  id?: string;
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-3.5 py-3.5 sm:px-4", className)}>
      <div className="min-w-0 flex-1 space-y-0.5 pr-1">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
          {label}
        </Label>
        {description ? <div className="text-xs leading-snug text-muted-foreground">{description}</div> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-testid={testId}
        className="shrink-0"
      />
    </div>
  );
}

export function SettingsSectionHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function SettingsFormBlock({
  title,
  children,
  id,
  className,
}: {
  title?: string;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 space-y-2.5", className)}>
      {title ? <SettingsSectionHeader title={title} /> : null}
      <div className="rounded-xl border border-border/40 bg-muted/10 p-3 sm:p-4">{children}</div>
    </section>
  );
}

export function SettingsSetupBanner({
  percentage,
  completed,
  total,
  missing = [],
}: {
  percentage: number;
  completed: number;
  total: number;
  missing?: { key: string; label: string; href: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Quick setup</p>
          <p className="text-xs text-muted-foreground">
            {completed} of {total} · better forecasts &amp; advice
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{percentage}%</span>
      </div>
      <Progress value={percentage} className="mt-2.5 h-1.5" />
      {missing.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-primary/10 pt-3">
          {missing.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-xs text-foreground/90 transition-colors hover:bg-primary/[0.06] hover:text-foreground"
                data-testid={`link-setup-missing-${item.key}`}
              >
                <span className="min-w-0 truncate">{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Extra scroll padding when the mobile sticky save bar is visible (`md:hidden`). */
export const SETTINGS_STICKY_SAVE_SCROLL_CLASS = "pb-[4.75rem] md:pb-6";

/** Floating mobile save bar above the bottom nav; hidden on desktop and when `visible` is false. */
export function SettingsStickySaveBar({
  visible,
  onSave,
  label = "Save",
  testId = "button-settings-save-sticky",
}: {
  visible: boolean;
  onSave: () => void;
  label?: string;
  testId?: string;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[110] md:hidden",
        "bottom-[calc(var(--keyboard-inset-bottom,0px)+var(--bottom-nav-height,7.5rem))]",
      )}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-lg px-4 pb-2 pt-1">
        <div className="rounded-2xl border border-border/35 bg-background/95 p-1.5 shadow-lg shadow-black/15 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
          <Button
            type="button"
            className="h-10 w-full rounded-xl text-sm font-semibold shadow-none"
            onClick={() => {
              void hapticLight();
              onSave();
            }}
            data-testid={testId}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {label}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsSubPageShell({
  title,
  description,
  actions,
  children,
  className,
  backHref = "/settings",
  backLabel = "Settings",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const [pathname] = useLocation();

  useLayoutEffect(() => {
    scrollAppMainToTop("auto");
  }, [pathname]);

  return (
    <PageShell variant="narrow" density="compact" className={cn("space-y-4 pb-6", className)}>
      <PageBackLink fallbackHref={backHref} label={backLabel} />
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </PageShell>
  );
}
