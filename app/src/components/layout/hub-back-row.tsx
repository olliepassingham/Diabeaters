import { PageBackLink } from "@/components/layout/page-back-link";

/** Back link to the situation guides hub (shared by scenario sub-pages and tools). */
export function HubBackRow() {
  return <PageBackLink fallbackHref="/scenarios" label="Guides" />;
}
