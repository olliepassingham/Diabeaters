import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Utensils, Dumbbell, Calculator, AlertCircle, Bot, User, BookOpen, ArrowLeft } from "lucide-react";
import { storage, UserSettings } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";

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

function generateExerciseAdvice(duration: number, intensity: string, settings: UserSettings, bgUnits: string = "mmol/L"): string {
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

  // Use appropriate BG values based on user's units
  const idealLow = bgUnits === "mmol/L" ? "6.7" : "120";
  const idealHigh = bgUnits === "mmol/L" ? "10.0" : "180";
  const lowThreshold = bgUnits === "mmol/L" ? "5.6" : "100";
  const hypoThreshold = bgUnits === "mmol/L" ? "4.0" : "70";

  return `For ${duration} minutes of ${intensity} exercise:\n\n` +
    `**Before Exercise:**\n` +
    `- Ideal starting BG: ${idealLow}-${idealHigh} ${bgUnits}\n` +
    `- If below ${lowThreshold} ${bgUnits}: eat ${carbsNeeded}g of fast-acting carbs\n` +
    `- Consider reducing bolus by ${insulinReduction} for meal within 2 hours before\n\n` +
    `**During Exercise:**\n` +
    `- Carry fast-acting glucose (15-20g)\n` +
    `- Check BG every 30-45 minutes for longer sessions\n` +
    `- If BG drops below ${hypoThreshold} ${bgUnits}, stop and treat\n\n` +
    `**After Exercise:**\n` +
    `- Monitor for delayed lows (up to 24 hours later)\n` +
    `- Consider reduced basal/bolus for next meal\n` +
    `- Stay hydrated\n\n` +
    `⚠️ Not medical advice. Individual responses to exercise vary significantly. Track your patterns.`;
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
5. Have your phone accessible for emergencies

⚠️ Not medical advice. Everyone responds differently to exercise. Track your patterns and work with your healthcare team.`;
}

function generateRatioAdvice(settings: UserSettings, bgUnits: string = "mmol/L"): string {
  if (settings.tdd) {
    const estimated500Rule = Math.round(500 / settings.tdd);
    // Use 100 rule for mmol/L, 1800 rule for mg/dL
    const correctionRule = bgUnits === "mmol/L" ? 100 : 1800;
    const estimatedCorrectionFactor = Math.round(correctionRule / settings.tdd * 10) / 10;
    const ruleName = bgUnits === "mmol/L" ? "100 Rule" : "1800 Rule";

    return `Based on your Total Daily Dose of ${settings.tdd} units:\n\n` +
      `**Estimated Carb Ratio (500 Rule):**\n` +
      `1:${estimated500Rule} (1 unit covers ${estimated500Rule}g of carbs)\n\n` +
      `**Estimated Correction Factor (${ruleName}):**\n` +
      `1:${estimatedCorrectionFactor} (1 unit lowers BG by ${estimatedCorrectionFactor} ${bgUnits})\n\n` +
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

  const ruleName = bgUnits === "mmol/L" ? "100 Rule" : "1800 Rule";
  const ruleNum = bgUnits === "mmol/L" ? "100" : "1800";
  const exampleResult = bgUnits === "mmol/L" ? "2.5" : "45";

  return `To calculate insulin ratios, I need your Total Daily Dose (TDD).\n\n` +
    `Please go to Settings and enter your TDD for ratio calculations.\n\n` +
    `**Common Rules of Thumb:**\n` +
    `- 500 Rule: 500 ÷ TDD = grams of carbs covered by 1 unit\n` +
    `- ${ruleName}: ${ruleNum} ÷ TDD = ${bgUnits} drop per 1 unit (correction)\n\n` +
    `Example: If TDD is 40 units:\n` +
    `- Carb ratio: 500 ÷ 40 = 1:12.5 (round to 1:12)\n` +
    `- Correction: ${ruleNum} ÷ 40 = ${exampleResult} ${bgUnits} per unit`;
}

function processUserMessage(message: string, settings: UserSettings, bgUnits: string = "mmol/L"): string {
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

  if (lowerMessage.includes("exercise guide") || lowerMessage.includes("types of exercise") || lowerMessage.includes("exercise types") || 
      lowerMessage.includes("different exercises") || lowerMessage.includes("how do different") ||
      (lowerMessage.includes("how does") && lowerMessage.includes("affect") && (lowerMessage.includes("blood sugar") || lowerMessage.includes("glucose"))) ||
      lowerMessage.includes("compare exercises") || lowerMessage.includes("which exercise")) {
    return generateExerciseTypeGuide(bgUnits);
  }

  if (lowerMessage.includes("exercise") || lowerMessage.includes("workout") || lowerMessage.includes("activity") || lowerMessage.includes("run") || lowerMessage.includes("gym")) {
    const durationMatch = message.match(/(\d+)\s*(?:min|minute|hr|hour)/i);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 45;
    const intensity = lowerMessage.includes("intense") || lowerMessage.includes("hard") ? "intense" :
                      lowerMessage.includes("light") || lowerMessage.includes("easy") ? "light" : "moderate";
    return generateExerciseAdvice(duration, intensity, settings, bgUnits);
  }

  if (lowerMessage.includes("ratio") || lowerMessage.includes("calculate") || lowerMessage.includes("correction") || lowerMessage.includes("icr")) {
    return generateRatioAdvice(settings, bgUnits);
  }

  // Use appropriate BG values based on user's units
  const hypoThreshold = bgUnits === "mmol/L" ? "4.0 mmol/L" : "70 mg/dL";
  
  if (lowerMessage.includes("low") || lowerMessage.includes("hypo")) {
    return `**For Low Blood Sugar (Hypoglycemia):**\n\n` +
      `If BG is below ${hypoThreshold}, follow the Rule of 15:\n` +
      `1. Consume 15g of fast-acting carbs (4 glucose tablets, 4oz juice, regular soda)\n` +
      `2. Wait 15 minutes\n` +
      `3. Recheck blood glucose\n` +
      `4. If still below ${hypoThreshold}, repeat\n` +
      `5. Once normal, eat a snack with protein\n\n` +
      `**Warning Signs:** Shakiness, sweating, confusion, fast heartbeat\n\n` +
      `⚠️ If you cannot treat yourself or are losing consciousness, this is an emergency. ` +
      `Have someone call 999 and administer glucagon if available.\n\n` +
      `Go to Help Now for emergency information.`;
  }

  if (lowerMessage.includes("high") || lowerMessage.includes("hyper")) {
    const ketoneThreshold = bgUnits === "mmol/L" ? "13.9 mmol/L" : "250 mg/dL";
    const correctionInfo = settings.correctionFactor 
      ? `Your correction factor is 1:${settings.correctionFactor} (1 unit lowers BG by ${settings.correctionFactor} ${bgUnits})`
      : `Set your correction factor in Settings for personalised advice`;

    return `**For High Blood Sugar (Hyperglycemia):**\n\n` +
      `${correctionInfo}\n\n` +
      `**General Steps:**\n` +
      `1. Check for ketones if BG > ${ketoneThreshold}\n` +
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
  const [profile, setProfile] = useState<{ bgUnits?: string; carbUnits?: string }>({});
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
  
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [exerciseDuration, setExerciseDuration] = useState("");
  const [exerciseIntensity, setExerciseIntensity] = useState("moderate");
  const [exerciseType, setExerciseType] = useState("cardio");

  useEffect(() => {
    setSettings(storage.getSettings());
    setProfile(storage.getProfile() || {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const quickActions = [
    { icon: Utensils, label: "Plan Meal", action: "meal_dialog" },
    { icon: Dumbbell, label: "Before Exercise", action: "exercise_dialog" },
    { icon: BookOpen, label: "Exercise Guide", action: "exercise_guide" },
    { icon: Calculator, label: "Calculate Ratio", action: "calculate_ratio" },
  ];

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsTyping(true);

    // Determine activity type from message content
    const lowerMessage = currentInput.toLowerCase();
    let activityType = "general";
    if (lowerMessage.includes("exercise") || lowerMessage.includes("run") || lowerMessage.includes("walk") || lowerMessage.includes("gym") || lowerMessage.includes("sport")) {
      activityType = "exercise";
    } else if (lowerMessage.includes("eat") || lowerMessage.includes("meal") || lowerMessage.includes("carb") || lowerMessage.includes("food") || lowerMessage.includes("breakfast") || lowerMessage.includes("lunch") || lowerMessage.includes("dinner")) {
      activityType = "meal";
    } else if (lowerMessage.includes("ratio") || lowerMessage.includes("calculate") || lowerMessage.includes("tdd")) {
      activityType = "calculation";
    }

    try {
      // Try the AI API first for activity-related queries
      // Send user's local storage data for personalized responses
      const userProfile = storage.getProfile();
      const userSettings = storage.getSettings();
      
      const response = await fetch("/api/activity/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType,
          activityDetails: currentInput,
          userProfile,
          userSettings,
        }),
      });

      let aiResponse: string;
      
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.recommendation + "\n\n⚠️ Not medical advice. Always verify with your own calculations.";
      } else {
        // Fall back to local processing if API unavailable
        aiResponse = processUserMessage(currentInput, settings, profile.bgUnits || "mmol/L");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      storage.addActivityLog({
        activityType: "advisor_chat",
        activityDetails: currentInput,
        recommendation: aiResponse.substring(0, 200),
      });
    } catch (error) {
      // Fall back to local processing on error
      const localResponse = processUserMessage(currentInput, settings, profile.bgUnits || "mmol/L");
      
      const assistantMessage: Message = {
        role: "assistant",
        content: localResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      storage.addActivityLog({
        activityType: "advisor_chat",
        activityDetails: currentInput,
        recommendation: localResponse.substring(0, 200),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "meal_dialog":
        setMealCarbs("");
        setMealType("lunch");
        setMealDialogOpen(true);
        break;
      case "exercise_dialog":
        setExerciseDuration("");
        setExerciseIntensity("moderate");
        setExerciseType("cardio");
        setExerciseDialogOpen(true);
        break;
      case "exercise_guide":
        sendMessage("Show me how different types of exercise affect blood sugar");
        break;
      case "calculate_ratio":
        sendMessage("Help me calculate my insulin-to-carb ratio");
        break;
    }
  };

  const sendMessage = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    const lowerMessage = message.toLowerCase();
    let activityType = "general";
    if (lowerMessage.includes("exercise") || lowerMessage.includes("run") || lowerMessage.includes("walk") || lowerMessage.includes("gym") || lowerMessage.includes("sport")) {
      activityType = "exercise";
    } else if (lowerMessage.includes("eat") || lowerMessage.includes("meal") || lowerMessage.includes("carb") || lowerMessage.includes("food")) {
      activityType = "meal";
    } else if (lowerMessage.includes("ratio") || lowerMessage.includes("calculate")) {
      activityType = "calculation";
    }

    try {
      const userProfile = storage.getProfile();
      const userSettings = storage.getSettings();
      
      const response = await fetch("/api/activity/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType,
          activityDetails: message,
          userProfile,
          userSettings,
        }),
      });

      let aiResponse: string;
      
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.recommendation + "\n\n⚠️ Not medical advice. Always verify with your own calculations.";
      } else {
        aiResponse = processUserMessage(message, settings, profile.bgUnits || "mmol/L");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      storage.addActivityLog({
        activityType: "advisor_chat",
        activityDetails: message,
        recommendation: aiResponse.substring(0, 200),
      });
    } catch (error) {
      const localResponse = processUserMessage(message, settings, profile.bgUnits || "mmol/L");
      
      const assistantMessage: Message = {
        role: "assistant",
        content: localResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      storage.addActivityLog({
        activityType: "advisor_chat",
        activityDetails: message,
        recommendation: localResponse.substring(0, 200),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleMealSubmit = () => {
    if (!mealCarbs) return;
    const message = `I'm planning to eat ${mealCarbs}g carbs for ${mealType}. What should my insulin dose be?`;
    setMealDialogOpen(false);
    sendMessage(message);
  };

  const handleExerciseSubmit = () => {
    if (!exerciseDuration) return;
    const message = `I'm planning to do ${exerciseType} exercise for ${exerciseDuration} minutes at ${exerciseIntensity} intensity. How should I prepare?`;
    setExerciseDialogOpen(false);
    sendMessage(message);
  };

  const handleStartNew = () => {
    setMessages([{
      role: "assistant",
      content: "Hello! I'm your AI diabetes advisor. I can help you with:\n\n" +
        "• Meal planning and bolus calculations\n" +
        "• Exercise recommendations\n" +
        "• Insulin ratio calculations\n" +
        "• Managing highs and lows\n\n" +
        "How can I assist you today?\n\n" +
        "⚠️ Remember: All suggestions are educational only and not medical advice.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setInputValue("");
  };

  return (
    <div className="flex flex-col h-full relative">
      <FaceLogoWatermark />
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

      {messages.length > 1 && (
        <div className="mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleStartNew}
            data-testid="button-start-new"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Start New Conversation
          </Button>
        </div>
      )}

      {messages.length === 1 && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Card
                key={action.label}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => handleQuickAction(action.action)}
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

      <Dialog open={mealDialogOpen} onOpenChange={setMealDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Plan Your Meal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="meal-carbs">How many carbs will you eat?</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="meal-carbs"
                  type="number"
                  placeholder="e.g., 60"
                  value={mealCarbs}
                  onChange={(e) => setMealCarbs(e.target.value)}
                  data-testid="input-meal-carbs"
                />
                <span className="text-muted-foreground">grams</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-type">What meal is this?</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger id="meal-type" data-testid="select-meal-type">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setMealDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMealSubmit} disabled={!mealCarbs} data-testid="button-get-meal-advice">
              Get Advice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              Plan Your Exercise
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exercise-type">What type of exercise?</Label>
              <Select value={exerciseType} onValueChange={setExerciseType}>
                <SelectTrigger id="exercise-type" data-testid="select-exercise-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cardio">Cardio (Running, Cycling, Swimming)</SelectItem>
                  <SelectItem value="strength">Strength Training (Weights)</SelectItem>
                  <SelectItem value="hiit">HIIT (High Intensity Intervals)</SelectItem>
                  <SelectItem value="yoga">Yoga / Stretching</SelectItem>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="sports">Team Sports (Football, Basketball)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-duration">How long will you exercise?</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="exercise-duration"
                  type="number"
                  placeholder="e.g., 45"
                  value={exerciseDuration}
                  onChange={(e) => setExerciseDuration(e.target.value)}
                  data-testid="input-exercise-duration"
                />
                <span className="text-muted-foreground">minutes</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-intensity">How intense will it be?</Label>
              <Select value={exerciseIntensity} onValueChange={setExerciseIntensity}>
                <SelectTrigger id="exercise-intensity" data-testid="select-exercise-intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light (can easily hold a conversation)</SelectItem>
                  <SelectItem value="moderate">Moderate (slightly breathless)</SelectItem>
                  <SelectItem value="intense">Intense (hard to talk)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExerciseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExerciseSubmit} disabled={!exerciseDuration} data-testid="button-get-exercise-advice">
              Get Advice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
