import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { PRIMARY_THEMES, useTheme, type AppPrimaryTheme } from "@/hooks/use-theme";
import type { ThemeMode } from "@/hooks/useThemeMode";
import { cn } from "@/lib/utils";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { Monitor, Moon, Sun } from "lucide-react";
import { SettingsBackLink } from "./shared";

type SettingsAppearanceRouteProps = {
  settingsInfoDialog: ReactNode;
};

const THEME_BOXES: {
  value: ThemeMode;
  label: string;
  testId: string;
  previewClass: string;
  icon: typeof Sun;
  iconClass: string;
}[] = [
  {
    value: "light",
    label: "Light",
    testId: "button-theme-light",
    previewClass: "bg-[rgb(247_248_250)]",
    icon: Sun,
    iconClass: "text-amber-500",
  },
  {
    value: "dark",
    label: "Dark",
    testId: "button-theme-dark",
    previewClass: "bg-[rgb(18_18_18)]",
    icon: Moon,
    iconClass: "text-sky-400",
  },
  {
    value: "system",
    label: "Auto",
    testId: "button-theme-auto",
    previewClass: "bg-gradient-to-br from-[rgb(247_248_250)] to-[rgb(18_18_18)]",
    icon: Monitor,
    iconClass: "text-primary",
  },
];

export function SettingsAppearanceRoute({ settingsInfoDialog }: SettingsAppearanceRouteProps) {
  const { toast } = useToast();
  const { themeMode, setThemeMode, primaryTheme, setPrimaryTheme } = useTheme();

  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-2"
        title="Appearance"
        description="Theme and primary colour."
        actions={settingsInfoDialog}
      />

      <Card
        id="appearance-theme"
        className="scroll-mt-28 overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40"
        data-testid="tab-appearance"
      >
        <CardContent className="space-y-4 p-6">
          <h2 className="text-h3 font-semibold text-foreground">Theme mode</h2>
          <p className="text-body text-muted-foreground">
            Light or dark. Auto switches by time (dark 7pm–7am).
          </p>
          <RadioGroup
            value={themeMode}
            onValueChange={(v) => setThemeMode(v as ThemeMode)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {THEME_BOXES.map(({ value, label, testId, previewClass, icon: Icon, iconClass }) => {
              const selected = themeMode === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors outline-none focus-within:ring-2 focus-within:ring-primary/30",
                    selected
                      ? "border-primary bg-primary/[0.06] ring-2 ring-primary/20"
                      : "border-border/60 hover:border-primary/40",
                  )}
                >
                  <RadioGroupItem value={value} id={`theme-${value}`} data-testid={testId} />
                  <span
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-full border border-border/60 shadow-sm flex items-center justify-center",
                      previewClass,
                    )}
                    aria-hidden
                  >
                    <Icon className={cn("h-5 w-5 drop-shadow-sm", iconClass)} aria-hidden />
                  </span>
                  <span className="text-body font-medium text-foreground">{label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card
        id="appearance-primary"
        className="scroll-mt-28 overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40"
      >
        <CardContent className="space-y-4 p-6">
          <h2 className="text-h3 font-semibold text-foreground">Primary colour</h2>
          <p className="text-body text-muted-foreground">Buttons, links, and highlights.</p>
          <RadioGroup
            value={primaryTheme}
            onValueChange={(v) => {
              setPrimaryTheme(v as AppPrimaryTheme);
              toast({ title: "Colour updated", description: "Accent applied across the app." });
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            {PRIMARY_THEMES.map((t) => (
              <label
                key={t.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                  primaryTheme === t.id
                    ? "border-primary bg-primary/[0.06] ring-2 ring-primary/20"
                    : "border-border/60 hover:border-primary/40",
                )}
              >
                <RadioGroupItem value={t.id} id={`primary-${t.id}`} data-testid={`button-primary-theme-${t.id}`} />
                <span
                  className="h-9 w-9 shrink-0 rounded-full border border-border/60 shadow-sm"
                  style={{ backgroundColor: t.swatch }}
                  aria-hidden
                />
                <span className="text-body font-medium text-foreground">{t.label}</span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </PageShell>
  );
}
