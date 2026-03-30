import { Link, useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { getGlossaryTermBySlug } from "@/lib/education-glossary";

export default function GlossaryDetail() {
  const [match, params] = useRoute("/education/:slug");

  if (!match || !params?.slug) {
    return null;
  }

  const entry = getGlossaryTermBySlug(params.slug);

  if (!entry) {
    return (
      <PageShell variant="standard" className="bg-background text-foreground">
        <PageHeader leading={<PageBackButton />} title="Term not found" />
        <Card className="p-4 space-y-4 mt-6">
          <p className="text-body text-muted-foreground">We couldn&apos;t find that glossary entry.</p>
          <Link href="/education" className="text-body font-medium text-primary underline underline-offset-4">
            Back to Glossary
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="bg-background text-foreground">
      <PageHeader leading={<PageBackButton />} title={entry.term} />

      <Card className="p-4 space-y-4 mt-6">
        <h1 className="text-h3 font-semibold text-foreground">{entry.term}</h1>
        <p className="text-body leading-relaxed text-foreground">{entry.definition}</p>
      </Card>
    </PageShell>
  );
}
