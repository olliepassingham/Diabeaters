import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Utensils, Dumbbell, Calculator, AlertCircle, Bot, User } from "lucide-react";
import { storage, UserSettings } from "@/lib/storage";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function ChatMessage({ role, content, timestamp }: Message) {
  return (
    <div className={`flex gap-3 ${role === "user" ? "flex-row-reverse" : ""}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        role === "assistant" ? "bg-primary/10" : "bg-muted"
      }`}>
        {role === "assistant" ? (
          <Bot className="h-4 w-4 text-primary" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className={`max-w-[80%] ${role === "user" ? "text-right" : ""}`}>
        <div className={`p-3 rounded-lg ${
          role === "user" 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        }`}>
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
      </div>
    </div>
  );
}

function generateMealAdvice(carbs: number, mealType: string, settings: UserSettings): string {
  const ratioMap: Record<string, string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio,
  };

  const ratio = ratioMap[mealType] || settings.breakfastRatio;
  let insulinUnits = 0;

  if (ratio) {
    const match = ratio.match(/1:(\d+)/);
    if (match) {
      const carbRatio = parseInt(match[1]);
      insulinUnits = Math.round((carbs / carbRatio) * 10) / 10;
    }
  } else if (settings.tdd) {
    const estimatedRatio = Math.round(500 / settings.tdd);
    insulinUnits = Math.round((carbs / estimatedRatio) * 10) / 10;
  }

  if (insulinUnits > 0) {
    return `Based on your settings, for ${carbs}g of carbs at ${mealType}:\n\n` +
      `Suggested bolus: ${insulinUnits} units\n\n` +
      `This calculation uses your ${mealType} ratio of ${ratio || "estimated from TDD"}.\n\n` +
      `Remember to also consider:\n` +
      `- Your current blood glucose level (add correction if needed)\n` +
      `- Recent or planned physical activity\n` +
      `- Time of day and your typical patterns\n\n` +
      `⚠️ Not medical advice. Always verify with your own calculations and adjust based on your experience.`;
  }

  return `To calculate your meal bolus, I need your carb ratios.\n\n` +
    `Please go to Settings and add your carb-to-insulin ratios for more accurate recommendations.\n\n` +
    `In the meantime, here are some general tips for ${carbs}g of carbs:\n` +
    `- Check your blood glucose before eating\n` +
    `- Consider the glycemic index of your food\n` +
    `- Monitor your levels 2 hours after eating`;
}

function generateExerciseAdvice(duration: number, intensity: string, settings: UserSettings): string {
  let carbsNeeded = 0;
  let insulinReduction = "";

  switch (intensity) {
    case "light":
      carbsNeeded = Math.round(duration / 30 * 10);
      insulinReduction = "10-20%";
      break;
    case "moderate":
      carbsNeeded = Math.round(duration / 30 * 15);
      insulinReduction = "20-30%";
      break;
    case "intense":
      carbsNeeded = Math.round(duration / 30 * 25);
      insulinReduction = "30-50%";
      break;
  }

  return `For ${duration} minutes of ${intensity} exercise:\n\n` +
    `**Before Exercise:**\n` +
    `- Ideal starting BG: 120-180 mg/dL\n` +
    `- If below 100 mg/dL: eat ${carbsNeeded}g of fast-acting carbs\n` +
    `- Consider reducing bolus by ${insulinReduction} for meal within 2 hours before\n\n` +
    `**During Exercise:**\n` +
    `- Carry fast-acting glucose (15-20g)\n` +
    `- Check BG every 30-45 minutes for longer sessions\n` +
    `- If BG drops below 70 mg/dL, stop and treat\n\n` +
    `**After Exercise:**\n` +
    `- Monitor for delayed lows (up to 24 hours later)\n` +
    `- Consider reduced basal/bolus for next meal\n` +
    `- Stay hydrated\n\n` +
    `⚠️ Not medical advice. Individual responses to exercise vary significantly. Track your patterns.`;
}

function generateRatioAdvice(settings: UserSettings): string {
  if (settings.tdd) {
    const estimated500Rule = Math.round(500 / settings.tdd);
    const estimated1800Rule = Math.round(1800 / settings.tdd);

    return `Based on your Total Daily Dose of ${settings.tdd} units:\n\n` +
      `**Estimated Carb Ratio (500 Rule):**\n` +
      `1:${estimated500Rule} (1 unit covers ${estimated500Rule}g of carbs)\n\n` +
      `**Estimated Correction Factor (1800 Rule):**\n` +
      `1:${estimated1800Rule} (1 unit lowers BG by ${estimated1800Rule} mg/dL)\n\n` +
      `**Your Current Settings:**\n` +
      `- Breakfast: ${settings.breakfastRatio || "Not set"}\n` +
      `- Lunch: ${settings.lunchRatio || "Not set"}\n` +
      `- Dinner: ${settings.dinnerRatio || "Not set"}\n` +
      `- Snack: ${settings.snackRatio || "Not set"}\n` +
      `- Correction Factor: ${settings.correctionFactor ? `1:${settings.correctionFactor}` : "Not set"}\n\n` +
      `These are starting estimates. Your actual ratios may vary based on:\n` +
      `- Time of day (often more insulin needed at breakfast)\n` +
      `- Activity level\n` +
      `- Hormonal cycles\n` +
      `- Stress and illness\n\n` +
      `⚠️ Not medical advice. Work with your healthcare team to fine-tune your ratios.`;
  }

  return `To calculate insulin ratios, I need your Total Daily Dose (TDD).\n\n` +
    `Please go to Settings and enter your TDD for ratio calculations.\n\n` +
    `**Common Rules of Thumb:**\n` +
    `- 500 Rule: 500 ÷ TDD = grams of carbs covered by 1 unit\n` +
    `- 1800 Rule: 1800 ÷ TDD = mg/dL drop per 1 unit (correction)\n\n` +
    `Example: If TDD is 40 units:\n` +
    `- Carb ratio: 500 ÷ 40 = 1:12.5 (round to 1:12)\n` +
    `- Correction: 1800 ÷ 40 = 45 mg/dL per unit`;
}

function processUserMessage(message: string, settings: UserSettings): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("meal") || lowerMessage.includes("carb") || lowerMessage.includes("eat")) {
    const carbMatch = message.match(/(\d+)\s*g/i);
    const carbs = carbMatch ? parseInt(carbMatch[1]) : 60;
    const mealType = lowerMessage.includes("breakfast") ? "breakfast" :
                     lowerMessage.includes("lunch") ? "lunch" :
                     lowerMessage.includes("dinner") ? "dinner" :
                     lowerMessage.includes("snack") ? "snack" : "meal";
    return generateMealAdvice(carbs, mealType, settings);
  }

  if (lowerMessage.includes("exercise") || lowerMessage.includes("workout") || lowerMessage.includes("activity") || lowerMessage.includes("run") || lowerMessage.includes("gym")) {
    const durationMatch = message.match(/(\d+)\s*(?:min|minute|hr|hour)/i);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 45;
    const intensity = lowerMessage.includes("intense") || lowerMessage.includes("hard") ? "intense" :
                      lowerMessage.includes("light") || lowerMessage.includes("easy") ? "light" : "moderate";
    return generateExerciseAdvice(duration, intensity, settings);
  }

  if (lowerMessage.includes("ratio") || lowerMessage.includes("calculate") || lowerMessage.includes("correction") || lowerMessage.includes("icr")) {
    return generateRatioAdvice(settings);
  }

  if (lowerMessage.includes("low") || lowerMessage.includes("hypo")) {
    return `**For Low Blood Sugar (Hypoglycemia):**\n\n` +
      `If BG is below 70 mg/dL, follow the Rule of 15:\n` +
      `1. Consume 15g of fast-acting carbs (4 glucose tablets, 4oz juice, regular soda)\n` +
      `2. Wait 15 minutes\n` +
      `3. Recheck blood glucose\n` +
      `4. If still below 70 mg/dL, repeat\n` +
      `5. Once normal, eat a snack with protein\n\n` +
      `**Warning Signs:** Shakiness, sweating, confusion, fast heartbeat\n\n` +
      `⚠️ If you cannot treat yourself or are losing consciousness, this is an emergency. ` +
      `Have someone call 911 and administer glucagon if available.\n\n` +
      `Go to Help Now for emergency information.`;
  }

  if (lowerMessage.includes("high") || lowerMessage.includes("hyper")) {
    const correctionInfo = settings.correctionFactor 
      ? `Your correction factor is 1:${settings.correctionFactor} (1 unit lowers BG by ${settings.correctionFactor} mg/dL)`
      : `Set your correction factor in Settings for personalized advice`;

    return `**For High Blood Sugar (Hyperglycemia):**\n\n` +
      `${correctionInfo}\n\n` +
      `**General Steps:**\n` +
      `1. Check for ketones if BG > 250 mg/dL\n` +
      `2. Take correction insulin (based on your factor)\n` +
      `3. Drink plenty of water\n` +
      `4. Recheck in 2-3 hours\n` +
      `5. Look for causes (missed bolus, illness, site issues)\n\n` +
      `**Seek Medical Help If:**\n` +
      `- Ketones are moderate or large\n` +
      `- BG won't come down after 2 corrections\n` +
      `- You feel nauseous, have abdominal pain, or fruity breath\n\n` +
      `⚠️ Not medical advice. Follow your healthcare provider's sick day rules.`;
  }

  return `I can help you with:\n\n` +
    `**Meal Planning:** "I'm eating 60g carbs for dinner"\n` +
    `**Exercise:** "I'm going to run for 45 minutes"\n` +
    `**Ratio Calculations:** "Help me calculate my carb ratio"\n` +
    `**Low Blood Sugar:** "What do I do for a low?"\n` +
    `**High Blood Sugar:** "How do I correct a high?"\n\n` +
    `Try asking me about any of these topics!\n\n` +
    `For the most personalized advice, make sure your settings are up to date ` +
    `(TDD, carb ratios, correction factor).`;
}

export default function Advisor() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI diabetes advisor. I can help you with:\n\n" +
        "• Meal planning and bolus calculations\n" +
        "• Exercise recommendations\n" +
        "• Insulin ratio calculations\n" +
        "• Managing highs and lows\n\n" +
        "How can I assist you today?\n\n" +
        "⚠️ Remember: All suggestions are educational only and not medical advice.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(storage.getSettings());
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const quickActions = [
    { icon: Utensils, label: "Plan Meal", prompt: "I'm planning to eat a meal with 60g carbs. What should my insulin dose be?" },
    { icon: Dumbbell, label: "Before Exercise", prompt: "I'm planning to exercise for 45 minutes. How should I adjust?" },
    { icon: Calculator, label: "Calculate Ratio", prompt: "Help me calculate my insulin-to-carb ratio." },
  ];

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const response = processUserMessage(inputValue, settings);
      
      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);

      storage.addActivityLog({
        activityType: "advisor_chat",
        activityDetails: inputValue,
        recommendation: response.substring(0, 200),
      });
    }, 500 + Math.random() * 500);
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold">AI Activity Advisor</h1>
        <p className="text-muted-foreground mt-1">Get personalized recommendations for meals and activities.</p>
      </div>

      <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20 mb-4">
        <CardContent className="p-3">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Not Medical Advice:</strong> All suggestions are educational only. 
              Always verify with your own calculations and consult your healthcare provider.
            </p>
          </div>
        </CardContent>
      </Card>

      {messages.length === 1 && (
        <div className="mb-4">
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
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <ChatMessage key={index} {...message} />
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about meals, activities, or insulin adjustments..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isTyping}
              data-testid="input-chat"
            />
            <Button onClick={handleSend} disabled={isTyping || !inputValue.trim()} data-testid="button-send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
