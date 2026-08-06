import type { ComponentType } from "react";
import type { WidgetSize, WidgetType } from "@/lib/storage";
import {
  AppointmentsWidget,
  SettingsCompletionWidget,
  SupplySummaryWidget,
  RatioAdviserWidget,
  QuickExerciseWidget,
  RoutinesWidget,
  TipOfDayWidget,
  WelcomeWidget,
  PharmacyWidget,
  CommunityQuickPostWidget,
  PatternInsightsWidget,
} from "@/components/widgets";

export type DashboardWidgetComponentProps = { layoutSize?: WidgetSize };
type WidgetComponent = ComponentType<DashboardWidgetComponentProps> | ComponentType<{ compact?: boolean }>;

/** Single source of truth for dashboard widget metadata and React components. */
export interface DashboardWidgetDefinition {
  id: WidgetType;
  label: string;
  description: string;
  defaultEnabled: boolean;
  defaultSize: WidgetSize;
  component: WidgetComponent;
}

/**
 * Default order is array order (also used as initial `order` index). Persisted `order` in localStorage overrides.
 * New users: Community → Patterns → Supplies → Pharmacy → Quick exercise → Ratios → Appointments →
 * Routines (off) → Tip of the day; Settings progress on; Welcome stays off.
 * UK-English copy throughout.
 */
export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetDefinition[] = [
  {
    id: "community-quick-post",
    label: "Community",
    description: "Tap to open the same new-post sheet as the Feed tab.",
    defaultEnabled: true,
    defaultSize: "half",
    component: CommunityQuickPostWidget,
  },
  {
    id: "pattern-insights",
    label: "Your patterns",
    description: "Spots patterns in your logged hypos, exercise, and checks.",
    defaultEnabled: true,
    defaultSize: "full",
    component: PatternInsightsWidget,
  },
  {
    id: "supply-summary",
    label: "Supplies",
    description: "Stock on hand and how long each item is expected to last (run-out bars).",
    defaultEnabled: true,
    defaultSize: "full",
    component: SupplySummaryWidget,
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    description: "Opening hours and whether it is open right now.",
    defaultEnabled: true,
    defaultSize: "half",
    component: PharmacyWidget,
  },
  {
    id: "quick-exercise",
    label: "Quick exercise",
    description: "Start exercise mode from saved workout routines in one tap.",
    defaultEnabled: true,
    defaultSize: "half",
    component: QuickExerciseWidget,
  },
  {
    id: "ratio-adviser",
    label: "Your ratios",
    description: "Carb ratios by meal, with a shortcut into meal planning.",
    defaultEnabled: true,
    defaultSize: "half",
    component: RatioAdviserWidget,
  },
  {
    id: "appointments",
    label: "Appointments",
    description: "Your next clinic visits and check-ups from the diary.",
    defaultEnabled: true,
    defaultSize: "half",
    component: AppointmentsWidget,
  },
  {
    id: "routines",
    label: "Routines",
    description: "Saved meal patterns and quick links to your full routines list.",
    defaultEnabled: false,
    defaultSize: "half",
    component: RoutinesWidget,
  },
  {
    id: "tip-of-day",
    label: "Tip of the day",
    description: "A practical type 1 reminder — shuffle for another tip anytime.",
    defaultEnabled: true,
    defaultSize: "full",
    component: TipOfDayWidget,
  },
  {
    id: "settings-completion",
    label: "Settings progress",
    description: "How complete your profile and safety settings are.",
    defaultEnabled: true,
    defaultSize: "half",
    component: SettingsCompletionWidget,
  },
  {
    id: "welcome",
    label: "Welcome",
    description: "Helpful tips and getting-started prompts.",
    defaultEnabled: false,
    defaultSize: "full",
    component: WelcomeWidget,
  },
];

export const DASHBOARD_WIDGET_BY_ID: Map<WidgetType, DashboardWidgetDefinition> = new Map(
  DASHBOARD_WIDGET_REGISTRY.map((d) => [d.id, d]),
);
