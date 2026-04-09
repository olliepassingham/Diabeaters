import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
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
    <PageShell variant="standard" className="space-y-8 bg-background text-foreground">
      <PageHeader
        leading={<PageBackButton />}
        title="Glossary"
        description="Search A–Z terms — educational only, not medical advice."
      />

      <div className="space-y-2">
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
            "surface-field flex h-11 w-full rounded-xl px-4 py-2 text-base text-foreground ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          )}
        />
      </div>

      <div className="space-y-8">
        {groups.length === 0 ? (
          <EmptyState
            title="No terms match your search"
            description="Try a shorter word or clear the search to see the full glossary."
          />
        ) : (
          groups.map(({ letter, terms }) => (
            <section key={letter} aria-labelledby={`glossary-letter-${letter}`} className="space-y-3">
              <h2
                id={`glossary-letter-${letter}`}
                className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {letter === "#" ? "#" : letter}
              </h2>
              <ul className="m-0 list-none space-y-3 p-0">
                {terms.map((t, idx) => (
                  <li
                    key={t.slug}
                    className="animate-soft-in"
                    style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                  >
                    <Link
                      href={`/education/${t.slug}`}
                      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card
                        variant="glass"
                        className="p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md sm:p-6"
                      >
                        <h3 className="font-display text-h3 font-semibold text-foreground">{t.term}</h3>
                        <p className="mt-1.5 text-small leading-relaxed text-muted-foreground">{t.short}</p>
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
