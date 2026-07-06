import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-transform duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border/40 shadow-sm hover:bg-primary/92 dark:border-0 dark:bg-primary/90 dark:hover:bg-primary/80",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border rounded-xl",
        outline:
          "rounded-xl border border-border bg-card/90 text-foreground shadow-sm hover:bg-muted/50 dark:bg-card/80",
        secondary:
          "rounded-xl border-0 bg-muted text-foreground shadow-sm hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground",
        ghost:
          "border border-transparent shadow-none text-foreground hover:bg-muted/70 dark:text-muted-foreground dark:hover:bg-card/80",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-9 rounded-lg px-3 text-xs",
        lg: "min-h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
