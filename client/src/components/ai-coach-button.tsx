import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AICoachButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/ai-coach">
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              size="lg"
              className="rounded-full shadow-lg"
              data-testid="button-ai-coach-floating"
            >
              <Bot className="h-5 w-5 mr-2" />
              AI Coach
            </Button>
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>Chat with AI Coach</p>
      </TooltipContent>
    </Tooltip>
  );
}
