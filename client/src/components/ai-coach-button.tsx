import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AICoachButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/ai-coach">
          <Button
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            data-testid="button-ai-coach-floating"
          >
            <Bot className="h-6 w-6" />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>Chat with AI Coach</p>
      </TooltipContent>
    </Tooltip>
  );
}
