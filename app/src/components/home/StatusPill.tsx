import { useEffect, useRef, useState } from "react";
import type { HealthStatus } from "@/lib/dashboard-health-status";

const STATUS_CONFIG = {
  stable: {
    text: "Stable",
    textColor: "text-green-700 dark:text-green-400",
    stroke: "#22c55e",
    trackStroke: "hsl(142 71% 45% / 0.2)",
    fill: "hsl(142 71% 45% / 0.08)",
    arc: 1,
  },
  watch: {
    text: "Watch",
    textColor: "text-amber-700 dark:text-amber-400",
    stroke: "#f59e0b",
    trackStroke: "hsl(38 92% 50% / 0.2)",
    fill: "hsl(38 92% 50% / 0.08)",
    arc: 0.6,
  },
  action: {
    text: "Action needed",
    textColor: "text-red-700 dark:text-red-400",
    stroke: "#ef4444",
    trackStroke: "hsl(0 72% 52% / 0.2)",
    fill: "hsl(0 72% 52% / 0.08)",
    arc: 0.3,
  },
} as const;

type StatusPillProps = {
  status: HealthStatus;
  /** default = compact; large = command hero. */
  size?: "default" | "large";
};

export function StatusPill({ status, size = "default" }: StatusPillProps) {
  const { text, textColor, stroke, trackStroke, fill, arc } = STATUS_CONFIG[status];
  const pillRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const isLarge = size === "large";

  useEffect(() => {
    if (pillRef.current) {
      const { offsetWidth, offsetHeight } = pillRef.current;
      setDims({ w: offsetWidth, h: offsetHeight });
    }
  }, [text, size]);

  const sw = isLarge ? 3 : 2.5;
  const innerW = dims.w - sw;
  const innerH = dims.h - sw;
  const innerRx = Math.max(0, dims.h / 2 - sw / 2);
  const innerRy = innerRx;

  const getPerimeter = () => {
    if (innerW <= 0 || innerH <= 0) return 0;
    const straightH = innerW - 2 * innerRx;
    const straightV = innerH - 2 * innerRy;
    const curveApprox =
      (Math.PI * (3 * (innerRx + innerRy) - Math.sqrt((3 * innerRx + innerRy) * (innerRx + 3 * innerRy)))) / 2;
    return 2 * straightH + 2 * straightV + 2 * curveApprox;
  };

  const perimeter = getPerimeter();
  const dashOffset = perimeter * (1 - arc);
  const pulseClass = status === "action" ? "animate-pulse" : "";

  return (
    <div className={`relative inline-flex ${pulseClass}`} data-testid="status-indicator">
      <div
        ref={pillRef}
        className={
          isLarge
            ? "relative inline-flex min-w-[7.5rem] items-center justify-center whitespace-nowrap px-5 py-2.5 sm:min-w-[8.5rem]"
            : "relative inline-flex min-w-[5.5rem] items-center justify-center whitespace-nowrap px-4 py-1.5 sm:min-w-[6rem] sm:px-4"
        }
        style={{ background: fill, borderRadius: `${dims.h / 2 || 20}px` }}
      >
        <span
          className={
            isLarge
              ? `font-display text-sm font-semibold tracking-tight sm:text-base ${textColor}`
              : `text-xs font-semibold ${textColor}`
          }
          data-testid="text-status"
        >
          {text}
        </span>
        {dims.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={dims.w}
            height={dims.h}
            viewBox={`0 0 ${dims.w} ${dims.h}`}
            aria-hidden
          >
            <rect
              x={sw / 2}
              y={sw / 2}
              width={innerW}
              height={innerH}
              rx={innerRx}
              ry={innerRy}
              fill="none"
              stroke={trackStroke}
              strokeWidth={sw}
            />
            <rect
              x={sw / 2}
              y={sw / 2}
              width={innerW}
              height={innerH}
              rx={innerRx}
              ry={innerRy}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={perimeter}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
