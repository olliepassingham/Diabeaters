import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Info, Loader2, Send } from "lucide-react";

import { chatThreadScrollClasses } from "@/components/chat-thread-scenery";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getPatientClinicalPrefsForCarer } from "@/lib/carers";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { getAgeBand } from "@/lib/user-age";
import { acceptAiCoachConsent, AI_COACH_CONSENT_VERSION, fetchAiCoachConsentAt } from "@/lib/ai-coach/consent";
import { sendCoachMessage, AiCoachHttpError } from "@/lib/ai-coach/client";
import { captureAiCoachSendFailure } from "@/observability/sentry";
import type { CoachAudience, CoachResponse, CoachTurn } from "@/lib/ai-coach/types";
import { describeCoachProfileVisibility } from "@/lib/ai-coach/contextSummary";
import { syncClinicalPrefsToCloud } from "@/lib/clinical-prefs-cloud-sync";
import { getCoachTopicConfig, normalizeCoachTopicParam } from "@/lib/ai-coach/topics";
import {
  AI_ASSISTANT_NAME,
  coachPageSubtitle,
  coachPageTitle,
  coachSupporterTopicScopeHint,
} from "@/lib/ai-coach/persona";
import { recordLastInteraction } from "@/lib/last-interaction";
import { cn } from "@/lib/utils";

function normalizeAudience(raw: string | null | undefined): CoachAudience {
  if (raw == null) return "patient";
  const v = raw.trim().toLowerCase();
  return v === "supporter" ? "supporter" : "patient";
}

const CHAT_STORAGE_KEY_V1 = "diabeater_ai_coach_history_v1";
const CHAT_STORAGE_KEY_V2 = "diabeater_ai_coach_history_v2";
const MAX_STORED_TURNS = 40;
/** Clear thread after this long with no new messages (local device clock). */
const CHAT_IDLE_RESET_MS = 2 * 60 * 60 * 1000;

type CoachStoredState = { lastActiveAt: number; turns: CoachTurn[] };

function normalizeTurns(raw: unknown): CoachTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t): t is CoachTurn =>
        !!t &&
        typeof t === "object" &&
        (t as CoachTurn).role !== undefined &&
        ((t as CoachTurn).role === "user" || (t as CoachTurn).role === "assistant") &&
        typeof (t as CoachTurn).content === "string",
    )
    .slice(-MAX_STORED_TURNS);
}

function loadInitialMessages(): CoachTurn[] {
  if (typeof window === "undefined") return [];
  const now = Date.now();
  try {
    const v2raw = localStorage.getItem(CHAT_STORAGE_KEY_V2);
    if (v2raw) {
      const parsed = JSON.parse(v2raw) as unknown;
      if (parsed && typeof parsed === "object") {
        const lastActiveAt = Number((parsed as CoachStoredState).lastActiveAt);
        const turns = normalizeTurns((parsed as CoachStoredState).turns);
        if (Number.isFinite(lastActiveAt) && now - lastActiveAt > CHAT_IDLE_RESET_MS && turns.length > 0) {
          const cleared: CoachStoredState = { turns: [], lastActiveAt: now };
          localStorage.setItem(CHAT_STORAGE_KEY_V2, JSON.stringify(cleared));
          return [];
        }
        if (Number.isFinite(lastActiveAt)) return turns;
      }
    }
    const v1raw = localStorage.getItem(CHAT_STORAGE_KEY_V1);
    if (v1raw) {
      const turns = normalizeTurns(JSON.parse(v1raw) as unknown);
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY_V1);
      } catch {
        /* ignore */
      }
      const migrated: CoachStoredState = { turns, lastActiveAt: now };
      localStorage.setItem(CHAT_STORAGE_KEY_V2, JSON.stringify(migrated));
      return turns;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveStoredCoachState(turns: CoachTurn[]) {
  try {
    const state: CoachStoredState = {
      lastActiveAt: Date.now(),
      turns: turns.slice(-MAX_STORED_TURNS),
    };
    localStorage.setItem(CHAT_STORAGE_KEY_V2, JSON.stringify(state));
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
      "Could not reach the chat service (network).",
      "Deploy the ai_coach Edge Function to this Supabase project.",
      "If VITE_SUPABASE_URL uses localhost, use your computer's LAN IP when testing on a phone or some simulators.",
    ].join(" ");
  }
  if (e instanceof Error) {
    return e.message;
  }
  return "Something went wrong";
}

function CoachDisclaimerFooter({
  isSupporter,
  effectiveTopic,
  topicLabel,
  topicHint,
  onClearChat,
}: {
  isSupporter: boolean;
  effectiveTopic: string;
  topicLabel: string;
  topicHint: string | null;
  onClearChat: () => void;
}) {
  return (
    <details className="group shrink-0 rounded-xl border border-border/40 bg-muted/10 text-[11px] leading-relaxed text-muted-foreground dark:bg-muted/5">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-foreground/90 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>Disclaimer & about this chat</span>
          </span>
          <span className="shrink-0 text-[10px] font-normal text-muted-foreground group-open:hidden">Show</span>
          <span className="hidden shrink-0 text-[10px] font-normal text-muted-foreground group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2">
        <p>{coachPageSubtitle(isSupporter ? "supporter" : "patient")}</p>
        {effectiveTopic !== "general" && topicHint ? (
          <p>
            <span className="font-medium text-foreground">Topic · {topicLabel}</span>
            <br />
            <span className="mt-1 inline-block">{topicHint}</span>
          </p>
        ) : null}
        <p>
          <span className="font-medium uppercase tracking-wide text-foreground/90">Educational only</span>
          {" · "}
          Not medical advice or dosing. For urgent symptoms,{" "}
          <Link href="/help-now" className="font-medium text-foreground underline underline-offset-2">
            open Help Now
          </Link>
          .
        </p>
        <p>Chat clears on this device after about 2 hours without a new message.</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={onClearChat}>
            Delete chat history
          </button>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
            Privacy
          </Link>
        </div>
      </div>
    </details>
  );
}

export default function CoachPage() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const search = useSearch();

  const audience = useMemo<CoachAudience>(
    () => normalizeAudience(new URLSearchParams(search).get("audience")),
    [search],
  );
  const isSupporter = audience === "supporter";
  const topicSlug = useMemo(() => normalizeCoachTopicParam(new URLSearchParams(search).get("topic")), [search]);
  const effectiveTopic = topicSlug ?? (isSupporter ? "supporter" : "general");
  const topicCfg = useMemo(() => getCoachTopicConfig(effectiveTopic), [effectiveTopic]);
  const starterContext = useMemo(() => buildCoachStarterContext(), []);
  const displayedStarters = useMemo(
    () => pickCoachStarterPrompts(effectiveTopic, starterContext, { userId: user?.id }),
    [effectiveTopic, starterContext, user?.id],
  );
  const pageTitle = coachPageTitle(isSupporter ? "supporter" : "patient");

  const { linked, isCarer } = useLinkedCarer();

  const patientDobForSupporterCoach = useQuery({
    queryKey: ["coachSupporterPatientDob", linked?.patientId],
    enabled: Boolean(isSupporter && supabase && user?.id && isCarer && linked?.patientId),
    queryFn: async () => {
      const r = await getPatientClinicalPrefsForCarer(linked!.patientId);
      if (r.error) throw r.error;
      return r.data?.date_of_birth ?? null;
    },
    staleTime: 60_000,
  });

  const supportedPersonAgeBand = useMemo(() => {
    if (!isSupporter) return "adult";
    if (isCarer && linked?.patientId) {
      if (patientDobForSupporterCoach.isPending) return "unknown";
      if (patientDobForSupporterCoach.isError) return "unknown";
      return getAgeBand(patientDobForSupporterCoach.data ?? null);
    }
    return getAgeBand(storage.getProfile()?.dateOfBirth);
  }, [
    isSupporter,
    isCarer,
    linked?.patientId,
    patientDobForSupporterCoach.isPending,
    patientDobForSupporterCoach.isError,
    patientDobForSupporterCoach.data,
  ]);

  const supporterTopicScopeHintText = useMemo(() => {
    if (!isSupporter) return "";
    return coachSupporterTopicScopeHint(supportedPersonAgeBand);
  }, [isSupporter, supportedPersonAgeBand]);

  const [messages, setMessages] = useState<CoachTurn[]>(() => loadInitialMessages());
  const [draft, setDraft] = useState("");
  const qSeededRef = useRef(false);
  const [lastReply, setLastReply] = useState<CoachResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [consentStep, setConsentStep] = useState<0 | 1>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastReply?.reply]);

  const qParam = useMemo(() => {
    const raw = new URLSearchParams(search).get("q");
    if (raw == null) return "";
    try {
      return decodeURIComponent(raw).trim().slice(0, 500);
    } catch {
      return raw.trim().slice(0, 500);
    }
  }, [search]);

  useLayoutEffect(() => {
    if (qSeededRef.current) return;
    if (!qParam) return;
    setDraft(qParam);
    qSeededRef.current = true;
  }, [qParam]);

  const consentQuery = useQuery({
    queryKey: coachConsentQueryKey(user?.id),
    enabled: Boolean(supabase && user?.id),
    staleTime: 0,
    // Avoid showing the main chat from stale cache while a refetch is in flight (e.g. after
    // `refetchOnMount: "always"` we could briefly treat old consent as still valid).
    gcTime: 0,
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

  const [retryableMessage, setRetryableMessage] = useState<string | null>(null);
  const sendAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      sendAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!user?.id || isSupporter) return;
    void syncClinicalPrefsToCloud(user.id);
  }, [user?.id, isSupporter]);

  const sendMutation = useMutation({
    mutationFn: async (payload: {
      message: string;
      history: CoachTurn[];
      audience: CoachAudience;
      signal: AbortSignal;
    }) => {
      return sendCoachMessage({
        message: payload.message,
        history: payload.history,
        audience: payload.audience,
        signal: payload.signal,
      });
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
      if (e instanceof DOMException && e.name === "AbortError") return;
      setSendError(coachSendErrorMessage(e));
      if (e instanceof AiCoachHttpError) {
        captureAiCoachSendFailure({ errorType: "http", status: e.status, detail: e.message });
      } else if (e instanceof Error && e.message.includes("Could not reach the Beatie service")) {
        captureAiCoachSendFailure({ errorType: "network", detail: e.message });
      } else {
        captureAiCoachSendFailure({
          errorType: "unknown",
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    },
  });

  useEffect(() => {
    saveStoredCoachState(messages);
  }, [messages]);

  const sendCoachTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendMutation.isPending || !hasConsent) return;

      sendAbortRef.current?.abort();
      const ac = new AbortController();
      sendAbortRef.current = ac;

      setSendError(null);
      const historyForApi = messages;
      setDraft("");
      setMessages((m) => [...m, { role: "user", content: trimmed }]);
      setLastReply(null);
      setRetryableMessage(null);

      try {
        const data = await sendMutation.mutateAsync({
          message: trimmed,
          history: historyForApi,
          audience,
          signal: ac.signal,
        });
        if (data.category === "consent_required") {
          setMessages((m) => m.slice(0, -1));
          setDraft(trimmed);
          setConsentStep(0);
          queryClient.setQueryData(coachConsentQueryKey(user?.id), null);
          void queryClient.invalidateQueries({ queryKey: coachConsentQueryKey(user?.id) });
          setSendError(
            `The server has no ${AI_ASSISTANT_NAME} consent on file for your account. Complete “Before you start” again — this is normal right after a consent update on the server, or if consent never saved.`,
          );
          setRetryableMessage(null);
          return;
        }
        recordLastInteraction("coach");
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setMessages((m) => m.slice(0, -1));
          setDraft(trimmed);
          return;
        }
        setMessages((m) => m.slice(0, -1));
        setDraft(trimmed);
        setRetryableMessage(trimmed);
      }
    },
    [audience, hasConsent, messages, queryClient, sendMutation, user?.id],
  );

  const onSend = useCallback(() => {
    void sendCoachTurn(draft);
  }, [draft, sendCoachTurn]);

  const onRetrySend = useCallback(() => {
    const t = retryableMessage?.trim();
    if (!t || sendMutation.isPending || !hasConsent) return;
    setSendError(null);
    void sendCoachTurn(t);
  }, [hasConsent, retryableMessage, sendCoachTurn, sendMutation.isPending]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setLastReply(null);
    setSendError(null);
    setRetryableMessage(null);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY_V2);
      localStorage.removeItem(CHAT_STORAGE_KEY_V1);
    } catch {
      /* ignore */
    }
  }, []);

  const intro = useMemo(
    () =>
      `${AI_ASSISTANT_NAME} is an educational guide for people with type 1 diabetes in the UK, including teenagers when they use the app with their team and family. This is not medical advice and it cannot suggest insulin doses, ratios, or targets. Messages are sent to our servers and, when the guide is enabled for your environment, to OpenAI to generate a reply. Do not type anything you would not want a third party to see.`,
    [],
  );

  const profileVisibility = useMemo(() => {
    if (isSupporter) return null;
    return describeCoachProfileVisibility();
  }, [isSupporter]);

  const headerDescription = isSupporter ? (
    "Education for supporters — UK type 1 diabetes"
  ) : (
    <span className="block space-y-1">
      <span>Education & clinic-prep — UK type 1 diabetes</span>
      {profileVisibility ? (
        <span className="block text-[11px] font-normal leading-snug text-muted-foreground" data-testid="coach-profile-visibility">
          {profileVisibility}
        </span>
      ) : null}
    </span>
  );

  const topicHint = useMemo(() => {
    if (effectiveTopic === "general") return null;
    if (isSupporter) {
      return effectiveTopic === "supporter" ? supporterTopicScopeHintText : topicCfg.emptyHint;
    }
    return topicCfg.emptyHint;
  }, [effectiveTopic, isSupporter, supporterTopicScopeHintText, topicCfg.emptyHint]);

  if (!supabase || !user) {
    return (
      <PageShell density="compact" className="pb-4">
        <PageHeader title={pageTitle} leading={<PageBackButton />} />
        <Card className="border-border/60">
          <CardContent className="flex gap-3 pt-6">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in to chat with {AI_ASSISTANT_NAME}.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (consentQuery.isLoading) {
    return (
      <PageShell density="compact" className="pb-4">
        <PageHeader title={pageTitle} leading={<PageBackButton />} />
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Loading…
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!hasConsent) {
    return (
      <PageShell density="compact" className="pb-4">
        <PageHeader title={pageTitle} leading={<PageBackButton />} />
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Before you start</CardTitle>
            <CardDescription>Consent version {AI_COACH_CONSENT_VERSION}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {consentStep === 0 ? (
              <>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    {AI_ASSISTANT_NAME} explains concepts and helps you prepare questions for your care team.
                  </li>
                  <li>It does not diagnose, prescribe, or recommend medication or device changes.</li>
                  <li>
                    Your chat is stored on this device only and clears automatically after about 2 hours with no new
                    messages. Each message is sent to our API and may be processed by OpenAI when enabled for this
                    deployment.
                  </li>
                  <li>
                    To personalise answers safely, the server may attach small <strong>aggregates</strong> from your
                    account when you have synced them: for example counts from your hypo log (last 14 days), supply
                    rows (category and stock level only), and whether sick-day or travel mode is on (from guide
                    settings, booleans only). It does not send free-text notes, treatment wording, supply display names,
                    or destinations to the model.
                  </li>
                  <li>For urgent symptoms, use Help Now or emergency services.</li>
                  {isSupporter ? (
                    <li>
                      This is general education for someone supporting a person with T1D in the UK; it is
                      not personal medical advice for them.
                    </li>
                  ) : null}
                </ul>
                <Button type="button" onClick={() => setConsentStep(1)}>
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Alert className="border-border/60 bg-muted/20">
                  <Info className="h-4 w-4" aria-hidden />
                  <AlertTitle className="text-foreground">How replies are generated</AlertTitle>
                  <AlertDescription className="text-muted-foreground">{intro}</AlertDescription>
                </Alert>
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
    <div
      className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col bg-background text-foreground"
      data-testid="coach-chat-shell"
    >
      <div
        className={chatThreadScrollClasses(
          "shrink-0 border-b border-border/40 px-4 pb-3 pt-2 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]",
        )}
      >
        <PageHeader title={pageTitle} description={headerDescription} leading={<PageBackButton />} />
      </div>

      {sendError ? (
        <Alert variant="destructive" className="mx-4 mt-2 shrink-0 py-2">
          <AlertTitle className="text-sm">Could not send</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 flex-1">{sendError}</span>
            {retryableMessage?.trim() ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 shrink-0 self-start sm:self-center"
                disabled={sendMutation.isPending}
                onClick={() => void onRetrySend()}
              >
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={chatThreadScrollClasses(
          "min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-3 sm:px-5",
        )}
        role="log"
        aria-live="polite"
        aria-label={`Chat with ${AI_ASSISTANT_NAME}`}
      >
        {messages.length === 0 && displayedStarters.length > 0 ? (
          <div className="mb-4 flex w-full min-w-0 flex-col gap-2.5" role="group" aria-label="Suggested prompts">
            <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested questions
            </p>
            {displayedStarters.map((q) => (
              <button
                key={q}
                type="button"
                className="w-full rounded-2xl border border-border/50 bg-card/80 px-4 py-3.5 text-left text-sm leading-snug text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-card active:scale-[0.99]"
                onClick={() => void sendCoachTurn(q)}
                disabled={sendMutation.isPending}
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={cn(
                "max-w-[90%] text-[15px] leading-relaxed shadow-sm",
                m.role === "user"
                  ? "ml-auto self-end rounded-[1.25rem] rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground"
                  : "mr-auto self-start rounded-[1.25rem] rounded-bl-md border border-border/40 bg-card px-3.5 py-2.5 text-card-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}

          {sendMutation.isPending ? (
            <div className="mr-auto flex max-w-[90%] items-center gap-2 rounded-[1.25rem] rounded-bl-md border border-border/40 bg-card/80 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>{AI_ASSISTANT_NAME} is thinking…</span>
            </div>
          ) : null}
        </div>

        {lastReply && lastReply.suggestedNextActions.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-border/50 bg-muted/15 p-3 dark:bg-muted/10" data-testid="coach-suggested-actions">
            <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Open in the app
            </p>
            <div className="flex flex-col gap-1.5">
              {lastReply.suggestedNextActions.map((a) => (
                <Button
                  key={`${a.href}-${a.label}`}
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-10 w-full justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-normal"
                  asChild
                >
                  <Link href={a.href} className="flex w-full min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 leading-snug">{a.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} className="h-2 shrink-0" aria-hidden />
      </div>

      <div className="z-10 shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-xl">
        {lastReply && lastReply.suggestedQuestions.length > 0 ? (
          <div className="space-y-2 border-b border-border/40 px-4 pb-2.5 pt-2.5">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Try asking next
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {lastReply.suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="shrink-0 max-w-[85%] rounded-full border border-border/50 bg-card px-3 py-2 text-left text-xs leading-snug text-foreground shadow-sm transition-colors hover:border-primary/30"
                  onClick={() => setDraft(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="px-3 py-2.5 pb-[calc(max(0.5rem,env(safe-area-inset-bottom,0px))+var(--keyboard-inset-bottom,0px))]">
          <div className="flex items-end gap-2 rounded-[1.75rem] border border-border/50 bg-muted/35 p-1.5 pl-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your question…"
              rows={1}
              className="min-h-10 max-h-32 flex-1 resize-none border-0 bg-transparent px-0 py-2.5 text-[16px] leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
              size="icon"
              className={cn(
                "h-10 w-10 shrink-0 rounded-full transition-all",
                draft.trim() ? "shadow-md" : "opacity-50",
              )}
              onClick={() => void onSend()}
              disabled={sendMutation.isPending || !draft.trim()}
              aria-label="Send message"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>

          <div className="mt-2">
            <CoachDisclaimerFooter
              isSupporter={isSupporter}
              effectiveTopic={effectiveTopic}
              topicLabel={topicCfg.label}
              topicHint={topicHint}
              onClearChat={clearChat}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
