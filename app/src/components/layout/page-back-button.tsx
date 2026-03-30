import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** History back (same effect as react-router `navigate(-1)`). App uses wouter — no `useNavigate` hook. */
export function PageBackButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="mr-2"
      aria-label="Go back"
      onClick={() => window.history.back()}
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  );
}
