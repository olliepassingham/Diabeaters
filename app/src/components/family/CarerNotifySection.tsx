/**
 * Patient UI: manage `public.carers` rows (push token or in-app carer user id).
 * Single source of truth for hypo alert targets — not duplicated in profile or localStorage.
 */
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabase";
import { deleteCarer, insertCarer, listPatientCarers, updateCarer } from "@/lib/carers-table";
import type { CarerRow } from "@/lib/carer-notify-types";

export function CarerNotifySection() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CarerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [method, setMethod] = useState<"push" | "inapp">("inapp");
  const [contactValue, setContactValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listPatientCarers();
    if (error) {
      setRows([]);
      if (getSupabase()) {
        toast({ title: "Could not load notify list", description: error.message, variant: "destructive" });
      }
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCarer = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await insertCarer({
      carer_name: name.trim(),
      relationship: relationship.trim() || undefined,
      contact_method: method,
      contact_value: contactValue.trim(),
      receive_hypo_alerts: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not add", description: error.message, variant: "destructive" });
      return;
    }
    setName("");
    setRelationship("");
    setContactValue("");
    toast({ title: "Carer added", description: "They can receive hypo alerts when you log a treatment." });
    await load();
  };

  if (!getSupabase()) {
    return null;
  }

  return (
    <Card data-testid="card-carer-notify-list">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary shrink-0" />
          Hypo alert contacts
        </CardTitle>
        <CardDescription>
          Add people to notify when you use &quot;Treated a Hypo&quot; on the dashboard. Use <strong>in-app</strong> with
          the carer&apos;s Diabeaters account user ID (UUID), or <strong>push</strong> with their device token when your
          project has a push API configured for the Edge Function.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="notify-carers-empty">
            No alert contacts yet. Add one below — this list is stored only in your cloud account.
          </p>
        ) : (
          <ul className="space-y-4" data-testid="notify-carers-list">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{r.carer_name}</p>
                  {r.relationship ? <p className="text-xs text-muted-foreground">{r.relationship}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {r.contact_method === "push" ? "Push" : "In-app"} · {r.contact_value || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={r.receive_hypo_alerts}
                      onCheckedChange={async (on) => {
                        const { error: err } = await updateCarer(r.id, { receive_hypo_alerts: on });
                        if (err) {
                          toast({ title: "Update failed", description: err.message, variant: "destructive" });
                          return;
                        }
                        await load();
                      }}
                      aria-label={`Hypo alerts for ${r.carer_name}`}
                    />
                    <span className="text-xs text-muted-foreground">Alerts on</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Remove ${r.carer_name}`}
                    onClick={async () => {
                      const { error: err } = await deleteCarer(r.id);
                      if (err) {
                        toast({ title: "Could not remove", description: err.message, variant: "destructive" });
                        return;
                      }
                      await load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Add contact</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-carer-name">Name</Label>
              <Input
                id="new-carer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mum"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-carer-rel">Relationship (optional)</Label>
              <Input
                id="new-carer-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. Parent"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Contact method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as "push" | "inapp")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inapp">In-app (carer user ID)</SelectItem>
                <SelectItem value="push">Push (device token)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-carer-contact">
              {method === "inapp" ? "Carer user ID (UUID)" : "Push token"}
            </Label>
            <Input
              id="new-carer-contact"
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              placeholder={method === "inapp" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : "FCM / APNs token"}
              className="font-mono text-sm"
            />
          </div>
          <Button type="button" onClick={() => void addCarer()} disabled={saving}>
            {saving ? "Saving…" : "Add to notify list"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
