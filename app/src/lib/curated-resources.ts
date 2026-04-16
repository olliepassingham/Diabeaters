export type CuratedResource = {
  /** Stable id for tests/ordering. */
  id: string;
  title: string;
  source: string;
  href: string;
  description: string;
  /** Display label (keep human-friendly; can be "Updated Apr 2026", etc.). */
  dateLabel: string;
  /** Optional tag chip like "Guidance" / "Basics" / "Research". */
  tag?: string;
};

/**
 * Curated, static resources (no external API).
 * Keep these links stable and trustworthy; update periodically.
 */
export const CURATED_RESOURCES: CuratedResource[] = [
  {
    id: "nhs-type1",
    source: "NHS",
    title: "Type 1 diabetes: overview",
    href: "https://www.nhs.uk/conditions/type-1-diabetes/",
    description:
      "A plain-English overview of Type 1 diabetes, symptoms, treatment, and day-to-day management.",
    dateLabel: "Reference",
    tag: "Basics",
  },
  {
    id: "diabetesuk-type1",
    source: "Diabetes UK",
    title: "Type 1 diabetes: information and support",
    href: "https://www.diabetes.org.uk/diabetes-the-basics/type-1",
    description:
      "UK-focused guidance and support resources for living with Type 1 diabetes.",
    dateLabel: "Reference",
    tag: "Support",
  },
  {
    id: "nice-type1",
    source: "NICE",
    title: "Type 1 diabetes in adults: diagnosis and management (NG17)",
    href: "https://www.nice.org.uk/guidance/ng17",
    description:
      "UK clinical guidance covering diagnosis, insulin therapy, glucose monitoring, and structured education.",
    dateLabel: "Guidance",
    tag: "Guidance",
  },
  {
    id: "jdrf-uk",
    source: "JDRF",
    title: "Living with Type 1 diabetes",
    href: "https://www.jdrf.org/t1d-resources/living-with-t1d/",
    description:
      "Practical resources for day-to-day Type 1 management, technology, and community support.",
    dateLabel: "Reference",
    tag: "Community",
  },
  {
    id: "beyondtype1",
    source: "Beyond Type 1",
    title: "Type 1 diabetes: getting started",
    href: "https://beyondtype1.org/type-1-diabetes/",
    description:
      "Approachable, patient-led learning with explainers, tips, and lived-experience perspectives.",
    dateLabel: "Reference",
    tag: "Learn",
  },
  {
    id: "ada-diabetes",
    source: "ADA",
    title: "Diabetes basics",
    href: "https://diabetes.org/diabetes",
    description:
      "General diabetes education, including Type 1 topics, technology, and guidance to discuss with your care team.",
    dateLabel: "Reference",
    tag: "Learn",
  },
];

