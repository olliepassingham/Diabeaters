import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTooltipProps {
  term: string;
  explanation: string;
  example?: string;
}

export function InfoTooltip({ term, explanation, example }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          type="button" 
          className="inline-flex items-center justify-center w-4 h-4 ml-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Learn more about ${term}`}
          data-testid={`button-info-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3" side="top">
        <div className="space-y-1.5">
          <p className="font-medium text-sm">{term}</p>
          <p className="text-xs text-muted-foreground">{explanation}</p>
          {example && (
            <p className="text-xs text-primary/80 italic">Example: {example}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export const DIABETES_TERMS = {
  tdd: {
    term: "Total Daily Dose",
    explanation: "The total amount of insulin you use in a typical day, including both mealtime and background insulin. This helps calculate other settings.",
    example: "If you take 20 units of background insulin and about 25 units for meals, your total daily dose is roughly 45 units.",
  },
  correctionFactor: {
    term: "Correction Factor",
    explanation: "How much 1 unit of insulin lowers your blood sugar. Everyone's body responds differently to insulin.",
    example: "If your correction factor is 2.5 mmol/L, taking 1 unit of insulin will lower your blood sugar by about 2.5 mmol/L.",
  },
  carbRatio: {
    term: "Carb Ratio",
    explanation: "How many grams of carbohydrates 1 unit of insulin covers. This helps you work out how much insulin to take for meals.",
    example: "A ratio of 1:10 means 1 unit of insulin covers 10 grams of carbs. For 30g of carbs, you'd take 3 units.",
  },
  bolus: {
    term: "Bolus (Mealtime Dose)",
    explanation: "The insulin you take to cover the food you're eating. It's sometimes called a 'mealtime dose' or 'fast-acting dose'.",
    example: "Before eating a meal with 40g of carbs, you might take a bolus of 4 units.",
  },
  basal: {
    term: "Basal (Background Insulin)",
    explanation: "The insulin that works in the background throughout the day and night, keeping your blood sugar steady between meals.",
    example: "You might take background insulin once or twice a day, or have it delivered continuously via a pump.",
  },
  targetRange: {
    term: "Target Range",
    explanation: "The blood sugar range you're aiming for. Your diabetes team will help you set this based on your individual needs.",
    example: "A common target range is 4-7 mmol/L before meals, but yours may be different.",
  },
  hypo: {
    term: "Hypo (Low Blood Sugar)",
    explanation: "When your blood sugar drops too low, usually below 4 mmol/L. You might feel shaky, sweaty, or confused.",
    example: "If you feel hypo symptoms, check your blood sugar and treat with fast-acting glucose if needed.",
  },
  ketones: {
    term: "Ketones",
    explanation: "Chemicals your body makes when it can't use glucose for energy, often due to not enough insulin. High ketones can be dangerous.",
    example: "Check for ketones when you're unwell or your blood sugar is very high (above 14 mmol/L).",
  },
  cgm: {
    term: "Continuous Glucose Monitor",
    explanation: "A small sensor worn on your body that checks your blood sugar every few minutes and shows the readings on a device or phone. Often called a CGM for short.",
    example: "A sensor typically lasts 7-14 days before needing to be replaced.",
  },
  iob: {
    term: "Insulin on Board",
    explanation: "The insulin still active in your body from previous doses. Fast-acting insulin typically works for 3-5 hours. Sometimes abbreviated as IOB.",
    example: "If you took 4 units 2 hours ago, you might still have about 2 units of insulin on board.",
  },
  shortActing: {
    term: "Short-Acting (Fast-Acting) Insulin",
    explanation: "The insulin you take at mealtimes to cover the food you eat. It starts working within 15 minutes and lasts a few hours. Sometimes called rapid-acting or bolus insulin.",
    example: "You might take 4 units of short-acting insulin before lunch to cover your meal.",
  },
  longActing: {
    term: "Long-Acting (Background) Insulin",
    explanation: "The insulin that works slowly over 12-24 hours to keep your blood sugar steady between meals and overnight. Sometimes called basal or background insulin.",
    example: "You might take 18 units of long-acting insulin at bedtime to keep your levels stable overnight.",
  },
  injectionsPerDay: {
    term: "Injections Per Day",
    explanation: "The total number of insulin injections you give yourself in a typical day, including both mealtime and background injections. This helps track your needle supply.",
    example: "If you inject background insulin once and mealtime insulin 3 times, that's 4 injections per day.",
  },
  cgmDuration: {
    term: "Sensor Duration",
    explanation: "How many days each glucose sensor lasts before you need to replace it with a new one. This varies by brand and model.",
    example: "FreeStyle Libre sensors last 14 days, Dexcom G7 sensors last 10 days.",
  },
} as const;
