import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Utensils, Dumbbell, AlertCircle, Bot, User, Info, Calculator, ChevronDown, ChevronUp, Clock, Droplet, Pizza, Wrench, Repeat } from "lucide-react";
import { RoutinesContent } from "./routines";
import { Switch } from "@/components/ui/switch";
import { storage, UserSettings, UserProfile } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

type MessageAction = {
  label: string;
  onClick: () => void;
};

type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  action?: MessageAction;
  confidence?: ConfidenceLevel;
  mealPeriod?: string;
};

function ConfidenceBadge({ level, mealPeriod }: { level: ConfidenceLevel; mealPeriod?: string }) {
  const config = {
    HIGH: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "High confidence" },
    MEDIUM: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Medium confidence" },
    LOW: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Low confidence" },
  };
  const c = config[level];
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`} data-testid="badge-confidence">
        {c.label}
      </span>
      {mealPeriod && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1" data-testid="badge-meal-period">
          <Clock className="h-3 w-3" />
          {mealPeriod} time
        </span>
      )}
    </div>
  );
}

function ChatMessage({ role, content, timestamp, action, confidence, mealPeriod }: Message) {
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
          {role === "assistant" && confidence && (
            <ConfidenceBadge level={confidence} mealPeriod={mealPeriod} />
          )}
          {action && (
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-2"
              onClick={action.onClick}
              data-testid="button-message-action"
            >
              <Dumbbell className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
      </div>
    </div>
  );
}

function generateExerciseTypeGuide(bgUnits: string = "mmol/L"): string {
  const lowThreshold = bgUnits === "mmol/L" ? "5.0" : "90";
  const idealLow = bgUnits === "mmol/L" ? "7.0" : "126";
  const idealHigh = bgUnits === "mmol/L" ? "10.0" : "180";
  const highStart = bgUnits === "mmol/L" ? "8.0" : "144";

  return `**Exercise Type Guide for Diabetics**

Different types of exercise affect blood sugar in different ways. Understanding this can help you exercise with confidence.

---

**CARDIO (Running, Cycling, Swimming)**
*Blood sugar effect:* Usually LOWERS blood sugar
*Why:* Muscles use glucose for sustained energy
*Timing:* Effect starts quickly, can last hours after

*Tips:*
- Start with BG ${idealLow}-${idealHigh} ${bgUnits}
- May need 15-30g carbs before longer sessions
- Reduce bolus 30-50% for meal before exercise
- Watch for delayed lows up to 24 hours later

---

**STRENGTH TRAINING (Weights, Resistance)**
*Blood sugar effect:* Can RAISE then LOWER blood sugar
*Why:* Intense effort triggers adrenaline (raises BG), then muscles refuel (lowers BG)
*Timing:* May spike during, then drop 2-6 hours after

*Tips:*
- Starting BG can be slightly higher (${highStart}+ ${bgUnits} is OK)
- Don't correct small rises during workout
- Monitor for delayed lows in the evening/overnight
- Consider reduced basal if doing heavy sessions

---

**HIIT (High Intensity Interval Training)**
*Blood sugar effect:* Often RAISES during, LOWERS after
*Why:* Intense bursts release stress hormones, then glucose uptake increases during recovery
*Timing:* Spikes during, drops 1-4 hours post-exercise

*Tips:*
- Don't start if BG below ${lowThreshold} ${bgUnits}
- Expect a temporary rise - don't over-correct
- Have snacks ready for the post-workout drop
- Shorter sessions may be easier to manage

---

**YOGA / STRETCHING / WALKING**
*Blood sugar effect:* Gentle LOWERING or stable
*Why:* Low intensity, steady glucose use
*Timing:* Gradual effect, minimal delayed impact

*Tips:*
- Great option when BG is already on the lower side
- Usually no carb pre-load needed
- Good for active recovery days
- Walking after meals can help reduce spikes

---

**TEAM SPORTS (Football, Basketball, Tennis)**
*Blood sugar effect:* UNPREDICTABLE - can go either way
*Why:* Mix of sprinting (raises) and sustained activity (lowers), plus competition adrenaline
*Timing:* Variable during, often drops after

*Tips:*
- Check BG every 30 minutes during games
- Carry fast-acting glucose on the sideline
- Consider slightly higher starting BG (${highStart}+ ${bgUnits})
- Log your patterns for each sport

---

**General Gym Tips:**
1. Always carry fast-acting glucose
2. Tell a gym buddy about your diabetes
3. Keep a log of how each activity affects you
4. Stay hydrated - dehydration affects BG readings
5. Have your phone accessible for emergencies`;
}

function processExerciseAwareMealMessage(message: string, settings: UserSettings, bgUnits: string = "mmol/L", exerciseContext?: "before" | "after" | "during", hoursAway?: number): string {
  const carbMatch = message.match(/(\d+)\s*(?:g|gram|cp|portion)/i);
  const carbs = carbMatch ? parseInt(carbMatch[1]) : null;
  
  if (!carbs) {
    return `Please specify how many carbs you're planning to eat.\n\n[Not medical advice.]`;
  }
  
  const lowerMessage = message.toLowerCase();
  const mealType = lowerMessage.includes("breakfast") ? "breakfast" :
                   lowerMessage.includes("lunch") ? "lunch" :
                   lowerMessage.includes("dinner") ? "dinner" :
                   lowerMessage.includes("snack") ? "snack" : "meal";
  
  const ratioMap: Record<string, string | undefined> = {
    breakfast: settings.breakfastRatio,
    lunch: settings.lunchRatio,
    dinner: settings.dinnerRatio,
    snack: settings.snackRatio,
    meal: settings.lunchRatio || settings.breakfastRatio,
  };

  const ratio = ratioMap[mealType];
  let baseUnits = 0;

  if (ratio) {
    const match = ratio.match(/1:(\d+)/);
    if (match) {
      const carbRatio = parseInt(match[1]);
      baseUnits = Math.round((carbs / carbRatio) * 10) / 10;
    }
  } else if (settings.tdd) {
    const estimatedRatio = Math.round(500 / settings.tdd);
    baseUnits = Math.round((carbs / estimatedRatio) * 10) / 10;
  }

  if (baseUnits <= 0) {
    return `To calculate your bolus, please add your carb ratios or TDD in Settings.\n\n[Not medical advice.]`;
  }

  if (!exerciseContext) {
    return `For ${carbs}g carbs at ${mealType}: approximately ${baseUnits} units\n\n` +
      `Adjust for your current blood glucose if needed.\n\n` +
      `[Not medical advice. Always verify with your own calculations.]`;
  }

  const hours = hoursAway || 2;
  
  if (exerciseContext === "before") {
    const reductionPercent = hours <= 1 ? 40 : hours <= 2 ? 30 : 20;
    const adjustedUnits = Math.round(baseUnits * (1 - reductionPercent / 100) * 10) / 10;
    
    return `**Pre-Exercise Meal (${carbs}g carbs, ${mealType})**\n\n` +
      `Standard dose: ${baseUnits} units\n` +
      `Suggested reduction: ${reductionPercent}%\n` +
      `**Adjusted dose: ~${adjustedUnits} units**\n\n` +
      `**Why reduce?**\n` +
      `Exercise increases insulin sensitivity. Eating ${hours} hour${hours > 1 ? 's' : ''} before exercise means the insulin will still be active when you start moving.\n\n` +
      `**Tips:**\n` +
      `- Start exercise with BG ${bgUnits === "mmol/L" ? "7-10" : "126-180"} ${bgUnits}\n` +
      `- Consider slower-digesting carbs (whole grains, protein)\n` +
      `- Check BG before starting\n\n` +
      `[Not medical advice. Adjust based on your experience.]`;
  }
  
  if (exerciseContext === "after") {
    const reductionPercent = hours <= 1 ? 35 : hours <= 2 ? 25 : 15;
    const adjustedUnits = Math.round(baseUnits * (1 - reductionPercent / 100) * 10) / 10;
    
    return `**Post-Exercise Meal (${carbs}g carbs, ${mealType})**\n\n` +
      `Standard dose: ${baseUnits} units\n` +
      `Suggested reduction: ${reductionPercent}%\n` +
      `**Adjusted dose: ~${adjustedUnits} units**\n\n` +
      `**Why reduce?**\n` +
      `Your muscles are refuelling and insulin sensitivity stays elevated for hours after exercise. This increases hypo risk.\n\n` +
      `**Recovery Tips:**\n` +
      `- Include protein to help muscle recovery\n` +
      `- Monitor for delayed lows over next 6-12 hours\n` +
      `- Consider a bedtime snack if exercised in the evening\n\n` +
      `[Not medical advice. Adjust based on your experience.]`;
  }
  
  if (exerciseContext === "during") {
    return `**During-Exercise Fuel (${carbs}g carbs)**\n\n` +
      `**Usually: No insulin needed**\n\n` +
      `Carbs eaten during exercise are typically used immediately by working muscles. For most activities under 90 minutes:\n\n` +
      `- Skip insulin for exercise snacks/gels\n` +
      `- Use fast-acting carbs (15-30g every 30-45 min)\n` +
      `- Monitor BG and adjust intake\n\n` +
      `**For longer sessions (90+ min):**\n` +
      `- May need very small bolus (10-25% of normal)\n` +
      `- Test with small amounts first\n\n` +
      `[Not medical advice. Individual responses vary significantly.]`;
  }

  return `For ${carbs}g carbs: approximately ${baseUnits} units\n\n[Not medical advice.]`;
}

function processActivitySessionMessage(message: string, settings: UserSettings, bgUnits: string = "mmol/L"): string {
  const durationMatch = message.match(/(\d+)\s*(?:min|minute)/i);
  const duration = durationMatch ? parseInt(durationMatch[1]) : 45;
  
  const lowerMessage = message.toLowerCase();
  const intensity = lowerMessage.includes("intense") || lowerMessage.includes("hard") ? "intense" :
                    lowerMessage.includes("light") || lowerMessage.includes("easy") ? "light" : "moderate";
  
  const exerciseType = lowerMessage.includes("cardio") || lowerMessage.includes("run") || lowerMessage.includes("cycl") ? "cardio" :
                       lowerMessage.includes("strength") || lowerMessage.includes("weight") ? "strength" :
                       lowerMessage.includes("hiit") ? "HIIT" : "exercise";

  let preExerciseCarbs = 0;
  let duringCarbs = 0;
  let postExerciseCarbs = 0;
  let bolusReduction = "";

  switch (intensity) {
    case "light":
      preExerciseCarbs = duration < 30 ? 0 : 15;
      duringCarbs = duration > 60 ? 15 : 0;
      postExerciseCarbs = 15;
      bolusReduction = "15-25%";
      break;
    case "moderate":
      preExerciseCarbs = duration < 20 ? 10 : 20;
      duringCarbs = duration > 45 ? Math.round(duration / 30 * 15) : 0;
      postExerciseCarbs = 20;
      bolusReduction = "25-35%";
      break;
    case "intense":
      preExerciseCarbs = 25;
      duringCarbs = duration > 30 ? Math.round(duration / 30 * 20) : 0;
      postExerciseCarbs = 30;
      bolusReduction = "35-50%";
      break;
  }

  const idealStart = bgUnits === "mmol/L" ? "7-10" : "126-180";
  const lowThreshold = bgUnits === "mmol/L" ? "5.6" : "100";

  return `**Complete Activity Session Plan**\n` +
    `${duration} min ${intensity} ${exerciseType}\n\n` +
    `---\n\n` +
    `**PRE-WORKOUT (30-60 min before)**\n` +
    `- Target BG: ${idealStart} ${bgUnits}\n` +
    `- If BG below ${lowThreshold} ${bgUnits}: eat ${preExerciseCarbs}g carbs\n` +
    `- Reduce bolus for pre-workout meal by ${bolusReduction}\n` +
    `- Good options: banana, toast, oat bar\n\n` +
    `---\n\n` +
    `**DURING WORKOUT**\n` +
    (duringCarbs > 0 ? 
      `- Have ${duringCarbs}g fast carbs available\n` +
      `- Take 15g every 30-45 min if BG drops\n`
    : `- For ${duration} min ${intensity} exercise, you may not need extra carbs\n` +
      `- Keep 15-20g fast glucose ready just in case\n`) +
    `- Check BG at halfway point for longer sessions\n\n` +
    `---\n\n` +
    `**POST-WORKOUT (within 30-60 min)**\n` +
    `- Have ${postExerciseCarbs}g carbs to help recovery\n` +
    `- Include protein (15-20g) for muscle repair\n` +
    `- Reduce bolus by ${bolusReduction} for recovery meal\n` +
    `- Good options: chocolate milk, yogurt, sandwich\n\n` +
    `---\n\n` +
    `**DELAYED LOW PREVENTION**\n` +
    `- Monitor BG for 6-24 hours after\n` +
    `- Consider reduced basal (if pumping) overnight\n` +
    `- Have a protein-carb snack before bed if evening exercise\n\n` +
    `[Not medical advice. Individual responses vary. Track your patterns.]`;
}

function processUserMessage(message: string, settings: UserSettings, bgUnits: string = "mmol/L", context: "meal" | "exercise"): string {
  const lowerMessage = message.toLowerCase();

  if (context === "meal") {
    const carbMatch = message.match(/(\d+)\s*(?:g|gram|cp|portion)/i);
    const carbs = carbMatch ? parseInt(carbMatch[1]) : null;
    
    if (carbs) {
      const mealType = lowerMessage.includes("breakfast") ? "breakfast" :
                       lowerMessage.includes("lunch") ? "lunch" :
                       lowerMessage.includes("dinner") ? "dinner" :
                       lowerMessage.includes("snack") ? "snack" : "meal";
      
      const ratioMap: Record<string, string | undefined> = {
        breakfast: settings.breakfastRatio,
        lunch: settings.lunchRatio,
        dinner: settings.dinnerRatio,
        snack: settings.snackRatio,
        meal: settings.lunchRatio || settings.breakfastRatio,
      };

      const ratio = ratioMap[mealType];
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
        return `For ${carbs}g carbs at ${mealType}: approximately ${insulinUnits} units\n\n` +
          `Adjust for your current blood glucose if needed.\n\n` +
          `[Not medical advice. Always verify with your own calculations.]`;
      }

      // Even without explicit ratio, try to estimate from TDD
      if (settings.tdd) {
        const estimatedRatio = Math.round(500 / settings.tdd);
        const estimatedUnits = Math.round((carbs / estimatedRatio) * 10) / 10;
        return `For ${carbs}g carbs at ${mealType}: approximately ${estimatedUnits} units (estimated from TDD)\n\n` +
          `Adjust for your current blood glucose if needed.\n\n` +
          `[Not medical advice. Always verify with your own calculations.]`;
      }

      return `To calculate your bolus, please add your carb ratios or TDD in Settings.\n\n` +
        `[Not medical advice.]`;
    }

    return `I can help you plan your meal! Please tell me:\n\n` +
      `- How many carbs you're planning to eat (e.g., "60g carbs")\n` +
      `- What meal it is (breakfast, lunch, dinner, or snack)\n\n` +
      `I'll calculate a suggested bolus based on your ratios.\n\n` +
      `[Not medical advice. Always verify with your own calculations.]`;
  }

  if (context === "exercise") {
    const durationMatch = message.match(/(\d+)\s*(?:min|minute|hr|hour)/i);
    const duration = durationMatch ? parseInt(durationMatch[1]) : null;
    const intensity = lowerMessage.includes("intense") || lowerMessage.includes("hard") ? "intense" :
                      lowerMessage.includes("light") || lowerMessage.includes("easy") ? "light" : "moderate";

    if (duration) {
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

      const idealLow = bgUnits === "mmol/L" ? "6.7" : "120";
      const idealHigh = bgUnits === "mmol/L" ? "10.0" : "180";
      const lowThreshold = bgUnits === "mmol/L" ? "5.6" : "100";
      const hypoThreshold = bgUnits === "mmol/L" ? "4.0" : "70";

      const recoveryCarbs = intensity === "intense" ? "25-30g" : intensity === "moderate" ? "15-25g" : "10-15g";
      
      return `For ${duration} minutes of ${intensity} exercise:\n\n` +
        `**Before Exercise:**\n` +
        `- Ideal starting BG: ${idealLow}-${idealHigh} ${bgUnits}\n` +
        `- If below ${lowThreshold} ${bgUnits}: eat ${carbsNeeded}g of fast-acting carbs\n` +
        `- Consider reducing bolus by ${insulinReduction} for meal within 2 hours before\n\n` +
        `**During Exercise:**\n` +
        `- Carry fast-acting glucose (15-20g)\n` +
        `- Check BG every 30-45 minutes for longer sessions\n` +
        `- If BG drops below ${hypoThreshold} ${bgUnits}, stop and treat\n\n` +
        `**After Exercise - Recovery Snack:**\n` +
        `- Within 30-60 mins: ${recoveryCarbs} carbs + protein\n` +
        `- Good options: chocolate milk, yogurt + fruit, banana + peanut butter\n` +
        `- Reduce bolus by ${insulinReduction} for recovery snack/meal\n\n` +
        `**Delayed Low Prevention:**\n` +
        `- Monitor BG for 6-24 hours after\n` +
        `- Consider a protein-carb snack before bed\n` +
        `- Stay hydrated\n\n` +
        `[Not medical advice. Individual responses to exercise vary significantly.]`;
    }

    return `I can help you plan for exercise! Please tell me:\n\n` +
      `- How long you'll exercise (e.g., "45 minutes")\n` +
      `- What type of exercise (cardio, weights, HIIT, etc.)\n` +
      `- How intense it will be (light, moderate, intense)\n\n` +
      `I'll provide recommendations for before, during, and after.\n\n` +
      `[Not medical advice. Individual responses to exercise vary.]`;
  }

  return `How can I help you today?`;
}

function RatioCalculationGuide({ settings, bgUnits }: { settings: UserSettings; bgUnits: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const correctionRule = bgUnits === "mmol/L" ? 100 : 1800;
  const ruleName = bgUnits === "mmol/L" ? "100 Rule" : "1800 Rule";
  const exampleResult = bgUnits === "mmol/L" ? "2.5" : "45";
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto" data-testid="button-ratio-guide">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">How to Calculate Insulin Ratios</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Starting Point: The 500 Rule</p>
            <p>500 ÷ TDD = grams of carbs covered by 1 unit</p>
            {settings.tdd && (
              <p className="text-primary">Your starting estimate: 500 ÷ {settings.tdd} = 1:{Math.round(500 / settings.tdd)}</p>
            )}
          </div>
          
          <div>
            <p className="font-medium text-foreground">Fine-Tuning by Trial</p>
            <p>The 500 rule gives you a starting point, but everyone is different. Here's how to adjust:</p>
            <ol className="list-decimal list-inside space-y-1 mt-2 text-xs">
              <li>Start with your calculated ratio (e.g., 1:10)</li>
              <li>Eat a measured meal with known carbs when blood sugar is stable</li>
              <li>Check blood sugar 2-3 hours after eating</li>
              <li>If still high: try a stronger ratio (e.g., 1:8)</li>
              <li>If going low: try a weaker ratio (e.g., 1:12)</li>
              <li>Repeat until you find what works for each meal</li>
            </ol>
          </div>

          <div>
            <p className="font-medium text-foreground">Correction Factor: {ruleName}</p>
            <p>{correctionRule} ÷ TDD = {bgUnits} drop per 1 unit</p>
            {settings.tdd && (
              <p className="text-primary">Your estimate: {correctionRule} ÷ {settings.tdd} = {Math.round(correctionRule / settings.tdd * 10) / 10} {bgUnits}</p>
            )}
          </div>

          <div className="text-xs bg-muted p-2 rounded">
            <p><strong>Why ratios differ by meal:</strong></p>
            <p>Many people need stronger ratios at breakfast (e.g., 1:8) due to morning hormone changes, and weaker ratios at lunch/dinner (e.g., 1:12). Trial each meal separately.</p>
          </div>
          
          <p className="text-xs text-muted-foreground italic">Note: Always work with your healthcare team when adjusting ratios. Keep a log of your trials to spot patterns.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChatSection({ 
  messages, 
  inputValue, 
  setInputValue, 
  onSend, 
  isTyping,
  placeholder 
}: { 
  messages: Message[]; 
  inputValue: string; 
  setInputValue: (v: string) => void; 
  onSend: () => void; 
  isTyping: boolean;
  placeholder: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <Card className="flex flex-col min-h-[300px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Ask the AI Advisor
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 px-4 max-h-[400px]" ref={scrollRef}>
        <div className="space-y-4 pb-4">
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
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
            disabled={isTyping}
            data-testid="input-chat"
          />
          <Button onClick={onSend} disabled={isTyping || !inputValue.trim()} data-testid="button-send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (tab === "meal" || tab === "exercise" || tab === "routines" || tab === "tools") {
    return tab;
  }
  return "meal";
}

export default function Advisor() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "meal" || tab === "exercise" || tab === "routines" || tab === "tools") {
      setActiveTab(tab);
    }
  }, []);
  
  const [mealMessages, setMealMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm here to help you plan your meals. Tell me how many carbs you're planning to eat (e.g., \"60g carbs for lunch\") and I'll calculate a suggested bolus based on your ratios.\n\n[Not medical advice. Always verify with your own calculations.]",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [exerciseMessages, setExerciseMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm here to help you plan your workout. Use the form above to set up your exercise, then I'll give you a complete plan covering what to eat before, during, and after your workout, plus insulin adjustments.\n\n[Not medical advice. Individual responses to exercise vary.]",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  
  const [mealInput, setMealInput] = useState("");
  const [exerciseInput, setExerciseInput] = useState("");
  const [isMealTyping, setIsMealTyping] = useState(false);
  const [isExerciseTyping, setIsExerciseTyping] = useState(false);
  
  const [mealCarbs, setMealCarbs] = useState("");
  const [carbUnit, setCarbUnit] = useState<"grams" | "cp">("grams");
  const [mealTime, setMealTime] = useState<string>("lunch");
  
  const [exerciseType, setExerciseType] = useState("cardio");
  const [exerciseDuration, setExerciseDuration] = useState("");
  const [exerciseIntensity, setExerciseIntensity] = useState("moderate");
  const [showExerciseGuide, setShowExerciseGuide] = useState(false);
  
  const [planningAroundExercise, setPlanningAroundExercise] = useState(false);
  const [exerciseTiming, setExerciseTiming] = useState<"before" | "after" | "during">("before");
  const [exerciseWithin, setExerciseWithin] = useState("2");
  
  const [sessionTimingFromNow, setSessionTimingFromNow] = useState("60");

  // Split Bolus Calculator state
  const [splitCarbs, setSplitCarbs] = useState("");
  const [splitFatLevel, setSplitFatLevel] = useState<"low" | "medium" | "high">("high");
  const [splitMealTime, setSplitMealTime] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const [showSplitCalculator, setShowSplitCalculator] = useState(false);
  const [splitResult, setSplitResult] = useState<{
    totalUnits: number;
    firstDose: number;
    secondDose: number;
    secondDoseDelay: number;
    splitRatio: string;
    ratioUsed: string;
  } | null>(null);

  // Hypo Treatment Calculator state
  const [currentBg, setCurrentBg] = useState("");
  const [targetBg, setTargetBg] = useState("");
  const [userWeight, setUserWeight] = useState("");
  const [hypoResult, setHypoResult] = useState<{
    carbsNeeded: number;
    glucoseTablets: number;
    juiceMl: number;
    jellyBabies: number;
  } | null>(null);

  const bgUnits = profile.bgUnits || "mmol/L";

  useEffect(() => {
    setSettings(storage.getSettings());
    const storedProfile = storage.getProfile();
    if (storedProfile) {
      setProfile(storedProfile);
      if (storedProfile.carbUnits) {
        setCarbUnit(storedProfile.carbUnits === "cp" ? "cp" : "grams");
      }
    }
  }, []);

  // Split Bolus Calculator function
  const calculateSplitBolus = () => {
    if (!splitCarbs) return;
    
    const carbValue = parseInt(splitCarbs);
    if (isNaN(carbValue) || carbValue <= 0) return;
    
    // Get ratio based on selected meal time
    const ratioMap: Record<string, string | undefined> = {
      breakfast: settings.breakfastRatio,
      lunch: settings.lunchRatio,
      dinner: settings.dinnerRatio,
      snack: settings.snackRatio || settings.lunchRatio, // Fallback snack to lunch
    };
    const selectedRatio = ratioMap[splitMealTime];
    
    let totalUnits = 0;
    let ratioUsed = "";
    
    if (selectedRatio) {
      const match = selectedRatio.match(/1:(\d+)/);
      if (match) {
        const carbRatio = parseInt(match[1]);
        totalUnits = Math.round((carbValue / carbRatio) * 10) / 10;
        ratioUsed = `Using your ${splitMealTime} ratio (${selectedRatio})`;
      }
    } else if (settings.tdd) {
      const estimatedRatio = Math.round(500 / settings.tdd);
      totalUnits = Math.round((carbValue / estimatedRatio) * 10) / 10;
      ratioUsed = `Estimated from TDD (1:${estimatedRatio})`;
    }
    
    if (totalUnits <= 0) {
      setSplitResult(null);
      return;
    }
    
    // Split ratios and timing based on fat content
    let firstPercent: number;
    let secondDoseDelay: number;
    let splitRatio: string;
    
    switch (splitFatLevel) {
      case "low":
        firstPercent = 70;
        secondDoseDelay = 1.5;
        splitRatio = "70/30";
        break;
      case "medium":
        firstPercent = 60;
        secondDoseDelay = 2;
        splitRatio = "60/40";
        break;
      case "high":
        firstPercent = 50;
        secondDoseDelay = 3;
        splitRatio = "50/50";
        break;
    }
    
    const firstDose = Math.round(totalUnits * (firstPercent / 100) * 10) / 10;
    const secondDose = Math.round((totalUnits - firstDose) * 10) / 10;
    
    setSplitResult({
      totalUnits,
      firstDose,
      secondDose,
      secondDoseDelay,
      splitRatio,
      ratioUsed,
    });
  };

  // Hypo Treatment Calculator function
  const calculateHypoTreatment = () => {
    if (!currentBg || !targetBg) return;
    
    const current = parseFloat(currentBg);
    const target = parseFloat(targetBg);
    const parsedWeight = userWeight ? parseFloat(userWeight) : 70;
    const weight = (isNaN(parsedWeight) || parsedWeight <= 0) ? 70 : parsedWeight; // Default 70kg, guard against invalid
    
    if (isNaN(current) || isNaN(target)) return;
    
    // Convert to mmol/L if using mg/dL for calculation
    const currentMmol = bgUnits === "mg/dL" ? current / 18 : current;
    const targetMmol = bgUnits === "mg/dL" ? target / 18 : target;
    
    const bgDifference = targetMmol - currentMmol;
    
    if (bgDifference <= 0) {
      setHypoResult(null);
      return;
    }
    
    // Rule of thumb: 1g glucose raises BG by ~0.2-0.3 mmol/L for a 70kg adult
    // Lighter people need less, heavier people need more
    const sensitivityFactor = 70 / weight; // Adjust for weight
    const baseRise = 0.25; // mmol/L per gram of glucose
    const effectiveRise = baseRise * sensitivityFactor;
    
    const carbsNeeded = Math.ceil(bgDifference / effectiveRise);
    
    // Common hypo treatment equivalents (UK focused)
    const glucoseTablets = Math.ceil(carbsNeeded / 4); // ~4g per tablet
    const juiceMl = Math.round(carbsNeeded * 10); // ~10ml juice per 1g carb
    const jellyBabies = Math.ceil(carbsNeeded / 5); // ~5g per jelly baby
    
    setHypoResult({
      carbsNeeded: Math.max(carbsNeeded, 10), // Minimum 10g
      glucoseTablets: Math.max(glucoseTablets, 3), // Minimum 3 tablets
      juiceMl: Math.max(juiceMl, 100), // Minimum 100ml
      jellyBabies: Math.max(jellyBabies, 2), // Minimum 2
    });
  };

  const sendMealMessage = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMealMessages(prev => [...prev, userMessage]);
    setIsMealTyping(true);

    let aiResponse: string;
    let confidence: ConfidenceLevel = "MEDIUM";
    let mealPeriod: string | undefined;

    try {
      const userProfile = storage.getProfile();
      const userSettings = storage.getSettings();
      const activityLogs = storage.getActivityLogs().slice(0, 5);
      
      // Build conversation history for context (excluding the welcome message)
      const conversationHistory = [...mealMessages, userMessage]
        .filter(m => m.content !== mealMessages[0]?.content)
        .map(m => ({ role: m.role, content: m.content }));
      
      const response = await fetch("/api/activity/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "meal",
          activityDetails: message,
          userProfile,
          userSettings,
          conversationHistory,
          activityLogs,
          currentTime: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.recommendation + "\n\n[Not medical advice. Always verify with your own calculations.]";
        confidence = data.confidence || "MEDIUM";
        mealPeriod = data.mealPeriod;
      } else {
        // API unavailable or error - use local processing
        aiResponse = processUserMessage(message, userSettings, bgUnits, "meal");
      }
    } catch {
      // Network error or other failure - use local processing
      const freshSettings = storage.getSettings();
      aiResponse = processUserMessage(message, freshSettings, bgUnits, "meal");
    }

    setMealMessages(prev => [...prev, {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      confidence,
      mealPeriod,
      action: {
        label: "Plan Exercise",
        onClick: () => setActiveTab("exercise"),
      },
    }]);
    
    try {
      storage.addActivityLog({
        activityType: "meal_planning",
        activityDetails: message,
        recommendation: aiResponse.substring(0, 200),
      });
    } catch {
      // Ignore logging errors
    }

    setIsMealTyping(false);
  };

  const sendExerciseMessage = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setExerciseMessages(prev => [...prev, userMessage]);
    setIsExerciseTyping(true);

    let aiResponse: string;
    let confidence: ConfidenceLevel = "MEDIUM";

    try {
      const userProfile = storage.getProfile();
      const userSettings = storage.getSettings();
      const activityLogs = storage.getActivityLogs().slice(0, 5);
      
      // Build conversation history for context
      const conversationHistory = [...exerciseMessages, userMessage]
        .filter(m => m.content !== exerciseMessages[0]?.content)
        .map(m => ({ role: m.role, content: m.content }));
      
      const response = await fetch("/api/activity/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "exercise",
          activityDetails: message,
          userProfile,
          userSettings,
          conversationHistory,
          activityLogs,
          currentTime: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.recommendation + "\n\n[Not medical advice. Individual responses to exercise vary.]";
        confidence = data.confidence || "MEDIUM";
      } else {
        // API unavailable or error - use local processing with session-style output
        aiResponse = processActivitySessionMessage(message, userSettings, bgUnits);
      }
    } catch {
      // Network error or other failure - use local processing with session-style output
      const freshSettings = storage.getSettings();
      aiResponse = processActivitySessionMessage(message, freshSettings, bgUnits);
    }

    setExerciseMessages(prev => [...prev, {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      confidence,
    }]);
    
    try {
      storage.addActivityLog({
        activityType: "exercise_planning",
        activityDetails: message,
        recommendation: aiResponse.substring(0, 200),
      });
    } catch {
      // Ignore logging errors
    }

    setIsExerciseTyping(false);
  };

  const handleMealSend = () => {
    if (!mealInput.trim()) return;
    sendMealMessage(mealInput);
    setMealInput("");
  };

  const handleExerciseSend = () => {
    if (!exerciseInput.trim()) return;
    sendExerciseMessage(exerciseInput);
    setExerciseInput("");
  };

  const handleQuickMealPlan = () => {
    if (!mealCarbs) return;
    const carbValue = carbUnit === "cp" ? parseInt(mealCarbs) * 10 : parseInt(mealCarbs);
    
    let message = `I'm planning to eat ${carbValue}g carbs for ${mealTime}.`;
    
    if (planningAroundExercise) {
      if (exerciseTiming === "before") {
        message += ` I'll be exercising in about ${exerciseWithin} hours. How should I adjust my insulin?`;
      } else if (exerciseTiming === "after") {
        message += ` I just finished exercising about ${exerciseWithin} hours ago. How should I adjust my insulin?`;
      } else {
        message += ` I'll be eating this during exercise. How should I handle it?`;
      }
    } else {
      message += ` What should my insulin dose be?`;
    }
    
    sendMealMessageWithExerciseContext(message, planningAroundExercise ? exerciseTiming : undefined, planningAroundExercise ? parseInt(exerciseWithin) : undefined);
    setMealCarbs("");
  };

  const handleQuickExercisePlan = () => {
    if (!exerciseDuration) return;
    const timingMins = parseInt(sessionTimingFromNow);
    const timingText = timingMins < 60 ? `${timingMins} minutes` : `${Math.round(timingMins / 60)} hour${timingMins >= 120 ? 's' : ''}`;
    const message = `I'm planning ${exerciseIntensity} ${exerciseType} for ${exerciseDuration} minutes, starting in about ${timingText}. Help me plan the whole workout including what to eat before, during, and after.`;
    sendExerciseMessage(message);
  };
  
  const sendMealMessageWithExerciseContext = async (message: string, exerciseContext?: "before" | "after" | "during", hoursAway?: number) => {
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMealMessages(prev => [...prev, userMessage]);
    setIsMealTyping(true);

    const freshSettings = storage.getSettings();
    const aiResponse = processExerciseAwareMealMessage(message, freshSettings, bgUnits, exerciseContext, hoursAway);

    setMealMessages(prev => [...prev, {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: exerciseContext ? undefined : {
        label: "Plan Exercise",
        onClick: () => setActiveTab("exercise"),
      },
    }]);
    
    setIsMealTyping(false);
  };
  
  const getRatioForMeal = (meal: string): string => {
    const ratioMap: Record<string, string | undefined> = {
      breakfast: settings.breakfastRatio,
      lunch: settings.lunchRatio,
      dinner: settings.dinnerRatio,
      snack: settings.snackRatio,
    };
    return ratioMap[meal] || "Not set";
  };

  return (
    <div className="flex flex-col h-full relative">
      <FaceLogoWatermark />
      <div className="mb-4 flex items-center gap-2">
        <div>
          <h1 className="text-3xl font-semibold">AI Activity Advisor</h1>
          <p className="text-muted-foreground mt-1">Get personalized recommendations for meals and exercise.</p>
        </div>
        <PageInfoDialog
          title="About AI Activity Advisor"
          description="Get smart recommendations for meals and exercise"
        >
          <InfoSection title="Meal Tab">
            <p>Enter carbs and meal type for a bolus suggestion. Toggle "Planning around exercise?" to get adjusted doses for meals before, during, or after workouts.</p>
          </InfoSection>
          <InfoSection title="Exercise Tab">
            <p>Plan workouts by type, duration, and intensity. Get preparation tips including what to eat before, during, and after exercise.</p>
          </InfoSection>
          <InfoSection title="Session Tab">
            <p>Plan your complete activity session: pre-workout fuel, the exercise itself, and recovery eating - all in one place with adjusted insulin recommendations.</p>
          </InfoSection>
          <InfoSection title="Smart Features">
            <p><strong>Conversation Memory:</strong> The AI remembers what you've asked in this session for better follow-up answers.</p>
            <p><strong>Time Awareness:</strong> Automatically uses your breakfast/lunch/dinner ratios based on current time.</p>
            <p><strong>Learning:</strong> Uses your activity history to provide more personalised recommendations.</p>
            <p><strong>Confidence Indicator:</strong> Shows how certain the AI is - green (high), amber (medium), or red (low).</p>
          </InfoSection>
          <InfoSection title="Safety Note">
            <p>All suggestions are for informational purposes only. Always verify with your own calculations and healthcare team. Not medical advice.</p>
          </InfoSection>
        </PageInfoDialog>
      </div>

      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Prototype Preview:</strong> This AI feature requires a backend connection. Full AI functionality will be available in a future release.
            </p>
          </div>
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Not Medical Advice:</strong> All suggestions are educational only. 
              Always verify with your own calculations and consult your healthcare provider.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="meal" className="gap-2" data-testid="tab-meal">
            <Utensils className="h-4 w-4" />Meal
          </TabsTrigger>
          <TabsTrigger value="exercise" className="gap-2" data-testid="tab-exercise">
            <Dumbbell className="h-4 w-4" />Exercise
          </TabsTrigger>
          <TabsTrigger value="routines" className="gap-2" data-testid="tab-routines">
            <Repeat className="h-4 w-4" />Routines
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2" data-testid="tab-tools">
            <Wrench className="h-4 w-4" />Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meal" className="flex-1 flex flex-col min-h-0 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Quick Meal Planner
              </CardTitle>
              <CardDescription>Enter your carbs and get a bolus suggestion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meal-carbs">How many carbs? ({carbUnit === "cp" ? "CP" : "grams"})</Label>
                  <Input
                    id="meal-carbs"
                    type="number"
                    placeholder={carbUnit === "cp" ? "e.g., 6" : "e.g., 60"}
                    value={mealCarbs}
                    onChange={(e) => setMealCarbs(e.target.value)}
                    data-testid="input-meal-carbs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meal-time">Which meal?</Label>
                  <Select value={mealTime} onValueChange={setMealTime}>
                    <SelectTrigger id="meal-time" data-testid="select-meal-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  <Label htmlFor="exercise-toggle" className="text-sm font-medium cursor-pointer">
                    Planning around exercise?
                  </Label>
                </div>
                <Switch
                  id="exercise-toggle"
                  checked={planningAroundExercise}
                  onCheckedChange={setPlanningAroundExercise}
                  data-testid="switch-exercise-toggle"
                />
              </div>

              {planningAroundExercise && (
                <div className="grid gap-4 md:grid-cols-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>When is exercise?</Label>
                    <Select value={exerciseTiming} onValueChange={(v: "before" | "after" | "during") => setExerciseTiming(v)}>
                      <SelectTrigger data-testid="select-exercise-timing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before this meal</SelectItem>
                        <SelectItem value="after">After this meal</SelectItem>
                        <SelectItem value="during">During exercise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {exerciseTiming !== "during" && (
                    <div className="space-y-2">
                      <Label>How many hours {exerciseTiming === "before" ? "until" : "since"} exercise?</Label>
                      <Select value={exerciseWithin} onValueChange={setExerciseWithin}>
                        <SelectTrigger data-testid="select-exercise-hours">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">About 1 hour</SelectItem>
                          <SelectItem value="2">About 2 hours</SelectItem>
                          <SelectItem value="3">About 3 hours</SelectItem>
                          <SelectItem value="4">4+ hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Your Current Ratios</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Breakfast:</span>
                    <span className={getRatioForMeal("breakfast") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("breakfast")}</span>
                  </div>
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Lunch:</span>
                    <span className={getRatioForMeal("lunch") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("lunch")}</span>
                  </div>
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Dinner:</span>
                    <span className={getRatioForMeal("dinner") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("dinner")}</span>
                  </div>
                  <div className="flex justify-between gap-1 flex-wrap">
                    <span className="text-muted-foreground">Snack:</span>
                    <span className={getRatioForMeal("snack") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("snack")}</span>
                  </div>
                </div>
                {(!settings.breakfastRatio && !settings.lunchRatio && !settings.dinnerRatio) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Link href="/settings" className="text-primary hover:underline">Set your ratios in Settings</Link> for accurate calculations.
                  </p>
                )}
              </div>

              <Button onClick={handleQuickMealPlan} disabled={!mealCarbs} className="w-full" data-testid="button-get-meal-advice">
                Get Bolus Suggestion
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 bg-transparent shadow-none">
            <RatioCalculationGuide settings={settings} bgUnits={bgUnits} />
          </Card>

          <Card>
            <Collapsible open={showSplitCalculator} onOpenChange={setShowSplitCalculator}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto" data-testid="button-split-calculator-toggle">
                  <div className="flex items-center gap-2">
                    <Pizza className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <span className="font-medium">Split Bolus Calculator</span>
                      <p className="text-xs text-muted-foreground font-normal">For high-fat meals like pizza, fish & chips</p>
                    </div>
                  </div>
                  {showSplitCalculator ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      High-fat meals slow down carb absorption. Taking all insulin upfront can cause an initial hypo, 
                      then a late spike. Split your bolus to match the slower digestion.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="split-carbs">Total carbs (g)</Label>
                      <Input
                        id="split-carbs"
                        type="number"
                        placeholder="e.g., 80"
                        value={splitCarbs}
                        onChange={(e) => setSplitCarbs(e.target.value)}
                        data-testid="input-split-carbs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-meal">Which meal?</Label>
                      <Select value={splitMealTime} onValueChange={(v: "breakfast" | "lunch" | "dinner" | "snack") => setSplitMealTime(v)}>
                        <SelectTrigger id="split-meal" data-testid="select-split-meal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-fat">Fat content</Label>
                      <Select value={splitFatLevel} onValueChange={(v: "low" | "medium" | "high") => setSplitFatLevel(v)}>
                        <SelectTrigger id="split-fat" data-testid="select-split-fat">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low fat (pasta, rice)</SelectItem>
                          <SelectItem value="medium">Medium fat (burgers, curries)</SelectItem>
                          <SelectItem value="high">High fat (pizza, fish & chips)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={calculateSplitBolus} disabled={!splitCarbs} className="w-full" data-testid="button-calculate-split">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Split Doses
                  </Button>

                  {splitResult && (
                    <div className="p-4 bg-primary/5 rounded-lg space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Pizza className="h-4 w-4 text-primary" />
                        Your Split Bolus Plan ({splitResult.splitRatio})
                      </h4>
                      
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">FIRST DOSE - NOW</p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{splitResult.firstDose} units</p>
                          <p className="text-xs text-green-600 dark:text-green-400">Take when you start eating</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">SECOND DOSE - LATER</p>
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{splitResult.secondDose} units</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">Take in {splitResult.secondDoseDelay} hours</p>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Total:</strong> {splitResult.totalUnits} units for {splitCarbs}g carbs</p>
                        <p className="text-xs">{splitResult.ratioUsed}</p>
                        <p><strong>Why split?</strong> Fat slows carb absorption by {splitResult.secondDoseDelay - 1} to {splitResult.secondDoseDelay + 1} hours.</p>
                      </div>

                      <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                        <strong>Tip:</strong> Set a timer for your second dose! Check BG before taking it.
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    [Not medical advice. Everyone's response to fat varies. Start conservatively and adjust based on your experience.]
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <ChatSection
            messages={mealMessages}
            inputValue={mealInput}
            setInputValue={setMealInput}
            onSend={handleMealSend}
            isTyping={isMealTyping}
            placeholder="Ask about meals, carbs, or bolus calculations..."
          />
        </TabsContent>

        <TabsContent value="exercise" className="flex-1 flex flex-col min-h-0 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-primary" />
                Exercise Planner
              </CardTitle>
              <CardDescription>Plan your workout with before, during, and after recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exercise-type">Type of Exercise</Label>
                  <Select value={exerciseType} onValueChange={setExerciseType}>
                    <SelectTrigger id="exercise-type" data-testid="select-exercise-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cardio">Cardio (Running, Cycling)</SelectItem>
                      <SelectItem value="strength">Strength Training</SelectItem>
                      <SelectItem value="hiit">HIIT</SelectItem>
                      <SelectItem value="yoga">Yoga / Stretching</SelectItem>
                      <SelectItem value="walking">Walking</SelectItem>
                      <SelectItem value="sports">Team Sports</SelectItem>
                      <SelectItem value="swimming">Swimming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exercise-duration">Duration</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="exercise-duration"
                      type="number"
                      placeholder="e.g., 45"
                      value={exerciseDuration}
                      onChange={(e) => setExerciseDuration(e.target.value)}
                      data-testid="input-exercise-duration"
                    />
                    <span className="text-muted-foreground text-sm">mins</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exercise-intensity">Intensity</Label>
                  <Select value={exerciseIntensity} onValueChange={setExerciseIntensity}>
                    <SelectTrigger id="exercise-intensity" data-testid="select-exercise-intensity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="intense">Intense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exercise-timing">Starting in...</Label>
                  <Select value={sessionTimingFromNow} onValueChange={setSessionTimingFromNow}>
                    <SelectTrigger id="exercise-timing" data-testid="select-exercise-timing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-primary/5 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Complete Workout Plan</p>
                    <p className="text-muted-foreground">Get recommendations for what to eat before, during, and after your workout, plus adjusted insulin guidance.</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleQuickExercisePlan} disabled={!exerciseDuration} className="w-full" data-testid="button-get-exercise-advice">
                Plan My Workout
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 bg-transparent shadow-none">
            <Collapsible open={showExerciseGuide} onOpenChange={setShowExerciseGuide}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto" data-testid="button-exercise-guide">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Exercise Type Guide</span>
                  </div>
                  {showExerciseGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <ScrollArea className="h-72">
                  <div className="max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm bg-transparent p-0 text-foreground">
                      {generateExerciseTypeGuide(bgUnits)}
                    </pre>
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground mt-4">
                  Not medical advice. Everyone responds differently to exercise.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <ChatSection
            messages={exerciseMessages}
            inputValue={exerciseInput}
            setInputValue={setExerciseInput}
            onSend={handleExerciseSend}
            isTyping={isExerciseTyping}
            placeholder="Ask about exercise, blood sugar, or preparation tips..."
          />
        </TabsContent>

        <TabsContent value="routines" className="flex-1 flex flex-col min-h-0 overflow-auto">
          <RoutinesContent />
        </TabsContent>

        <TabsContent value="tools" className="flex-1 flex flex-col min-h-0 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Droplet className="h-5 w-5 text-red-500" />
                Hypo Treatment Calculator
              </CardTitle>
              <CardDescription>Calculate exactly how much fast-acting glucose you need</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Instead of always eating 15g carbs, this calculator helps you treat hypos more precisely 
                  based on your current reading and target - helping avoid over-treating and rebounding high.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="current-bg">Current BG ({bgUnits})</Label>
                  <Input
                    id="current-bg"
                    type="number"
                    step="0.1"
                    placeholder={bgUnits === "mmol/L" ? "e.g., 3.2" : "e.g., 58"}
                    value={currentBg}
                    onChange={(e) => setCurrentBg(e.target.value)}
                    data-testid="input-current-bg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-bg">Target BG ({bgUnits})</Label>
                  <Input
                    id="target-bg"
                    type="number"
                    step="0.1"
                    placeholder={bgUnits === "mmol/L" ? "e.g., 5.5" : "e.g., 100"}
                    value={targetBg}
                    onChange={(e) => setTargetBg(e.target.value)}
                    data-testid="input-target-bg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-weight">Your weight (kg, optional)</Label>
                  <Input
                    id="user-weight"
                    type="number"
                    placeholder="e.g., 70"
                    value={userWeight}
                    onChange={(e) => setUserWeight(e.target.value)}
                    data-testid="input-user-weight"
                  />
                </div>
              </div>

              <Button onClick={calculateHypoTreatment} disabled={!currentBg || !targetBg} className="w-full" data-testid="button-calculate-hypo">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Treatment
              </Button>

              {hypoResult && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-red-800 dark:text-red-200">
                    <Droplet className="h-4 w-4" />
                    You need approximately:
                  </h4>
                  
                  <div className="text-center p-4 bg-white dark:bg-red-900/30 rounded-lg">
                    <p className="text-4xl font-bold text-red-600 dark:text-red-400">{hypoResult.carbsNeeded}g</p>
                    <p className="text-sm text-red-700 dark:text-red-300">fast-acting carbs</p>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <p className="font-medium text-red-800 dark:text-red-200">That's about:</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="p-2 bg-white dark:bg-red-900/30 rounded text-center">
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.glucoseTablets}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">glucose tablets</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-red-900/30 rounded text-center">
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.juiceMl}ml</p>
                        <p className="text-xs text-red-600 dark:text-red-400">fruit juice</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-red-900/30 rounded text-center">
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">{hypoResult.jellyBabies}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">jelly babies</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    <strong>Remember:</strong> Wait 15 minutes, then recheck. If still low, treat again.
                  </div>
                </div>
              )}

              {parseFloat(currentBg) > 0 && parseFloat(targetBg) > 0 && parseFloat(currentBg) >= parseFloat(targetBg) && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Your current BG is already at or above your target - no treatment needed!
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                [Not medical advice. Individual responses vary. If in doubt, use the standard 15g rule. 
                For severe hypos or if you're unable to swallow, use glucagon and call for help.]
              </p>
            </CardContent>
          </Card>

          <Card className="p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">Quick Reference - Standard Hypo Treatment</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Mild hypo (3.5-3.9 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 10-15g fast carbs</li>
                  <li><strong>Moderate hypo (2.8-3.4 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 15-20g fast carbs</li>
                  <li><strong>Severe hypo (&lt;2.8 {bgUnits === "mmol/L" ? "mmol/L" : "mg/dL"}):</strong> 20-25g fast carbs, may need help</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Always follow up with a slower-acting snack if your next meal is more than 1-2 hours away.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
