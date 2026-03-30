export type GlossaryTerm = {
  term: string;
  slug: string;
  short: string;
  definition: string;
};

/**
 * Type 1 diabetes glossary: app language plus common clinical terms.
 * Kept sorted alphabetically by `term` (A–Z lists rely on this order).
 */
export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "A1C (HbA1c)",
    slug: "a1c-hba1c",
    short: "Average glucose over roughly the last three months.",
    definition:
      "HbA1c (often called A1C) reflects how much glucose has been attached to haemoglobin over the past weeks. It complements finger checks and CGM because it shows longer-term exposure to highs, not moment-to-moment values. Your clinic sets a personal target; it is one part of how they review how type 1 management is going alongside hypos, quality of life, and time in range.",
  },
  {
    term: "Basal insulin",
    slug: "basal-insulin",
    short: "Background insulin between meals and overnight.",
    definition:
      "Basal insulin is the steady “background” insulin that tends to hold glucose stable when you are not eating. On multiple daily injections (MDI) it is usually a long-acting insulin; on a pump it is delivered as small amounts every few minutes (basal rate). Basal needs can change with illness, activity, hormones, and growth. Diabeaters may refer to basal when describing pump or MDI settings — always match changes to your written plan from your team.",
  },
  {
    term: "Blood glucose (BG)",
    slug: "blood-glucose",
    short: "Glucose level in your blood right now.",
    definition:
      "Blood glucose is the concentration of glucose in your bloodstream at the time of the check. Meters read capillary blood; CGM estimates glucose in interstitial fluid (see Sensor lag). The app may shorten this to “BG” on labels. Targets and correction rules are individual; use the units you chose in your profile (mmol/L or mg/dL).",
  },
  {
    term: "Bolus insulin",
    slug: "bolus-insulin",
    short: "Meal or correction insulin given for carbs or highs.",
    definition:
      "A bolus is a dose of rapid-acting insulin to cover carbohydrate at meals or snacks, to correct a high glucose, or both. Bolus calculators in tools like the adviser use your carb ratio, correction factor, active insulin settings, and the glucose you enter. Bolus timing (including pre-bolus) is something your team should coach you on — the app’s suggestions are educational and must not override their advice.",
  },
  {
    term: "Carbohydrate counting",
    slug: "carbohydrate-counting",
    short: "Estimating carbs in food to match insulin to meals.",
    definition:
      "Carbohydrate counting means estimating how many grams of carbohydrate you will eat so you can choose a bolus that fits. People use food labels, apps, scales, and experience. Protein and fat change how quickly glucose rises for some meals; your team may suggest different strategies for pizza, takeaways, or high-fat meals. Diabeaters calculators assume the carb values you enter are the best estimate you can make at the time.",
  },
  {
    term: "Carbohydrates (Carbs)",
    slug: "carbohydrates",
    short: "Nutrients that usually affect glucose after eating.",
    definition:
      "Carbohydrates include starches, sugars, and fibre (fibre is counted differently depending on local teaching). They usually have the largest impact on post-meal glucose in type 1 diabetes. “Carbs” appears throughout the app on meal forms, ratios, and exercise planning. Learning which foods are carb-heavy helps you plan checks and boluses with less guesswork.",
  },
  {
    term: "Carb ratio",
    slug: "carb-ratio",
    short: "How many grams of carb one unit of insulin covers.",
    definition:
      "The carb ratio (insulin-to-carb ratio, sometimes written I:C) says how many grams of carbohydrate are covered by one unit of rapid-acting insulin — for example 1 unit per 10 g. Ratios often differ by time of day. Diabeaters stores the ratios you enter in settings and uses them in meal bolus calculations. Only change ratios with your diabetes team’s guidance.",
  },
  {
    term: "CGM (Continuous glucose monitoring)",
    slug: "cgm",
    short: "Wearable sensor that streams glucose trends.",
    definition:
      "A CGM system uses a sensor under the skin to measure glucose in interstitial fluid and show trends, arrows, and alerts on a phone or receiver. It can help spot patterns and hypos, but readings can lag behind blood glucose during fast changes. The app may ask about CGM when explaining duration of insulin action or scenario checklists. Alarms and targets should be set with your clinic.",
  },
  {
    term: "Closed loop (Automated insulin delivery)",
    slug: "closed-loop",
    short: "Pump and CGM working together to adjust basal automatically.",
    definition:
      "Closed-loop systems (hybrid or full) use CGM data to adjust insulin delivery from a pump, sometimes suspending or increasing basal and offering correction suggestions. They still need user input for meals, exercise, and illness. Even with automation, you must understand hypos, bolusing, and when to take over manually. Diabeaters does not replace manufacturer training or your team’s pump settings.",
  },
  {
    term: "Correction dose",
    slug: "correction-dose",
    short: "Insulin to bring a high glucose down toward target.",
    definition:
      "A correction dose is rapid-acting insulin taken because glucose is above target, separate from food coverage. Tools combine correction with meal insulin when you enter both carbs and a high reading. Skipping correction when you are ill, ketotic, or following a sick-day plan may be appropriate — follow the plan you were given rather than the app alone.",
  },
  {
    term: "Correction factor",
    slug: "correction-factor",
    short: "How much one unit lowers your glucose (ISF / sensitivity factor).",
    definition:
      "The correction factor (insulin sensitivity factor, ISF) estimates how much one unit of rapid-acting insulin lowers your blood glucose — for example 1 unit per 3 mmol/L. It is used with your target range to suggest correction doses. Factors often vary by time of day. Diabeaters uses the values you save in settings; they must match what your team has prescribed.",
  },
  {
    term: "Dawn phenomenon",
    slug: "dawn-phenomenon",
    short: "Early-morning rise in glucose from hormones.",
    definition:
      "The dawn phenomenon is a rise in glucose in the early hours driven by hormones such as cortisol and growth hormone. It can look like too little basal overnight but must be distinguished from a rebound after a night hypo. Patterns on CGM or overnight checks help your team adjust basal timing or amounts. Scenario and bedtime wording in the app may mention morning trends in general terms only.",
  },
  {
    term: "Diabetic ketoacidosis (DKA)",
    slug: "dka",
    short: "Emergency state of high glucose, ketones, and acidosis.",
    definition:
      "DKA occurs when there is not enough insulin for the body’s needs, leading to high glucose, ketones, and acidic blood. It is a medical emergency with symptoms that can include thirst, vomiting, abdominal pain, rapid breathing, and confusion. Sick-day flows and education text in Diabeaters mention DKA so you know when to seek urgent help. Never delay care based on an app screen.",
  },
  {
    term: "Duration of insulin action (DIA)",
    slug: "duration-of-insulin-action",
    short: "How long bolus insulin keeps lowering glucose.",
    definition:
      "DIA is how long a bolus is assumed to keep working for IOB calculations — often around 3–5 hours for rapid-acting analogues, depending on your team’s teaching. If DIA is set too short, calculators may “forget” active insulin and suggest stacking; if too long, they may under-suggest food boluses. Diabeaters may expose DIA in settings where your profile stores it.",
  },
  {
    term: "Exercise adjustment",
    slug: "exercise-adjustment",
    short: "Changing insulin or carbs around activity.",
    definition:
      "Exercise adjustment means changing basal, bolus, or food to reduce hypo risk or manage adrenaline-related rises during activity. Plans are highly individual and depend on intensity, duration, insulin on board, and recent highs or ketones. The exercise scenario in the app offers structured reminders and planning — it is educational and should align with what your team has taught you about sport and diabetes.",
  },
  {
    term: "Fast-acting carbohydrate",
    slug: "fast-acting-carbohydrate",
    short: "Quick sugar used to treat hypoglycaemia.",
    definition:
      "Fast-acting carbohydrate is absorbed quickly to raise a low glucose — glucose tablets, juice, regular soft drink (not diet), or sweets as taught by your team. The hypo-help style tools in the app estimate amounts from your targets; they do not replace knowing your own symptoms and having treatment within reach. After treating, recheck as your clinic recommends.",
  },
  {
    term: "Flash glucose monitoring",
    slug: "flash-glucose-monitoring",
    short: "Scan or phone-read sensor without full CGM alarms.",
    definition:
      "Flash systems use a worn sensor you scan with a reader or phone to see a current value and trend arrow. They may not alarm like full CGM unless configured. The app may treat “sensor” language generically; your device manual defines how often to scan and calibrate if required.",
  },
  {
    term: "Glucose",
    slug: "glucose",
    short: "The main sugar your body uses for energy.",
    definition:
      "Glucose is a simple sugar circulating in the blood and stored in the liver. In type 1 diabetes, insulin therapy replaces what the pancreas no longer supplies so glucose can enter cells safely. “Glucose”, “blood sugar”, and “BG” are used interchangeably in everyday language; Diabeaters prefers precise labels on forms while keeping explanations readable.",
  },
  {
    term: "Glycaemic index (GI)",
    slug: "glycaemic-index",
    short: "How quickly a carb food tends to raise glucose.",
    definition:
      "The glycaemic index ranks carbohydrate foods by how fast they tend to raise glucose compared with a reference food. Lower-GI foods often raise glucose more slowly, which can matter for bolus timing. It is only one factor — portion size (total carbs) still dominates bolus decisions. The app does not require GI for calculations but the concept appears in broader diabetes education.",
  },
  {
    term: "Hyperglycaemia (Hyper)",
    slug: "hyperglycaemia",
    short: "Blood glucose above your target range.",
    definition:
      "Hyperglycaemia means glucose is higher than the range you and your team aim for. Short episodes happen; persistent highs increase thirst, tiredness, and the risk of ketones if insulin is missed or during illness. Correction doses, hydration, and sick-day rules apply. Diabeaters may prompt corrections in tools — those numbers are not valid unless your underlying settings and safety limits match your prescription.",
  },
  {
    term: "Hypoglycaemia (Hypo)",
    slug: "hypoglycaemia",
    short: "Low blood glucose — treat promptly.",
    definition:
      "Hypoglycaemia is a low blood glucose level; many teams use a threshold around 3.9 mmol/L (70 mg/dL) for alerts, but your own targets may differ. Symptoms vary from person to person and can include shaking, sweating, hunger, confusion, or few symptoms (“hypo unawareness”). The app’s hypo help and banners emphasise fast carbs, rechecking, and when others should use glucagon or emergency help.",
  },
  {
    term: "Infusion set",
    slug: "infusion-set",
    short: "Pump cannula and tubing that delivers insulin under the skin.",
    definition:
      "An infusion set is the disposable part of pump therapy that sits under the skin and connects insulin from the pump to your body. Rotation of sites reduces lipohypertrophy. Occlusions, kinks, or set failures can cause sudden highs or ketones; pump-failure and travel scenarios in the app refer to carrying backup plans your team provides.",
  },
  {
    term: "Insulin on board (IOB)",
    slug: "insulin-on-board",
    short: "Bolus insulin still active in your body.",
    definition:
      "IOB estimates how much recent bolus insulin is still lowering glucose. Calculators subtract IOB from suggested corrections to reduce stacking. IOB math depends on duration of insulin action and the curve your system uses. Understanding IOB helps interpret adviser suggestions; it does not replace finger or CGM checks when you feel unwell.",
  },
  {
    term: "Insulin pump therapy",
    slug: "insulin-pump-therapy",
    short: "Continuous subcutaneous insulin via a pump.",
    definition:
      "Pump therapy delivers basal in small pulses and boluses in user-directed doses. It allows fine-tuning and temporary basal changes for exercise or illness. You still need supplies, site changes, and emergency MDI backup if your team prescribes it. Profile questions in Diabeaters use pump vs MDI to show relevant wording in supplies and scenarios.",
  },
  {
    term: "Insulin resistance",
    slug: "insulin-resistance",
    short: "Same insulin dose has less effect than expected.",
    definition:
      "Insulin resistance means the body needs more insulin than before for the same glucose effect. It can rise with illness, steroids, weight change, puberty, or other conditions. Type 1 management responds by adjusting doses under medical supervision — not by guessing from an app alone. If needs jump suddenly, contact your team to rule out illness or pump issues.",
  },
  {
    term: "Insulin sensitivity",
    slug: "insulin-sensitivity",
    short: "How strongly your body responds to insulin.",
    definition:
      "Insulin sensitivity describes how much glucose drops per unit of insulin — closely related to the correction factor. Higher sensitivity means smaller doses have a larger effect. Sensitivity changes with exercise, time of day, stress, and hormones. Closed-loop systems estimate sensitivity from data; manual dosing uses the factors stored in your settings.",
  },
  {
    term: "Ketones",
    slug: "ketones",
    short: "Acids from fat breakdown when insulin is insufficient.",
    definition:
      "Ketones appear when the body burns fat for fuel because glucose cannot enter cells without enough insulin. Small amounts can occur during fasting or illness; larger amounts with high glucose suggest risk of DKA. Sick-day screens in the app remind you when to test ketones and seek help. Follow your clinic’s thresholds for blood versus urine ketone testing.",
  },
  {
    term: "Lancet",
    slug: "lancet",
    short: "Small needle used with a fingerstick device.",
    definition:
      "A lancet pricks the skin to obtain a drop of blood for a meter check. Rotating fingers and using appropriate depth reduces soreness. Even with CGM, finger checks are still needed for calibration (if required), when symptoms do not match the sensor, or during rapid changes.",
  },
  {
    term: "MDI (Multiple daily injections)",
    slug: "mdi",
    short: "Basal and bolus insulin by pen or syringe.",
    definition:
      "MDI means using separate injections for long-acting basal insulin and rapid-acting meal or correction insulin. It remains a standard, flexible option alongside pumps. Diabeaters asks how you deliver insulin so language about reservoirs, infusion sets, or temporary basal applies only when relevant.",
  },
  {
    term: "Pre-bolus",
    slug: "pre-bolus",
    short: "Giving insulin before eating so it starts working with the meal.",
    definition:
      "Pre-bolusing is taking rapid-acting insulin a number of minutes before eating so insulin activity lines up with carb absorption. The right lead time depends on the insulin type, the meal’s glycaemic load, and your glucose level. Pre-bolusing when low or uncertain about food intake increases hypo risk — your team should give you rules for when to delay or split the dose.",
  },
  {
    term: "Sensor lag",
    slug: "sensor-lag",
    short: "CGM reads tissue fluid, slightly behind blood glucose.",
    definition:
      "Sensor lag is the delay between blood glucose and interstitial glucose, often minutes, which is most noticeable when glucose is changing quickly. That is why treatment decisions for severe lows or driving rules may still require a finger check. Educational text in the app may warn not to rely on a lagging arrow alone in those situations.",
  },
  {
    term: "Sick day rules",
    slug: "sick-day-rules",
    short: "Extra checks and insulin adjustments when you are unwell.",
    definition:
      "Sick day rules are your team’s written plan for more frequent glucose and ketone checks, hydration, insulin adjustments, and when to call the hospital — usually provided as a paper or PDF plan. Diabeaters sick-day mode offers reminders and logging aligned with general principles but cannot store your clinic’s exact protocol unless you mirror it in your own care.",
  },
  {
    term: "Target range",
    slug: "target-range",
    short: "Glucose band you and your team aim to stay in.",
    definition:
      "Target range is the glucose interval you try to spend most time in — often discussed alongside time in range. It may differ before meals, after meals, overnight, or during pregnancy. Diabeaters uses your saved targets in calculators and hypo help. Changing targets should always reflect medical advice, not only app defaults.",
  },
  {
    term: "Time in range (TIR)",
    slug: "time-in-range",
    short: "Percentage of time glucose stays within a set band.",
    definition:
      "Time in range is the proportion of readings (usually from CGM) between a lower and upper threshold, commonly 3.9–10.0 mmol/L for adults but individualised. It captures variability and overnight control alongside HbA1c. The app may reference range concepts in dashboards or education; your device reports remain the source of truth for TIR statistics.",
  },
  {
    term: "Total daily dose (TDD)",
    slug: "total-daily-dose",
    short: "All basal and bolus insulin in a typical day.",
    definition:
      "TDD is the sum of basal and bolus insulin over 24 hours under usual conditions. Teams sometimes use TDD to estimate starting carb ratios or correction factors during titration. Settings and onboarding in Diabeaters may ask for TDD or derive patterns from your entries — use numbers your team has validated.",
  },
  {
    term: "Units (U)",
    slug: "units-u",
    short: "How insulin doses are measured.",
    definition:
      "Insulin is prescribed in units (U). Pens and pumps deliver in units or tenths of units. The letter “U” appears on forms and labels in the app to save space. Different insulins are not interchangeable unit-for-unit; always confirm you are using the correct pen or vial your prescription describes.",
  },
].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));

const bySlug = new Map<string, GlossaryTerm>();
for (const t of GLOSSARY_TERMS) {
  bySlug.set(t.slug, t);
}

export function getGlossaryTermBySlug(slug: string): GlossaryTerm | undefined {
  return bySlug.get(slug);
}

export function filterGlossaryTerms(terms: GlossaryTerm[], query: string): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (!q) return terms;
  return terms.filter(
    (t) =>
      t.term.toLowerCase().includes(q) ||
      t.short.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q),
  );
}

/** First A–Z bucket for a term (non-letters grouped under "#"). */
export function glossaryLetter(term: string): string {
  const c = term.trim().charAt(0).toUpperCase();
  if (c >= "A" && c <= "Z") return c;
  return "#";
}

export function groupGlossaryByLetter(terms: GlossaryTerm[]): { letter: string; terms: GlossaryTerm[] }[] {
  const map = new Map<string, GlossaryTerm[]>();
  for (const t of terms) {
    const L = glossaryLetter(t.term);
    const list = map.get(L) ?? [];
    list.push(t);
    map.set(L, list);
  }
  const letters = Array.from(map.keys()).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });
  return letters.map((letter) => ({ letter, terms: map.get(letter) ?? [] }));
}
