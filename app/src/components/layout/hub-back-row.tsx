import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Back link to the situation guides hub (shared by scenario sub-pages and tools). */
export function HubBackRow() {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 gap-1" asChild>
      <Link href="/scenarios">
        <ArrowLeft className="h-4 w-4" />
        Guides
      </Link>
    </Button>
  );
}
