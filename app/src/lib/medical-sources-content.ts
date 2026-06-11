import type { AppRegion } from "@/lib/region";

export type MedicalSourceLink = { label: string; href: string };

export type MedicalSourcesSection = {
  id: string;
  title: string;
  description: string;
  links: MedicalSourceLink[];
};

const SHARED_SECTIONS: MedicalSourcesSection[] = [
  {
    id: "insulin",
    title: "Insulin dosing concepts (bolus/corrections)",
    description:
      "Used for educational framing around carb ratios, correction factors (ISF), and dose estimates shown in the Adviser and correction tools. Always use targets and dosing rules agreed with your clinician.",
    links: [
      {
        label: "Diabetes UK: Insulin (overview)",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/managing-your-diabetes/treating-your-diabetes/insulin",
      },
      {
        label: "American Diabetes Association: Insulin & other injectables",
        href: "https://diabetes.org/health-wellness/medication/oral-other-injectable-diabetes-medications/insulin-other-injectables",
      },
    ],
  },
  {
    id: "disclaimer",
    title: "Notes on calculators",
    description:
      "Calculators in Diabeaters provide estimates to support education and conversation with your care team. They do not know your full clinical context (e.g. insulin on board, illness, alcohol, exercise, pump settings, or individual sensitivity changes).",
    links: [],
  },
];

const UK_SECTIONS: MedicalSourcesSection[] = [
  {
    id: "hypoglycaemia",
    title: "Hypoglycaemia (low blood sugar) & treatment",
    description: "Used for general “treat the low” guidance and reminders shown in Help Now and the hypo tools.",
    links: [
      {
        label: "NHS: Low blood sugar (hypoglycaemia)",
        href: "https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/",
      },
      {
        label: "Diabetes UK: Hypoglycaemia (hypos)",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/complications/hypos",
      },
    ],
  },
  {
    id: "emergency",
    title: "Emergency guidance",
    description:
      "Used for the Help Now page and safety framing. In the UK, call 999 for emergencies. For urgent non-emergency advice, consider NHS 111.",
    links: [
      {
        label: "NHS: Call 999",
        href: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/",
      },
      {
        label: "NHS: NHS 111",
        href: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/nhs-111/",
      },
    ],
  },
  {
    id: "sickday",
    title: "Sick day rules, ketones, and DKA",
    description: "Used for sick-day and pump-failure scenario information and warnings.",
    links: [
      {
        label: "NHS: Diabetic ketoacidosis (DKA)",
        href: "https://www.nhs.uk/conditions/diabetic-ketoacidosis/",
      },
      {
        label: "Diabetes UK: Ketones and DKA",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/complications/diabetic-ketoacidosis",
      },
    ],
  },
  {
    id: "exercise",
    title: "Exercise & diabetes",
    description: "Used for general exercise education and reminders shown in the exercise planner and in-progress banner.",
    links: [
      { label: "NHS: Exercise", href: "https://www.nhs.uk/live-well/exercise/" },
      {
        label: "Diabetes UK: Exercise",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/enjoy-food/exercise",
      },
    ],
  },
  {
    id: "driving",
    title: "Driving with diabetes (UK)",
    description: "Used for the driving scenario flow and readiness guidance.",
    links: [
      { label: "GOV.UK: Diabetes and driving", href: "https://www.gov.uk/diabetes-driving" },
      {
        label: "DVLA: Medical conditions, disabilities and driving",
        href: "https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency",
      },
    ],
  },
];

const US_SECTIONS: MedicalSourcesSection[] = [
  {
    id: "hypoglycaemia",
    title: "Hypoglycemia (low blood sugar) & treatment",
    description: "Used for general “treat the low” guidance and reminders shown in Help Now and the hypo tools.",
    links: [
      {
        label: "CDC: Low blood sugar (hypoglycemia)",
        href: "https://www.cdc.gov/diabetes/basics/low-blood-sugar.html",
      },
      {
        label: "American Diabetes Association: Hypoglycemia",
        href: "https://diabetes.org/living-with-diabetes/hypoglycemia",
      },
    ],
  },
  {
    id: "emergency",
    title: "Emergency guidance",
    description:
      "Used for the Help Now page and safety framing. In the US, call 911 for emergencies. For urgent non-emergency care, contact your doctor or local urgent care.",
    links: [
      {
        label: "911.gov: When to call 911",
        href: "https://www.911.gov/when-to-call",
      },
      {
        label: "CDC: Diabetes — sick days & when to get help",
        href: "https://www.cdc.gov/diabetes/treatment/sick-days.html",
      },
    ],
  },
  {
    id: "sickday",
    title: "Sick day rules, ketones, and DKA",
    description: "Used for sick-day and pump-failure scenario information and warnings.",
    links: [
      {
        label: "CDC: Sick days & ketones",
        href: "https://www.cdc.gov/diabetes/treatment/sick-days.html",
      },
      {
        label: "JDRF: DKA and ketones",
        href: "https://www.jdrf.org/t1d-resources/living-with-t1d/health-and-wellness/diabetic-ketoacidosis/",
      },
    ],
  },
  {
    id: "exercise",
    title: "Exercise & diabetes",
    description: "Used for general exercise education and reminders shown in the exercise planner and in-progress banner.",
    links: [
      {
        label: "American Diabetes Association: Fitness",
        href: "https://diabetes.org/health-wellness/fitness",
      },
      {
        label: "JDRF: Exercise and Type 1 Diabetes",
        href: "https://www.jdrf.org/t1d-resources/living-with-t1d/exercise/",
      },
    ],
  },
  {
    id: "driving",
    title: "Driving with diabetes (US)",
    description: "Used for the driving scenario flow and readiness guidance.",
    links: [
      {
        label: "American Diabetes Association: Driving with diabetes",
        href: "https://diabetes.org/living-with-diabetes/treatment-care/driving",
      },
    ],
  },
];

const OTHER_SECTIONS: MedicalSourcesSection[] = [
  {
    id: "hypoglycaemia",
    title: "Hypoglycaemia (low blood sugar) & treatment",
    description: "Used for general “treat the low” guidance and reminders shown in Help Now and the hypo tools.",
    links: [
      {
        label: "International Diabetes Federation",
        href: "https://diabetesatlas.org/",
      },
      {
        label: "Diabetes UK: Hypoglycaemia (hypos)",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/complications/hypos",
      },
      {
        label: "American Diabetes Association: Hypoglycemia",
        href: "https://diabetes.org/living-with-diabetes/hypoglycemia",
      },
    ],
  },
  {
    id: "emergency",
    title: "Emergency guidance",
    description:
      "Used for the Help Now page and safety framing. Use your local emergency number for life-threatening situations.",
    links: [
      {
        label: "International Diabetes Federation",
        href: "https://diabetesatlas.org/",
      },
    ],
  },
  {
    id: "sickday",
    title: "Sick day rules, ketones, and DKA",
    description: "Used for sick-day and pump-failure scenario information and warnings.",
    links: [
      {
        label: "Diabetes UK: Ketones and DKA",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/complications/diabetic-ketoacidosis",
      },
      {
        label: "JDRF: DKA and ketones",
        href: "https://www.jdrf.org/t1d-resources/living-with-t1d/health-and-wellness/diabetic-ketoacidosis/",
      },
    ],
  },
  {
    id: "exercise",
    title: "Exercise & diabetes",
    description: "Used for general exercise education and reminders shown in the exercise planner and in-progress banner.",
    links: [
      {
        label: "JDRF: Exercise and Type 1 Diabetes",
        href: "https://www.jdrf.org/t1d-resources/living-with-t1d/exercise/",
      },
      {
        label: "Diabetes UK: Exercise",
        href: "https://www.diabetes.org.uk/guide-to-diabetes/enjoy-food/exercise",
      },
    ],
  },
];

export function medicalSourcesPageDescription(region: AppRegion): string {
  if (region === "US") {
    return "References for diabetes-related educational content in Diabeaters (United States).";
  }
  if (region === "OTHER") {
    return "References for diabetes-related educational content in Diabeaters (international).";
  }
  return "References for diabetes-related educational content in Diabeaters (UK).";
}

export function getMedicalSourcesSections(region: AppRegion): MedicalSourcesSection[] {
  const regional = region === "US" ? US_SECTIONS : region === "OTHER" ? OTHER_SECTIONS : UK_SECTIONS;
  return [...regional, ...SHARED_SECTIONS];
}
