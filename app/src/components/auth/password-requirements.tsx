import type { ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

type PasswordRequirementsProps = {
  password: string;
};

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;

  return (
    <div
      className="space-y-1 text-xs text-muted-foreground"
      aria-live="polite"
      data-testid="password-requirements"
    >
      <Requirement met={hasMinLength}>
        At least {PASSWORD_MIN_LENGTH} characters
      </Requirement>
    </div>
  );
}

function Requirement({
  met,
  children,
}: {
  met: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", met && "text-foreground")}>
      {met ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <Circle className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}
