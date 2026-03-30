import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  GLOSSARY_TERMS,
  filterGlossaryTerms,
  groupGlossaryByLetter,
} from "@/lib/education-glossary";

export default function GlossaryIndex() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterGlossaryTerms(GLOSSARY_TERMS, query), [query]);
  const groups = useMemo(() => groupGlossaryByLetter(filtered), [filtered]);

  return (
    <PageShell variant="standard" className="bg-background text-foreground">
      <PageHeader title="Glossary" />

      <div className="mt-6 space-y-2">
        <label htmlFor="glossary-search" className="sr-only">
          Search glossary terms
        </label>
        <input
          id="glossary-search"
          type="search"
          placeholder="Search terms..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          )}
        />
      </div>

      <div className="mt-6 space-y-6">
        {groups.length === 0 ? (
          <p className="text-body text-muted-foreground">No terms match your search.</p>
        ) : (
          groups.map(({ letter, terms }) => (
            <section key={letter} aria-labelledby={`glossary-letter-${letter}`} className="space-y-2">
              <h2
                id={`glossary-letter-${letter}`}
                className="text-small font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {letter === "#" ? "#" : letter}
              </h2>
              <ul className="list-none space-y-2 p-0 m-0">
                {terms.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/education/${t.slug}`}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className="p-4 border border-border/80 shadow-sm transition-colors hover:bg-muted/50">
                        <h3 className="text-h3 font-semibold text-foreground">{t.term}</h3>
                        <p className="text-small text-muted-foreground mt-1.5">{t.short}</p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PageShell>
  );
}
