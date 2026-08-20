import { useCallback, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

type Props = {
  siteKey: string;
  onToken: (token: string | null) => void;
};

export function TurnstileCaptcha({ siteKey, onToken }: Props) {
  return (
    <div data-testid="turnstile">
      <Turnstile
        siteKey={siteKey}
        onSuccess={(token: string) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
}

export function useTurnstileCaptcha() {
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
  const required = Boolean(siteKey);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setResetKey((k) => k + 1);
  }, []);

  return { siteKey, required, token, setToken, resetKey, reset };
}
