export const DISCLAIMER_TEXT =
  "Diabeaters provides general lifestyle organization for people living with Type 1 diabetes. It does not provide medical advice and is not a medical device. Always follow guidance from your healthcare professional.";

/** Reusable disclaimer for onboarding and Settings/About. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className ?? ""}`}>
      {DISCLAIMER_TEXT}
    </p>
  );
}
