import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { PRIMARY_THEMES, useTheme, type AppPrimaryTheme } from "@/hooks/use-theme";
import type { ThemeMode } from "@/hooks/useThemeMode";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  SettingsGroupLabel,
  SettingsPanel,
  SettingsPanelBody,
  SettingsSectionHeader,
  SettingsSubPageShell,
} from "./shared";
import { SettingsAppearanceInfoDialog } from "./settings-page-info";

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
    label: "Auto (day/night)",
    testId: "button-theme-auto",
    previewClass: "bg-gradient-to-br from-[rgb(247_248_250)] to-[rgb(18_18_18)]",
    icon: Monitor,
    iconClass: "text-primary",
  },
];

export function SettingsAppearanceRoute() {
  const { toast } = useToast();
  const { themeMode, setThemeMode, primaryTheme, setPrimaryTheme } = useTheme();

  return (
    <SettingsSubPageShell
      title="Appearance"
      description="Theme and primary colour."
      actions={<SettingsAppearanceInfoDialog />}
    >
      <SettingsPanel id="appearance-theme" className="scroll-mt-28" data-testid="tab-appearance">
        <SettingsPanelBody className="space-y-4">
          <SettingsSectionHeader
            title="Theme mode"
            description="Light or dark all day, or Auto (day/night) — dark from 7pm to 7am."
          />
          <RadioGroup
            value={themeMode}
            onValueChange={(v) => setThemeMode(v as ThemeMode)}
            className="grid gap-2.5 sm:grid-cols-3"
          >
            {THEME_BOXES.map(({ value, label, testId, previewClass, icon: Icon, iconClass }) => {
              const selected = themeMode === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors outline-none focus-within:ring-2 focus-within:ring-primary/30",
                    selected
                      ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                      : "border-border/50 bg-muted/10 hover:border-primary/35",
                  )}
                >
                  <RadioGroupItem value={value} id={`theme-${value}`} data-testid={testId} />
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 shadow-sm",
                      previewClass,
                    )}
                    aria-hidden
                  >
                    <Icon className={cn("h-5 w-5 drop-shadow-sm", iconClass)} aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </SettingsPanelBody>
      </SettingsPanel>

      <div>
        <SettingsGroupLabel>Accent</SettingsGroupLabel>
        <SettingsPanel id="appearance-primary" className="scroll-mt-28">
          <SettingsPanelBody className="space-y-4">
            <SettingsSectionHeader title="Primary colour" description="Buttons, links, and highlights." />
            <RadioGroup
              value={primaryTheme}
              onValueChange={(v) => {
                setPrimaryTheme(v as AppPrimaryTheme);
                toast({ title: "Colour updated", description: "Accent applied across the app." });
              }}
              className="grid gap-2.5 sm:grid-cols-2"
            >
              {PRIMARY_THEMES.map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors",
                    primaryTheme === t.id
                      ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                      : "border-border/50 bg-muted/10 hover:border-primary/35",
                  )}
                >
                  <RadioGroupItem value={t.id} id={`primary-${t.id}`} data-testid={`button-primary-theme-${t.id}`} />
                  <span
                    className="h-9 w-9 shrink-0 rounded-full border border-border/50 shadow-sm"
                    style={{ backgroundColor: t.swatch }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </label>
              ))}
            </RadioGroup>
          </SettingsPanelBody>
        </SettingsPanel>
      </div>
    </SettingsSubPageShell>
  );
}
