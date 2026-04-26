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
  CommunityQuickPostWidget,
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
 * New users: all main widgets on; Welcome stays off by default (same content can appear in Today).
 * UK-English copy throughout.
 */
export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetDefinition[] = [
  {
    id: "community-quick-post",
    label: "Community",
    description: "Short line to open the feed composer with draft text.",
    defaultEnabled: true,
    defaultSize: "half",
    component: CommunityQuickPostWidget,
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
    id: "quick-exercise",
    label: "Quick exercise",
    description: "Start exercise mode from saved workout routines in one tap.",
    defaultEnabled: true,
    defaultSize: "half",
    component: QuickExerciseWidget,
  },
  {
    id: "ratio-adviser",
    label: "Ratio adviser",
    description: "Your insulin ratios and correction factor at a glance.",
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
    defaultEnabled: true,
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
