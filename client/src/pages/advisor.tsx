import { useState } from "react";
import { ChatMessage } from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Utensils, Dumbbell, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export default function Advisor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI diabetes advisor. I can help you with insulin adjustments, carb counting, and activity planning. How can I assist you today?",
      timestamp: "2:30 PM",
    },
  ]);
  const [inputValue, setInputValue] = useState("");

  const quickActions = [
    { icon: Utensils, label: "Plan Meal", prompt: "I'm planning to eat a meal with 60g carbs. What should my insulin dose be?" },
    { icon: Dumbbell, label: "Before Exercise", prompt: "I'm planning to exercise for 45 minutes. How should I adjust?" },
    { icon: Calculator, label: "Adjust Ratio", prompt: "Help me calculate my insulin-to-carb ratio." },
  ];

  const handleSend = () => {
    if (!inputValue.trim()) return;

    setMessages(prev => [
      ...prev,
      {
        role: "user",
        content: inputValue,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    console.log("Sent message:", inputValue);
    
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "This is a design prototype. In the full version, I'll provide personalized diabetes management advice based on your profile and the latest medical guidelines.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1000);

    setInputValue("");
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    console.log("Quick action selected:", prompt);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">AI Activity Advisor</h1>
        <p className="text-muted-foreground mt-1">Get personalized recommendations for meals and activities.</p>
      </div>

      {messages.length === 1 && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Card
                key={action.label}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => handleQuickAction(action.prompt)}
                data-testid={`button-quick-${action.label.toLowerCase().replace(' ', '-')}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-medium text-sm">{action.label}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <ChatMessage key={index} {...message} />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about meals, activities, or insulin adjustments..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              data-testid="input-chat"
            />
            <Button onClick={handleSend} data-testid="button-send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
