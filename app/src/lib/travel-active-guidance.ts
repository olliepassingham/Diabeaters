/**
 * Active travel mode: trip profile chips, one-line daily focus, and Ask Beatie prompts.
 * Educational framing only — not dosing or medical advice.
 */

export type TravelTripStyle = "relax" | "active" | "city" | "remote" | "family" | "not_sure";

export type ActiveTravelPlanSlice = {
  destination: string;
  travelType: "domestic" | "international";
  timezoneChange: "none" | "minor" | "major";
  timezoneHours: number;
  timezoneDirection: "east" | "west" | "none";
  accessRisk: "easy" | "limited" | "unsure";
  weatherChange: "warmer" | "colder" | "similar" | "unknown";
  weatherSeverity: "slight" | "moderate" | "extreme";
  tripStyle?: TravelTripStyle;
};

export type ActiveTravelProgressInput = {
  plan: ActiveTravelPlanSlice;
  /** 1-based day while travelling; 0 before start. */
  dayNumber: number;
  totalDays: number;
  hasStarted: boolean;
  hasEnded: boolean;
  daysUntilStart: number;
  daysRemaining: number;
  isPumpUser: boolean;
};

export type TripProfileChip = { label: string };

const TRIP_STYLE_LABELS: Record<TravelTripStyle, string> = {
  relax: "Relaxing",
  active: "Active",
  city: "City break",
  remote: "Remote",
  family: "Family visit",
  not_sure: "General",
};

const TRIP_STYLE_FOCUS: Record<Exclude<TravelTripStyle, "not_sure">, string> = {
  relax: "Keep hypos cool; don't skip checks in the heat.",
  active: "Keep fast carbs handy between activity.",
  city: "Late meals are common — plan when to check.",
  remote: "Treat spares as essential, not optional.",
  family: "Agree a simple hypo plan with people you're with.",
};

const TRIP_STYLE_COACH_STEM: Record<Exclude<TravelTripStyle, "not_sure">, string> = {
  relax: "downtime, heat, and keeping a steady check routine",
  active: "activity, hypos, and recovery between sessions",
  city: "eating out, walking lots, and irregular mealtimes",
  remote: "limited shops, backups, and emergency access",
  family: "shared meals, routine changes, and telling people your hypo plan",
};

export function tripStyleLabel(style: TravelTripStyle | undefined): string | null {
  if (!style || style === "not_sure") return null;
  return TRIP_STYLE_LABELS[style];
}

function styleTodayFocus(plan: ActiveTravelPlanSlice): string | null {
  const style = plan.tripStyle;
  if (!style || style === "not_sure") return null;
  if (style === "remote" && (plan.accessRisk === "limited" || plan.accessRisk === "unsure")) {
    return null;
  }
  return TRIP_STYLE_FOCUS[style];
}

export function buildActiveTravelTripProfileChips(plan: ActiveTravelPlanSlice): TripProfileChip[] {
  const chips: TripProfileChip[] = [];

  const styleLabel = tripStyleLabel(plan.tripStyle);
  if (styleLabel) chips.push({ label: styleLabel });

  chips.push({
    label: plan.travelType === "international" ? "International" : "Domestic",
  });

  if (plan.timezoneChange !== "none" && plan.timezoneHours > 0) {
    const dir =
      plan.timezoneDirection === "east" ? "east" : plan.timezoneDirection === "west" ? "west" : "TZ";
    chips.push({ label: `${plan.timezoneHours}h ${dir}` });
  }

  if (plan.weatherChange === "warmer") chips.push({ label: "Warmer" });
  else if (plan.weatherChange === "colder") chips.push({ label: "Colder" });

  if (plan.accessRisk === "limited") chips.push({ label: "Limited pharmacies" });
  else if (plan.accessRisk === "unsure") chips.push({ label: "Pharmacies unsure" });

  return chips;
}

function timezonePhase(dayNumber: number): 1 | 2 | 3 {
  if (dayNumber <= 2) return 1;
  if (dayNumber <= 4) return 2;
  return 3;
}

/** One short line for the progress card — chips carry the rest. */
export function buildActiveTravelTodayFocus(input: ActiveTravelProgressInput): string {
  const { plan, dayNumber, hasStarted, hasEnded, daysUntilStart, isPumpUser } = input;

  if (hasEnded) return "Trip done — restock when you're home.";

  if (!hasStarted) {
    if (daysUntilStart <= 1) return "Final pack check today.";
    return "Work through your packing list.";
  }

  if (plan.timezoneChange !== "none" && plan.timezoneHours > 0) {
    const phase = timezonePhase(dayNumber);
    if (phase === 1) return isPumpUser ? "Extra checks while time zones settle." : "Extra checks; basal may stay on home time.";
    if (phase === 2) return "Shift meals and timing in small steps.";
    return "Aim for your local routine.";
  }

  if (plan.accessRisk === "limited" || plan.accessRisk === "unsure") {
    return "Keep full backups on you.";
  }

  if (plan.weatherChange === "colder") {
    return "Warm up meters/CGM before trusting readings.";
  }

  if (plan.weatherChange === "warmer") {
    return "Keep hypos cool and within reach.";
  }

  const styleFocus = styleTodayFocus(plan);
  if (styleFocus) return styleFocus;

  if (dayNumber <= 2) return "Decide where your kit lives on this trip.";
  return "Spares on you, not only at the hotel.";
}

export function buildActiveTravelCoachPrompt(input: ActiveTravelProgressInput): string {
  const { plan, dayNumber, totalDays, hasStarted, hasEnded, daysUntilStart } = input;
  const dest = plan.destination.trim();
  const chips = buildActiveTravelTripProfileChips(plan)
    .map((c) => c.label)
    .join(", ");
  const focus = buildActiveTravelTodayFocus(input);
  const style = plan.tripStyle;
  const styleLabel = tripStyleLabel(style);
  const styleStem =
    style && style !== "not_sure" ? TRIP_STYLE_COACH_STEM[style] : null;

  let tripPhase: string;
  if (hasEnded) tripPhase = "My trip has just ended.";
  else if (!hasStarted) {
    tripPhase =
      daysUntilStart <= 0
        ? "I'm travelling today."
        : `My trip starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}.`;
  } else {
    tripPhase = `I'm on day ${dayNumber} of ${totalDays}.`;
  }

  const question = styleStem
    ? `What should I keep in mind for ${styleStem}?`
    : "What else should I keep in mind today?";

  const parts = [
    tripPhase,
    dest ? `Destination: ${dest}.` : null,
    styleLabel ? `Trip type: ${styleLabel}.` : null,
    chips ? `Also: ${chips}.` : null,
    `Today's focus in the app: ${focus}`,
    question,
  ].filter(Boolean);

  return parts.join(" ").slice(0, 500);
}
