import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Bug, Lightbulb, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { APP_VERSION } from "@/lib/app-version";
import {
  buildFeedbackGmailWebComposeUrl,
  buildFeedbackMailtoHref,
  buildFeedbackRequestText,
  buildFeedbackSubmissionInsert,
  feedbackSubmitUnavailableDescription,
  FEEDBACK_MIN_MESSAGE_LENGTH,
  isFeedbackMessageLongEnough,
  isFeedbackSubmissionsTableUnavailableMessage,
  type FeedbackKind,
} from "@/lib/feedback";
import { getProfileRegion } from "@/lib/region";
import { getSupportEmail } from "@/lib/support";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import {
  SettingsGroup,
  SettingsGroupLabel,
  SettingsPanel,
  SettingsPanelBody,
  SettingsSubPageShell,
} from "./shared";
import { SettingsFeedbackInfoDialog } from "./settings-page-info";

export function SettingsFeedbackRoute() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [message, setMessage] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);

  const profile = storage.getProfile();
  const region = getProfileRegion(profile);
  const supportEmail = getSupportEmail();

  const payload = useMemo(
    () => ({
      kind,
      message,
      appVersion: APP_VERSION,
      region,
      userEmail: user?.email ?? null,
      userId: user?.id ?? null,
      pagePath: typeof window !== "undefined" ? window.location.pathname : "/settings/feedback",
      supportEmail,
    }),
    [kind, message, region, user?.email, user?.id, supportEmail],
  );

  const canSend = isFeedbackMessageLongEnough(message);

  const tooShortHint =
    message.trim().length > 0 && !canSend
      ? `Write at least ${FEEDBACK_MIN_MESSAGE_LENGTH} characters to send (${FEEDBACK_MIN_MESSAGE_LENGTH - message.trim().length} more).`
      : null;

  const handleSubmitInApp = async () => {
    if (!canSend) {
      toast({
        title: "Add a bit more detail",
        description: "Please write at least a sentence so we know what to improve.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id) {
      toast({
        title: "Sign in to send",
        description: "Use the email options below, or sign in and try again.",
        variant: "destructive",
      });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      toast({
        title: "Could not send",
        description: "Auth is not configured on this build. Try the email options below.",
        variant: "destructive",
      });
      return;
    }
    setSubmitBusy(true);
    const { error } = await supabase
      .from("feedback_submissions")
      .insert(
        buildFeedbackSubmissionInsert({
          userId: user.id,
          kind,
          message,
          appVersion: APP_VERSION,
          region,
          userEmail: user.email ?? null,
          pagePath: payload.pagePath,
        }),
      );
    setSubmitBusy(false);
    if (error) {
      const missingTable = isFeedbackSubmissionsTableUnavailableMessage(error.message);
      toast({
        title: missingTable ? "In-app send isn’t available here yet" : "Could not send feedback",
        description: missingTable ? feedbackSubmitUnavailableDescription() : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Thanks — we got it",
      description: "Your feedback was sent to the Diabeaters team.",
    });
    setMessage("");
  };

  const handleCopy = async () => {
    if (!canSend) {
      toast({
        title: "Add a bit more detail",
        description: "Please write at least a sentence so we know what to improve.",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(buildFeedbackRequestText(payload));
      toast({ title: "Copied", description: "Paste into your email app if the buttons below do not open one." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the text in the box and copy manually.",
        variant: "destructive",
      });
    }
  };

  const openMailto = () => {
    if (!canSend) {
      toast({
        title: "Add a bit more detail",
        description: "Please write at least a sentence so we know what to improve.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = buildFeedbackMailtoHref(payload);
  };

  const openGmail = () => {
    if (!canSend) {
      toast({
        title: "Add a bit more detail",
        description: "Please write at least a sentence so we know what to improve.",
        variant: "destructive",
      });
      return;
    }
    window.open(buildFeedbackGmailWebComposeUrl(payload), "_blank", "noopener,noreferrer");
  };

  return (
    <SettingsSubPageShell
      title="Send feedback"
      description="Tell us what is working well and what we should improve next."
      actions={<SettingsFeedbackInfoDialog />}
    >
      <div className="space-y-6">
        <SettingsPanel>
          <SettingsPanelBody className="space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-medium">What kind of feedback is this?</Label>
              <RadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as FeedbackKind)}
                className="grid gap-2 sm:grid-cols-2"
              >
                <label
                  htmlFor="feedback-kind-suggestion"
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem id="feedback-kind-suggestion" value="suggestion" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
                      Suggestion
                    </span>
                    <span className="block text-xs text-muted-foreground">Ideas to make Diabeaters better</span>
                  </span>
                </label>
                <label
                  htmlFor="feedback-kind-bug"
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem id="feedback-kind-bug" value="bug" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Bug className="h-4 w-4 text-primary" aria-hidden />
                      Problem / bug
                    </span>
                    <span className="block text-xs text-muted-foreground">Something broken or confusing</span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-message">Your message</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  kind === "bug"
                    ? "What were you trying to do? What happened instead?"
                    : "What would make Diabeaters more useful for you?"
                }
                className="min-h-[140px] resize-y"
                data-testid="textarea-feedback-message"
              />
              {tooShortHint ? <p className="text-xs text-muted-foreground">{tooShortHint}</p> : null}
              <p className="text-xs text-muted-foreground">
                We automatically attach app version, platform, and region to help us investigate. For urgent medical
                issues, contact your diabetes team or emergency services — not this form.
              </p>
            </div>
          </SettingsPanelBody>
        </SettingsPanel>

        <div>
          <SettingsGroupLabel>Send</SettingsGroupLabel>
          <SettingsGroup>
            <div className="space-y-3 p-3.5 sm:p-4">
              <Button
                type="button"
                className="w-full min-h-11"
                disabled={!canSend || submitBusy}
                onClick={() => void handleSubmitInApp()}
                data-testid="button-feedback-send"
              >
                <Send className="mr-2 h-4 w-4" aria-hidden />
                {submitBusy ? "Sending…" : "Send feedback"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Sends in the app — no email client needed. You can also use email below.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11"
                disabled={!canSend}
                onClick={openMailto}
                data-testid="button-feedback-send-mail"
              >
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                Send via email app
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!canSend}
                  onClick={openGmail}
                  data-testid="button-feedback-open-gmail"
                >
                  Open in Gmail
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!canSend}
                  onClick={() => void handleCopy()}
                  data-testid="button-feedback-copy"
                >
                  Copy message
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Email fallback:{" "}
                <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
                . Need help? See{" "}
                <Link href="/support" className="text-primary underline-offset-2 hover:underline">
                  Support
                </Link>
                .
              </p>
            </div>
          </SettingsGroup>
        </div>
      </div>
    </SettingsSubPageShell>
  );
}
