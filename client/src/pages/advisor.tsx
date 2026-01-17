import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Utensils, Dumbbell, AlertCircle, Bot, User, Info, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { storage, UserSettings, UserProfile } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
        return `Based on your settings, for ${carbs}g of carbs at ${mealType}:\n\n` +
          `Suggested bolus: ${insulinUnits} units\n\n` +
          `This calculation uses your ${mealType} ratio of ${ratio || "estimated from TDD"}.\n\n` +
          `Remember to also consider:\n` +
          `- Your current blood glucose level (add correction if needed)\n` +
          `- Recent or planned physical activity\n` +
          `- Time of day and your typical patterns\n\n` +
          `[Not medical advice. Always verify with your own calculations.]`;
      }

      return `To calculate your meal bolus, I need your carb ratios.\n\n` +
        `Please go to Settings and add your carb-to-insulin ratios for more accurate recommendations.\n\n` +
        `In the meantime, here are some general tips for ${carbs}g of carbs:\n` +
        `- Check your blood glucose before eating\n` +
        `- Consider the glycemic index of your food\n` +
        `- Monitor your levels 2 hours after eating`;
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
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">500 Rule (Carb Ratio)</p>
            <p>500 ÷ TDD = grams of carbs covered by 1 unit</p>
            {settings.tdd && (
              <p className="text-primary">Your estimate: 500 ÷ {settings.tdd} = 1:{Math.round(500 / settings.tdd)}</p>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">{ruleName} (Correction Factor)</p>
            <p>{correctionRule} ÷ TDD = {bgUnits} drop per 1 unit</p>
            {settings.tdd && (
              <p className="text-primary">Your estimate: {correctionRule} ÷ {settings.tdd} = {Math.round(correctionRule / settings.tdd * 10) / 10} {bgUnits}</p>
            )}
          </div>
          <div className="text-xs bg-muted p-2 rounded">
            <p><strong>Example:</strong> If TDD is 40 units:</p>
            <p>• Carb ratio: 500 ÷ 40 = 1:12.5 (round to 1:12)</p>
            <p>• Correction: {correctionRule} ÷ 40 = {exampleResult} {bgUnits} per unit</p>
          </div>
          <p className="text-xs text-muted-foreground italic">Note: These are starting estimates. Work with your healthcare team to fine-tune.</p>
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

export default function Advisor() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [activeTab, setActiveTab] = useState("meal");
  
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
      content: "Hi! I'm here to help you prepare for exercise. Tell me what you're planning (e.g., \"45 minutes of moderate running\") and I'll give you recommendations for before, during, and after.\n\n[Not medical advice. Individual responses to exercise vary.]",
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

  const sendMealMessage = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMealMessages(prev => [...prev, userMessage]);
    setIsMealTyping(true);

    let aiResponse: string;

    try {
      const userProfile = storage.getProfile();
      const userSettings = storage.getSettings();
      
      const response = await fetch("/api/activity/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "meal",
          activityDetails: message,
          userProfile,
          userSettings,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.recommendation + "\n\n[Not medical advice. Always verify with your own calculations.]";
      } else {
        // API unavailable or error - use local processing
        aiResponse = processUserMessage(message, settings, bgUnits, "meal");
      }
    } catch {
      // Network error or other failure - use local processing
      aiResponse = processUserMessage(message, settings, bgUnits, "meal");
    }

    setMealMessages(prev => [...prev, {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

    try {
      const userProfile = storage.getProfile();
      const userSettings = storage.getSettings();
      
      const response = await fetch("/api/activity/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "exercise",
          activityDetails: message,
          userProfile,
          userSettings,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.recommendation + "\n\n[Not medical advice. Individual responses to exercise vary.]";
      } else {
        // API unavailable or error - use local processing
        aiResponse = processUserMessage(message, settings, bgUnits, "exercise");
      }
    } catch {
      // Network error or other failure - use local processing
      aiResponse = processUserMessage(message, settings, bgUnits, "exercise");
    }

    setExerciseMessages(prev => [...prev, {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    const message = `I'm planning to eat ${carbValue}g carbs for ${mealTime}. What should my insulin dose be?`;
    sendMealMessage(message);
    setMealCarbs("");
  };

  const handleQuickExercisePlan = () => {
    if (!exerciseDuration) return;
    const message = `I'm planning to do ${exerciseType} exercise for ${exerciseDuration} minutes at ${exerciseIntensity} intensity. How should I prepare?`;
    sendExerciseMessage(message);
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
      <div className="mb-4">
        <h1 className="text-3xl font-semibold">AI Activity Advisor</h1>
        <p className="text-muted-foreground mt-1">Get personalized recommendations for meals and exercise.</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="meal" className="gap-2" data-testid="tab-meal">
            <Utensils className="h-4 w-4" />Plan Meal
          </TabsTrigger>
          <TabsTrigger value="exercise" className="gap-2" data-testid="tab-exercise">
            <Dumbbell className="h-4 w-4" />Exercise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meal" className="flex-1 flex flex-col min-h-0 mt-0 space-y-4">
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
                  <Label htmlFor="meal-carbs">How many carbs?</Label>
                  <div className="flex gap-2">
                    <Input
                      id="meal-carbs"
                      type="number"
                      placeholder={carbUnit === "cp" ? "e.g., 6" : "e.g., 60"}
                      value={mealCarbs}
                      onChange={(e) => setMealCarbs(e.target.value)}
                      data-testid="input-meal-carbs"
                    />
                    <Select value={carbUnit} onValueChange={(v: "grams" | "cp") => setCarbUnit(v)}>
                      <SelectTrigger className="w-28" data-testid="select-carb-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grams">grams</SelectItem>
                        <SelectItem value="cp">CP (10g)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

          <ChatSection
            messages={mealMessages}
            inputValue={mealInput}
            setInputValue={setMealInput}
            onSend={handleMealSend}
            isTyping={isMealTyping}
            placeholder="Ask about meals, carbs, or bolus calculations..."
          />
        </TabsContent>

        <TabsContent value="exercise" className="flex-1 flex flex-col min-h-0 mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-primary" />
                Exercise Planner
              </CardTitle>
              <CardDescription>Plan your workout and get preparation tips</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
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
              </div>

              <Button onClick={handleQuickExercisePlan} disabled={!exerciseDuration} className="w-full" data-testid="button-get-exercise-advice">
                Get Exercise Recommendations
              </Button>
            </CardContent>
          </Card>

          <Collapsible open={showExerciseGuide} onOpenChange={setShowExerciseGuide}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate rounded-lg">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Exercise Type Guide</CardTitle>
                    </div>
                    {showExerciseGuide ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                  <CardDescription>Learn how different exercises affect blood sugar</CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm bg-transparent p-0">
                        {generateExerciseTypeGuide(bgUnits)}
                      </pre>
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-4">
                    Not medical advice. Everyone responds differently to exercise. Track your patterns and work with your healthcare team.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <ChatSection
            messages={exerciseMessages}
            inputValue={exerciseInput}
            setInputValue={setExerciseInput}
            onSend={handleExerciseSend}
            isTyping={isExerciseTyping}
            placeholder="Ask about exercise, blood sugar, or preparation tips..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
