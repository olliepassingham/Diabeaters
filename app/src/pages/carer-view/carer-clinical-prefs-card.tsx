import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Stethoscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPatientClinicalPrefsForCarer, updatePatientClinicalPrefsForCarer } from "@/lib/carers";
import { normalizeDateOfBirthInput } from "@/lib/user-age";

export function CarerClinicalPrefsCard({
  patientId,
  enabled,
}: {
  patientId: string;
  enabled: boolean;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [dob, setDob] = useState("");
  const [delivery, setDelivery] = useState<"" | "pen" | "pump">("");
  const [tdd, setTdd] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadErr(null);
    const { data, error } = await getPatientClinicalPrefsForCarer(patientId);
    setLoading(false);
    if (error) {
      setLoadErr(error.message);
      return;
    }
    if (!data) {
      setLoadErr("This section is not available for your current link.");
      return;
    }
    setDob(data.date_of_birth ?? "");
    setDelivery(data.insulin_delivery_method === "pump" ? "pump" : data.insulin_delivery_method === "pen" ? "pen" : "");
    setTdd(data.tdd != null && data.tdd > 0 ? String(data.tdd) : "");
  }, [patientId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    const normalizedDob = normalizeDateOfBirthInput(dob.trim() || null);
    if (dob.trim() && !normalizedDob) {
      toast({
        title: "Check date of birth",
        description: "Use YYYY-MM-DD.",
        variant: "destructive",
      });
      return;
    }
    const tddNum = tdd.trim() ? parseFloat(tdd) : NaN;
    if (tdd.trim() && (!Number.isFinite(tddNum) || tddNum <= 0)) {
      toast({
        title: "Check TDD",
        description: "Enter a positive number or leave blank to clear.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await updatePatientClinicalPrefsForCarer(patientId, {
      date_of_birth: normalizedDob,
      insulin_delivery_method: delivery === "" ? null : delivery,
      tdd: tdd.trim() ? tddNum : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Their cloud profile has been updated." });
    void load();
  };

  if (!enabled) return null;

  return (
    <Card
      id="carer-clinical-settings"
      className="border-border/60 shadow-sm scroll-mt-24"
      data-testid="carer-clinical-prefs"
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Stethoscope className="h-5 w-5 text-primary shrink-0" aria-hidden />
          Clinical basics
        </CardTitle>
        <CardDescription>
          They allowed you to update delivery method, total daily dose, and date of birth on their cloud profile. This
          helps other devices stay in sync — it does not replace their diabetes team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadErr ? (
          <Alert variant="destructive">
            <AlertDescription>{loadErr}</AlertDescription>
          </Alert>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="carer-patient-dob">Date of birth</Label>
              <Input
                id="carer-patient-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                data-testid="input-carer-patient-dob"
              />
              <p className="text-xs text-muted-foreground">Optional. Used for age-appropriate guidance in the app.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carer-patient-delivery">Insulin delivery</Label>
              <Select
                value={delivery || "unset"}
                onValueChange={(v) => setDelivery(v === "unset" ? "" : (v as "pen" | "pump"))}
              >
                <SelectTrigger id="carer-patient-delivery" data-testid="select-carer-patient-delivery">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  <SelectItem value="pen">MDI (pens / injections)</SelectItem>
                  <SelectItem value="pump">Insulin pump</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carer-patient-tdd">Total daily dose (units)</Label>
              <Input
                id="carer-patient-tdd"
                type="number"
                min={0}
                step="0.1"
                placeholder="e.g. 40"
                value={tdd}
                onChange={(e) => setTdd(e.target.value)}
                data-testid="input-carer-patient-tdd"
              />
            </div>
            <Button type="button" onClick={() => void onSave()} disabled={saving || !!loadErr} data-testid="button-carer-clinical-save">
              {saving ? "Saving…" : "Save to their profile"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
