import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { leaveCarerLink } from "@/lib/carers";
import {
  invalidateCarerLinkQueries,
  linkedPatientQueryKey,
  linkedPatientsQueryKey,
} from "@/lib/carer-link-query";
import {
  canSwitchAppMode,
  clearActiveCarerPatientId,
  setActiveAppMode,
  setActiveCarerPatientId,
} from "@/lib/carer-session";
import { localIndicatesPatientAccount } from "@/lib/community-path-patient-reconcile";
import { nextSupportedPerson } from "@/lib/supporter-leave";
import type { LinkedPatientInfo, LinkedPatientWithProfile } from "@/lib/carers.types";

function firstName(label: string): string {
  return label.trim().split(/\s+/)[0] || label;
}

export function SupporterStopSupporting({
  userId,
  linkId,
  displayName,
  people,
  onSwitched,
}: {
  userId: string;
  linkId: string;
  displayName: string;
  people: readonly LinkedPatientWithProfile[];
  onSwitched: (nextPatientId: string | null) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const shortName = firstName(displayName);
  const others = people.filter((person) => person.linkId !== linkId);
  const otherName = others.length === 1 ? firstName(others[0]?.patient_full_name?.trim() || "The other person") : null;

  const confirm = async () => {
    setBusy(true);
    const { error } = await leaveCarerLink(linkId);
    setBusy(false);
    if (error) {
      toast({ title: "Could not stop supporting", description: error.message, variant: "destructive" });
      return;
    }

    const next = nextSupportedPerson(people, linkId);
    const remaining = people.filter((person) => person.linkId !== linkId);
    queryClient.setQueryData(linkedPatientsQueryKey(userId), remaining);
    const nextInfo: LinkedPatientInfo | null = next
      ? { linkId: next.linkId, patientId: next.patientId, carerId: next.carerId, scopes: next.scopes }
      : null;
    queryClient.setQueryData(linkedPatientQueryKey(userId), nextInfo);
    void invalidateCarerLinkQueries(queryClient, userId);

    setOpen(false);
    toast({
      title: `Stopped supporting ${shortName}`,
      description: otherName ? `${otherName} stays linked.` : others.length > 1 ? "Your other links stay in place." : "You no longer see what they share.",
    });

    if (next) {
      setActiveCarerPatientId(next.patientId);
      onSwitched(next.patientId);
      return;
    }

    clearActiveCarerPatientId();
    onSwitched(null);
    if (canSwitchAppMode() || localIndicatesPatientAccount()) {
      setActiveAppMode("patient");
      setLocation("/");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full text-base font-medium text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid="button-stop-supporting"
      >
        Stop supporting {shortName}
      </Button>
      <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!busy) setOpen(nextOpen); }}>
        <AlertDialogContent data-testid="dialog-stop-supporting">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Stop supporting {displayName}?</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              You will stop seeing what they share. Reminders for them stop. They can invite you again.
              {otherName ? ` ${otherName} stays linked.` : null}
              {others.length > 1 ? " Your other links stay in place." : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-base" disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full text-base sm:w-auto"
              disabled={busy}
              onClick={() => void confirm()}
              data-testid="button-stop-supporting-confirm"
            >
              {busy ? "Stopping…" : "Stop supporting"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
