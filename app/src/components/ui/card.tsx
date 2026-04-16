import * as React from "react"

import { cn } from "@/lib/utils"

export type CardVariant = "default" | "glass" | "glass-strong" | "glass-muted"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "shadcn-card rounded-2xl text-card-foreground transition-[box-shadow,border-color,background-color] duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)]",
      variant === "default" &&
        "border border-border/55 shadow-sm ring-1 ring-primary/[0.05] dark:border-border/55 dark:shadow-md dark:ring-primary/[0.06] surface-glass-strong",
      variant === "glass" && "surface-glass shadow-sm dark:shadow-md",
      variant === "glass-strong" && "surface-glass-strong shadow-sm dark:shadow-md",
      variant === "glass-muted" && "surface-glass-muted shadow-sm dark:shadow-md",
      variant !== "default" && "border-0",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6 sm:p-7", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-display text-h3 font-semibold text-foreground tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-small leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pb-6 pt-0 sm:px-7 sm:pb-7", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 sm:px-7", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
