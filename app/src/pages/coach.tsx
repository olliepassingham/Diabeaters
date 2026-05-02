import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";

import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { acceptAiCoachConsent, AI_COACH_CONSENT_VERSION, fetchAiCoachConsentAt } from "@/lib/ai-coach/consent";
import { sendCoachMessage, AiCoachHttpError } from "@/lib/ai-coach/client";
import type { CoachResponse, CoachTurn } from "@/lib/ai-coach/types";

const CHAT_STORAGE_KEY = "diabeater_ai_coach_history_v1";
const MAX_STORED_TURNS = 40;

function loadStoredTurns(): CoachTurn[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is CoachTurn =>
          !!t &&
          typeof t === "object" &&
          (t as CoachTurn).role !== undefined &&
          ((t as CoachTurn).role === "user" || (t as CoachTurn).role === "assistant") &&
          typeof (t as CoachTurn).content === "string",
      )
      .slice(-MAX_STORED_TURNS);
  } catch {
    return [];
  }
}

function saveStoredTurns(turns: CoachTurn[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(turns.slice(-MAX_STORED_TURNS)));
  } catch {
    /* ignore */
  }
}

function coachConsentQueryKey(userId: string | undefined) {
  return ["aiCoachConsent", userId] as const;
}

/** Network failures: see sendCoachMessage try/catch + legacy "Failed to fetch". */
function coachSendErrorMessage(e: unknown): string {
  if (e instanceof AiCoachHttpError) {
    return `${e.message} (${e.status})`;
  }
  if (e instanceof Error && e.message === "Failed to fetch") {
    return [
      "Could not reach the coach service (network).",
      "Deploy the ai_coach Edge Function to this Supabase project.",
      "If VITE_SUPABASE_URL uses localhost, use your computer's LAN IP when testing on a phone or some simulators.",
    ].join(" ");
  }
  if (e instanceof Error) {
    return e.message;
  }
  return "Something went wrong";
}

export default function CoachPage() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<CoachTurn[]>(() =>
    typeof window !== "undefined" ? loadStoredTurns() : [],
  );
  const [draft, setDraft] = useState("");
  const [lastReply, setLastReply] = useState<CoachResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [consentStep, setConsentStep] = useState<0 | 1>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastReply?.reply]);

  const consentQuery = useQuery({
    queryKey: coachConsentQueryKey(user?.id),
    enabled: Boolean(supabase && user?.id),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!supabase || !user?.id) return null;
      return fetchAiCoachConsentAt(supabase, user.id);
    },
  });

  const hasConsent = Boolean(consentQuery.data);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !user?.id) throw new Error("Not signed in");
      const { error } = await acceptAiCoachConsent(supabase, user.id);
      if (error) throw new Error(error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: coachConsentQueryKey(user?.id) });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; history: CoachTurn[] }) => {
      return sendCoachMessage(payload);
    },
    onSuccess: (data) => {
      if (data.category !== "consent_required") {
        setLastReply(data);
      } else {
        setLastReply(null);
      }
      setSendError(null);
    },
    onError: (e: unknown) => {
      setSendError(coachSendErrorMessage(e));
    },
  });

  useEffect(() => {
    saveStoredTurns(messages);
  }, [messages]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sendMutation.isPending || !hasConsent) return;

    const historyForApi = messages;
    setDraft("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLastReply(null);

    try {
      const data = await sendMutation.mutateAsync({ message: text, history: historyForApi });
      if (data.category === "consent_required") {
        setMessages((m) => m.slice(0, -1));
        setDraft(text);
        setConsentStep(0);
        queryClient.setQueryData(coachConsentQueryKey(user?.id), null);
        void queryClient.invalidateQueries({ queryKey: coachConsentQueryKey(user?.id) });
        setSendError(
          "The server has no coach consent on file for your account. Complete “Before you start” again — this is normal right after the coach database migration, or if consent never saved.",
        );
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => m.slice(0, -1));
      setDraft(text);
    }
  }, [draft, hasConsent, messages, queryClient, sendMutation, user?.id]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setLastReply(null);
    setSendError(null);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const intro = useMemo(
    () =>
      "This is an educational coach for adults with type 1 diabetes in the UK. It is not medical advice and it cannot suggest insulin doses, ratios, or targets. Messages are sent to our servers and, when the coach is enabled for your environment, to OpenAI to generate a reply. Do not type anything you would not want a third party to see.",
    [],
  );

  if (!supabase || !user) {
    return (
      <PageShell>
        <PageHeader title="Coach" leading={<PageBackButton />} />
        <p className="text-sm text-muted-foreground">Sign in to use the coach.</p>
      </PageShell>
    );
  }

  if (consentQuery.isLoading) {
    return (
      <PageShell>
        <PageHeader title="Coach" leading={<PageBackButton />} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      </PageShell>
    );
  }

  if (!hasConsent) {
    return (
      <PageShell>
        <PageHeader title="Coach" leading={<PageBackButton />} />
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Before you start</CardTitle>
            <CardDescription>Consent version {AI_COACH_CONSENT_VERSION}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {consentStep === 0 ? (
              <>
                <ul className="list-disc space-y-2 pl-5">
                  <li>The coach explains concepts and helps you prepare questions for your care team.</li>
                  <li>It does not diagnose, prescribe, or recommend medication or device changes.</li>
                  <li>Your chat is stored on this device only. Each message is sent to our API and may be processed by OpenAI when enabled for this deployment.</li>
                  <li>For urgent symptoms, use Help Now or emergency services.</li>
                </ul>
                <Button type="button" onClick={() => setConsentStep(1)}>
                  Continue
                </Button>
              </>
            ) : (
              <>
                <p>{intro}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void acceptMutation.mutateAsync()}
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "I understand and agree"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConsentStep(0)}>
                    Back
                  </Button>
                </div>
                {acceptMutation.isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Could not save consent</AlertTitle>
                    <AlertDescription>
                      {acceptMutation.error instanceof Error
                        ? acceptMutation.error.message
                        : "Please try again."}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Diabeaters coach" leading={<PageBackButton />} />
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Educational only</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            Not medical advice. For urgent symptoms,{" "}
            <Link href="/help-now" className="underline underline-offset-2">
              open Help Now
            </Link>
            .
          </AlertDescription>
        </Alert>

        {sendError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not send</AlertTitle>
            <AlertDescription className="text-xs">{sendError}</AlertDescription>
          </Alert>
        ) : null}

        <div
          className="max-h-[min(28rem,55vh)] space-y-3 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3"
          role="log"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask a general question about type 1 diabetes, or ask how to prepare for a clinic visit. The coach
              cannot suggest doses or interpret your CGM arrows as treatment instructions.
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={
                m.role === "user"
                  ? "ml-8 rounded-lg bg-primary/15 px-3 py-2 text-sm"
                  : "mr-8 rounded-lg bg-background px-3 py-2 text-sm shadow-sm"
              }
            >
              <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
            </div>
          ))}
          {sendMutation.isPending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Thinking…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {lastReply && lastReply.suggestedQuestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {lastReply.suggestedQuestions.map((q) => (
              <Button
                key={q}
                type="button"
                size="sm"
                variant="secondary"
                className="h-auto min-h-9 max-w-full whitespace-normal text-left text-xs font-normal"
                onClick={() => setDraft(q)}
              >
                {q}
              </Button>
            ))}
          </div>
        ) : null}

        {lastReply && lastReply.suggestedNextActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {lastReply.suggestedNextActions.map((a) => (
              <Button key={a.href + a.label} type="button" size="sm" variant="outline" asChild>
                <Link href={a.href}>{a.label}</Link>
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your question…"
            rows={3}
            className="min-h-[5.5rem] flex-1 resize-none"
            disabled={sendMutation.isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <Button
            type="button"
            className="shrink-0"
            onClick={() => void onSend()}
            disabled={sendMutation.isPending || !draft.trim()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" aria-hidden />
                Send
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <button type="button" className="underline underline-offset-2" onClick={clearChat}>
            Delete chat history on this device
          </button>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
