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

