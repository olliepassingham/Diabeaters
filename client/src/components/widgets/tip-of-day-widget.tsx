import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw } from "lucide-react";
import { storage } from "@/lib/storage";

interface Tip {
  text: string;
  category: "supplies" | "food" | "exercise" | "daily" | "mental";
  tags?: string[];
}

const TIPS: Tip[] = [
  { text: "Rotate your injection sites regularly — using the same spot can cause hard lumps under the skin that affect insulin absorption.", category: "supplies", tags: ["injection"] },
  { text: "Store opened insulin at room temperature — cold insulin from the fridge can sting more when injecting.", category: "supplies" },
  { text: "Keep a spare set of supplies in your bag, car, or at work — you never know when you might need them.", category: "supplies" },
  { text: "Check your CGM sensor adhesion daily — a loose sensor gives unreliable readings.", category: "supplies", tags: ["cgm"] },
  { text: "Set a reminder to reorder supplies a week before they run out — don't leave it until the last minute.", category: "supplies" },
  { text: "Always check your insulin hasn't expired — expired insulin can be much less effective.", category: "supplies" },
  { text: "Keep insulin away from direct sunlight and extreme heat — it can lose potency quickly.", category: "supplies" },
  { text: "Carry a backup pen or syringe even if you use a pump — technology can fail at the worst times.", category: "supplies", tags: ["pump"] },

  { text: "Weigh your food when you can — eyeballing portions often leads to underestimating carbs.", category: "food" },
  { text: "High-fat meals like pizza can cause a delayed blood sugar rise — consider splitting your dose.", category: "food" },
  { text: "Protein in large amounts can also raise blood sugar, just more slowly than carbs.", category: "food" },
  { text: "Keep a list of your most common meals and their carb counts — it saves time and improves accuracy.", category: "food" },
  { text: "Fibre doesn't raise blood sugar — in some countries you subtract it from total carbs to get 'net carbs'.", category: "food" },
  { text: "Liquid carbs like juice and regular fizzy drinks hit your bloodstream very fast — useful for hypos, tricky for meals.", category: "food" },
  { text: "If you're unsure about the carbs in a meal, it's usually safer to slightly underestimate your dose and correct later.", category: "food" },
  { text: "Eating at consistent times can make blood sugar patterns easier to spot and manage.", category: "food" },

  { text: "Check your blood sugar before exercise — starting below 7 mmol/L may mean you need a snack first.", category: "exercise" },
  { text: "Resistance training can sometimes raise blood sugar temporarily — don't panic, it usually settles.", category: "exercise" },
  { text: "Keep fast-acting glucose within arm's reach during any workout.", category: "exercise" },
  { text: "A short walk after meals can help reduce post-meal blood sugar spikes.", category: "exercise" },
  { text: "Exercise can increase insulin sensitivity for up to 24 hours — watch for delayed hypos, especially overnight.", category: "exercise" },
  { text: "Swimming and water sports can mask hypo symptoms — check more frequently around water.", category: "exercise" },
  { text: "Morning exercise tends to raise blood sugar less than afternoon sessions for many people — experiment to find your pattern.", category: "exercise" },

  { text: "Stress and illness can raise blood sugar even without eating — monitor more frequently on tough days.", category: "daily" },
  { text: "Alcohol can cause delayed hypos — check your blood sugar before bed after drinking.", category: "daily" },
  { text: "Heat can speed up insulin absorption — be mindful on hot days or after hot baths.", category: "daily" },
  { text: "Always carry medical ID — it speaks for you if you can't.", category: "daily" },
  { text: "Tell someone you trust how to use glucagon — it could save your life.", category: "daily" },
  { text: "Flying across time zones? Adjust your long-acting insulin timing gradually — ask your diabetes team for a plan.", category: "daily", tags: ["travel"] },
  { text: "Keep glucose tablets or sweets in every coat pocket and bag — hypos don't wait for convenience.", category: "daily" },
  { text: "If you're unwell, never stop taking your basal insulin — even if you're not eating. Contact your team if unsure.", category: "daily" },
  { text: "Hormones, sleep, and even the weather can affect blood sugar — some days there's no obvious reason for a high or low.", category: "daily" },
  { text: "When driving, always check your blood sugar before setting off and keep hypo treatment in the car.", category: "daily" },

  { text: "Diabetes burnout is real — it's okay to have days where you do the minimum. Just don't stop completely.", category: "mental" },
  { text: "You don't need perfect numbers to be doing a good job — aim for progress, not perfection.", category: "mental" },
  { text: "Talking to others with Type 1 can help — you're not the only one dealing with this.", category: "mental" },
  { text: "It's okay to feel frustrated by diabetes — acknowledging it is the first step to managing it.", category: "mental" },
  { text: "Celebrate the small wins — a good day in range, remembering supplies, or trying a new meal. They all count.", category: "mental" },
  { text: "Ask for help when you need it — from your diabetes team, family, or fellow Type 1s. Nobody manages this alone.", category: "mental" },
];

const CATEGORY_LABELS: Record<string, string> = {
  supplies: "Supplies",
  food: "Food & Carbs",
  exercise: "Exercise",
  daily: "Daily Life",
  mental: "Wellbeing",
};

function getTipIndex(date: Date): number {
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  return daysSinceEpoch % TIPS.length;
}

export function TipOfDayWidget({ compact = false }: { compact?: boolean }) {
  const [tipIndex, setTipIndex] = useState(() => getTipIndex(new Date()));
  const [showRandom, setShowRandom] = useState(false);

  const tip = TIPS[tipIndex];

  const handleShuffle = () => {
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * TIPS.length);
    } while (newIndex === tipIndex && TIPS.length > 1);
    setTipIndex(newIndex);
    setShowRandom(true);
  };

  const handleResetToday = () => {
    setTipIndex(getTipIndex(new Date()));
    setShowRandom(false);
  };

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-tip-of-day">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Tip of the Day</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={showRandom ? handleResetToday : handleShuffle}
            title={showRandom ? "Back to today's tip" : "Show another tip"}
            data-testid="button-shuffle-tip"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className={`text-sm leading-relaxed ${compact ? "line-clamp-4" : ""}`} data-testid="text-tip-content">
          {tip.text}
        </p>
        <p className="text-xs text-muted-foreground mt-2" data-testid="text-tip-category">
          {CATEGORY_LABELS[tip.category] || tip.category}
        </p>
      </CardContent>
    </Card>
  );
}
