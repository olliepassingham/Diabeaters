import * as Sentry from "@sentry/react";

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || "";
const ENV =
  (import.meta.env.VITE_APP_ENV as string | undefined)?.trim() ||
  (import.meta.env.PROD ? "production" : "development");

let initialised = false;

function scrubText(input: string): string {
  // Remove emails and obvious identifiers.
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  return input.replace(emailRegex, "[redacted]");
}

function scrubEvent(event: Sentry.Event): Sentry.Event {
  // Never capture user PII.
  if (event.user) {
    event.user.email = undefined;
    event.user.username = undefined;
    event.user.ip_address = undefined;
  }

  // Reduce request surface.
  if (event.request) {
    event.request.cookies = undefined;
    event.request.data = undefined;
    event.request.headers = undefined;
    if (event.request.url) {
      try {
        const u = new URL(event.request.url);
        event.request.url = u.pathname;
      } catch {
        event.request.url = undefined;
      }
    }
  }

  // Scrub message and exception strings.
  if (event.message) event.message = scrubText(event.message);
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v) => ({
      ...v,
      value: v.value ? scrubText(v.value) : v.value,
    }));
  }

  // Remove potentially sensitive extras.
  event.extra = undefined;

  return event;
}

export function initSentry() {
  if (initialised) return;
  initialised = true;

  if (!DSN) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[Sentry] VITE_SENTRY_DSN not set; Sentry is disabled.");
    }
    return;
  }

  const tracesSampleRate = ENV === "production" ? 0.1 : 0.5;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    tracesSampleRate,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.message) breadcrumb.message = scrubText(breadcrumb.message);
      return breadcrumb;
    },
  });
}

export function setSentryUserId(userId: string | null) {
  if (!DSN) return;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: userId });
}

export function captureException(err: unknown) {
  if (!DSN) return;
  Sentry.captureException(err);
}

