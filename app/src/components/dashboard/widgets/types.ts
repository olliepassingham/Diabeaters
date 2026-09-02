import type { WidgetSize, WidgetType } from "@/lib/storage";

export type DashboardWidgetLayoutProps = {
  /** Half-width grid cells use a denser layout. */
  layoutSize?: WidgetSize;
  widgetType?: WidgetType;
};

export function isCompactLayout({ layoutSize }: DashboardWidgetLayoutProps): boolean {
  return layoutSize === "half";
}
