import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "pressable surface-field flex min-h-[88px] w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base leading-relaxed text-foreground ring-offset-background transition-[box-shadow,transform,border-color,background-color] duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
