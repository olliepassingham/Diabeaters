import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  CARB_SOURCE_SCENARIO_LABELS,
  CARB_SOURCE_SCENARIO_ORDER,
  COMMON_CARB_SOURCE_TEMPLATES,
  MAX_CARB_SOURCE_FAVORITES,
  carbSourcePreferencesToCloud,
  createFavoriteFromTemplate,
  emptyCarbSourcePreferences,
  getCarbSourcePreferences,
  normalizeCarbSourcePreferences,
  type CarbSourceFavorite,
  type CarbSourcePreferences,
  type CarbSourceScenario,
} from "@/lib/carb-source-preferences";
import { syncCarbSourcePrefsToCloud } from "@/lib/clinical-prefs-cloud-sync";
import {
  DIABEATER_PROFILE_CHANGED_EVENT,
  storage,
  type UserProfile,
} from "@/lib/storage";
import { PageHeader, PageShell } from "@/components/layout";
import { FieldLabelWithInfo, InlineInfoHint } from "@/components/ui/field-label-with-info";
import { SettingsBackLink } from "./shared";

type DraftFavorite = {
  id: string;
  label: string;
  carbsPerServing: string;
  unitLabel: string;
};

function draftFromFavorite(fav: CarbSourceFavorite): DraftFavorite {
  return {
    id: fav.id,
    label: fav.label,
    carbsPerServing: String(fav.carbsPerServing),
    unitLabel: fav.unitLabel,
  };
}

function favoriteFromDraft(draft: DraftFavorite): CarbSourceFavorite | null {
  const label = draft.label.trim();
  const unitLabel = draft.unitLabel.trim();
  const carbsPerServing = Number(draft.carbsPerServing);
  if (!label || !unitLabel || !Number.isFinite(carbsPerServing) || carbsPerServing <= 0) return null;
  return {
    id: draft.id,
    label,
    carbsPerServing,
    unitLabel,
  };
}

function prefsFromDrafts(
  drafts: DraftFavorite[],
  defaultByScenario: Partial<Record<CarbSourceScenario, string>>,
): CarbSourcePreferences {
  const favorites = drafts
    .map(favoriteFromDraft)
    .filter((f): f is CarbSourceFavorite => Boolean(f))
    .slice(0, MAX_CARB_SOURCE_FAVORITES);

  const validIds = new Set(favorites.map((f) => f.id));
  const cleanedDefaults: Partial<Record<CarbSourceScenario, string>> = {};
  for (const [scenario, id] of Object.entries(defaultByScenario)) {
    if (id && validIds.has(id)) {
      cleanedDefaults[scenario as CarbSourceScenario] = id;
    }
  }

  return normalizeCarbSourcePreferences({ favorites, defaultByScenario: cleanedDefaults });
}

export default function SettingsCarbSourcesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<DraftFavorite[]>([]);
  const [defaultByScenario, setDefaultByScenario] = useState<
    Partial<Record<CarbSourceScenario, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [templateSelectKey, setTemplateSelectKey] = useState(0);

  const loadFromProfile = useCallback((profile: UserProfile | null) => {
    const prefs = getCarbSourcePreferences(profile ?? undefined);
    setDrafts(prefs.favorites.map(draftFromFavorite));
    setDefaultByScenario({ ...prefs.defaultByScenario });
  }, []);

  useEffect(() => {
    loadFromProfile(storage.getProfile());
    const onProfile = () => loadFromProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, [loadFromProfile]);

  const favoriteOptions = useMemo(
    () =>
      drafts
        .map(favoriteFromDraft)
        .filter((f): f is CarbSourceFavorite => Boolean(f)),
    [drafts],
  );

  const addDraft = (seed?: CarbSourceFavorite) => {
    if (drafts.length >= MAX_CARB_SOURCE_FAVORITES) {
      toast({
        title: "Limit reached",
        description: `You can save up to ${MAX_CARB_SOURCE_FAVORITES} favourites.`,
        variant: "destructive",
      });
      return;
    }
    const fav = seed ?? {
      id: crypto.randomUUID(),
      label: "",
      carbsPerServing: 4,
      unitLabel: "tablet",
    };
    setDrafts((prev) => [...prev, draftFromFavorite(fav)]);
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setDefaultByScenario((prev) => {
      const next = { ...prev };
      for (const scenario of CARB_SOURCE_SCENARIO_ORDER) {
        if (next[scenario] === id) delete next[scenario];
      }
      return next;
    });
  };

  const updateDraft = (id: string, patch: Partial<DraftFavorite>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    const base = storage.getProfile();
    if (!base) return;

    const prefs = prefsFromDrafts(drafts, defaultByScenario);
    if (drafts.some((d) => !favoriteFromDraft(d))) {
      toast({
        title: "Check your favourites",
        description: "Each item needs a name, grams per serving, and a unit label.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const nextProfile: UserProfile = {
      ...base,
      carbSourcePreferences: prefs,
    };
    storage.saveProfile(nextProfile);

    if (user?.id) {
      const { error, skipped } = await syncCarbSourcePrefsToCloud(user.id);
      if (error) {
        toast({
          title: "Saved on this device",
          description: "Cloud sync failed — favourites are stored locally for now.",
          variant: "destructive",
        });
      } else if (skipped) {
        toast({
          title: "Saved on this device",
          description: "Cloud column not available yet — run the carb sources migration when ready.",
        });
      } else {
        toast({ title: "Carb sources saved" });
      }
    } else {
      toast({ title: "Carb sources saved" });
    }
    setSaving(false);
  };

  const handleClear = () => {
    const base = storage.getProfile();
    if (!base) return;
    storage.saveProfile({ ...base, carbSourcePreferences: emptyCarbSourcePreferences() });
    loadFromProfile(storage.getProfile());
    toast({ title: "Cleared carb sources" });
  };

  return (
    <PageShell variant="standard" className="relative mx-auto max-w-lg space-y-5">
      <SettingsBackLink href="/settings" />
      <PageHeader
        title="Carb sources"
        actions={
          <InlineInfoHint
            ariaLabel="About carb sources"
            content={
              <p>
                Name the gels, drinks, and tablets you actually use. Grams stay the main number — these favourites
                translate them into what to carry.
              </p>
            }
          />
        }
      />

      <Card variant="glass-muted">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Your favourites</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              e.g. “SIS Beta Fuel gel · 22g per gel” or “Lucozade · 26g per 330ml can”.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="carb-source-template" className="text-xs text-muted-foreground">
              Add from template
            </Label>
            <Select
              key={templateSelectKey}
              disabled={drafts.length >= MAX_CARB_SOURCE_FAVORITES}
              onValueChange={(value) => {
                const template = COMMON_CARB_SOURCE_TEMPLATES.find((t) => t.label === value);
                if (template) addDraft(createFavoriteFromTemplate(template));
                setTemplateSelectKey((k) => k + 1);
              }}
            >
              <SelectTrigger id="carb-source-template">
                <SelectValue placeholder="Choose a common product…" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CARB_SOURCE_TEMPLATES.map((template) => (
                  <SelectItem key={template.label} value={template.label}>
                    {template.label} · {template.carbsPerServing}g per {template.unitLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {drafts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              No favourites yet. Add one from a template or create your own.
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="rounded-2xl border border-border/50 bg-card/70 p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Product name</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                      aria-label="Remove favourite"
                      onClick={() => removeDraft(draft.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <Input
                    value={draft.label}
                    onChange={(e) => updateDraft(draft.id, { label: e.target.value })}
                    placeholder="e.g. SIS Beta Fuel gel"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Grams per serving</Label>
                      <Input
                        inputMode="decimal"
                        value={draft.carbsPerServing}
                        onChange={(e) => updateDraft(draft.id, { carbsPerServing: e.target.value })}
                        placeholder="22"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Serving label</Label>
                      <Input
                        value={draft.unitLabel}
                        onChange={(e) => updateDraft(draft.id, { unitLabel: e.target.value })}
                        placeholder="gel, can, tablet"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => addDraft()}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Add custom favourite
          </Button>
        </CardContent>
      </Card>

      <Card variant="glass-muted">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Use these for…</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a favourite for each situation. Hypo and exercise can differ — tablets at home, gel on a run.
            </p>
          </div>

          {CARB_SOURCE_SCENARIO_ORDER.map((scenario) => {
            const meta = CARB_SOURCE_SCENARIO_LABELS[scenario];
            return (
              <div key={scenario} className="space-y-1.5">
                <FieldLabelWithInfo
                  htmlFor={`scenario-${scenario}`}
                  className="items-center"
                  info={<p>{meta.description}</p>}
                >
                  {meta.title}
                </FieldLabelWithInfo>
                <Select
                  value={defaultByScenario[scenario] ?? "unset"}
                  onValueChange={(v) =>
                    setDefaultByScenario((prev) => ({
                      ...prev,
                      [scenario]: v === "unset" ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger id={`scenario-${scenario}`}>
                    <SelectValue placeholder="App default presets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">App default presets</SelectItem>
                    {favoriteOptions.map((fav) => (
                      <SelectItem key={fav.id} value={fav.id}>
                        {fav.label} · {fav.carbsPerServing}g
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
          <Save className="mr-2 h-4 w-4" aria-hidden />
          Save carb sources
        </Button>
        <Button type="button" variant="outline" onClick={handleClear}>
          Clear all
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Grams are the clinical number. Favourites are approximate packaging helpers only — always follow your care
        team&apos;s written hypo and exercise plan.
      </p>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/settings/usage#settings-personal" className="text-primary underline-offset-4 hover:underline">
          Personal info
        </Link>{" "}
        still holds weight and units used in hypo estimates.
      </p>
    </PageShell>
  );
}
