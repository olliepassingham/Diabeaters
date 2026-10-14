import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Lightbulb, Shuffle } from "lucide-react";

import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CATEGORY_LABELS, tipsForDelivery, type Tip } from "@/components/dashboard/widgets/tipOfDayData";
import { storage, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";

type TipWithIndex = Tip & { idx: number };

function pickRandomTipIndex(length: number, exclude?: number): number {
  if (length <= 1) return 0;
  let idx = Math.floor(Math.random() * length);
  while (exclude != null && idx === exclude) idx = Math.floor(Math.random() * length);
  return idx;
}

export default function TipsPage() {
  const [deliveryMethod, setDeliveryMethod] = useState(
    () => storage.getProfile()?.insulinDeliveryMethod,
  );
  const tips = useMemo(() => tipsForDelivery(deliveryMethod), [deliveryMethod]);
  const [randomIdx, setRandomIdx] = useState(() =>
    pickRandomTipIndex(tipsForDelivery(storage.getProfile()?.insulinDeliveryMethod).length),
  );

  useEffect(() => {
    const onProfile = () => setDeliveryMethod(storage.getProfile()?.insulinDeliveryMethod);
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  const tipsByCategory = useMemo(() => {
    const out = new Map<string, TipWithIndex[]>();
    tips.forEach((t, idx) => {
      const list = out.get(t.category) ?? [];
      list.push({ ...t, idx });
      out.set(t.category, list);
    });
    return out;
  }, [tips]);

  const randomTip = tips[randomIdx] ?? tips[0];

  return (
    <PageShell variant="standard" className="space-y-6 py-4 md:py-8">
      <PageHeader
        leading={<PageBackButton />}
        title="Tips"
        description="Short, practical reminders you can come back to anytime. Educational only."
      />

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden />
              Random tip
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setRandomIdx((prev) => pickRandomTipIndex(tips.length, prev))}
            >
              <Shuffle className="h-4 w-4 mr-2" aria-hidden />
              Another
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-body leading-relaxed">{randomTip?.text}</p>
          {randomTip?.category ? (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {CATEGORY_LABELS[randomTip.category] || randomTip.category}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {[...tipsByCategory.entries()].map(([cat, tips]) => {
        const label = CATEGORY_LABELS[cat] || cat;
        return (
          <section key={cat} className="space-y-3" aria-label={`${label} tips`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-h3 font-semibold text-foreground">{label}</h2>
              <Badge variant="secondary" className="tabular-nums">
                {tips.length}
              </Badge>
            </div>
            <ul className="space-y-2">
              {tips.map((t) => (
                <li
                  key={`${cat}-${t.idx}`}
                  className={cn("rounded-lg border border-border/60 bg-card/70 px-3 py-3 text-sm")}
                >
                  {t.text}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Want a deeper explanation? See the{" "}
        <Link href="/education" className="text-primary underline underline-offset-2 hover:opacity-90">
          Education
        </Link>{" "}
        glossary.
      </p>
    </PageShell>
  );
}

