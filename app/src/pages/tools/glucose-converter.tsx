import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { convertGlucoseValue } from "@/lib/cgm/units";
import type { BgUnits } from "@/lib/cgm/types";
import {
  DIABEATER_PROFILE_CHANGED_EVENT,
  storage,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

const REFERENCE_MMOL = [4, 5.5, 7, 10, 14] as const;

function parseBgInput(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatConverted(value: number, units: BgUnits): string {
  if (units === "mg/dL") return String(Math.round(value));
  return value.toFixed(1);
}

function profilePreferredUnits(): BgUnits {
  const p = storage.getProfile();
  return p?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
}

/** Default “from” unit is the opposite of the user’s preference (paste foreign readings). */
function defaultFromUnits(preferred: BgUnits): BgUnits {
  return preferred === "mmol/L" ? "mg/dL" : "mmol/L";
}

export default function GlucoseConverterPage() {
  const [preferred, setPreferred] = useState<BgUnits>(() => profilePreferredUnits());
  const [fromUnits, setFromUnits] = useState<BgUnits>(() => defaultFromUnits(profilePreferredUnits()));
  const [raw, setRaw] = useState("");

  useEffect(() => {
    const sync = () => {
      const next = profilePreferredUnits();
      setPreferred(next);
    };
    sync();
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, sync);
  }, []);

  const toUnits: BgUnits = fromUnits === "mmol/L" ? "mg/dL" : "mmol/L";
  const parsed = parseBgInput(raw);
  const converted =
    parsed != null ? convertGlucoseValue(parsed, fromUnits, toUnits) : null;

  const hint = useMemo(() => {
    if (preferred === "mmol/L") {
      return "Your profile uses mmol/L — paste a US mg/dL reading to see the UK value.";
    }
    return "Your profile uses mg/dL — paste a mmol/L reading to convert.";
  }, [preferred]);

  function swapUnits() {
    if (converted != null) {
      setRaw(formatConverted(converted, toUnits));
    }
    setFromUnits(toUnits);
  }

  return (
    <PageShell variant="standard" className="space-y-6 py-4 md:py-8">
      <PageHeader
        leading={<PageBackButton fallbackHref="/tools" />}
        title="Glucose units"
        description="Convert between mmol/L (common in the UK) and mg/dL (common in the US)."
      />

      <p className="text-sm text-muted-foreground">{hint}</p>

      <div className="space-y-4">
        <div className="flex gap-2" role="group" aria-label="Input unit">
          {(["mg/dL", "mmol/L"] as const).map((u) => (
            <Button
              key={u}
              type="button"
              variant={fromUnits === u ? "default" : "outline"}
              className="min-h-11 flex-1"
              aria-pressed={fromUnits === u}
              onClick={() => setFromUnits(u)}
            >
              {u}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="glucose-converter-input">Value in {fromUnits}</Label>
          <Input
            id="glucose-converter-input"
            inputMode="decimal"
            type="text"
            autoComplete="off"
            placeholder={fromUnits === "mg/dL" ? "e.g. 120" : "e.g. 6.7"}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="min-h-12 text-lg"
          />
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-2"
            onClick={swapUnits}
            aria-label={`Swap to convert from ${toUnits}`}
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            Swap units
          </Button>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-muted/30 px-5 py-6 text-center",
            converted == null && "opacity-70",
          )}
          aria-live="polite"
        >
          {converted != null ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">{toUnits}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                {formatConverted(converted, toUnits)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatConverted(parsed!, fromUnits)} {fromUnits} →{" "}
                {formatConverted(converted, toUnits)} {toUnits}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Enter a glucose value to convert.</p>
          )}
        </div>
      </div>

      <section className="space-y-2" aria-label="Common reference values">
        <h2 className="text-sm font-semibold text-foreground">Quick reference</h2>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 text-sm">
          {REFERENCE_MMOL.map((mmol) => {
            const mg = convertGlucoseValue(mmol, "mmol/L", "mg/dL");
            return (
              <li
                key={mmol}
                className="flex items-center justify-between gap-3 px-4 py-2.5 tabular-nums"
              >
                <span>
                  {mmol.toFixed(1)} mmol/L
                </span>
                <span className="text-muted-foreground">{mg} mg/dL</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">Rule of thumb: ÷ or × by about 18.</p>
      </section>

      <Alert>
        <AlertDescription>
          Conversion only — not medical advice. Always follow your care team’s guidance for treating
          highs and lows.
        </AlertDescription>
      </Alert>
    </PageShell>
  );
}
