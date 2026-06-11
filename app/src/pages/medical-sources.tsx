import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import {
  getMedicalSourcesSections,
  medicalSourcesPageDescription,
  type MedicalSourceLink,
} from "@/lib/medical-sources-content";
import { formatAppDate, getProfileRegion } from "@/lib/region";
import { DIABEATER_PROFILE_CHANGED_EVENT, storage, type UserProfile } from "@/lib/storage";

function SourceList({ links }: { links: MedicalSourceLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="list-disc pl-5 space-y-1">
      {links.map((l) => (
        <li key={l.href}>
          <a
            href={l.href}
            className="text-primary underline underline-offset-2 hover:opacity-90"
            target="_blank"
            rel="noreferrer"
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function MedicalSourcesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(() => storage.getProfile());
  const region = getProfileRegion(profile);
  const sections = getMedicalSourcesSections(region);
  const reviewed = formatAppDate(new Date(), profile, { year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    const onProfile = () => setProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  return (
    <PageShell variant="standard" className="min-h-screen">
      <PageHeader
        leading={<PageBackButton />}
        title="Medical sources"
        description={medicalSourcesPageDescription(region)}
      />

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 pt-6">
          <p className="text-xs text-muted-foreground">Last reviewed: {reviewed}</p>
          <p>
            Diabeaters provides educational information and calculators intended to support day-to-day organisation and
            learning. It is <strong>not</strong> a medical device and does not replace your clinician. Always follow your
            diabetes team’s plan and local emergency guidance.
          </p>

          {sections.map((section) => (
            <div key={section.id}>
              <h2 id={section.id} className="scroll-mt-24 text-base font-semibold">
                {section.title}
              </h2>
              <p>{section.description}</p>
              <SourceList links={section.links} />
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
