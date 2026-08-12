import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "pressable surface-field flex h-12 w-full min-w-0 max-w-full rounded-xl border border-input bg-background px-3.5 py-2 text-base text-foreground ring-offset-background transition-[box-shadow,transform,border-color,background-color] duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          (type === "date" || type === "time" || type === "datetime-local" || type === "month" || type === "week") &&
            "tabular-nums [&::-webkit-calendar-picker-indicator]:shrink-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:min-w-0",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
