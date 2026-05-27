import { useRef } from "react";
import { format } from "date-fns";
import { type DayProps, useDayRender } from "react-day-picker";

import {
  getScenarioDayBoxClass,
  scenarioModesOnDay,
  SCENARIO_CALENDAR_STYLES,
} from "@/lib/scenario-calendar";
import { cn } from "@/lib/utils";

import { useActivityCalendarContext } from "./activity-calendar-context";

/**
 * Calendar day with subtle scenario tint and thin accent markers.
 */
export function ActivityCalendarDay({ date, displayMonth }: DayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dayRender = useDayRender(date, displayMonth, buttonRef);
  const ctx = useActivityCalendarContext();

  const dayKey = format(date, "yyyy-MM-dd");
  const modes = ctx ? scenarioModesOnDay(ctx.scenarioDays, dayKey) : [];
  const hasActivity = ctx?.activityDayKeys.has(dayKey) ?? false;
  const hasScenario = modes.length > 0;
  const boxClass = getScenarioDayBoxClass(modes);

  if (dayRender.isHidden) {
    return <td className="h-11 w-11 p-0" role="gridcell" />;
  }

  const { isButton, buttonProps, divProps, activeModifiers } = dayRender;
  const isSelected = Boolean(activeModifiers.selected);
  const isToday = Boolean(activeModifiers.today);
  const isOutside = Boolean(activeModifiers.outside);

  const dayContent = (
    <>
      {boxClass ? (
        <span className={cn("pointer-events-none absolute inset-[4px]", boxClass)} aria-hidden />
      ) : null}

      {modes.length > 1 ? (
        <span className="pointer-events-none absolute inset-x-[7px] bottom-[6px] z-20 flex gap-px" aria-hidden>
          {modes.map((mode) => (
            <span key={mode} className={cn("h-px flex-1 rounded-full", SCENARIO_CALENDAR_STYLES[mode].barClass)} />
          ))}
        </span>
      ) : hasScenario ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-[9px] bottom-[6px] z-20 h-px rounded-full",
            SCENARIO_CALENDAR_STYLES[modes[0]!]!.barClass,
          )}
          aria-hidden
        />
      ) : null}

      {hasActivity ? (
        <span
          className={cn(
            "pointer-events-none absolute z-20 h-1 w-1 rounded-full bg-emerald-600/55 dark:bg-emerald-500/50",
            hasScenario ? "right-[7px] top-[7px]" : "bottom-[7px] left-1/2 -translate-x-1/2",
          )}
          aria-hidden
        />
      ) : null}

      <span
        className={cn(
          "relative z-10 text-sm tabular-nums leading-none",
          isOutside && "text-muted-foreground/50",
          isToday && !isSelected && "font-medium text-primary",
          isSelected && "font-medium",
        )}
      >
        {date.getDate()}
      </span>
    </>
  );

  const shellClass = cn(
    "relative flex h-11 w-11 items-center justify-center p-0",
    "rounded-lg transition-colors duration-150",
    "hover:bg-muted/35",
    isToday && !isSelected && !hasScenario && "bg-muted/20",
  );

  if (isButton) {
    return (
      <td className="relative p-0 text-center" role="gridcell">
        <button {...buttonProps} ref={buttonRef} className={cn(buttonProps.className, shellClass)}>
          {dayContent}
        </button>
      </td>
    );
  }

  return (
    <td {...divProps} className={cn(divProps.className, "relative p-0 text-center")} role="gridcell">
      <div className={shellClass}>{dayContent}</div>
    </td>
  );
}
