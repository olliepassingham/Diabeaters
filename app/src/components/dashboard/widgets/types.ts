import type { WidgetSize } from "@/lib/storage";

export type DashboardWidgetLayoutProps = {
  /** Half-width grid cells use a denser layout. */
  layoutSize?: WidgetSize;
};

export function isCompactLayout({ layoutSize }: DashboardWidgetLayoutProps): boolean {
  return layoutSize === "half";
}
