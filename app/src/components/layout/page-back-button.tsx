import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { navigateBack, normalizeNavPath } from "@/lib/nav-back";

export type PageBackButtonProps = {
  /** Parent route when browser history is empty (e.g. deep link). */
  fallbackHref?: string;
};

/** History back with safe parent-route fallback. App uses wouter — no `useNavigate` hook. */
export function PageBackButton({ fallbackHref }: PageBackButtonProps = {}) {
  const [location, setLocation] = useLocation();
  const pathOnly = normalizeNavPath(location);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="-ml-2 h-9 w-9 shrink-0"
      aria-label="Go back"
      onClick={() => navigateBack(pathOnly, setLocation, fallbackHref)}
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  );
}
