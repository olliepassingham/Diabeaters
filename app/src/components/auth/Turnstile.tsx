import { useCallback, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

type Props = {
  siteKey: string;
  onToken: (token: string | null) => void;
  onWidgetError?: () => void;
};

export function TurnstileCaptcha({ siteKey, onToken, onWidgetError }: Props) {
  return (
    <div data-testid="turnstile">
      <Turnstile
        siteKey={siteKey}
        options={{
          retry: "auto",
          refreshExpired: "auto",
          size: "flexible",
        }}
        onSuccess={(token: string) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => {
          onToken(null);
          onWidgetError?.();
        }}
      />
    </div>
  );
}

export function useTurnstileCaptcha() {
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
  const required = Boolean(siteKey);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const reset = useCallback(() => {
    setToken(null);
    setLoadError(false);
    setResetKey((k) => k + 1);
  }, []);

  const onWidgetError = useCallback(() => {
    setToken(null);
    setLoadError(true);
  }, []);

  return {
    siteKey,
    required,
    token,
    setToken,
    resetKey,
    reset,
    loadError,
    onWidgetError,
  };
}

export function AuthCaptcha({
  captcha,
}: {
  captcha: ReturnType<typeof useTurnstileCaptcha>;
}) {
  if (!captcha.required) return null;
  return (
    <div className="space-y-2">
      <TurnstileCaptcha
        key={captcha.resetKey}
        siteKey={captcha.siteKey}
        onToken={captcha.setToken}
        onWidgetError={captcha.onWidgetError}
      />
      {captcha.loadError ? (
        <p className="text-xs text-muted-foreground">
          The security check did not load.{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2"
            onClick={captcha.reset}
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
