import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PageInfoDialogProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Smaller trigger for hub pages with no title row. */
  compact?: boolean;
  /** Icon (default) or muted text link — link suits hub footers without a top gap. */
  triggerVariant?: "icon" | "link";
  linkLabel?: string;
}

export function PageInfoDialog({
  title,
  description,
  children,
  compact,
  triggerVariant = "icon",
  linkLabel = "Learn more",
}: PageInfoDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerVariant === "link" ? (
          <Button
            type="button"
            variant="link"
            data-testid="button-page-info"
            className="h-auto px-0 py-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {linkLabel}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-page-info"
            className={cn(compact && "h-9 w-9")}
          >
            <Info className={cn("h-5 w-5", compact && "h-4 w-4")} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface InfoSectionProps {
  title: string;
  children: React.ReactNode;
}

export function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{title}</h4>
      <div className="text-sm text-muted-foreground space-y-1">
        {children}
      </div>
    </div>
  );
}
